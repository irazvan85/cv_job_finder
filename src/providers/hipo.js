/**
 * Hipo.ro — Romania's specialist board for graduates, young professionals,
 * and university students. Strong coverage of entry-level and junior roles
 * across IT, business, marketing, and finance. No API key required.
 *
 * IP restriction: same cloud-IP blocking as eJobs.ro (see ejobs.js).
 *
 * RSS endpoint: https://www.hipo.ro/rss/
 * Params: q (keywords), city, domain
 *
 * Because Hipo focuses on early-career roles, the seniority scorer naturally
 * rates these lower for senior profiles — which is the correct behaviour.
 */

import { fetchText, parseRssItems, rssDate, keywordsFromProfile } from './util.js';
import { stripHtml } from '../europass/parser.js';
import { normalizeRoSalary } from '../matching/romanian.js';

const FEED_URL = 'https://www.hipo.ro/rss/';

export const hipo = {
  id: 'hipo',
  name: 'Hipo.ro (Romania — graduates & juniors)',
  requiresKey: false,
  isConfigured: () => true,

  async search(profile, { limit = 20 } = {}) {
    const kw = encodeURIComponent(keywordsFromProfile(profile));
    const xml = await fetchText(`${FEED_URL}?q=${kw}&city=&domain=`);
    const items = parseRssItems(xml);
    return items.slice(0, limit).map((item) => {
      const title = tv(item.title);
      const link  = tv(item.link) || tv(item.guid);
      const desc  = stripHtml(tv(item.description) || tv(item.summary)).slice(0, 3000);
      const city  = tv(item.city) || tv(item.location) || '';
      const remote = /remote|telemunca|work from home/i.test(`${title} ${desc}`);
      return {
        id: `hipo-${hashId(link || title)}`,
        title,
        company: tv(item.company) || tv(item.companyName) || tv(item.employer) || '',
        location: city || 'Romania',
        country: 'ro',
        remote,
        salary: normalizeRoSalary(tv(item.salary)),
        url: link,
        postedDate: rssDate(tv(item.pubDate)),
        description: desc,
        source: 'Hipo RO',
      };
    });
  },
};

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
