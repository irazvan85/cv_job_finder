/**
 * Europass CV parser.
 *
 * Supports the three ways a Europass CV is commonly delivered:
 *  - Europass XML (v3.x "SkillsPassport" schema, the classic europass.cedefop format)
 *  - Europass JSON (the new europass.europa.eu profile export)
 *  - Europass PDF (the official PDFs embed the XML/JSON document as an
 *    attachment; we extract it, and fall back to plain-text extraction)
 *
 * Everything is normalised into a single CV profile object that the
 * matching engine consumes.
 */

import { XMLParser } from 'fast-xml-parser';
import { extractFromPdf } from './pdf-extract.js';
import { extractSkillTokens } from '../matching/skills.js';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** @typedef {ReturnType<typeof emptyProfile>} CvProfile */

function emptyProfile() {
  return {
    name: '',
    email: '',
    phone: '',
    location: { city: '', country: '', countryCode: '' },
    headline: '',
    jobTitles: /** @type {string[]} */ ([]),
    skills: /** @type {string[]} */ ([]),
    languages: /** @type {{code: string, name: string, level: string}[]} */ ([]),
    education: /** @type {{title: string, organisation: string, from: string, to: string}[]} */ ([]),
    experience: /** @type {{position: string, employer: string, from: string, to: string, description: string}[]} */ ([]),
    totalExperienceYears: 0,
    seniority: 'mid',
    rawText: '',
    sourceFormat: '',
  };
}

/**
 * Parse a Europass CV from a buffer. Format is detected from the
 * filename extension and the content itself.
 * @param {Buffer} buffer
 * @param {string} filename
 * @returns {Promise<CvProfile>}
 */
export async function parseEuropassCv(buffer, filename = '') {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const head = buffer.subarray(0, 512).toString('utf8').trimStart();

  if (ext === 'pdf' || head.startsWith('%PDF')) {
    const extracted = await extractFromPdf(buffer);
    if (extracted.xml) return parseXml(extracted.xml);
    if (extracted.json) return parseJson(extracted.json);
    return parsePlainText(extracted.text);
  }
  if (ext === 'json' || head.startsWith('{') || head.startsWith('[')) {
    return parseJson(buffer.toString('utf8'));
  }
  if (ext === 'xml' || head.startsWith('<')) {
    return parseXml(buffer.toString('utf8'));
  }
  return parsePlainText(buffer.toString('utf8'));
}

/* ------------------------------------------------------------------ */
/* Europass XML (SkillsPassport v3)                                    */
/* ------------------------------------------------------------------ */

export function parseXml(xmlString) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    trimValues: true,
  });
  const doc = parser.parse(xmlString);
  const root = doc.SkillsPassport || doc.Europass || doc;
  const learner = root.LearnerInfo || {};
  const profile = emptyProfile();
  profile.sourceFormat = 'europass-xml';

  // Identification
  const ident = learner.Identification || {};
  const personName = ident.PersonName || {};
  profile.name = [text(personName.FirstName), text(personName.Surname)]
    .filter(Boolean)
    .join(' ');
  const contact = ident.ContactInfo || {};
  profile.email = text(contact.Email && contact.Email.Contact);
  const telephones = asArray(contact.TelephoneList && contact.TelephoneList.Telephone);
  if (telephones.length) profile.phone = text(telephones[0].Contact);
  const address = (contact.Address && contact.Address.Contact) || {};
  profile.location.city = text(address.Municipality);
  const country = address.Country || {};
  profile.location.country = text(country.Label);
  profile.location.countryCode = text(country.Code).toUpperCase();

  // Headline (e.g. preferred occupation)
  const headline = learner.Headline || {};
  profile.headline = text(headline.Description && headline.Description.Label) || text(headline.Description);

  // Work experience
  const workItems = asArray(learner.WorkExperienceList && learner.WorkExperienceList.WorkExperience);
  for (const item of workItems) {
    const position = text(item.Position && item.Position.Label) || text(item.Position);
    const employer = text(item.Employer && item.Employer.Name);
    const period = item.Period || {};
    profile.experience.push({
      position,
      employer,
      from: periodDate(period.From),
      to: period.Current === true || period.Current === 'true' ? 'present' : periodDate(period.To),
      description: stripHtml(text(item.Activities)),
    });
    if (position) profile.jobTitles.push(position);
  }

  // Education
  const eduItems = asArray(learner.EducationList && learner.EducationList.Education);
  for (const item of eduItems) {
    profile.education.push({
      title: text(item.Title),
      organisation: text(item.Organisation && item.Organisation.Name),
      from: periodDate((item.Period || {}).From),
      to: periodDate((item.Period || {}).To),
    });
  }

  // Languages
  const skills = learner.Skills || {};
  const linguistic = skills.Linguistic || {};
  for (const lang of asArray(linguistic.MotherTongueList && linguistic.MotherTongueList.MotherTongue)) {
    const d = lang.Description || {};
    profile.languages.push({ code: text(d.Code).toLowerCase(), name: text(d.Label), level: 'native' });
  }
  for (const lang of asArray(linguistic.ForeignLanguageList && linguistic.ForeignLanguageList.ForeignLanguage)) {
    const d = lang.Description || {};
    const prof = lang.ProficiencyLevel || {};
    const levels = CEFR_LEVELS.filter((l) =>
      [prof.Listening, prof.Reading, prof.SpokenInteraction, prof.SpokenProduction, prof.Writing]
        .map(text)
        .includes(l)
    );
    profile.languages.push({
      code: text(d.Code).toLowerCase(),
      name: text(d.Label),
      level: levels.length ? levels[levels.length - 1] : 'B1',
    });
  }

  // Skill text from all free-text skill sections + work descriptions
  const skillText = [
    text(skills.Computer && skills.Computer.Description),
    text(skills.Communication && skills.Communication.Description),
    text(skills.Organisational && skills.Organisational.Description),
    text(skills.JobRelated && skills.JobRelated.Description),
    text(skills.Other && skills.Other.Description),
    ...profile.experience.map((e) => `${e.position} ${e.description}`),
    ...profile.education.map((e) => e.title),
    profile.headline,
  ]
    .filter(Boolean)
    .join('\n');
  profile.rawText = stripHtml(skillText);
  profile.skills = extractSkillTokens(profile.rawText);

  finaliseProfile(profile);
  return profile;
}

/* ------------------------------------------------------------------ */
/* Europass JSON (new europass.europa.eu export)                       */
/* ------------------------------------------------------------------ */

export function parseJson(jsonString) {
  const doc = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
  const profile = emptyProfile();
  profile.sourceFormat = 'europass-json';

  // New Europass exports nest the CV under profile / personalInformation;
  // be liberal about where fields live.
  const p = doc.profile || doc;
  const personal = p.personalInformation || p.identification || {};
  profile.name =
    [personal.firstName, personal.lastName].filter(Boolean).join(' ') ||
    personal.fullName ||
    '';
  const emails = personal.emails || (personal.email ? [personal.email] : []);
  profile.email = typeof emails[0] === 'string' ? emails[0] : '';
  profile.location.city = personal.city || (personal.address || {}).city || '';
  profile.location.country = personal.country || (personal.address || {}).country || '';
  profile.location.countryCode = (personal.nationality || '').toUpperCase().slice(0, 2);

  const work = p.workExperiences || p.workExperience || [];
  for (const item of asArray(work)) {
    const position = item.occupation || item.position || item.title || '';
    profile.experience.push({
      position,
      employer: item.employer || item.company || '',
      from: item.startDate || '',
      to: item.ongoing ? 'present' : item.endDate || '',
      description: stripHtml(item.mainActivities || item.description || ''),
    });
    if (position) profile.jobTitles.push(position);
  }
  for (const item of asArray(p.educationTrainings || p.education || [])) {
    profile.education.push({
      title: item.qualification || item.title || '',
      organisation: item.organisationName || item.organisation || '',
      from: item.startDate || '',
      to: item.endDate || '',
    });
  }
  for (const lang of asArray(p.languageSkills || p.languages || [])) {
    if (typeof lang === 'string') {
      profile.languages.push({ code: '', name: lang, level: 'B1' });
      continue;
    }
    profile.languages.push({
      code: (lang.languageCode || lang.code || '').toLowerCase(),
      name: lang.language || lang.name || '',
      level: lang.motherTongue ? 'native' : lang.overallLevel || lang.level || 'B1',
    });
  }

  const skillList = asArray(p.digitalSkills || []).concat(asArray(p.skills || []), asArray(p.otherSkills || []));
  const skillText = [
    skillList.map((s) => (typeof s === 'string' ? s : s.name || s.description || '')).join('\n'),
    ...profile.experience.map((e) => `${e.position} ${e.description}`),
    ...profile.education.map((e) => e.title),
  ]
    .filter(Boolean)
    .join('\n');
  profile.rawText = stripHtml(skillText);
  profile.skills = extractSkillTokens(profile.rawText);

  finaliseProfile(profile);
  return profile;
}

/* ------------------------------------------------------------------ */
/* Plain text fallback (PDF without embedded data, txt files)          */
/* ------------------------------------------------------------------ */

export function parsePlainText(textContent) {
  const profile = emptyProfile();
  profile.sourceFormat = 'text';
  profile.rawText = textContent || '';

  const emailMatch = profile.rawText.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (emailMatch) profile.email = emailMatch[0];

  // Pull lines that look like job titles after a work-experience heading.
  const lines = profile.rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let inWork = false;
  for (const line of lines) {
    if (/^(work experience|professional experience|experience)$/i.test(line)) {
      inWork = true;
      continue;
    }
    if (/^(education|training|skills|languages)/i.test(line)) inWork = false;
    if (inWork && line.length < 80 && /^[A-Z]/.test(line) && !/\d{4}/.test(line)) {
      profile.jobTitles.push(line);
      if (profile.jobTitles.length >= 5) inWork = false;
    }
  }
  profile.skills = extractSkillTokens(profile.rawText);
  finaliseProfile(profile);
  return profile;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function finaliseProfile(profile) {
  profile.jobTitles = [...new Set(profile.jobTitles.filter(Boolean))];
  if (!profile.headline && profile.jobTitles.length) profile.headline = profile.jobTitles[0];
  profile.totalExperienceYears = estimateExperienceYears(profile.experience);
  profile.seniority =
    profile.totalExperienceYears >= 7 ? 'senior' : profile.totalExperienceYears >= 3 ? 'mid' : 'junior';
}

function estimateExperienceYears(experience) {
  let months = 0;
  for (const item of experience) {
    const from = parseYearMonth(item.from);
    const to = item.to === 'present' ? new Date() : parseYearMonth(item.to);
    if (from && to && to > from) {
      months += (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    }
  }
  return Math.round((months / 12) * 10) / 10;
}

function parseYearMonth(value) {
  if (!value) return null;
  const m = String(value).match(/(\d{4})(?:-(\d{1,2}))?/);
  if (!m) return null;
  return new Date(Number(m[1]), m[2] ? Number(m[2]) - 1 : 0, 1);
}

function periodDate(node) {
  if (!node) return '';
  const year = node['@_year'] ?? node.Year ?? '';
  const month = node['@_month'] ?? node.Month ?? '';
  const m = String(month).replace(/^--/, '');
  return [year, m && String(m).padStart(2, '0')].filter(Boolean).join('-');
}

function text(value) {
  if (value == null) return '';
  if (typeof value === 'object') return text(value['#text'] ?? value.Label ?? '');
  return String(value).trim();
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
