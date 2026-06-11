/**
 * Arbeitnow — free job board API, strong on Germany/DACH and
 * English-speaking roles across Europe. No API key required.
 * https://www.arbeitnow.com/api/job-board-api
 */

import { fetchJson } from './util.js';
import { stripHtml } from '../europass/parser.js';

export const arbeitnow = {
  id: 'arbeitnow',
  name: 'Arbeitnow (DACH & Europe)',
  requiresKey: false,
  isConfigured: () => true,

  async search(profile, { limit = 50 } = {}) {
    const jobs = [];
    // The API has no keyword parameter; pull the latest pages and let
    // the scorer rank relevance.
    for (let page = 1; page <= 2 && jobs.length < limit; page++) {
      const data = await fetchJson(`https://www.arbeitnow.com/api/job-board-api?page=${page}`);
      for (const job of data.data || []) {
        jobs.push({
          id: `arbeitnow-${job.slug}`,
          title: job.title || '',
          company: job.company_name || '',
          location: job.location || '',
          country: 'de',
          remote: Boolean(job.remote),
          salary: '',
          url: job.url || '',
          postedDate: job.created_at ? new Date(job.created_at * 1000).toISOString().slice(0, 10) : '',
          description: stripHtml(job.description || '').slice(0, 3000),
          source: 'Arbeitnow',
        });
      }
      if (!data.links || !data.links.next) break;
    }
    return jobs.slice(0, limit);
  },
};
