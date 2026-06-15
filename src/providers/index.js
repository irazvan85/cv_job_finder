/**
 * Provider registry and fan-out search.
 *
 * Every provider exposes: id, name, requiresKey, isConfigured(), and
 * search(profile, options) → normalised job objects. Searches run in
 * parallel; a failing provider is reported but never sinks the others.
 */

import { eures } from './eures.js';
import { ejobs } from './ejobs.js';
import { bestjobs } from './bestjobs.js';
import { hipo } from './hipo.js';
import { arbeitnow } from './arbeitnow.js';
import { remotive } from './remotive.js';
import { adzuna } from './adzuna.js';
import { jooble } from './jooble.js';
import { reed } from './reed.js';
import { demo } from './demo.js';

// Romanian portals first (most directly relevant for Romanian candidates),
// then pan-European, then key-required aggregators.
export const ALL_PROVIDERS = [eures, ejobs, bestjobs, hipo, arbeitnow, remotive, adzuna, jooble, reed];

/**
 * @param {import('../europass/parser.js').CvProfile} profile
 * @param {{demoMode?: boolean, limitPerProvider?: number, filters?: {countries?: string[]}}} [options]
 * @returns {Promise<{jobs: object[], providerStatus: {id: string, name: string, status: string, count: number, detail: string}[]}>}
 */
export async function searchAllProviders(
  profile,
  { demoMode = false, limitPerProvider = 30, filters = {} } = {}
) {
  const providers = demoMode ? [demo] : ALL_PROVIDERS;
  const providerStatus = [];
  const jobs = [];

  const results = await Promise.allSettled(
    providers.map(async (provider) => {
      if (!provider.isConfigured()) {
        return { provider, skipped: true };
      }
      const found = await provider.search(profile, { limit: limitPerProvider, filters });
      return { provider, found };
    })
  );

  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      const { provider, found, skipped } = result.value;
      if (skipped) {
        providerStatus.push({
          id: provider.id,
          name: provider.name,
          status: 'skipped',
          count: 0,
          detail: 'API key not configured (see README)',
        });
        continue;
      }
      jobs.push(...found);
      providerStatus.push({
        id: provider.id,
        name: provider.name,
        status: 'ok',
        count: found.length,
        detail: '',
      });
    } else {
      const provider = providers[index];
      providerStatus.push({
        id: provider.id,
        name: provider.name,
        status: 'error',
        count: 0,
        detail: String(result.reason && result.reason.message ? result.reason.message : result.reason),
      });
    }
  }

  return { jobs: dedupe(jobs), providerStatus };
}

/** Drop near-duplicate listings (same title + company across sources). */
function dedupe(jobs) {
  const seen = new Set();
  return jobs.filter((job) => {
    const key = `${job.title}::${job.company}`.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
