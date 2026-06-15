/**
 * Romanian localisation helpers.
 *
 * The skill dictionary and scoring heuristics are English-first, but the
 * Romanian job boards (eJobs, BestJobs, Hipo) — and many EURES vacancies —
 * post in Romanian. These helpers let the matcher understand Romanian text:
 *
 *  - diacritics folding (ș/ț/ă/â/î → s/t/a/a/i) so "Timișoara" and
 *    "Timisoara" compare equal;
 *  - a Romanian → canonical-skill alias map (e.g. "contabilitate" →
 *    "accounting") so Romanian-language ads still surface known skills;
 *  - city/location normalisation incl. the București ↔ Bucharest bridge;
 *  - Romanian salary parsing (RON/lei, net/brut);
 *  - Romanian language-requirement and seniority cues.
 *
 * Everything here keys off diacritics-folded, lowercase text, and Romanian
 * terms don't collide with English words, so enabling it never changes the
 * result for an English CV or ad.
 */

/** Strip diacritics; Romanian ș ț ă â î (and cedilla variants) all fold to ASCII. */
export function foldDiacritics(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Diacritics-folded, lowercased, whitespace-collapsed. */
export function foldLower(s) {
  return foldDiacritics(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Romanian skill / job terms mapped to a canonical skill that already exists
 * in the English dictionary (src/matching/skills.js). Keys are
 * diacritics-folded, lowercase. Longest phrases win (see skills.js).
 */
export const RO_SKILL_ALIASES = {
  contabilitate: 'accounting',
  contabil: 'accounting',
  salarizare: 'payroll',
  'resurse umane': 'hr',
  recrutare: 'recruitment',
  vanzari: 'sales',
  achizitii: 'procurement',
  aprovizionare: 'supply chain',
  'lant de aprovizionare': 'supply chain',
  logistica: 'logistics',
  transporturi: 'logistics',
  'asistent medical': 'nursing',
  'asistenta medicala': 'nursing',
  'ingrijire pacienti': 'patient care',
  farmacie: 'pharmacy',
  kinetoterapie: 'physiotherapy',
  predare: 'teaching',
  'dezvoltare curriculum': 'curriculum development',
  sudura: 'welding',
  sudor: 'welding',
  tamplarie: 'carpentry',
  instalator: 'plumbing',
  instalatii: 'plumbing',
  depozit: 'warehouse',
  stivuitor: 'forklift',
  'analiza datelor': 'data analysis',
  'analiza de date': 'data analysis',
  'invatare automata': 'machine learning',
  'inteligenta artificiala': 'machine learning',
  'managementul proiectelor': 'project management',
  'management de proiect': 'project management',
  'managementul produsului': 'product management',
  negociere: 'negotiation',
  'servicii clienti': 'customer service',
  'relatii cu clientii': 'customer service',
  'relatii clienti': 'customer service',
  bugetare: 'budgeting',
  'previziuni financiare': 'forecasting',
  conformitate: 'compliance',
  'gestionarea riscului': 'risk management',
  'managementul riscului': 'risk management',
  'asigurarea calitatii': 'quality assurance',
  'controlul calitatii': 'quality assurance',
  'marketing digital': 'content marketing',
  'retele sociale': 'social media',
  'media sociala': 'social media',
  ospitalitate: 'hospitality',
  'siguranta alimentara': 'food safety',
};

const escapeForRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Longest aliases first so "resurse umane" wins over a hypothetical "resurse".
const RO_SKILL_PATTERNS = Object.entries(RO_SKILL_ALIASES)
  .sort((a, b) => b[0].length - a[0].length)
  .map(([alias, skill]) => ({
    skill,
    pattern: new RegExp(`(?<![\\w#+.])${escapeForRegex(alias)}(?![\\w#+])`),
  }));

/**
 * Extract canonical skills from Romanian-language text. The input is folded
 * to ASCII first, so callers can pass raw text with diacritics.
 * @param {string} text
 * @returns {string[]} canonical skill names
 */
export function extractRomanianSkills(text) {
  if (!text) return [];
  const folded = foldLower(text);
  const found = new Set();
  for (const { skill, pattern } of RO_SKILL_PATTERNS) {
    if (pattern.test(folded)) found.add(skill);
  }
  return [...found];
}

/** Romanian city names that differ from / collapse to a canonical form. */
const RO_CITY_ALIASES = {
  bucuresti: 'bucharest',
  bucuresci: 'bucharest',
};

/**
 * Normalise a location string for comparison: fold diacritics, lowercase,
 * and bridge București → Bucharest so a Romanian-language ad matches an
 * English-language CV (and vice versa).
 * @param {string} s
 */
export function normalizeLocation(s) {
  let f = foldLower(s);
  for (const [ro, canon] of Object.entries(RO_CITY_ALIASES)) {
    if (f.includes(ro)) f = f.replace(new RegExp(ro, 'g'), canon);
  }
  return f;
}

// Romanian names for the languages the scorer cares about (folded, lowercase).
const RO_LANGUAGE_TERMS = {
  en: 'engleza', de: 'germana', fr: 'franceza', es: 'spaniola', it: 'italiana',
  nl: 'olandeza', pt: 'portugheza', ro: 'romana', pl: 'poloneza', hu: 'maghiara',
  ru: 'rusa', el: 'greaca', bg: 'bulgara', cs: 'ceha', sk: 'slovaca',
};

/**
 * Detect which languages a Romanian-language ad explicitly requires. Looks
 * for "limba <lang>" or "<lang>" next to a proficiency/requirement cue
 * (nivel, avansat, mediu, fluent, obligatoriu, necesar, …).
 * @param {string} jobText
 * @returns {string[]} ISO codes
 */
export function requiredLanguagesRo(jobText) {
  const lower = foldLower(jobText);
  const required = [];
  for (const [code, term] of Object.entries(RO_LANGUAGE_TERMS)) {
    if (
      new RegExp(`limba\\s+${term}\\b`).test(lower) ||
      new RegExp(`\\b${term}\\b\\s*(avansat|mediu|fluent|nivel|obligatoriu|necesar|conversational|\\()`).test(lower) ||
      new RegExp(`(cunostinte|cunoasterea|nivel)\\s+(de\\s+)?(limba\\s+)?${term}\\b`).test(lower)
    ) {
      required.push(code);
    }
  }
  return required;
}

/** Romanian cues that an ad targets entry-level / junior candidates. */
export function wantsJuniorRo(jobText) {
  return /\b(debutant|fara experienta|incepator|junior|stagiar|practicant|intern)\b/.test(foldLower(jobText));
}

/** Romanian cues that an ad targets senior candidates. */
export function wantsSeniorRo(jobText) {
  return /\b(senior|expert|coordonator|sef|lider de echipa|peste \d+ ani)\b/.test(foldLower(jobText));
}

/**
 * Normalise a Romanian salary string into a tidy, comparable display:
 *   "5.000 - 7.000 lei net"  → "5,000–7,000 RON net"
 *   "Salariu 2500 RON brut"  → "2,500 RON gross"
 * Returns the trimmed original if no figures are found.
 * @param {string} raw
 */
export function normalizeRoSalary(raw) {
  if (!raw) return '';
  const text = String(raw);
  // Numbers with optional . or , as thousands separators (e.g. 5.000, 7,500).
  const nums = (text.match(/\d[\d.,]*/g) || [])
    .map((n) => Number(n.replace(/[.,]/g, '')))
    .filter((n) => n >= 100);
  if (!nums.length) return text.trim();

  const lower = text.toLowerCase();
  const currency = /eur|€/.test(lower) ? 'EUR' : /ron|lei/.test(lower) ? 'RON' : '';
  const kind = /\bnet\b/.test(lower) ? 'net' : /\b(brut|gross)\b/.test(lower) ? 'gross' : '';

  const fmt = (n) => n.toLocaleString('en-GB');
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const amount = lo !== hi ? `${fmt(lo)}–${fmt(hi)}` : fmt(lo);
  return [amount, currency, kind].filter(Boolean).join(' ');
}
