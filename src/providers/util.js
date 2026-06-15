/** Shared helpers for job providers. */

import { XMLParser } from 'fast-xml-parser';

// Providers run in parallel, so the slowest one bounds the request.
// Keep it comfortably inside the serverless maxDuration (30s on Vercel,
// see vercel.json) with headroom for parsing and scoring.
const DEFAULT_TIMEOUT_MS = 9000;

/**
 * fetch with a timeout; throws on non-2xx. Returns raw text.
 * Used for RSS/XML feeds.
 */
export async function fetchText(url, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: 'application/rss+xml, application/xml, text/xml, */*',
        'user-agent': 'europass-job-matcher/1.0',
        ...(init.headers || {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

const _rssParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,  // strips e.g. <ejobs:city> → city
  trimValues: true,
});

/**
 * Parse an RSS 2.0 feed and return the list of <item> objects.
 * Namespace prefixes are stripped so custom fields like
 * <ejobs:city> appear as plain `city`.
 * @param {string} xmlText
 * @returns {object[]}
 */
export function parseRssItems(xmlText) {
  const doc = _rssParser.parse(xmlText);
  const channel = (doc.rss && doc.rss.channel) || {};
  const raw = channel.item || [];
  return Array.isArray(raw) ? raw : [raw];
}

/** Coerce an RSS <pubDate> string (RFC 2822) to YYYY-MM-DD. */
export function rssDate(pubDate) {
  if (!pubDate) return '';
  try { return new Date(String(pubDate)).toISOString().slice(0, 10); } catch { return ''; }
}

/**
 * fetch with a timeout and JSON parsing; throws on non-2xx.
 * @param {string} url
 * @param {RequestInit & {timeoutMs?: number}} [options]
 */
export async function fetchJson(url, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'europass-job-matcher/1.0',
        ...(init.headers || {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build the search keyword string from a CV profile. An explicit
 * `searchKeywords` override (set by the user in the refine panel) wins;
 * otherwise we use the most recent job title, falling back to the
 * headline and then the strongest skills.
 * @param {import('../europass/parser.js').CvProfile} profile
 */
export function keywordsFromProfile(profile) {
  if (profile.searchKeywords && profile.searchKeywords.trim()) return profile.searchKeywords.trim();
  if (profile.jobTitles.length) return profile.jobTitles[0];
  if (profile.headline) return profile.headline;
  return profile.skills.slice(0, 3).join(' ');
}

const KEYWORD_STOP = new Set([
  'and', 'or', 'of', 'the', 'for', 'in', 'at', 'a', 'an', 'to', 'with',
  'm', 'f', 'd', 'w', 'x', 'junior', 'senior', 'lead',
]);

/**
 * Tokenise the search keywords plus the strongest CV skills into a set of
 * lowercase terms. Used by keyword-less providers (e.g. Arbeitnow) to
 * filter their feed down to roles that are actually relevant.
 * @param {import('../europass/parser.js').CvProfile} profile
 * @returns {string[]}
 */
export function keywordTerms(profile) {
  const base = `${keywordsFromProfile(profile)} ${profile.skills.slice(0, 8).join(' ')}`;
  return [
    ...new Set(
      base
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .filter((t) => t.length > 1 && !KEYWORD_STOP.has(t))
    ),
  ];
}

/** True if any of the given terms appears in the text (case-insensitive). */
export function matchesAnyTerm(text, terms) {
  if (!terms.length) return true;
  const l = String(text || '').toLowerCase();
  return terms.some((t) => l.includes(t));
}

/**
 * Resolve which country markets to query. When the user picked specific
 * target countries they take priority (intersected with what the
 * provider supports); otherwise we search the CV's home market plus all
 * available markets.
 * @param {import('../europass/parser.js').CvProfile} profile
 * @param {{countries?: string[]}|undefined} filters
 * @param {string[]} available provider-supported market codes (lowercase)
 */
export function marketsFor(profile, filters, available) {
  const home = countryCodeOf(profile);
  const requested =
    filters && filters.countries && filters.countries.length
      ? filters.countries
      : [home, ...available];
  return [...new Set(requested.map((c) => String(c).toLowerCase()))].filter((m) =>
    available.includes(m)
  );
}

/** Map common country names to ISO 3166-1 alpha-2 codes (lowercase). */
const COUNTRY_CODES = {
  austria: 'at', belgium: 'be', bulgaria: 'bg', croatia: 'hr', cyprus: 'cy',
  czechia: 'cz', 'czech republic': 'cz', denmark: 'dk', estonia: 'ee',
  finland: 'fi', france: 'fr', germany: 'de', greece: 'gr', hungary: 'hu',
  ireland: 'ie', italy: 'it', latvia: 'lv', lithuania: 'lt', luxembourg: 'lu',
  malta: 'mt', netherlands: 'nl', poland: 'pl', portugal: 'pt', romania: 'ro',
  slovakia: 'sk', slovenia: 'si', spain: 'es', sweden: 'se', norway: 'no',
  switzerland: 'ch', iceland: 'is', 'united kingdom': 'gb', uk: 'gb',
};

export function countryCodeOf(profile) {
  const cc = profile.location.countryCode.toLowerCase();
  if (cc) return cc;
  return COUNTRY_CODES[profile.location.country.toLowerCase()] || '';
}
