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
import { analyseCv } from '../src/matching/jobAreas.js';
import { topDemandedJobs, canonicalRole } from '../src/matching/demand.js';
import { searchAllProviders } from '../src/providers/index.js';
import { keywordsFromProfile, keywordTerms, matchesAnyTerm, marketsFor, parseRssItems, rssDate } from '../src/providers/util.js';
import {
  foldDiacritics, extractRomanianSkills, normalizeLocation,
  requiredLanguagesRo, normalizeRoSalary, wantsJuniorRo,
} from '../src/matching/romanian.js';

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

/* --- Romanian localisation ---------------------------------------- */
console.log('Romanian localisation');
check('diacritics folded', foldDiacritics('Timișoara Iași București') === 'Timisoara Iasi Bucuresti');
check('RO skill: contabilitate → accounting', extractRomanianSkills('Experiență în contabilitate și audit').includes('accounting'));
check('RO skill: resurse umane → hr', extractRomanianSkills('Departament resurse umane').includes('hr'));
check('RO skill diacritics tolerated', extractRomanianSkills('vânzări și achiziții').includes('sales'));
check('English text yields no spurious RO skills', extractRomanianSkills('React and Node.js developer').length === 0);
check('extractSkillTokens picks up RO terms', extractSkillTokens('Responsabil de contabilitate si salarizare').includes('accounting'));
check('București ↔ Bucharest bridge', normalizeLocation('București, România').includes('bucharest'));
check('diacritic city normalises', normalizeLocation('Cluj-Napoca') === normalizeLocation('Cluj-Napoca'.normalize('NFD')));
check('RO language requirement detected', requiredLanguagesRo('Limba engleză nivel avansat obligatoriu').includes('en'));
check('RO language: germană detected', requiredLanguagesRo('Cunoștințe de limba germană').includes('de'));
check('RO junior cue detected', wantsJuniorRo('Post pentru debutant, fără experiență') === true);
check('RO salary RON net normalised', normalizeRoSalary('12.000 - 16.000 RON net') === '12,000–16,000 RON net');
check('RO salary lei brut → gross', normalizeRoSalary('6.000 - 8.000 lei brut') === '6,000–8,000 RON gross');
check('RO salary single value', normalizeRoSalary('2500 lei') === '2,500 RON');
check('RO salary empty passes through', normalizeRoSalary('') === '');

// Scoring a Romanian-language ad against the (Romanian) sample CV.
const roDevJob = {
  title: 'Dezvoltator Full Stack (React/Node.js)',
  description: 'Căutăm un dezvoltator cu experiență în React, TypeScript, Node.js și PostgreSQL. Docker, CI/CD, agile. Limba engleză nivel avansat obligatorie.',
  location: 'București, România', country: 'ro', remote: false,
};
const roScore = scoreJob(profile, roDevJob);
check('RO dev ad matches RO dev CV well', roScore.hiringChance >= 60, `got ${roScore.hiringChance}%`);
check('RO ad reports matched skills', roScore.matchedSkills.includes('react') && roScore.matchedSkills.includes('node.js'));

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

/* --- Europass plain-text PDF layout -------------------------------- */
console.log('Europass plain-text PDF layout');
// Mirrors what pdf-parse produces for an official Europass PDF that has
// no embedded XML/JSON attachment. U+00A0 is intentionally used in the
// "Mother tongue(s)" line to match real PDF output.
const EURO_PLAINTEXT = [
  'John Smith',
  'Date of birth: 01/01/1985 | Nationality: Romanian | Gender: Male',
  'Phone: (+40) 721111222 (Mobile) | Address: Str. Test, 1, Timisoara, Romania (Home)',
  '',
  'WORK EXPERIENCE',
  '',
  '01/01/2020 - CURRENT  -  Timisoara, Romania',
  'DEVOPS ENGINEEREXAMPLECORP',
  '• Build and manage CI/CD pipelines using Docker and Kubernetes',
  '',
  '01/06/2015 - 31/12/2019  -  Bucharest, Romania',
  'SOFTWARE ENGINEERTECH SOLUTIONS',
  '• Developed backend services using Java and Spring Boot',
  '',
  'EDUCATION & TRAINING',
  '',
  '01/10/2004 - 30/06/2008  -  Cluj-Napoca, Romania',
  'Bachelor of Computer Science- Polytechnic University of Timisoara',
  '',
  'LANGUAGE SKILLS',
  '',
  'Mother tongue(s): Romanian',
  '',
  'ENGLISH C1 C1 C1 C1 C1',
].join('\n');

const euroPlainProfile = parsePlainText(EURO_PLAINTEXT);

check('euro plain-text: name detected', euroPlainProfile.name === 'John Smith', euroPlainProfile.name);
check('euro plain-text: phone extracted', euroPlainProfile.phone === '+40721111222', euroPlainProfile.phone);
check('euro plain-text: city extracted', euroPlainProfile.location.city === 'Timisoara', euroPlainProfile.location.city);
check('euro plain-text: country extracted', euroPlainProfile.location.country === 'Romania', euroPlainProfile.location.country);
check('euro plain-text: 2 work entries parsed', euroPlainProfile.experience.length === 2, `got ${euroPlainProfile.experience.length}`);
check('euro plain-text: current job to=present', euroPlainProfile.experience[0].to === 'present', euroPlainProfile.experience[0].to);
check('euro plain-text: DEVOPS position split', euroPlainProfile.experience[0].position === 'DEVOPS ENGINEER', euroPlainProfile.experience[0].position);
check('euro plain-text: employer split from position', euroPlainProfile.experience[0].employer === 'EXAMPLECORP', euroPlainProfile.experience[0].employer);
check('euro plain-text: experience years > 0', euroPlainProfile.totalExperienceYears > 0, `got ${euroPlainProfile.totalExperienceYears}`);
check('euro plain-text: seniority is senior', euroPlainProfile.seniority === 'senior', euroPlainProfile.seniority);
check('euro plain-text: education entry parsed', euroPlainProfile.education.length === 1, `got ${euroPlainProfile.education.length}`);
check('euro plain-text: education title parsed', /bachelor/i.test(euroPlainProfile.education[0]?.title), euroPlainProfile.education[0]?.title);
check('euro plain-text: native language detected', euroPlainProfile.languages.some((l) => l.level === 'native'), JSON.stringify(euroPlainProfile.languages));
check('euro plain-text: mother tongue is Romanian', euroPlainProfile.languages.some((l) => /romanian/i.test(l.name) && l.level === 'native'), JSON.stringify(euroPlainProfile.languages));
check('euro plain-text: CEFR language detected (English C1)', euroPlainProfile.languages.some((l) => /english/i.test(l.name) && l.level === 'C1'), JSON.stringify(euroPlainProfile.languages));
check('euro plain-text: docker skill extracted', euroPlainProfile.skills.includes('docker'), JSON.stringify(euroPlainProfile.skills));
check('euro plain-text: kubernetes skill extracted', euroPlainProfile.skills.includes('kubernetes'), JSON.stringify(euroPlainProfile.skills));

/* --- CV analysis & job-area recommendations ------------------------- */
console.log('CV analysis & job-area recommendations');
const cvAnalysis = analyseCv(profile);
check('summary reflects experience years', cvAnalysis.summary.totalExperienceYears === profile.totalExperienceYears);
check('summary reflects seniority', cvAnalysis.summary.seniority === profile.seniority);
check('summary reflects skill count', cvAnalysis.summary.skillCount === profile.skills.length);
check('strengths is non-empty for a skills-rich CV', cvAnalysis.strengths.length > 0, JSON.stringify(cvAnalysis.strengths));
check('strengths entries carry a domain', cvAnalysis.strengths.every((s) => typeof s.domain === 'string' && s.domain.length > 0));
check('recommends Software Engineering for a React/Node/K8s dev CV', cvAnalysis.recommendedAreas.some((a) => a.domain === 'Software Engineering'), JSON.stringify(cvAnalysis.recommendedAreas.map((a) => a.domain)));
check('recommended areas capped at 4', cvAnalysis.recommendedAreas.length <= 4);
check('recommended areas sorted by score desc', cvAnalysis.recommendedAreas.every((a, i, arr) => i === 0 || arr[i - 1].score >= a.score));
check('each recommended area has example titles or matched skills', cvAnalysis.recommendedAreas.every((a) => a.exampleTitles.length > 0 || a.matchedSkills.length > 0));
check('no gaps flagged for a complete CV', cvAnalysis.gaps.length === 0, JSON.stringify(cvAnalysis.gaps));

const sparseProfile = parsePlainText('John Doe\njohn@example.com');
const sparseAnalysis = analyseCv(sparseProfile);
check('sparse CV flags few skills', sparseAnalysis.gaps.some((g) => /few skills/i.test(g)));
check('sparse CV flags no languages', sparseAnalysis.gaps.some((g) => /language/i.test(g)));
check('sparse CV flags no headline', sparseAnalysis.gaps.some((g) => /headline/i.test(g)));
check('sparse CV flags no experience', sparseAnalysis.gaps.some((g) => /experience/i.test(g)));
check('sparse CV yields no recommendations', sparseAnalysis.recommendedAreas.length === 0);

const nurseProfile = parsePlainText('Jane Nurse\nWork Experience\nRegistered Nurse\nSkills\nnursing, patient care');
const nurseAnalysis = analyseCv(nurseProfile);
check('healthcare title+skills recommend Healthcare & Education', nurseAnalysis.recommendedAreas[0]?.domain === 'Healthcare & Education', JSON.stringify(nurseAnalysis.recommendedAreas));

/* --- In-demand jobs by city ---------------------------------------- */
console.log('In-demand jobs by city');
check('canonicalRole strips seniority', canonicalRole('Senior Software Engineer') === 'software engineer', canonicalRole('Senior Software Engineer'));
check('canonicalRole strips parenthetical tech', canonicalRole('Software Engineer (TypeScript/React)') === 'software engineer', canonicalRole('Software Engineer (TypeScript/React)'));
check('canonicalRole strips gender tag', canonicalRole('Data Analyst (m/f/d)') === 'data analyst', canonicalRole('Data Analyst (m/f/d)'));
check('canonicalRole strips trailing qualifier', canonicalRole('DevOps Engineer - Remote') === 'devops engineer', canonicalRole('DevOps Engineer - Remote'));
check('canonicalRole drops empty title', canonicalRole('') === '');

const demandJobs = [
  { title: 'Senior Software Engineer', company: 'Acme', location: 'Timișoara, Romania', country: 'ro', remote: false, source: 'EURES', url: 'https://e/1' },
  { title: 'Software Engineer (Java)', company: 'Beta', location: 'Timisoara, RO', country: 'ro', remote: true, source: 'eJobs', url: 'https://e/2' },
  { title: 'Junior Software Engineer', company: 'Gamma', location: 'Timișoara', country: 'ro', remote: false, source: 'BestJobs', url: '' },
  { title: 'Data Analyst (m/f/d)', company: 'Delta', location: 'Timișoara, Romania', country: 'ro', remote: false, source: 'EURES', url: 'https://e/4' },
  { title: 'Mechanical Engineer', company: 'Epsilon', location: 'Cluj-Napoca, Romania', country: 'ro', remote: false, source: 'EURES', url: 'https://e/5' },
];
const demand = topDemandedJobs(demandJobs, { city: 'Timisoara', limit: 10 });
check('demand filters by city (excludes Cluj)', demand.totalConsidered === 4, `got ${demand.totalConsidered}`);
check('demand top role is Software Engineer', demand.roles[0].title === 'Software Engineer', JSON.stringify(demand.roles[0]));
check('demand groups seniority variants', demand.roles[0].count === 3, `got ${demand.roles[0].count}`);
check('demand reports share %', demand.roles[0].share === 75, `got ${demand.roles[0].share}`);
check('demand counts remote vacancies', demand.roles[0].remoteCount === 1, `got ${demand.roles[0].remoteCount}`);
check('demand lists hiring companies', demand.roles[0].companies.includes('Acme') && demand.roles[0].companies.includes('Beta'));
check('demand lists sources', demand.roles[0].sources.includes('EURES'));
check('demand picks a sample url', demand.roles[0].sampleUrl === 'https://e/1', demand.roles[0].sampleUrl);
check('demand ranks by count desc', demand.roles.every((r, i, a) => i === 0 || a[i - 1].count >= r.count));
check('demand diacritics-folded city match (Timișoara ≡ Timisoara)', demand.roles.some((r) => r.title === 'Data Analyst'));
const demandAll = topDemandedJobs(demandJobs, { city: '', limit: 2 });
check('demand without city aggregates all', demandAll.totalConsidered === 5, `got ${demandAll.totalConsidered}`);
check('demand respects limit', demandAll.roles.length === 2, `got ${demandAll.roles.length}`);

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

      const resRo = await fetch(`http://127.0.0.1:${port}/api/insights/romania`);
      const roJson = await resRo.json();
      check('GET /api/insights/romania returns 200', resRo.status === 200, `status ${resRo.status}`);
      check('Romania insights has city profiles', Array.isArray(roJson.CITY_PROFILES) && roJson.CITY_PROFILES.length >= 5, `got ${roJson.CITY_PROFILES?.length}`);
      check('Romania insights has sector outlook', Array.isArray(roJson.SECTOR_OUTLOOK) && roJson.SECTOR_OUTLOOK.length >= 10, `got ${roJson.SECTOR_OUTLOOK?.length}`);
      check('Romania insights has salary benchmarks', Array.isArray(roJson.SALARY_BENCHMARKS) && roJson.SALARY_BENCHMARKS.length >= 10, `got ${roJson.SALARY_BENCHMARKS?.length}`);
      check('Romania insights has career tips', Array.isArray(roJson.CAREER_TIPS) && roJson.CAREER_TIPS.length >= 5, `got ${roJson.CAREER_TIPS?.length}`);

      const fd = new FormData();
      fd.append('cv', new Blob([xmlBuffer], { type: 'application/xml' }), 'cv.xml');
      fd.append('demo', '1');
      const res2 = await fetch(`http://127.0.0.1:${port}/api/match`, { method: 'POST', body: fd });
      const data = await res2.json();
      check('POST /api/match (demo) returns ranked jobs', res2.status === 200 && data.jobs.length >= 10, `status ${res2.status}`);
      check('POST /api/match includes CV analysis', !!(data.analysis && Array.isArray(data.analysis.recommendedAreas)), JSON.stringify(data.analysis));

      // Two-step flow: parse, then search the parsed (and tweakable) profile.
      const fdParse = new FormData();
      fdParse.append('cv', new Blob([xmlBuffer], { type: 'application/xml' }), 'cv.xml');
      const resParse = await fetch(`http://127.0.0.1:${port}/api/parse`, { method: 'POST', body: fdParse });
      const parsed = await resParse.json();
      check('POST /api/parse returns a profile only', resParse.status === 200 && parsed.profile && !parsed.jobs, `status ${resParse.status}`);
      check('POST /api/parse includes CV analysis', !!(parsed.analysis && Array.isArray(parsed.analysis.recommendedAreas)), JSON.stringify(parsed.analysis));

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

      const resDemand = await fetch(`http://127.0.0.1:${port}/api/demand`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ city: 'Berlin', country: 'de', demo: true }),
      });
      const demandData = await resDemand.json();
      check('POST /api/demand (demo) returns ranked roles',
        resDemand.status === 200 && demandData.demand && Array.isArray(demandData.demand.roles) && demandData.demand.roles.length >= 1,
        `status ${resDemand.status} ${JSON.stringify(demandData.demand)}`);

      const resDemandBad = await fetch(`http://127.0.0.1:${port}/api/demand`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ demo: true }),
      });
      check('POST /api/demand without city returns 400', resDemandBad.status === 400, `status ${resDemandBad.status}`);

      const resRoleInfo = await fetch(`http://127.0.0.1:${port}/api/role-info`);
      const roleInfoArr = await resRoleInfo.json();
      check('GET /api/role-info returns 200', resRoleInfo.status === 200, `status ${resRoleInfo.status}`);
      check('GET /api/role-info returns non-empty array', Array.isArray(roleInfoArr) && roleInfoArr.length >= 20, `got ${roleInfoArr?.length}`);
      check('role-info entries have required fields', roleInfoArr.every((r) => Array.isArray(r.matches) && r.title && r.summary && Array.isArray(r.tasks)), 'missing fields');
      check('role-info matches are non-empty strings', roleInfoArr.every((r) => r.matches.every((m) => typeof m === 'string' && m.length > 0)), 'bad match string');

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
