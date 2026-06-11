#!/usr/bin/env node
/**
 * CLI mode: parse a Europass CV, search the providers, and print the
 * ranked job table to the terminal. Also writes job-matches.csv.
 *
 *   node src/cli.js <cv-file> [--demo] [--csv <path>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseEuropassCv } from './europass/parser.js';
import { searchAllProviders } from './providers/index.js';
import { rankJobs } from './matching/scorer.js';

const args = process.argv.slice(2);
const demoMode = args.includes('--demo') || process.env.DEMO === '1';
const csvFlag = args.indexOf('--csv');
const csvPath = csvFlag >= 0 ? args[csvFlag + 1] : 'job-matches.csv';
const cvFile = args.find((a) => !a.startsWith('--') && a !== csvPath);

if (!cvFile) {
  console.error('Usage: node src/cli.js <europass-cv.(xml|json|pdf)> [--demo] [--csv <path>]');
  process.exit(1);
}

const buffer = fs.readFileSync(cvFile);
const profile = await parseEuropassCv(buffer, path.basename(cvFile));

console.log(`\nCV: ${profile.name || '(name not found)'} — ${profile.headline || 'no headline'}`);
console.log(`Location: ${[profile.location.city, profile.location.country].filter(Boolean).join(', ') || 'unknown'}`);
console.log(`Experience: ${profile.totalExperienceYears} years (${profile.seniority})`);
console.log(`Languages: ${profile.languages.map((l) => `${l.name} (${l.level})`).join(', ') || 'none found'}`);
console.log(`Skills: ${profile.skills.join(', ') || 'none recognised'}\n`);

if (!profile.skills.length && !profile.jobTitles.length) {
  console.error('Could not extract skills or job titles from this file — is it a Europass CV?');
  process.exit(2);
}

console.log(demoMode ? 'Searching demo data…' : 'Searching European job platforms…');
const { jobs, providerStatus } = await searchAllProviders(profile, { demoMode });

for (const s of providerStatus) {
  const note = s.status === 'ok' ? `${s.count} jobs` : s.status === 'skipped' ? 'skipped (no API key)' : `error: ${s.detail}`;
  console.log(`  ${s.status === 'ok' ? '✓' : s.status === 'skipped' ? '–' : '✗'} ${s.name}: ${note}`);
}

const ranked = rankJobs(profile, jobs);
if (!ranked.length) {
  console.log('\nNo jobs retrieved. If the live APIs are unreachable from this network, retry with --demo.');
  process.exit(0);
}

console.log(`\n${ranked.length} matching jobs, best first:\n`);
console.table(
  ranked.slice(0, 30).map((j) => ({
    'Chance': `${j.match.hiringChance}% ${j.match.label}`,
    'Job title': truncate(j.title, 42),
    'Company': truncate(j.company, 24),
    'Location': truncate(j.location + (j.remote ? ' (remote)' : ''), 26),
    'Salary': truncate(j.salary || '—', 20),
    'Source': j.source,
    'Matched skills': truncate(j.match.matchedSkills.join(', ') || '—', 36),
  }))
);

const header = ['Hiring chance %', 'Label', 'Job title', 'Company', 'Location', 'Remote', 'Salary', 'Posted', 'Source', 'Matched skills', 'URL'];
const rows = ranked.map((j) => [
  j.match.hiringChance, j.match.label, j.title, j.company, j.location,
  j.remote ? 'yes' : 'no', j.salary, j.postedDate, j.source,
  j.match.matchedSkills.join('; '), j.url,
]);
const csv = [header, ...rows]
  .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
  .join('\r\n');
fs.writeFileSync(csvPath, '\uFEFF' + csv);
console.log(`Full results written to ${csvPath}`);

function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
