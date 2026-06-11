/**
 * Jooble — aggregator operating in most European countries.
 * Requires a free API key: set JOOBLE_API_KEY (https://jooble.org/api/about).
 */

import { fetchJson, keywordsFromProfile } from './util.js';
import { stripHtml } from '../europass/parser.js';

export const jooble = {
  id: 'jooble',
  name: 'Jooble (Europe-wide aggregator)',
  requiresKey: true,
  isConfigured: () => Boolean(process.env.JOOBLE_API_KEY),

  async search(profile, { limit = 30 } = {}) {
    const key = process.env.JOOBLE_API_KEY;
    const data = await fetchJson(`https://jooble.org/api/${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        keywords: keywordsFromProfile(profile),
        location: profile.location.country || profile.location.city || '',
        page: 1,
      }),
    });
    return (data.jobs || []).slice(0, limit).map((job) => ({
      id: `jooble-${job.id}`,
      title: job.title || '',
      company: job.company || '',
      location: job.location || '',
      country: '',
      remote: /remote/i.test(`${job.title} ${job.location}`),
      salary: job.salary || '',
      url: job.link || '',
      postedDate: (job.updated || '').slice(0, 10),
      description: stripHtml(job.snippet || ''),
      source: 'Jooble',
    }));
  },
};
