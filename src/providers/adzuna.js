/**
 * Adzuna — aggregator with per-country APIs across 11 European markets
 * (AT, BE, CH, DE, ES, FR, GB, IT, NL, PL). Requires free credentials:
 * set ADZUNA_APP_ID and ADZUNA_APP_KEY (https://developer.adzuna.com/).
 */

import { fetchJson, keywordsFromProfile, countryCodeOf, marketsFor } from './util.js';

const EUROPEAN_MARKETS = ['at', 'be', 'ch', 'de', 'es', 'fr', 'gb', 'it', 'nl', 'pl'];

export const adzuna = {
  id: 'adzuna',
  name: 'Adzuna (10 European markets)',
  requiresKey: true,
  isConfigured: () => Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),

  async search(profile, { limit = 30, filters } = {}) {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    const what = encodeURIComponent(keywordsFromProfile(profile));

    // Honour the user's target countries when set; otherwise search the
    // candidate's home market first, then the other European markets.
    const home = countryCodeOf(profile);
    const explicit = Boolean(filters && filters.countries && filters.countries.length);
    const markets = marketsFor(profile, filters, EUROPEAN_MARKETS);

    const jobs = [];
    for (const market of markets) {
      if (jobs.length >= limit) break;
      const perMarket = explicit
        ? Math.max(5, Math.ceil(limit / markets.length))
        : market === home
          ? 20
          : 5;
      try {
        const data = await fetchJson(
          `https://api.adzuna.com/v1/api/jobs/${market}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=${perMarket}&what=${what}&content-type=application/json`
        );
        for (const job of data.results || []) {
          jobs.push({
            id: `adzuna-${job.id}`,
            title: job.title || '',
            company: (job.company && job.company.display_name) || '',
            location: (job.location && job.location.display_name) || '',
            country: market,
            remote: false,
            salary: formatSalary(job),
            url: job.redirect_url || '',
            postedDate: (job.created || '').slice(0, 10),
            description: job.description || '',
            source: `Adzuna ${market.toUpperCase()}`,
          });
        }
      } catch {
        // Skip markets that error (rate limits, unsupported); others still count.
      }
    }
    return jobs.slice(0, limit);
  },
};

function formatSalary(job) {
  if (!job.salary_min && !job.salary_max) return '';
  const fmt = (n) => Math.round(n).toLocaleString('en-GB');
  if (job.salary_min && job.salary_max && job.salary_min !== job.salary_max) {
    return `${fmt(job.salary_min)}–${fmt(job.salary_max)}`;
  }
  return fmt(job.salary_max || job.salary_min);
}
