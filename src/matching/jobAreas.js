/**
 * CV analysis and job-area recommendations.
 *
 * A transparent, deterministic heuristic — not a prediction model, in the
 * same spirit as the hiring-chance scorer (see scorer.js). It groups the
 * canonical skills already extracted by skills.js into broad job domains,
 * adds signal from job titles/headline text, and ranks domains by how much
 * of the CV supports them. Every recommendation traces back to literal
 * skills or title words so it stays explainable.
 */

/** Canonical skill → domain. Mirrors the grouping comments in skills.js. */
const DOMAIN_SKILLS = {
  'Software Engineering': [
    'javascript', 'typescript', 'python', 'java', 'kotlin', 'c#', 'c++', 'go', 'rust',
    'php', 'ruby', 'swift', 'scala', 'r', 'sql', 'html', 'css', 'bash',
    'react', 'angular', 'vue', 'svelte', 'next.js', 'node.js', 'express', 'django',
    'flask', 'fastapi', 'spring', 'spring boot', '.net', 'laravel', 'symfony',
    'rails', 'flutter', 'react native', 'jquery', 'tailwind', 'bootstrap',
    'oop', 'design patterns', 'unit testing', 'integration testing', 'selenium',
    'cypress', 'playwright', 'rest', 'graphql', 'microservices', 'tdd',
  ],
  'Data & AI': [
    'tensorflow', 'pytorch', 'pandas', 'numpy', 'scikit-learn', 'matlab',
    'data engineering', 'data analysis', 'machine learning', 'deep learning',
    'nlp', 'computer vision', 'etl', 'big data', 'data science', 'power bi',
    'tableau', 'excel', 'spark', 'hadoop', 'airflow', 'dbt', 'snowflake', 'databricks',
  ],
  'Cloud & DevOps': [
    'docker', 'kubernetes', 'terraform', 'ansible', 'aws', 'azure', 'gcp',
    'linux', 'git', 'ci/cd', 'jenkins', 'gitlab', 'github actions', 'grafana',
    'prometheus', 'devops', 'postgresql', 'mysql', 'mongodb', 'redis',
    'elasticsearch', 'kafka', 'rabbitmq',
  ],
  'Project & Product Management': [
    'agile', 'scrum', 'kanban', 'project management', 'product management',
    'business analysis', 'stakeholder management', 'jira', 'confluence',
  ],
  'Engineering & Industry': [
    'autocad', 'solidworks', 'catia', 'plc', 'scada', 'embedded systems',
    'electronics', 'mechanical engineering', 'electrical engineering',
    'civil engineering', 'lean manufacturing', 'six sigma', 'quality assurance',
    'iso 9001', 'cad', 'revit',
  ],
  'Sales, Marketing & Business': [
    'crm', 'salesforce', 'sap', 'erp', 'procurement', 'supply chain', 'logistics',
    'negotiation', 'account management', 'sales', 'marketing', 'seo', 'sem',
    'content marketing', 'social media', 'google analytics', 'copywriting',
    'public relations', 'budgeting', 'forecasting',
  ],
  'HR & People Operations': [
    'recruitment', 'hr', 'payroll', 'training', 'coaching', 'leadership',
    'team management', 'customer service',
  ],
  'Finance & Legal': [
    'accounting', 'bookkeeping', 'audit', 'ifrs', 'gaap', 'financial analysis',
    'risk management', 'compliance', 'gdpr', 'tax', 'controlling', 'banking',
    'insurance', 'contract law',
  ],
  'Healthcare & Education': [
    'nursing', 'patient care', 'pharmacy', 'physiotherapy', 'teaching', 'tutoring',
    'curriculum development', 'childcare',
  ],
  'Hospitality & Trades': [
    'hospitality', 'food safety', 'haccp', 'bartending', 'housekeeping', 'welding',
    'carpentry', 'plumbing', 'forklift', 'warehouse', 'driving licence', 'truck driving',
  ],
  'Design & Media': [
    'photoshop', 'illustrator', 'indesign', 'figma', 'sketch', 'ui design',
    'ux design', 'graphic design', 'video editing', 'after effects', 'premiere',
    '3d modelling', 'blender', 'animation', 'photography',
  ],
};

/** Job titles to suggest per domain, used when the CV doesn't already list them. */
const DOMAIN_TITLES = {
  'Software Engineering': ['Software Engineer', 'Full Stack Developer', 'Backend Developer', 'Frontend Developer', 'Mobile App Developer'],
  'Data & AI': ['Data Analyst', 'Data Engineer', 'Machine Learning Engineer', 'Business Intelligence Analyst', 'Data Scientist'],
  'Cloud & DevOps': ['DevOps Engineer', 'Site Reliability Engineer', 'Cloud Infrastructure Engineer', 'Platform Engineer'],
  'Project & Product Management': ['Project Manager', 'Product Manager', 'Scrum Master', 'Business Analyst'],
  'Engineering & Industry': ['Mechanical Design Engineer', 'Electrical Engineer', 'Quality Assurance Engineer', 'Manufacturing Engineer'],
  'Sales, Marketing & Business': ['Account Manager', 'Digital Marketing Manager', 'Sales Representative', 'Supply Chain Coordinator'],
  'HR & People Operations': ['HR Specialist', 'Recruiter', 'Training Coordinator', 'Customer Support Specialist'],
  'Finance & Legal': ['Financial Analyst', 'Accountant', 'Internal Auditor', 'Compliance Officer'],
  'Healthcare & Education': ['Registered Nurse', 'Teacher', 'Physiotherapist', 'Childcare Worker'],
  'Hospitality & Trades': ['Hotel Operations Specialist', 'Warehouse Operative', 'Electrician', 'Logistics Driver'],
  'Design & Media': ['UI/UX Designer', 'Graphic Designer', 'Video Editor', '3D Artist'],
};

/** Keyword cues in job titles/headline, used when skills alone are thin. */
const TITLE_KEYWORDS = {
  'Software Engineering': ['developer', 'software engineer', 'programmer', 'engineer software'],
  'Data & AI': ['data analyst', 'data scientist', 'data engineer', 'machine learning', 'bi analyst'],
  'Cloud & DevOps': ['devops', 'site reliability', 'sysadmin', 'system administrator', 'cloud engineer'],
  'Project & Product Management': ['project manager', 'product manager', 'scrum master', 'business analyst'],
  'Engineering & Industry': ['mechanical engineer', 'electrical engineer', 'civil engineer', 'industrial engineer'],
  'Sales, Marketing & Business': ['sales', 'account manager', 'marketing', 'business development'],
  'HR & People Operations': ['hr ', 'human resources', 'recruiter', 'recruitment'],
  'Finance & Legal': ['accountant', 'financial analyst', 'auditor', 'controller'],
  'Healthcare & Education': ['nurse', 'physician', 'teacher', 'physiotherapist', 'caregiver'],
  'Hospitality & Trades': ['waiter', 'chef', 'electrician', 'plumber', 'warehouse', 'driver'],
  'Design & Media': ['designer', 'ui/ux', 'video editor', 'photographer'],
};

const SKILL_TO_DOMAIN = Object.fromEntries(
  Object.entries(DOMAIN_SKILLS).flatMap(([domain, skills]) => skills.map((s) => [s, domain]))
);

const SKILL_WEIGHT = 2;
const TITLE_WEIGHT = 1.5;
const MAX_RECOMMENDATIONS = 4;

/**
 * @param {import('../europass/parser.js').CvProfile} profile
 * @returns {{
 *   summary: {totalExperienceYears: number, seniority: string, skillCount: number, languageCount: number, jobTitleCount: number},
 *   strengths: {skill: string, domain: string}[],
 *   gaps: string[],
 *   recommendedAreas: {domain: string, score: number, matchedSkills: string[], exampleTitles: string[], rationale: string}[],
 * }}
 */
export function analyseCv(profile) {
  const skills = profile.skills || [];
  const titleText = [...(profile.jobTitles || []), profile.headline || ''].join(' ').toLowerCase();

  const domainScores = new Map();
  const domainSkillMatches = new Map();
  for (const skill of skills) {
    const domain = SKILL_TO_DOMAIN[skill];
    if (!domain) continue;
    domainScores.set(domain, (domainScores.get(domain) || 0) + SKILL_WEIGHT);
    if (!domainSkillMatches.has(domain)) domainSkillMatches.set(domain, []);
    domainSkillMatches.get(domain).push(skill);
  }
  for (const [domain, keywords] of Object.entries(TITLE_KEYWORDS)) {
    if (keywords.some((kw) => titleText.includes(kw))) {
      domainScores.set(domain, (domainScores.get(domain) || 0) + TITLE_WEIGHT);
    }
  }

  const recommendedAreas = [...domainScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_RECOMMENDATIONS)
    .map(([domain, score]) => {
      const matchedSkills = domainSkillMatches.get(domain) || [];
      const heldTitles = new Set((profile.jobTitles || []).map((t) => t.toLowerCase()));
      const exampleTitles = (DOMAIN_TITLES[domain] || []).filter((t) => !heldTitles.has(t.toLowerCase()));
      const rationale = matchedSkills.length
        ? `Your CV shows ${matchedSkills.length} skill(s) in this area: ${matchedSkills.slice(0, 6).join(', ')}.`
        : `Your job title or headline aligns with this area.`;
      return { domain, score, matchedSkills, exampleTitles: exampleTitles.slice(0, 5), rationale };
    });

  const strengths = skills
    .filter((s) => SKILL_TO_DOMAIN[s])
    .slice(0, 12)
    .map((skill) => ({ skill, domain: SKILL_TO_DOMAIN[skill] }));

  const gaps = [];
  if (skills.length < 5) {
    gaps.push('Few skills detected — add more detail to the CV\'s skills, summary, or job descriptions so the matcher (and recruiters) can find more relevant roles.');
  }
  if (!profile.languages || profile.languages.length === 0) {
    gaps.push('No language proficiency listed — most European employers expect at least one language (commonly English) stated explicitly.');
  }
  if (!profile.headline) {
    gaps.push('No professional headline or summary — adding one makes the target role clear at a glance.');
  }
  if (!profile.experience || profile.experience.length === 0) {
    gaps.push('No work experience entries found — if relevant experience exists, make sure it is listed under a dedicated work experience section.');
  }

  return {
    summary: {
      totalExperienceYears: profile.totalExperienceYears || 0,
      seniority: profile.seniority || 'mid',
      skillCount: skills.length,
      languageCount: (profile.languages || []).length,
      jobTitleCount: (profile.jobTitles || []).length,
    },
    strengths,
    gaps,
    recommendedAreas,
  };
}
