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
  // pdf-parse often uses non-breaking spaces (U+00A0) between words; normalise
  // them to regular spaces so skill patterns and section-header regexes match.
  profile.rawText = (textContent || '').replace(/ /g, ' ');

  const emailMatch = profile.rawText.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (emailMatch) profile.email = emailMatch[0];

  const lines = profile.rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Try the structured Europass plain-text layout first (produced by pdf-parse
  // on official Europass PDFs that have no embedded XML/JSON attachment).
  if (!tryEuropassLayout(lines, profile)) {
    // Generic fallback: scan for job titles after a work-experience heading.
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
  }

  profile.skills = extractSkillTokens(profile.rawText);
  finaliseProfile(profile);
  return profile;
}

/**
 * Parse a Europass plain-text PDF layout.
 *
 * Official Europass PDFs extracted with pdf-parse follow a predictable
 * structure: the name is the first non-blank line; contact metadata follows
 * in a pipe-separated header block; work/education entries start with a
 * "DD/MM/YYYY - DD/MM/YYYY  -  CITY, COUNTRY" date line; the position and
 * employer are concatenated on the very next line (bold font loses its
 * boundary on extraction); description bullets follow.
 *
 * Returns true if the layout was recognised and the profile filled in.
 * @param {string[]} lines
 * @param {ReturnType<typeof emptyProfile>} profile
 */
function tryEuropassLayout(lines, profile) {
  const DATE_LINE_RE = /^(\d{2}[\/]\d{2}[\/]\d{4}|\d{2}[\/]\d{4})\s*-\s*(CURRENT|\d{2}[\/]\d{2}[\/]\d{4}|\d{2}[\/]\d{4})/i;
  if (!lines.some((l) => DATE_LINE_RE.test(l))) return false;

  // ---- Header block -------------------------------------------------------
  // Name: typically the first non-blank line before the metadata pipe block.
  const metaIdx = lines.findIndex((l) =>
    /date of birth|nationality|gender|phone|email address/i.test(l)
  );
  if (metaIdx > 0) profile.name = lines[0];

  // Join the first ~8 lines (or up to the first section header) to extract
  // phone, address and countryCode from the Europass pipe-separated block.
  const headerEnd = lines.findIndex((l) => /^WORK EXPERIENCE$/i.test(l));
  const headerLines = lines.slice(0, headerEnd > 0 ? headerEnd : 8);
  const headerText = headerLines.join(' ');

  // Phone: "Phone:(+40) 721933949 (Mobile)" — may wrap across two lines, so
  // we join before matching and strip the parenthetical country prefix.
  const phoneM = headerText.match(/Phone:\s*(\(\+[\d]+\)[\d\s]+?)(?:\s*\(Mobile\)|\s*\|)/i);
  if (phoneM) {
    profile.phone = phoneM[1].replace(/\s+/g, '').replace(/\((\+\d+)\)/, '$1');
  }

  // Address: "Address: Street, Nr, City, Country (Home)" — take last two
  // comma-parts (before stripping parenthetical annotation) as city/country.
  const addrM = headerText.match(/Address:\s*(.+?)(?:\s*$)/i);
  if (addrM) {
    const parts = addrM[1].replace(/\([^)]*\)/g, '').split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      profile.location.country = parts[parts.length - 1];
      profile.location.city = parts[parts.length - 2];
    }
  }

  // ---- Section scanner ----------------------------------------------------
  let section = null;       // 'work' | 'edu' | 'lang' | null
  let currentEntry = null;  // partially-built work/edu object
  let pendingEduTitle = null;  // multi-line education title accumulator

  const flushEntry = () => {
    if (!currentEntry) return;
    if (section === 'work') {
      profile.experience.push(currentEntry);
    } else if (section === 'edu') {
      profile.education.push({
        title: currentEntry.position,
        organisation: currentEntry.employer,
        from: currentEntry.from,
        to: currentEntry.to,
      });
    }
    currentEntry = null;
    pendingEduTitle = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ---------- Section headers -------------------------------------------
    if (/^WORK EXPERIENCE$/i.test(line))                         { flushEntry(); section = 'work'; continue; }
    if (/^EDUCATION(\s*&\s*TRAINING)?$/i.test(line))            { flushEntry(); section = 'edu';  continue; }
    if (/^LANGUAGE\s*(SKILLS)?$/i.test(line))                   { flushEntry(); section = 'lang'; continue; }
    if (/^(JOB-?RELATED SKILLS|NETWORKS|HOBBY|DIGITAL SKILLS)$/i.test(line)) {
      flushEntry(); section = null; continue;
    }

    // ---------- Work / Education entries ----------------------------------
    if (section === 'work' || section === 'edu') {
      const dateM = line.match(/^(\d{2}[\/]\d{2}[\/]\d{4}|\d{2}[\/]\d{4})\s*-\s*(CURRENT|\d{2}[\/]\d{2}[\/]\d{4}|\d{2}[\/]\d{4})/i);
      if (dateM) {
        flushEntry();
        const from = euroDateToIso(dateM[1]);
        const to   = /^CURRENT$/i.test(dateM[2]) ? 'present' : euroDateToIso(dateM[2]);
        currentEntry = { position: '', employer: '', from, to, description: '' };

        // The title line immediately follows the date line.
        const titleLine = lines[i + 1] || '';
        if (titleLine && !DATE_LINE_RE.test(titleLine)) {
          if (section === 'work') {
            const { position, employer } = splitWorkTitleLine(titleLine);
            currentEntry.position = position;
            currentEntry.employer = employer;
          } else {
            // Education: "QUALIFICATION- INSTITUTION REST" — split on first dash
            const eduM = titleLine.match(/^(.+?)\s*[-–]\s+(.+)$/);
            if (eduM) {
              currentEntry.position  = eduM[1].trim();  // title/qualification
              currentEntry.employer  = eduM[2].trim();  // institution
              pendingEduTitle = currentEntry.employer;
            } else {
              currentEntry.position = titleLine.trim();
              pendingEduTitle = null;
            }
          }
          i++; // consume the title line
        }
        continue;
      }

      if (!currentEntry) continue;

      // Education institution names sometimes wrap onto the next line.
      if (section === 'edu' && pendingEduTitle && !/^[•·]/.test(line) && !/^[A-Z0-9]+$/.test(line)) {
        if (currentEntry.description === '') {
          currentEntry.employer += ' ' + line;
        } else {
          currentEntry.description += '\n' + line.replace(/^[•·]\s*/, '').replace(/​/g, '').trim();
        }
        continue;
      }

      // Bullet / description line
      const cleaned = line.replace(/^[•·]\s*/, '').replace(/​/g, '').trim();
      if (cleaned) {
        currentEntry.description += (currentEntry.description ? '\n' : '') + cleaned;
        if (section === 'edu') pendingEduTitle = null; // first desc line ends title accumulation
      }
      continue;
    }

    // ---------- Language section -----------------------------------------
    if (section === 'lang') {
      // "Mother tongue(s):" — parenthesised (s) is the Europass standard heading
      const mtM = line.match(/mother tongue[^:]*:\s*(.+)/i);
      if (mtM) {
        for (const name of mtM[1].split(/[,;/]+/).map((s) => s.trim()).filter(Boolean)) {
          profile.languages.push({ code: isoLangCode(name), name, level: 'native' });
        }
        continue;
      }
      // "ENGLISHC1C1C1C1C1" — language name concatenated with 5 CEFR scores
      const cefrM = line.match(/^([A-Z][A-Z\s\-]+?)\s*((?:[ABC][12]\s*){1,5})$/i);
      if (cefrM) {
        const name   = cefrM[1].trim();
        const levels = cefrM[2].match(/[ABC][12]/gi) || [];
        if (name && levels.length) {
          const level = levels[levels.length - 1].toUpperCase();
          profile.languages.push({ code: isoLangCode(name), name, level });
        }
      }
    }
  }
  flushEntry();

  // Populate jobTitles from work experience positions (Europass CVs often have
  // no separate "Desired Position" field).
  for (const e of profile.experience) {
    if (e.position) profile.jobTitles.push(e.position);
  }

  return true;
}

/**
 * Convert a European date string (DD/MM/YYYY or MM/YYYY) to ISO (YYYY-MM).
 * Returns the string unchanged if it does not match.
 */
function euroDateToIso(dateStr) {
  // DD/MM/YYYY
  let m = String(dateStr).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}`;
  // MM/YYYY
  m = String(dateStr).match(/^(\d{2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1]}`;
  return dateStr;
}

/**
 * Split a concatenated Europass "POSITIONEMPLOYER" line.
 *
 * Europass PDFs render the position in bold and the employer in regular
 * weight on the same line. After PDF text extraction, the two are
 * concatenated without any separator. We detect the split point by finding
 * the last occurrence of a common job-title ending keyword.
 */
function splitWorkTitleLine(line) {
  // Common terminal words of English job titles, ordered longest-first so
  // "ENGINEER" doesn't fire before "FULFILLMENT ENGINEER".
  const TITLE_ENDS = [
    'FULFILLMENT ENGINEER', 'DELIVERY MANAGER', 'NETWORK ANALYST',
    'SOFTWARE DEVELOPER', 'SOFTWARE INTEGRATOR', 'SOFTWARE ENGINEER',
    'PROJECT MANAGER', 'PRODUCT MANAGER', 'SYSTEM ADMINISTRATOR',
    'SITE RELIABILITY ENGINEER', 'TECHNICAL SUPPORT',
    'ENGINEER', 'INTEGRATOR', 'DEVELOPER', 'MANAGER', 'ANALYST',
    'SUPERVISOR', 'OPERATOR', 'SPECIALIST', 'CONSULTANT', 'ARCHITECT',
    'DIRECTOR', 'COORDINATOR', 'EDITOR', 'OFFICER', 'ADMINISTRATOR',
    'TECHNICIAN', 'DESIGNER', 'PROGRAMMER', 'DEVOPS', 'LEAD',
  ];
  for (const kw of TITLE_ENDS) {
    const idx = line.indexOf(kw);
    if (idx >= 0) {
      const end = idx + kw.length;
      // A slash right after (e.g. "EDITOR/SUPERVISOR") — keep consuming.
      const slashM = line.slice(end).match(/^\/([A-Z]+)/);
      const actualEnd = slashM ? end + 1 + slashM[1].length : end;
      const position = line.slice(0, actualEnd).trim();
      const employer = line.slice(actualEnd).trim();
      if (position && (employer || idx > 0)) return { position, employer };
    }
  }
  return { position: line.trim(), employer: '' };
}

/** Map common language names to two-letter ISO 639-1 codes. */
function isoLangCode(name) {
  const MAP = {
    romanian: 'ro', română: 'ro', english: 'en', german: 'de', french: 'fr',
    spanish: 'es', italian: 'it', hungarian: 'hu', portuguese: 'pt',
    dutch: 'nl', polish: 'pl', czech: 'cs', slovak: 'sk',
  };
  return MAP[name.toLowerCase()] || name.slice(0, 2).toLowerCase();
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
  if (!value || value === 'present') return null;
  const s = String(value);
  // ISO: YYYY-MM or YYYY (set by XML parser and euroDateToIso)
  let m = s.match(/^(\d{4})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, 1);
  // European: DD/MM/YYYY
  m = s.match(/^\d{2}\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(Number(m[2]), Number(m[1]) - 1, 1);
  // European: MM/YYYY
  m = s.match(/^(\d{2})\/(\d{4})$/);
  if (m) return new Date(Number(m[2]), Number(m[1]) - 1, 1);
  // Bare year fallback
  m = s.match(/(\d{4})/);
  if (!m) return null;
  return new Date(Number(m[1]), 0, 1);
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
