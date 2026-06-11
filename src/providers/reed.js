/**
 * Reed — the UK's largest job board.
 * Requires a free API key: set REED_API_KEY (https://www.reed.co.uk/developers).
 */

import { fetchJson, keywordsFromProfile } from './util.js';

export const reed = {
  id: 'reed',
  name: 'Reed (United Kingdom)',
  requiresKey: true,
  isConfigured: () => Boolean(process.env.REED_API_KEY),

  async search(profile, { limit = 25 } = {}) {
    const key = process.env.REED_API_KEY;
    const keywords = encodeURIComponent(keywordsFromProfile(profile));
    const data = await fetchJson(
      `https://www.reed.co.uk/api/1.0/search?keywords=${keywords}&resultsToTake=${limit}`,
      {
        headers: { authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}` },
      }
    );
    return (data.results || []).map((job) => ({
      id: `reed-${job.jobId}`,
      title: job.jobTitle || '',
      company: job.employerName || '',
      location: job.locationName || '',
      country: 'gb',
      remote: false,
      salary:
        job.minimumSalary || job.maximumSalary
          ? `£${(job.minimumSalary || job.maximumSalary).toLocaleString('en-GB')}${
              job.maximumSalary && job.maximumSalary !== job.minimumSalary
                ? `–£${job.maximumSalary.toLocaleString('en-GB')}`
                : ''
            }`
          : '',
      url: job.jobUrl || '',
      postedDate: job.date || '',
      description: job.jobDescription || '',
      source: 'Reed UK',
    }));
  },
};
