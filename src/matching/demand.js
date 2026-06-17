/**
 * Job-market demand aggregation.
 *
 * Turns a flat list of vacancies (already fetched from every provider) into
 * a ranked "most in-demand roles" table for a given city: job titles are
 * normalised into a canonical role, grouped, and counted. The result is a
 * transparent, explainable market snapshot — each ranked role traces back
 * to literal vacancies, with the hiring companies and sources that back it.
 *
 * Like the rest of the matcher this is deterministic and English/Romanian
 * aware: city matching reuses the diacritics-folded location normaliser
 * (București ↔ Bucharest bridge included) from romanian.js.
 */

import { normalizeLocation } from './romanian.js';

// Words that describe seniority/level rather than the role itself. Stripped
// so "Senior Software Engineer" and "Junior Software Engineer" both count
// towards the same in-demand role, "Software Engineer".
const SENIORITY_RE =
  /\b(senior|sr|junior|jr|mid|middle|lead|principal|staff|entry[- ]?level|entry|graduate|trainee|intern(?:ship)?|experienced)\b/gi;

// Acronyms to keep upper-cased when we title-case a canonical role for display.
const ACRONYMS = {
  it: 'IT', qa: 'QA', hr: 'HR', ui: 'UI', ux: 'UX', sap: 'SAP', erp: 'ERP',
  crm: 'CRM', ai: 'AI', ml: 'ML', sql: 'SQL', php: 'PHP', css: 'CSS',
  html: 'HTML', ios: 'iOS', api: 'API', sre: 'SRE', bi: 'BI', devops: 'DevOps',
};

/**
 * Reduce a raw job title to a canonical role key used for grouping.
 * Drops parentheticals/brackets, gender tags (m/f/d), trailing qualifiers
 * after a delimiter (" - ", "|", ":", ","), and seniority words.
 * @param {string} title
 * @returns {string} lowercase canonical key ('' if nothing meaningful is left)
 */
export function canonicalRole(title) {
  let t = String(title || '').toLowerCase();
  t = t.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' '); // (…) and […]
  t = t.replace(/\b[mwfdx](?:\s*\/\s*[mwfdx])+\b/g, ' ');       // m/f/d, m/w/d, m/f/x
  t = t.split(/\s+[-–—|:]\s+|,/)[0];                            // keep core role before a qualifier
  t = t.replace(SENIORITY_RE, ' ');
  t = t.replace(/[^a-z0-9+#.\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return t;
}

/** Title-case a canonical role for display, keeping known acronyms upper-cased. */
function displayRole(canonical) {
  return canonical
    .split(' ')
    .filter(Boolean)
    .map((w) => ACRONYMS[w] || (w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

/** True if a job's location (or country) matches the requested city. */
function jobInCity(job, cityNorm) {
  if (!cityNorm) return true;
  const loc = normalizeLocation(`${job.location || ''} ${job.country || ''}`);
  return loc.includes(cityNorm);
}

/**
 * Rank the most in-demand roles among a set of vacancies, optionally
 * restricted to a city. Roles are grouped by their canonical title and
 * sorted by vacancy count (then alphabetically for stable ties).
 *
 * @param {object[]} jobs normalised job objects from the providers
 * @param {{city?: string, limit?: number}} [options]
 * @returns {{
 *   city: string,
 *   totalConsidered: number,
 *   roles: {
 *     title: string, count: number, share: number,
 *     companies: string[], sources: string[], remoteCount: number, sampleUrl: string,
 *   }[],
 * }}
 */
export function topDemandedJobs(jobs, { city = '', limit = 10 } = {}) {
  const cityNorm = normalizeLocation(city);
  const considered = (jobs || []).filter((j) => jobInCity(j, cityNorm));

  /** @type {Map<string, {count: number, companies: Set<string>, sources: Set<string>, remoteCount: number, sampleUrl: string}>} */
  const groups = new Map();
  for (const job of considered) {
    const key = canonicalRole(job.title);
    if (!key) continue;
    let g = groups.get(key);
    if (!g) {
      g = { count: 0, companies: new Set(), sources: new Set(), remoteCount: 0, sampleUrl: '' };
      groups.set(key, g);
    }
    g.count++;
    if (job.company) g.companies.add(job.company);
    if (job.source) g.sources.add(job.source);
    if (job.remote) g.remoteCount++;
    if (!g.sampleUrl && job.url) g.sampleUrl = job.url;
  }

  const total = considered.length;
  const roles = [...groups.entries()]
    .map(([key, g]) => ({
      title: displayRole(key),
      count: g.count,
      share: total ? Math.round((g.count / total) * 1000) / 10 : 0,
      companies: [...g.companies].slice(0, 4),
      sources: [...g.sources],
      remoteCount: g.remoteCount,
      sampleUrl: g.sampleUrl,
    }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    .slice(0, limit);

  return { city, totalConsidered: total, roles };
}
