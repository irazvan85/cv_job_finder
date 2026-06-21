/**
 * Express app factory — shared by the local server (server.js) and the
 * Vercel serverless function (api/index.js).
 *
 * Routes:
 *   POST /api/parse      multipart upload field "cv" → { profile, analysis }
 *   POST /api/search     JSON { profile, filters, demo } → { jobs, ... }
 *   POST /api/match      multipart "cv" (+ optional "demo=1") — parse+search
 *                        in one call (kept for backward compatibility)
 *   POST /api/demand     JSON { city, country, demo } → top in-demand roles
 *                        in that city across all platforms (no CV needed)
 *   GET  /api/insights/romania  Romania job-market insights: city profiles,
 *                        sector outlook, salary benchmarks, career tips
 *   GET  /api/providers  provider list with configuration status
 *
 * "analysis" (src/matching/jobAreas.js) is a deterministic CV analysis:
 * detected strengths grouped by domain, CV completeness gaps, and ranked
 * job-area recommendations with example titles — derived purely from the
 * skills/titles already extracted by the parser, no external calls.
 *
 * The two-step parse/search split lets the UI show the parsed profile and
 * let the user refine the search (keywords, skills, target countries)
 * before any job board is queried.
 */

import express from 'express';
import multer from 'multer';
import { parseEuropassCv } from './europass/parser.js';
import { searchAllProviders, ALL_PROVIDERS } from './providers/index.js';
import { rankJobs } from './matching/scorer.js';
import { analyseCv } from './matching/jobAreas.js';
import { topDemandedJobs } from './matching/demand.js';
import roInsights from './insights/romania.js';

// Vercel rejects request bodies over ~4.5 MB before they reach the
// function, so a larger multer limit would never be exercised there.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export function createApp() {
  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
  });
  app.use(express.json({ limit: '2mb' }));

  // Static Romania market-insight data (city profiles, sector outlook,
  // salary benchmarks, career tips). Served as JSON so the client can
  // render it without re-fetching; the data changes with each research
  // update to the insights module, not per-request.
  app.get('/api/insights/romania', (_req, res) => {
    res.json(roInsights);
  });

  app.get('/api/providers', (_req, res) => {
    res.json(
      ALL_PROVIDERS.map((p) => ({
        id: p.id,
        name: p.name,
        requiresKey: p.requiresKey,
        configured: p.isConfigured(),
      }))
    );
  });

  // Step 1: parse an uploaded CV into a profile (no job boards queried).
  app.post('/api/parse', upload.single('cv'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No CV file uploaded. Send it as multipart field "cv".' });
      }
      const profile = await parseEuropassCv(req.file.buffer, req.file.originalname);
      if (!profile.skills.length && !profile.jobTitles.length) {
        return res.status(422).json({
          error:
            'Could not extract any skills or job titles from this file. ' +
            'Make sure it is a Europass CV (XML, JSON, or an official Europass PDF).',
          profile,
        });
      }
      res.json({ profile, analysis: analyseCv(profile) });
    } catch (err) {
      res.status(500).json({ error: `Failed to process CV: ${err.message}` });
    }
  });

  // Step 2: search job boards for a (possibly user-refined) profile.
  app.post('/api/search', async (req, res) => {
    try {
      const profile = normaliseProfile(req.body && req.body.profile);
      if (!profile) {
        return res.status(400).json({ error: 'Missing or invalid "profile" in request body.' });
      }
      const filters = sanitiseFilters(req.body && req.body.filters);
      const demoMode = req.body.demo === true || req.body.demo === '1' || process.env.DEMO === '1';
      const { jobs, providerStatus } = await searchAllProviders(profile, { demoMode, filters });
      const ranked = rankJobs(profile, jobs);
      res.json({ profile, jobs: ranked, providerStatus, demoMode });
    } catch (err) {
      res.status(500).json({ error: `Search failed: ${err.message}` });
    }
  });

  // Backward-compatible one-shot: parse the upload and search in one call.
  app.post('/api/match', upload.single('cv'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No CV file uploaded. Send it as multipart field "cv".' });
      }
      const profile = await parseEuropassCv(req.file.buffer, req.file.originalname);
      if (!profile.skills.length && !profile.jobTitles.length) {
        return res.status(422).json({
          error:
            'Could not extract any skills or job titles from this file. ' +
            'Make sure it is a Europass CV (XML, JSON, or an official Europass PDF).',
          profile,
        });
      }
      const demoMode = req.body.demo === '1' || process.env.DEMO === '1';
      const { jobs, providerStatus } = await searchAllProviders(profile, { demoMode });
      const ranked = rankJobs(profile, jobs);
      res.json({ profile, analysis: analyseCv(profile), jobs: ranked, providerStatus, demoMode });
    } catch (err) {
      res.status(500).json({ error: `Failed to process CV: ${err.message}` });
    }
  });

  // Market insight: the most in-demand roles in a given city, aggregated
  // across every available platform — no CV required. We query the boards
  // using the city as the keyword (so each board returns the diverse roles
  // located there), filter the results to that city, then group the
  // vacancies by canonical job title and rank them by count.
  app.post('/api/demand', async (req, res) => {
    try {
      const city = str(req.body && req.body.city).trim();
      if (!city) {
        return res.status(400).json({ error: 'Missing "city" in request body.' });
      }
      const countryCode = str(req.body && req.body.country).toLowerCase().slice(0, 2);
      const limit = Math.min(25, Math.max(1, Number(req.body && req.body.limit) || 10));
      const demoMode = req.body.demo === true || req.body.demo === '1' || process.env.DEMO === '1';

      const profile = cityProfile(city, countryCode);
      const filters = countryCode ? { countries: [countryCode] } : {};
      const { jobs, providerStatus } = await searchAllProviders(profile, {
        demoMode,
        limitPerProvider: 50,
        filters,
      });
      const demand = topDemandedJobs(jobs, { city, limit });
      res.json({ city, country: countryCode, demand, providerStatus, demoMode });
    } catch (err) {
      res.status(500).json({ error: `Demand lookup failed: ${err.message}` });
    }
  });

  // Multer errors (e.g. file too large) would otherwise fall through to the
  // default HTML error page; keep the API JSON-only.
  app.use((err, _req, res, next) => {
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      const detail =
        err.code === 'LIMIT_FILE_SIZE'
          ? `CV file exceeds the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB upload limit.`
          : err.message;
      return res.status(status).json({ error: detail });
    }
    next(err);
  });

  return app;
}

const str = (v) => (v == null ? '' : String(v));
const arr = (v) => (Array.isArray(v) ? v : []);

/**
 * A minimal CV-profile-shaped object that steers the providers towards a
 * city: the city becomes the search keyword (so keyword-driven boards return
 * the roles located there) and the home market, so country-aware boards
 * (EURES, Adzuna) query the right country.
 */
function cityProfile(city, countryCode) {
  return {
    name: '', email: '', phone: '',
    location: { city, country: '', countryCode: (countryCode || '').toUpperCase() },
    headline: '',
    searchKeywords: city,
    jobTitles: [],
    skills: [],
    languages: [],
    education: [],
    experience: [],
    totalExperienceYears: 0,
    seniority: 'mid',
    rawText: '',
    sourceFormat: '',
  };
}

/**
 * Coerce a client-supplied profile (from /api/parse, possibly edited in the
 * refine panel) into the shape the matching engine expects. Keeps only the
 * fields we use and applies sane defaults so a malformed body can't throw.
 */
function normaliseProfile(p) {
  if (!p || typeof p !== 'object') return null;
  const loc = p.location || {};
  return {
    name: str(p.name),
    email: str(p.email),
    phone: str(p.phone),
    location: {
      city: str(loc.city),
      country: str(loc.country),
      countryCode: str(loc.countryCode),
    },
    headline: str(p.headline),
    searchKeywords: str(p.searchKeywords),
    jobTitles: arr(p.jobTitles).map(str).filter(Boolean),
    skills: arr(p.skills).map(str).map((s) => s.toLowerCase()).filter(Boolean),
    languages: arr(p.languages).map((l) => ({
      code: str(l && l.code).toLowerCase(),
      name: str(l && l.name),
      level: str(l && l.level),
    })),
    education: arr(p.education),
    experience: arr(p.experience),
    totalExperienceYears: Number(p.totalExperienceYears) || 0,
    seniority: ['junior', 'mid', 'senior'].includes(p.seniority) ? p.seniority : 'mid',
    rawText: str(p.rawText),
    sourceFormat: str(p.sourceFormat),
  };
}

/** Validate the search filters supplied by the refine panel. */
function sanitiseFilters(f) {
  const filters = f && typeof f === 'object' ? f : {};
  return {
    countries: arr(filters.countries)
      .map((c) => str(c).toLowerCase().slice(0, 2))
      .filter(Boolean),
  };
}
