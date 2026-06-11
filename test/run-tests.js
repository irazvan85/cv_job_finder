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
      check('GET /api/providers returns 200 JSON', res.status === 200 && Array.isArray(list) && list.length === 6, `status ${res.status}`);

      const fd = new FormData();
      fd.append('cv', new Blob([xmlBuffer], { type: 'application/xml' }), 'cv.xml');
      fd.append('demo', '1');
      const res2 = await fetch(`http://127.0.0.1:${port}/api/match`, { method: 'POST', body: fd });
      const data = await res2.json();
      check('POST /api/match (demo) returns ranked jobs', res2.status === 200 && data.jobs.length >= 10, `status ${res2.status}`);

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
