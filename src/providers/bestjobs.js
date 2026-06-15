/**
 * BestJobs.eu — Romania's second-largest job board (Ringier Romania).
 * No API key required; uses the public RSS feed with keyword search.
 *
 * IP restriction: same cloud-IP blocking as eJobs.ro (see ejobs.js).
 * Works from local/residential/EU-ISP servers; fails gracefully on Vercel.
 *
 * RSS endpoint: https://bestjobs.eu/rss/jobs/
 * Params: q (keywords), city
 *
 * Title format in the feed is typically "Job Title — Company Name", from
 * which we extract both fields when dedicated tags are absent.
 */

import { fetchText, parseRssItems, rssDate, keywordsFromProfile } from './util.js';
import { stripHtml } from '../europass/parser.js';

const FEED_URL = 'https://bestjobs.eu/rss/jobs/';

export const bestjobs = {
  id: 'bestjobs',
  name: 'BestJobs (Romania #2)',
  requiresKey: false,
  isConfigured: () => true,

  async search(profile, { limit = 25 } = {}) {
    const kw = encodeURIComponent(keywordsFromProfile(profile));
    const xml = await fetchText(`${FEED_URL}?q=${kw}`);
    const items = parseRssItems(xml);
    return items.slice(0, limit).map((item) => {
      const rawTitle = tv(item.title);
      const { title, company } = splitTitle(rawTitle);
      const link = tv(item.link) || tv(item.guid);
      const desc = stripHtml(tv(item.description) || tv(item.summary)).slice(0, 3000);
      const city  = tv(item.city) || tv(item.location) || '';
      const remote = /remote|telemunca|work from home/i.test(`${rawTitle} ${desc}`);
      return {
        id: `bestjobs-${hashId(link || rawTitle)}`,
        title,
        company: tv(item.company) || tv(item.companyName) || company,
        location: city || 'Romania',
        country: 'ro',
        remote,
        salary: tv(item.salary) || '',
        url: link,
        postedDate: rssDate(tv(item.pubDate)),
        description: desc,
        source: 'BestJobs RO',
      };
    });
  },
};

/**
 * BestJobs feed often encodes both parts in the title:
 *   "Senior Java Developer — Acme Corp"
 *   "Data Analyst | Example SRL"
 * Split on em-dash, pipe, or " - " to separate them.
 */
function splitTitle(raw) {
  const sep = raw.match(/([—–|]|\s-\s)/);
  if (sep) {
    const idx = raw.indexOf(sep[0]);
    return {
      title:   raw.slice(0, idx).trim(),
      company: raw.slice(idx + sep[0].length).trim(),
    };
  }
  return { title: raw, company: '' };
}

function tv(v) {
  if (v == null) return '';
  if (typeof v === 'object') return String(v['#text'] ?? v.Label ?? v._ ?? '').trim();
  return String(v).trim();
}

function hashId(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
