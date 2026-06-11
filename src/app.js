/**
 * Express app factory — shared by the local server (server.js) and the
 * Vercel serverless function (api/index.js).
 *
 * Routes:
 *   POST /api/match      multipart upload field "cv" (+ optional "demo=1")
 *   GET  /api/providers  provider list with configuration status
 */

import express from 'express';
import multer from 'multer';
import { parseEuropassCv } from './europass/parser.js';
import { searchAllProviders, ALL_PROVIDERS } from './providers/index.js';
import { rankJobs } from './matching/scorer.js';

// Vercel rejects request bodies over ~4.5 MB before they reach the
// function, so a larger multer limit would never be exercised there.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export function createApp() {
  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
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
      res.json({ profile, jobs: ranked, providerStatus, demoMode });
    } catch (err) {
      res.status(500).json({ error: `Failed to process CV: ${err.message}` });
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
