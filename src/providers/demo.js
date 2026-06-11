/**
 * Demo provider — a small fixed set of realistic European vacancies.
 * Used when demo mode is requested (UI toggle, CLI --demo, or DEMO=1),
 * so the whole pipeline can be exercised on networks where the live
 * job APIs are unreachable.
 */

const DEMO_JOBS = [
  {
    title: 'Senior Software Engineer (TypeScript/React)',
    company: 'Nordwind Tech GmbH', location: 'Berlin, Germany', country: 'de',
    remote: false, salary: '70,000–85,000 EUR',
    description: 'We build logistics SaaS. You will own features end to end with TypeScript, React, Node.js and PostgreSQL on AWS. Docker, CI/CD with GitHub Actions, agile team. English required, German is a plus.',
  },
  {
    title: 'Full Stack Developer',
    company: 'Lumière Digital', location: 'Lyon, France', country: 'fr',
    remote: false, salary: '45,000–55,000 EUR',
    description: 'JavaScript, Vue or React on the front, Node.js and MongoDB on the back. REST APIs, unit testing, Scrum. Fluent French required, English working proficiency.',
  },
  {
    title: 'Backend Engineer (Python)',
    company: 'Tulip Systems BV', location: 'Amsterdam, Netherlands', country: 'nl',
    remote: true, salary: '60,000–75,000 EUR',
    description: 'Remote-first within the EU. Python, Django, FastAPI, PostgreSQL, Redis, Kubernetes. You will design microservices and mentor juniors. English-only workplace.',
  },
  {
    title: 'Data Analyst',
    company: 'Vistula Analytics', location: 'Warsaw, Poland', country: 'pl',
    remote: false, salary: '12,000–16,000 PLN/month',
    description: 'SQL, Power BI, Excel, Python (pandas) for marketing analytics. Stakeholder management and clear reporting. English required, Polish nice to have.',
  },
  {
    title: 'DevOps Engineer',
    company: 'Iberia Cloud SL', location: 'Madrid, Spain', country: 'es',
    remote: true, salary: '50,000–65,000 EUR',
    description: 'Kubernetes, Terraform, AWS, Prometheus/Grafana, CI/CD pipelines with GitLab. Hybrid or fully remote from Spain. Spanish and English required.',
  },
  {
    title: 'Junior Frontend Developer',
    company: 'Fjord Apps AS', location: 'Oslo, Norway', country: 'no',
    remote: false, salary: '550,000–650,000 NOK',
    description: 'Entry-level role: HTML, CSS, JavaScript, React, Git. Mentorship programme, agile team. English working language.',
  },
  {
    title: 'Mechanical Design Engineer',
    company: 'Alpenwerk AG', location: 'Zurich, Switzerland', country: 'ch',
    remote: false, salary: '95,000–110,000 CHF',
    description: 'SolidWorks and CATIA design of precision assemblies, GD&T, prototyping. German B2 and English required. 5+ years experience in mechanical engineering.',
  },
  {
    title: 'Registered Nurse — Internal Medicine',
    company: 'Sankt Maria Klinik', location: 'Munich, Germany', country: 'de',
    remote: false, salary: '3,400–4,100 EUR/month',
    description: 'Patient care on a 30-bed internal medicine ward. EU nursing qualification recognised, German B2 required. Relocation support available.',
  },
  {
    title: 'Digital Marketing Manager',
    company: 'Adriatic Brands d.o.o.', location: 'Zagreb, Croatia', country: 'hr',
    remote: false, salary: '2,000–2,800 EUR/month',
    description: 'SEO, SEM, Google Analytics, content marketing and social media for FMCG brands. Budget ownership. English required, Croatian preferred.',
  },
  {
    title: 'Machine Learning Engineer',
    company: 'Baltic AI OÜ', location: 'Tallinn, Estonia', country: 'ee',
    remote: true, salary: '55,000–70,000 EUR',
    description: 'Python, PyTorch, NLP pipelines, MLOps on GCP with Docker and Kubernetes. Remote within EU time zones. English-only team.',
  },
  {
    title: 'Financial Controller',
    company: 'Danubia Finance Kft.', location: 'Budapest, Hungary', country: 'hu',
    remote: false, salary: '1,200,000–1,500,000 HUF/month',
    description: 'IFRS reporting, budgeting, forecasting, SAP. Audit background welcome. English required, Hungarian a plus.',
  },
  {
    title: 'Customer Support Specialist (German-speaking)',
    company: 'Lisboa Services Lda.', location: 'Lisbon, Portugal', country: 'pt',
    remote: false, salary: '1,400–1,800 EUR/month',
    description: 'Customer service for a German e-commerce client. Native-level German and B2 English. Relocation package, CRM tooling (Salesforce).',
  },
];

export const demo = {
  id: 'demo',
  name: 'Demo data (offline sample)',
  requiresKey: false,
  isConfigured: () => true,

  async search(_profile, { limit = 50 } = {}) {
    const today = new Date().toISOString().slice(0, 10);
    return DEMO_JOBS.slice(0, limit).map((job, i) => ({
      id: `demo-${i}`,
      url: 'https://example.com/demo-job/' + i,
      postedDate: today,
      source: 'Demo',
      ...job,
    }));
  },
};
