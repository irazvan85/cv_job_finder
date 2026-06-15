/**
 * eJobs.ro — Romania's largest job board (30 000+ active vacancies).
 * No API key required; uses the public RSS feed with keyword search.
 *
 * IP restriction: eJobs blocks requests originating from cloud/datacenter
 * ASN ranges (AWS, GCP, Azure, Vercel Edge). This provider works correctly
 * from local installations, on-premises servers, and EU residential/ISP
 * addresses. On blocked IPs it fails with HTTP 403 and is reported as
 * "unreachable" in the UI — the other providers still run normally.
 *
 * RSS endpoint: https://www.ejobs.ro/user/rss/
 * Params: keywords, domain (IT, Finance, …), city
 */

import { fetchText, parseRssItems, rssDate, keywordsFromProfile } from './util.js';
import { stripHtml } from '../europass/parser.js';
import { normalizeRoSalary } from '../matching/romanian.js';

const FEED_URL = 'https://www.ejobs.ro/user/rss/';

export const ejobs = {
  id: 'ejobs',
  name: 'eJobs (Romania #1)',
  requiresKey: false,
  isConfigured: () => true,

  async search(profile, { limit = 30 } = {}) {
    const kw = encodeURIComponent(keywordsFromProfile(profile));
    const xml = await fetchText(`${FEED_URL}?keywords=${kw}&domain=&city=`);
    const items = parseRssItems(xml);
    return items.slice(0, limit).map((item) => {
      const title    = tv(item.title);
      const link     = tv(item.link) || tv(item.guid);
      const desc     = stripHtml(tv(item.description) || tv(item.summary)).slice(0, 3000);
      // eJobs uses custom <ejobs:*> tags; removeNSPrefix strips the prefix.
      const company  = tv(item.companyName) || tv(item.company) || tv(item.employer) || parseCompany(title);
      const city     = tv(item.city) || tv(item.location) || '';
      const salary   = normalizeRoSalary(tv(item.salary) || tv(item.salarygross) || tv(item.salarynet));
      const remote   = /remote|telemunca|work from home/i.test(`${title} ${desc}`);
      return {
        id: `ejobs-${hashId(link || title)}`,
        title,
        company,
        location: city || 'Romania',
        country: 'ro',
        remote,
        salary,
        url: link,
        postedDate: rssDate(tv(item.pubDate)),
        description: desc,
        source: 'eJobs RO',
      };
    });
  },
};

/** Pull a plain string out of an RSS field that may be a fast-xml-parser object. */
function tv(v) {
  if (v == null) return '';
  if (typeof v === 'object') return String(v['#text'] ?? v.Label ?? v._ ?? '').trim();
  return String(v).trim();
}

/**
 * Some RSS feeds encode "Title @ Company" or "Title - Company" in the title.
 * Try to extract the company name from that pattern.
 */
function parseCompany(title) {
  const m = title.match(/[@–—]\s*(.+)$/) || title.match(/\s[-]\s(.+)$/);
  return m ? m[1].trim() : '';
}

/** Short deterministic id from a URL or title string. */
function hashId(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
