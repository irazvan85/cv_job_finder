/**
 * Arbeitnow — free job board API, strong on Germany/DACH and
 * English-speaking roles across Europe. No API key required.
 * https://www.arbeitnow.com/api/job-board-api
 */

import { fetchJson, keywordTerms, matchesAnyTerm } from './util.js';
import { stripHtml } from '../europass/parser.js';

export const arbeitnow = {
  id: 'arbeitnow',
  name: 'Arbeitnow (DACH & Europe)',
  requiresKey: false,
  isConfigured: () => true,

  async search(profile, { limit = 50 } = {}) {
    // The public API has no keyword parameter, so we pull several pages of
    // the latest postings and keep only the ones whose title or description
    // mention the candidate's role or skills. This fills the result slots
    // with relevant roles instead of whatever happens to be newest.
    const terms = keywordTerms(profile);
    const collected = [];
    for (let page = 1; page <= 5 && collected.length < limit * 5; page++) {
      const data = await fetchJson(`https://www.arbeitnow.com/api/job-board-api?page=${page}`);
      for (const job of data.data || []) {
        collected.push({
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
    const relevant = collected.filter((job) =>
      matchesAnyTerm(`${job.title} ${job.description}`, terms)
    );
    // If nothing matched (unusual keywords), fall back to the latest feed
    // so the scorer still has something to rank.
    return (relevant.length ? relevant : collected).slice(0, limit);
  },
};
