/**
 * Job ↔ CV matching and hiring-chance estimation.
 *
 * The "estimated hiring chance" is a transparent heuristic, not a
 * prediction model. It combines five weighted signals, each scored
 * 0..1, into a percentage, and reports which skills matched so the
 * user can sanity-check every number:
 *
 *   skills      45%  overlap between CV skills and skills in the job ad
 *   title       25%  similarity between CV job titles and the ad title
 *   location    15%  same country, same city, or remote
 *   language    10%  CV languages vs the ad's language requirements
 *   seniority    5%  junior/mid/senior alignment
 */

import { extractSkillTokens } from './skills.js';
import { stripHtml } from '../europass/parser.js';
import {
  normalizeLocation,
  requiredLanguagesRo,
  wantsJuniorRo,
  wantsSeniorRo,
} from './romanian.js';

const WEIGHTS = { skills: 0.45, title: 0.25, location: 0.15, language: 0.1, seniority: 0.05 };

const LANGUAGE_NAMES = {
  en: 'english', de: 'german', fr: 'french', es: 'spanish', it: 'italian',
  nl: 'dutch', pl: 'polish', pt: 'portuguese', ro: 'romanian', sv: 'swedish',
  da: 'danish', fi: 'finnish', no: 'norwegian', cs: 'czech', sk: 'slovak',
  hu: 'hungarian', el: 'greek', bg: 'bulgarian', hr: 'croatian', et: 'estonian',
  lv: 'latvian', lt: 'lithuanian', sl: 'slovenian', ga: 'irish', mt: 'maltese',
};

/**
 * Score a list of jobs against a CV profile and return them sorted by
 * estimated hiring chance, best first.
 * @param {import('../europass/parser.js').CvProfile} profile
 * @param {Array<object>} jobs normalised job objects from the providers
 */
export function rankJobs(profile, jobs) {
  return jobs
    .map((job) => ({ ...job, match: scoreJob(profile, job) }))
    .sort((a, b) => b.match.hiringChance - a.match.hiringChance);
}

/**
 * @returns {{hiringChance: number, label: string, matchedSkills: string[], breakdown: object}}
 */
export function scoreJob(profile, job) {
  const jobText = stripHtml(`${job.title || ''}\n${job.description || ''}`);
  const jobSkills = extractSkillTokens(jobText);

  const matchedSkills = jobSkills.filter((s) => profile.skills.includes(s));
  // Denominator favours the job's requirements: matching most of what
  // the ad asks for matters more than the CV listing extra skills.
  const skillScore = jobSkills.length
    ? matchedSkills.length / jobSkills.length
    : profile.skills.length
      ? 0.3 // ad lists no recognisable skills: neutral-low, not zero
      : 0.5;

  const titleScore = bestTitleSimilarity(profile, job.title || '');
  const locationScore = locationCompatibility(profile, job);
  const languageScore = languageCompatibility(profile, job, jobText);
  const seniorityScore = seniorityAlignment(profile, jobText);

  const total =
    skillScore * WEIGHTS.skills +
    titleScore * WEIGHTS.title +
    locationScore * WEIGHTS.location +
    languageScore * WEIGHTS.language +
    seniorityScore * WEIGHTS.seniority;

  const hiringChance = Math.round(Math.min(0.97, Math.max(0.02, total)) * 100);
  return {
    hiringChance,
    label: hiringChance >= 65 ? 'High' : hiringChance >= 40 ? 'Medium' : 'Low',
    matchedSkills,
    breakdown: {
      skills: round2(skillScore),
      title: round2(titleScore),
      location: round2(locationScore),
      language: round2(languageScore),
      seniority: round2(seniorityScore),
    },
  };
}

/* ------------------------------------------------------------------ */

function bestTitleSimilarity(profile, jobTitle) {
  const candidates = [...profile.jobTitles, profile.headline].filter(Boolean);
  if (!candidates.length || !jobTitle) return 0.3;
  let best = 0;
  for (const candidate of candidates) {
    best = Math.max(best, tokenOverlap(candidate, jobTitle));
  }
  return best;
}

function tokenOverlap(a, b) {
  const stop = new Set(['and', 'or', 'of', 'the', 'for', 'in', 'at', 'a', 'an', 'to', 'with', 'm', 'f', 'd', 'w', 'x']);
  const tok = (s) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .filter((t) => t.length > 1 && !stop.has(t))
    );
  const ta = tok(a);
  const tb = tok(b);
  if (!ta.size || !tb.size) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.min(ta.size, tb.size);
}

function locationCompatibility(profile, job) {
  if (job.remote) return 1;
  // Diacritics-folded with the București ↔ Bucharest bridge, so a Romanian
  // ad and an English CV (or differing diacritics) still line up.
  const jobLoc = normalizeLocation(`${job.location || ''} ${job.country || ''}`);
  if (!jobLoc.trim()) return 0.5;
  const city = normalizeLocation(profile.location.city);
  const country = normalizeLocation(profile.location.country);
  const cc = profile.location.countryCode.toLowerCase();
  if (city && jobLoc.includes(city)) return 1;
  if (country && jobLoc.includes(country)) return 0.8;
  if (cc && (job.country || '').toLowerCase() === cc) return 0.8;
  // Different EU country: relocation is possible (EU freedom of movement)
  // but still a hurdle relative to local candidates.
  return 0.35;
}

function languageCompatibility(profile, job, jobText) {
  const spoken = new Set();
  for (const lang of profile.languages) {
    if (lang.code) spoken.add(lang.code.toLowerCase());
    const name = (lang.name || '').toLowerCase();
    for (const [code, full] of Object.entries(LANGUAGE_NAMES)) {
      if (name === full || name === code) spoken.add(code);
    }
  }
  // Which languages does the ad explicitly require?
  const required = [];
  const lower = jobText.toLowerCase();
  for (const [code, full] of Object.entries(LANGUAGE_NAMES)) {
    if (new RegExp(`\\b${full}\\b\\s*(language|skills|speaker|fluent|required|proficiency|\\(|:)`, 'i').test(lower) ||
        new RegExp(`(fluent|native|proficient)\\s+(in\\s+)?${full}\\b`, 'i').test(lower)) {
      required.push(code);
    }
  }
  if (job.language) required.push(String(job.language).toLowerCase().slice(0, 2));
  // Romanian-language requirements ("limba engleză", "germană avansat", …).
  for (const code of requiredLanguagesRo(jobText)) required.push(code);
  const uniqueRequired = [...new Set(required)];
  if (!uniqueRequired.length) return spoken.has('en') || spoken.size === 0 ? 0.8 : 0.6;
  const met = uniqueRequired.filter((code) => spoken.has(code));
  return met.length / uniqueRequired.length;
}

function seniorityAlignment(profile, jobText) {
  const lower = jobText.toLowerCase();
  const wantsSenior = /\b(senior|lead|principal|head of|staff)\b/.test(lower) || wantsSeniorRo(jobText);
  const wantsJunior = /\b(junior|entry[ -]level|graduate|trainee|intern)\b/.test(lower) || wantsJuniorRo(jobText);
  if (!wantsSenior && !wantsJunior) return 0.8;
  if (wantsSenior) return profile.seniority === 'senior' ? 1 : profile.seniority === 'mid' ? 0.5 : 0.15;
  return profile.seniority === 'junior' ? 1 : profile.seniority === 'mid' ? 0.6 : 0.3;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
