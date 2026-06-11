/** Shared helpers for job providers. */

// Providers run in parallel, so the slowest one bounds the request.
// Keep it comfortably inside the serverless maxDuration (30s on Vercel,
// see vercel.json) with headroom for parsing and scoring.
const DEFAULT_TIMEOUT_MS = 9000;

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
 * Build the search keyword string from a CV profile: the most recent
 * job title, falling back to the strongest skills.
 * @param {import('../europass/parser.js').CvProfile} profile
 */
export function keywordsFromProfile(profile) {
  if (profile.jobTitles.length) return profile.jobTitles[0];
  if (profile.headline) return profile.headline;
  return profile.skills.slice(0, 3).join(' ');
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
