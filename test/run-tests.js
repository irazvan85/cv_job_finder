/**
 * Test suite: Europass parsing, skill extraction, scoring, and the
 * demo-mode end-to-end pipeline. Run with `npm test`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEuropassCv, parseJson, parsePlainText } from '../src/europass/parser.js';
import { extractSkillTokens } from '../src/matching/skills.js';
import { scoreJob, rankJobs } from '../src/matching/scorer.js';
import { searchAllProviders } from '../src/providers/index.js';
import { keywordsFromProfile, keywordTerms, matchesAnyTerm, marketsFor, parseRssItems, rssDate } from '../src/providers/util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let failures = 0;

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/* --- Europass XML parsing ----------------------------------------- */
console.log('Europass XML parser');
const xmlBuffer = fs.readFileSync(path.join(__dirname, '../samples/sample-europass-cv.xml'));
const profile = await parseEuropassCv(xmlBuffer, 'sample-europass-cv.xml');

check('name extracted', profile.name === 'Ana Popescu', `got "${profile.name}"`);
check('email extracted', profile.email === 'ana.popescu@example.com', `got "${profile.email}"`);
check('city extracted', profile.location.city === 'Cluj-Napoca', `got "${profile.location.city}"`);
check('country code extracted', profile.location.countryCode === 'RO', `got "${profile.location.countryCode}"`);
check('headline extracted', profile.headline === 'Full Stack Software Developer', `got "${profile.headline}"`);
check('two work experiences', profile.experience.length === 2, `got ${profile.experience.length}`);
check('current job marked present', profile.experience[0].to === 'present', `got "${profile.experience[0].to}"`);
check('education extracted', profile.education.length === 1 && profile.education[0].title === 'BSc Computer Science');
check('three languages', profile.languages.length === 3, `got ${profile.languages.length}`);
check('mother tongue is native', profile.languages[0].level === 'native');
check('english is C1', profile.languages.find((l) => l.code === 'en')?.level === 'C1');
check('skills include react', profile.skills.includes('react'), profile.skills.join(','));
check('skills include typescript', profile.skills.includes('typescript'));
check('skills include kubernetes', profile.skills.includes('kubernetes'));
check('experience years ≈ 8.5', profile.totalExperienceYears > 7 && profile.totalExperienceYears < 10, `got ${profile.totalExperienceYears}`);
check('seniority is senior', profile.seniority === 'senior', profile.seniority);

/* --- Skill extraction --------------------------------------------- */
console.log('Skill extraction');
const tokens = extractSkillTokens('Experienced in React Native and React, with C# and node.js; some SAP and IFRS.');
check('multi-word skill wins', tokens.includes('react native'));
check('single-word still found', tokens.includes('react'));
check('c# matched', tokens.includes('c#'));
check('node.js matched', tokens.includes('node.js'));
check('no false "r" match from random text', !extractSkillTokens('we are hiring').includes('r'));

/* --- Skill aliases ------------------------------------------------ */
console.log('Skill aliases');
check('k8s → kubernetes', extractSkillTokens('Experience with K8s clusters').includes('kubernetes'));
check('golang → go', extractSkillTokens('Backend in Golang').includes('go'));
check('postgres → postgresql', extractSkillTokens('postgres tuning').includes('postgresql'));
check('reactjs → react', extractSkillTokens('built with ReactJS').includes('react'));
check('alias and canonical de-duplicate', (() => {
  const t = extractSkillTokens('Kubernetes and K8s both used');
  return t.filter((s) => s === 'kubernetes').length === 1;
})());

/* --- Keyword helpers ---------------------------------------------- */
console.log('Keyword helpers');
check('searchKeywords override wins', keywordsFromProfile({ ...profile, searchKeywords: 'devops engineer' }) === 'devops engineer');
check('falls back to job title without override', keywordsFromProfile(profile) === profile.jobTitles[0]);
const terms = keywordTerms(profile);
check('keywordTerms include role tokens', terms.includes('developer') || terms.includes('stack'));
check('matchesAnyTerm finds a term', matchesAnyTerm('Senior React Developer wanted', ['react']));
check('matchesAnyTerm rejects when none match', !matchesAnyTerm('Pastry chef position', ['react', 'python']));
check('matchesAnyTerm true on empty terms', matchesAnyTerm('anything', []));

/* --- RSS parsing utils -------------------------------------------- */
console.log('RSS utilities');
const sampleRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:ejobs="https://www.ejobs.ro">
  <channel>
    <title>eJobs.ro</title>
    <item>
      <title>Senior React Developer</title>
      <link>https://www.ejobs.ro/user/locuri-de-munca/senior-react-developer/123</link>
      <description>React, TypeScript, Node.js required. Full remote.</description>
      <pubDate>Mon, 01 Jan 2024 10:00:00 +0200</pubDate>
      <ejobs:companyName>Acme SRL</ejobs:companyName>
      <ejobs:city>Cluj-Napoca</ejobs:city>
      <ejobs:salary>5000-7000 RON</ejobs:salary>
    </item>
    <item>
      <title>Junior Data Analyst</title>
      <link>https://www.ejobs.ro/user/locuri-de-munca/junior-data-analyst/456</link>
      <description>SQL, Excel, Power BI knowledge required.</description>
      <pubDate>Tue, 02 Jan 2024 09:00:00 +0200</pubDate>
      <ejobs:companyName>DataCo SA</ejobs:companyName>
      <ejobs:city>Bucharest</ejobs:city>
    </item>
  </channel>
</rss>`;
const rssItems = parseRssItems(sampleRss);
check('parseRssItems returns array', Array.isArray(rssItems) && rssItems.length === 2);
check('rss title parsed', String(rssItems[0].title || '').includes('React'));
check('rss namespace stripped (ejobs:city → city)', !!rssItems[0].city || !!rssItems[0].companyName);
check('rssDate parses RFC 2822', rssDate('Mon, 01 Jan 2024 10:00:00 +0200') === '2024-01-01');
check('rssDate returns empty on bad input', rssDate('') === '');

/* --- Market selection --------------------------------------------- */
console.log('Market selection');
const ADZUNA_MARKETS = ['at', 'be', 'ch', 'de', 'es', 'fr', 'gb', 'it', 'nl', 'pl'];
check('explicit countries intersect availability', (() => {
  const m = marketsFor(profile, { countries: ['de', 'fr', 'jp'] }, ADZUNA_MARKETS);
  return m.includes('de') && m.includes('fr') && !m.includes('jp');
})());
check('no filter falls back to home + all', (() => {
  const m = marketsFor({ location: { country: 'Germany', countryCode: 'DE' } }, {}, ADZUNA_MARKETS);
  return m.includes('de') && m.length === ADZUNA_MARKETS.length;
})());

/* --- Scoring -------------------------------------------------------*/
console.log('Scoring');
const goodJob = {
  title: 'Senior Full Stack Developer (React/Node.js)',
  description: 'React, TypeScript, Node.js, PostgreSQL, Docker, Kubernetes, AWS. English required.',
  location: 'Cluj-Napoca, Romania', country: 'ro', remote: false,
};
const badJob = {
  title: 'Registered Nurse',
  description: 'Patient care, nursing qualification, fluent German required. Junior welcome.',
  location: 'Munich, Germany', country: 'de', remote: false,
};
const good = scoreJob(profile, goodJob);
const bad = scoreJob(profile, badJob);
check('strong match scores high', good.hiringChance >= 70, `got ${good.hiringChance}%`);
check('strong match labelled High', good.label === 'High');
check('weak match scores low', bad.hiringChance <= 40, `got ${bad.hiringChance}%`);
check('good > bad', good.hiringChance > bad.hiringChance);
check('matched skills reported', good.matchedSkills.includes('react') && good.matchedSkills.includes('docker'));
check('breakdown sums to weighted total (within 2..97 clamp)', (() => {
  const weighted =
    good.breakdown.skills * 0.45 + good.breakdown.title * 0.25 + good.breakdown.location * 0.15 +
    good.breakdown.language * 0.1 + good.breakdown.seniority * 0.05;
  const clamped = Math.min(0.97, Math.max(0.02, weighted));
  return Math.abs(clamped - good.hiringChance / 100) < 0.03;
})());

const ranked = rankJobs(profile, [badJob, goodJob]);
check('rankJobs sorts best first', ranked[0].title === goodJob.title);

/* --- Europass JSON parsing ----------------------------------------- */
console.log('Europass JSON parser');
const jsonProfile = parseJson(JSON.stringify({
  profile: {
    personalInformation: { firstName: 'Jan', lastName: 'Kowalski', emails: ['jan@example.com'], city: 'Warsaw', country: 'Poland' },
    workExperiences: [{ occupation: 'Data Analyst', employer: 'DataCo', startDate: '2020-01', ongoing: true, mainActivities: 'SQL, Power BI, Excel and Python dashboards' }],
    languageSkills: [{ language: 'Polish', motherTongue: true }, { language: 'English', overallLevel: 'B2' }],
  },
}));
check('json name', jsonProfile.name === 'Jan Kowalski');
check('json job title', jsonProfile.jobTitles.includes('Data Analyst'));
check('json skills include sql', jsonProfile.skills.includes('sql'));
check('json mother tongue native', jsonProfile.languages[0].level === 'native');

/* --- Plain text fallback ------------------------------------------- */
console.log('Plain text fallback');
const textProfile = parsePlainText('Curriculum Vitae\nWork Experience\nSoftware Engineer\nSkills\nJava, Spring, SQL, Docker');
check('text job title found', textProfile.jobTitles.includes('Software Engineer'));
check('text skills found', textProfile.skills.includes('java') && textProfile.skills.includes('docker'));

/* --- End-to-end demo pipeline -------------------------------------- */
console.log('End-to-end (demo mode)');
const { jobs, providerStatus } = await searchAllProviders(profile, { demoMode: true });
check('demo provider returns jobs', jobs.length >= 10, `got ${jobs.length}`);
check('demo provider status ok', providerStatus.length === 1 && providerStatus[0].status === 'ok');
const rankedDemo = rankJobs(profile, jobs);
check('every job has a hiring chance 2..97', rankedDemo.every((j) => j.match.hiringChance >= 2 && j.match.hiringChance <= 97));
check('developer jobs outrank nursing job', (() => {
  const dev = rankedDemo.findIndex((j) => /Software Engineer \(TypeScript/.test(j.title));
  const nurse = rankedDemo.findIndex((j) => /Nurse/.test(j.title));
  return dev !== -1 && nurse !== -1 && dev < nurse;
})());

/* --- Vercel function smoke test ------------------------------------ */
console.log('Vercel function (api/index.js)');
const { default: vercelApp } = await import('../api/index.js');
check('exports a request handler', typeof vercelApp === 'function');
const http = await import('node:http');
await new Promise((resolve) => {
  const server = http.createServer(vercelApp).listen(0, async () => {
    const port = server.address().port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/providers`);
      const list = await res.json();
      check('GET /api/providers returns 200 JSON', res.status === 200 && Array.isArray(list) && list.length === 9, `status ${res.status}`);

      const fd = new FormData();
      fd.append('cv', new Blob([xmlBuffer], { type: 'application/xml' }), 'cv.xml');
      fd.append('demo', '1');
      const res2 = await fetch(`http://127.0.0.1:${port}/api/match`, { method: 'POST', body: fd });
      const data = await res2.json();
      check('POST /api/match (demo) returns ranked jobs', res2.status === 200 && data.jobs.length >= 10, `status ${res2.status}`);

      // Two-step flow: parse, then search the parsed (and tweakable) profile.
      const fdParse = new FormData();
      fdParse.append('cv', new Blob([xmlBuffer], { type: 'application/xml' }), 'cv.xml');
      const resParse = await fetch(`http://127.0.0.1:${port}/api/parse`, { method: 'POST', body: fdParse });
      const parsed = await resParse.json();
      check('POST /api/parse returns a profile only', resParse.status === 200 && parsed.profile && !parsed.jobs, `status ${resParse.status}`);

      const resSearch = await fetch(`http://127.0.0.1:${port}/api/search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile: parsed.profile, filters: { countries: ['de'] }, demo: true }),
      });
      const searched = await resSearch.json();
      check('POST /api/search (demo) returns ranked jobs', resSearch.status === 200 && searched.jobs.length >= 10, `status ${resSearch.status}`);

      const resBad = await fetch(`http://127.0.0.1:${port}/api/search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filters: {} }),
      });
      check('POST /api/search without profile returns 400', resBad.status === 400, `status ${resBad.status}`);

      const fd3 = new FormData();
      fd3.append('cv', new Blob([new Uint8Array(5 * 1024 * 1024)]), 'big.xml');
      const res3 = await fetch(`http://127.0.0.1:${port}/api/match`, { method: 'POST', body: fd3 });
      check('oversize upload returns 413 JSON', res3.status === 413 && (await res3.json()).error.includes('upload limit'), `status ${res3.status}`);
    } catch (e) {
      check('function smoke test ran', false, e.message);
    } finally {
      server.close(resolve);
    }
  });
});

console.log(failures ? `\n${failures} test(s) FAILED` : '\nAll tests passed');
process.exit(failures ? 1 : 0);
