/**
 * Skill keyword extraction.
 *
 * A curated dictionary of skills commonly found on European job boards,
 * grouped loosely by domain. Matching is case-insensitive on word
 * boundaries; multi-word skills are matched as phrases. The dictionary
 * approach keeps extraction deterministic and explainable — every skill
 * shown to the user can be traced to literal text in the CV or job ad.
 */

const SKILL_DICTIONARY = [
  // Programming languages
  'javascript', 'typescript', 'python', 'java', 'kotlin', 'c#', 'c++', 'go', 'rust',
  'php', 'ruby', 'swift', 'scala', 'r', 'matlab', 'sql', 'html', 'css', 'bash',
  // Frameworks & libraries
  'react', 'angular', 'vue', 'svelte', 'next.js', 'node.js', 'express', 'django',
  'flask', 'fastapi', 'spring', 'spring boot', '.net', 'laravel', 'symfony',
  'rails', 'flutter', 'react native', 'tensorflow', 'pytorch', 'pandas', 'numpy',
  'scikit-learn', 'jquery', 'tailwind', 'bootstrap',
  // Data & infra
  'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'kafka', 'rabbitmq',
  'docker', 'kubernetes', 'terraform', 'ansible', 'aws', 'azure', 'gcp',
  'linux', 'git', 'ci/cd', 'jenkins', 'gitlab', 'github actions', 'grafana',
  'prometheus', 'spark', 'hadoop', 'airflow', 'dbt', 'snowflake', 'databricks',
  'data engineering', 'data analysis', 'machine learning', 'deep learning',
  'nlp', 'computer vision', 'etl', 'big data', 'data science', 'power bi',
  'tableau', 'excel',
  // Methods & practice
  'agile', 'scrum', 'kanban', 'devops', 'tdd', 'rest', 'graphql', 'microservices',
  'oop', 'design patterns', 'unit testing', 'integration testing', 'selenium',
  'cypress', 'playwright', 'jira', 'confluence',
  // Engineering & industry
  'autocad', 'solidworks', 'catia', 'plc', 'scada', 'embedded systems',
  'electronics', 'mechanical engineering', 'electrical engineering',
  'civil engineering', 'lean manufacturing', 'six sigma', 'quality assurance',
  'iso 9001', 'cad', 'revit',
  // Business & management
  'project management', 'product management', 'business analysis', 'stakeholder management',
  'budgeting', 'forecasting', 'crm', 'salesforce', 'sap', 'erp', 'procurement',
  'supply chain', 'logistics', 'negotiation', 'account management', 'sales',
  'marketing', 'seo', 'sem', 'content marketing', 'social media', 'google analytics',
  'copywriting', 'public relations', 'customer service', 'recruitment', 'hr',
  'payroll', 'training', 'coaching', 'leadership', 'team management',
  // Finance & legal
  'accounting', 'bookkeeping', 'audit', 'ifrs', 'gaap', 'financial analysis',
  'risk management', 'compliance', 'gdpr', 'tax', 'controlling', 'banking',
  'insurance', 'contract law',
  // Health, education, hospitality, trades
  'nursing', 'patient care', 'pharmacy', 'physiotherapy', 'teaching', 'tutoring',
  'curriculum development', 'childcare', 'hospitality', 'food safety', 'haccp',
  'bartending', 'housekeeping', 'welding', 'carpentry', 'plumbing', 'forklift',
  'warehouse', 'driving licence', 'truck driving',
  // Design & media
  'photoshop', 'illustrator', 'indesign', 'figma', 'sketch', 'ui design',
  'ux design', 'graphic design', 'video editing', 'after effects', 'premiere',
  '3d modelling', 'blender', 'animation', 'photography',
];

// Common aliases and abbreviations mapped to their canonical skill so a
// CV that says "K8s" still matches a job asking for "Kubernetes". Kept
// high-precision (each alias maps unambiguously to one skill) so matches
// stay explainable.
const SKILL_ALIASES = {
  k8s: 'kubernetes',
  k8: 'kubernetes',
  golang: 'go',
  postgres: 'postgresql',
  reactjs: 'react',
  'react.js': 'react',
  vuejs: 'vue',
  'vue.js': 'vue',
  nextjs: 'next.js',
  nodejs: 'node.js',
  node: 'node.js',
  dotnet: '.net',
  '.net core': '.net',
  cicd: 'ci/cd',
  'ci-cd': 'ci/cd',
  sklearn: 'scikit-learn',
  'gh actions': 'github actions',
  'g cloud': 'gcp',
  'google cloud': 'gcp',
  'amazon web services': 'aws',
};

// Longest phrases first so "react native" wins over "react".
const SORTED_SKILLS = [...SKILL_DICTIONARY].sort((a, b) => b.length - a.length);

const escapeForRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SKILL_PATTERNS = SORTED_SKILLS.map((skill) => ({
  skill,
  pattern: new RegExp(`(?<![\\w#+.])${escapeForRegex(skill)}(?![\\w#+])`, 'i'),
}));

// Aliases are matched longest-first too, and resolve to the canonical skill.
const ALIAS_PATTERNS = Object.entries(SKILL_ALIASES)
  .sort((a, b) => b[0].length - a[0].length)
  .map(([alias, skill]) => ({
    skill,
    pattern: new RegExp(`(?<![\\w#+.])${escapeForRegex(alias)}(?![\\w#+])`, 'i'),
  }));

/**
 * Extract known skills from free text. Canonical skill names and their
 * common aliases (e.g. "k8s" → "kubernetes") both resolve to the canonical
 * name so CV and job-ad wording can differ.
 * @param {string} text
 * @returns {string[]} normalised, de-duplicated skill names
 */
export function extractSkillTokens(text) {
  if (!text) return [];
  const found = new Set();
  for (const { skill, pattern } of SKILL_PATTERNS) {
    if (pattern.test(text)) found.add(skill);
  }
  for (const { skill, pattern } of ALIAS_PATTERNS) {
    if (pattern.test(text)) found.add(skill);
  }
  return [...found];
}
