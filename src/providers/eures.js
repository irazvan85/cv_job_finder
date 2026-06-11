/**
 * EURES — the European Commission's job mobility portal.
 *
 * EURES aggregates vacancies from the public employment services of
 * every EU/EEA member state plus Switzerland, which makes it the
 * single broadest "all European platforms" source available without
 * API keys. We call the same JSON search endpoint the EURES web app
 * uses. No key required, but the endpoint occasionally changes shape,
 * so failures are reported and tolerated.
 */

import { fetchJson, keywordsFromProfile, countryCodeOf } from './util.js';

const SEARCH_URL = 'https://europa.eu/eures/eures-apps/searchengine/page/jv-search/search';

export const eures = {
  id: 'eures',
  name: 'EURES (all EU/EEA national job services)',
  requiresKey: false,
  isConfigured: () => true,

  /** @param {import('../europass/parser.js').CvProfile} profile */
  async search(profile, { limit = 25 } = {}) {
    const body = {
      resultsPerPage: limit,
      page: 1,
      sortSearch: 'BEST_MATCH',
      keywords: [{ keyword: keywordsFromProfile(profile), specificSearchCode: 'EVERYWHERE' }],
      publicationPeriod: null,
      occupationUris: [],
      skillUris: [],
      requiredExperienceCodes: [],
      positionScheduleCodes: [],
      sectorCodes: [],
      educationAndQualificationLevelCodes: [],
      positionOfferingCodes: [],
      locationCodes: countryCodeOf(profile) ? [countryCodeOf(profile)] : [],
      euresFlagCodes: [],
      otherBenefitsCodes: [],
      requiredLanguages: [],
      minNumberPost: null,
    };

    const data = await fetchJson(SEARCH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    const items = data.jvs || data.results || [];
    return items.map((jv) => ({
      id: `eures-${jv.id || jv.reference || ''}`,
      title: jv.title || '',
      company: (jv.employer && jv.employer.name) || jv.employerName || '',
      location: [firstLocation(jv).cityName, firstLocation(jv).countryCode]
        .filter(Boolean)
        .join(', '),
      country: (firstLocation(jv).countryCode || '').toLowerCase(),
      remote: false,
      salary: '',
      url: jv.id ? `https://europa.eu/eures/portal/jv-se/jv-details/${encodeURIComponent(jv.id)}` : '',
      postedDate: jv.creationDate || jv.lastModificationDate || '',
      description: jv.description || '',
      source: 'EURES',
    }));
  },
};

function firstLocation(jv) {
  const locations = jv.locationMap
    ? Object.values(jv.locationMap).flat()
    : jv.locations || [];
  return locations[0] || {};
}
