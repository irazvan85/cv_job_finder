/**
 * Remotive — remote jobs API, many of them open to candidates anywhere
 * in Europe. No API key required.
 * https://remotive.com/api/remote-jobs
 */

import { fetchJson, keywordsFromProfile } from './util.js';
import { stripHtml } from '../europass/parser.js';

export const remotive = {
  id: 'remotive',
  name: 'Remotive (remote, Europe-friendly)',
  requiresKey: false,
  isConfigured: () => true,

  async search(profile, { limit = 25 } = {}) {
    const search = encodeURIComponent(keywordsFromProfile(profile));
    const data = await fetchJson(`https://remotive.com/api/remote-jobs?search=${search}&limit=${limit}`);
    return (data.jobs || [])
      .filter((job) => isEuropeFriendly(job.candidate_required_location))
      .map((job) => ({
        id: `remotive-${job.id}`,
        title: job.title || '',
        company: job.company_name || '',
        location: job.candidate_required_location || 'Remote',
        country: '',
        remote: true,
        salary: job.salary || '',
        url: job.url || '',
        postedDate: (job.publication_date || '').slice(0, 10),
        description: stripHtml(job.description || '').slice(0, 3000),
        source: 'Remotive',
      }));
  },
};

function isEuropeFriendly(location) {
  if (!location) return true; // unspecified: assume worldwide
  const l = location.toLowerCase();
  return (
    l.includes('worldwide') ||
    l.includes('anywhere') ||
    l.includes('europe') ||
    l.includes('emea') ||
    /\b(germany|france|spain|italy|netherlands|poland|portugal|austria|belgium|sweden|denmark|finland|ireland|romania|czech|hungary|greece|uk|united kingdom)\b/.test(l)
  );
}
