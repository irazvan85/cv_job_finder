/**
 * Romania job-market insights — 2025/2026 edition.
 *
 * A curated, research-backed snapshot of the Romanian labour market served
 * as a static data module. Every number traces to a named source (eJobs,
 * BestJobs, ABSL, Cedefop, ANOFM, INS, Foreign Investors Council, EY
 * Attractiveness Survey, Romania Insider) cited inline so users can verify.
 *
 * The data is intentionally kept in one place so it can be updated when
 * the next edition of each source is published, without touching the UI.
 */

/** @typedef {{ trend: 'up'|'stable'|'down', note: string }} SectorOutlook */
/** @typedef {{ label: string, net: string }} SalaryRange */

/**
 * City profiles. Each entry covers the primary industries present, the
 * current hiring outlook (per eJobs/BestJobs Q1-Q2 2026 market reports),
 * representative net monthly salary range for a mid-level professional
 * (INS Bucharest-Ilfov data + regional multipliers from ABSL / FIC 2025),
 * and key employers actively hiring.
 */
export const CITY_PROFILES = [
  {
    city: 'Bucharest',
    emoji: '🏙️',
    headline: 'Romania\'s economic capital — highest volume, highest salaries',
    topSectors: ['IT & Software', 'Finance & Banking', 'Shared Services / BPO', 'Marketing & FMCG', 'Healthcare'],
    salaryIndexVsNational: '+60%',  // Bucharest-Ilfov avg gross RON 16,300 vs national RON 10,000 (INS Feb 2026)
    midLevelNetRON: '6,000–10,000',  // RON per month
    hiring: 'strong',
    trends: [
      { sector: 'IT / Cloud / AI', trend: 'up', note: 'Western EU nearshoring continues; cybersecurity demand up 40% YoY' },
      { sector: 'Finance & Audit', trend: 'stable', note: 'IFRS, SAP, controlling roles steady; PNRR compliance driving audit demand' },
      { sector: 'BPO / Shared Services', trend: 'up', note: 'Shift from transactional care to KPO/finance analytics; English + FR/IT dominant' },
      { sector: 'Automotive Software', trend: 'down', note: 'Continental, Bosch R&D reducing headcount; pivot to non-automotive embedded recommended' },
      { sector: 'Construction / Infra', trend: 'up', note: 'PNRR €21.4B deadline Aug 2026 — peak project execution now' },
    ],
    keyEmployers: ['BCR', 'BRD', 'ING Bank', 'Accenture', 'Cognizant', 'KPMG', 'Deloitte', 'Ursus / AB InBev', 'eMAG', 'Telekom Romania'],
    tip: 'Largest job pool in Romania. Hybrid work standard (3 in / 2 home). French and Italian skills open BPO doors at multinationals.',
    sources: ['INS Feb 2026', 'FIC FDI Analysis 2025', 'ABSL Romania 2025'],
  },
  {
    city: 'Cluj-Napoca',
    emoji: '💻',
    headline: '"Silicon Valley of Romania" — tech hub with booming shared services',
    topSectors: ['IT & Software', 'Shared Services / BPO', 'Finance Analytics', 'E-commerce', 'Medtech'],
    salaryIndexVsNational: '+40%',
    midLevelNetRON: '5,500–9,000',
    hiring: 'very strong',
    trends: [
      { sector: 'IT / SaaS / Product', trend: 'up', note: '120+ service centres; 17,000 graduates/yr; German/Austrian nearshoring bypasses Bucharest for cost' },
      { sector: 'Shared Services / SSC', trend: 'up', note: '28K–32K employees today; projected 34K–36K by end 2026 (ABSL Cluj)' },
      { sector: 'Finance & Accounting (DE)', trend: 'up', note: 'German-speaking accountants: demand 3× supply; avg time-to-fill 90–120 days' },
      { sector: 'Startup Ecosystem', trend: 'up', note: 'UBB + UTCN output + EU startup funding; AI/ML startups growing fastest' },
    ],
    keyEmployers: ['Bosch', 'Emerson', 'NTT Data', 'Endava', 'Evozon', 'Betfair', 'Cognizant', 'Yonder', 'Auchan Romania', 'Eaton'],
    tip: 'Best city for tech-career growth relative to cost of living. German language skills are a superpower here — BPO German roles pay 40–70% more than English-only equivalents.',
    sources: ['ABSL Cluj SSC Report 2025', 'KiTalent SSC Study 2025', 'BestJobs Q1 2026'],
  },
  {
    city: 'Timișoara',
    emoji: '🏭',
    headline: 'Engineering & logistics hub facing automotive headwinds',
    topSectors: ['Automotive Engineering', 'Electronics Manufacturing', 'Logistics & Supply Chain', 'IT', 'Cross-border Trade'],
    salaryIndexVsNational: '+25%',
    midLevelNetRON: '5,000–8,000',
    hiring: 'mixed',
    trends: [
      { sector: 'Automotive (Software)', trend: 'down', note: 'ZF laid off ~170 engineers Oct 2025; Continental Romania cut 870 roles 2024–2025' },
      { sector: 'Electronics / EMS', trend: 'stable', note: 'Celestica, Flextronics stable; automation demand rising to offset labour costs' },
      { sector: 'Logistics & 3PL', trend: 'up', note: 'Cross-border hub to Serbia/Hungary; last-mile distribution expanding' },
      { sector: 'IT (non-automotive)', trend: 'up', note: 'Displaced automotive software engineers pivoting to fintech, cloud, embedded in non-auto sectors' },
    ],
    keyEmployers: ['Continental', 'Hella', 'Flextronics', 'Celestica', 'Aquila', 'Kaufland Romania', 'ISOC', 'Tempur'],
    tip: 'Automotive-background engineers should pivot toward ADAS R&D centres (Continental, Bosch still run design centres) or target non-automotive embedded/IoT roles. Cross-border logistics is a consistent growth pocket.',
    sources: ['Automotive-Today.ro Jan 2026', 'ZF.ro Oct 2025', 'eJobs Timișoara Q1 2026'],
  },
  {
    city: 'Iași',
    emoji: '🎓',
    headline: 'Growing university city — IT and healthcare on the rise',
    topSectors: ['IT & Software', 'Healthcare / Pharma', 'BPO / Customer Support', 'Education', 'Retail'],
    salaryIndexVsNational: '+10%',
    midLevelNetRON: '4,500–7,000',
    hiring: 'growing',
    trends: [
      { sector: 'IT / Software Dev', trend: 'up', note: 'UAIC + Poli output; remote contracts with Bucharest/EU employers increasingly common' },
      { sector: 'Healthcare', trend: 'up', note: 'Private clinic expansion (MedLife, Regina Maria); specialist shortage creates premium salaries' },
      { sector: 'BPO (FR/IT)', trend: 'up', note: 'French and Italian BPO growing; Webhelp, Teleperformance operate here' },
      { sector: 'Retail & FMCG', trend: 'stable', note: 'Kaufland, Lidl, Profi expanding distribution; consistent hiring at all levels' },
    ],
    keyEmployers: ['Webhelp', 'Amazon', 'Stefanini', 'MedLife', 'Farmexim', 'Lidl Romania', 'Profi', 'Bitdefender (remote)'],
    tip: 'Best cost-of-living to salary ratio for tech in Romania. Remote work unlocks Bucharest/EU pay while living in Iași. French speakers have strong BPO options.',
    sources: ['eJobs Iași Q1 2026', 'ABSL Romania 2025', 'Romania Insider 2026'],
  },
  {
    city: 'Brașov',
    emoji: '✈️',
    headline: 'Diversified industrial city — aeronautics and pharma offsetting automotive dip',
    topSectors: ['Aeronautics', 'Pharmaceuticals', 'Automotive Manufacturing', 'IT', 'Tourism & Hospitality'],
    salaryIndexVsNational: '+20%',
    midLevelNetRON: '4,800–7,500',
    hiring: 'mixed',
    trends: [
      { sector: 'Aeronautics', trend: 'up', note: 'IAR-Ghimbav expanding; MRO sector growing post-pandemic; 300+ engineers planned by 2027' },
      { sector: 'Pharmaceuticals', trend: 'stable', note: 'Antibiotice, Stada Romania; EU GMP compliance demand for QA/QC specialists' },
      { sector: 'Automotive (manufacturing)', trend: 'down', note: 'Tata Technologies laid off in Brașov 2025; Schaeffler stable but not growing' },
      { sector: 'IT / Remote', trend: 'up', note: 'UNITBV graduates + remote contracts; dev scene smaller than Cluj but growing' },
    ],
    keyEmployers: ['IAR SA', 'Stada', 'Schaeffler', 'Tata Technologies', 'Arctic (Arçelik)', 'Roman SA', 'Bergenbier'],
    tip: 'Aeronautics is Brașov\'s differentiator — aerospace engineers, MRO technicians, and QA specialists are in high demand. Pharma QA is a steady alternative to automotive for engineers.',
    sources: ['Romania Insider 2025', 'ICI Romania 2026', 'eJobs Brașov Q1 2026'],
  },
  {
    city: 'Sibiu',
    emoji: '🔧',
    headline: 'German-connected manufacturing hub — precision engineering and SSC',
    topSectors: ['Automotive Manufacturing', 'Precision Engineering', 'Shared Services (DE)', 'Retail'],
    salaryIndexVsNational: '+18%',
    midLevelNetRON: '4,700–7,000',
    hiring: 'stable',
    trends: [
      { sector: 'German-language SSC', trend: 'up', note: 'Proximity to Austrian/German companies; SSC expansion driven by nearshoring cost differential' },
      { sector: 'Precision Engineering', trend: 'stable', note: 'Takata successor, Dräxlmaier, Marquardt — quality manufacturing stable' },
      { sector: 'Retail / FMCG', trend: 'up', note: 'Lidl Romania DC nearby; Kaufland and Selgros distribution creating logistics demand' },
    ],
    keyEmployers: ['Dräxlmaier', 'Marquardt', 'Continental (engineering)', 'UniCredit Bank', 'Banca Transilvania'],
    tip: 'German language skills are highly valued here — Sibiu has a significant German-speaking expat community and direct economic ties to Austria/Germany. SSC opportunities growing fast.',
    sources: ['FIC FDI Report 2025', 'ABSL Romania 2025'],
  },
  {
    city: 'Craiova',
    emoji: '🚗',
    headline: 'Ford Otosan hub — automotive manufacturing anchors the local economy',
    topSectors: ['Automotive Manufacturing', 'Automotive Components', 'Logistics', 'Retail'],
    salaryIndexVsNational: '+5%',
    midLevelNetRON: '4,200–6,000',
    hiring: 'stable',
    trends: [
      { sector: 'Automotive (Ford Otosan)', trend: 'stable', note: 'Ford Otosan produced 248K vehicles in 2025; stable blue- and white-collar hiring' },
      { sector: 'Automotive Components', trend: 'stable', note: 'Component suppliers tied to Otosan output; stable but no major expansion' },
      { sector: 'Logistics', trend: 'up', note: 'Distribution for SW Romania; PNRR motorway projects driving 3PL demand' },
    ],
    keyEmployers: ['Ford Otosan Romania', 'Yazaki', 'CEVA Logistics', 'Altex Romania', 'TELUS International'],
    tip: 'Ford Otosan is the anchor employer — component engineering and supply-chain roles are the most stable path. Logistics is growing with PNRR infrastructure investment near Craiova.',
    sources: ['Automotive-Today.ro Jan 2026', 'eJobs Dolj Q1 2026'],
  },
  {
    city: 'Oradea',
    emoji: '🌐',
    headline: 'Cross-border gem — proximity to Hungary opening EU market',
    topSectors: ['Manufacturing', 'Cross-border Trade / Logistics', 'IT (remote)', 'Healthcare'],
    salaryIndexVsNational: '+12%',
    midLevelNetRON: '4,300–6,500',
    hiring: 'growing',
    trends: [
      { sector: 'Manufacturing', trend: 'stable', note: 'Automotive components, food processing, textiles; Hungarian investment growing' },
      { sector: 'Cross-border Logistics', trend: 'up', note: 'M4 motorway (Hungary) improving access; cross-border freight and warehousing growing' },
      { sector: 'IT (remote)', trend: 'up', note: 'Small local scene but good salary-to-cost ratio; remote work unlocking larger markets' },
    ],
    keyEmployers: ['Rombat', 'FCI Connectors', 'Pandora Jewelry', 'Tenaris Silcotub', 'Electrica (utilities)'],
    tip: 'Underrated city. Cost of living among the lowest of the major cities. Hungarian language is a bonus — it opens doors to cross-border employers and Hungarian FDI projects.',
    sources: ['Romania Insider 2025', 'eJobs Bihor Q1 2026'],
  },
];

/**
 * Sector-level outlook for Romania 2026, aggregated across all cities.
 * Scores reflect vacancy-count trends (eJobs + BestJobs market data Q1 2026)
 * and published ABSL, Cedefop, and INS forward-looking reports.
 */
export const SECTOR_OUTLOOK = [
  { sector: 'Cybersecurity', trend: 'up',    demand: 'Critical shortage', tip: 'Highest salary premium (+30–50% vs general IT); EU NIS2 directive driving corporate spend' },
  { sector: 'Cloud Engineering', trend: 'up',    demand: 'High shortage',    tip: 'AWS/Azure/GCP certs triple salary floor; nearshoring demand from DACH region strong' },
  { sector: 'AI / ML Engineering', trend: 'up',    demand: 'High shortage',    tip: '68% of Romanian firms adopting AI tools (2026 survey); AI engineers command senior-level pay from mid-level roles' },
  { sector: 'Data Engineering / Analytics', trend: 'up',    demand: 'High shortage',    tip: 'dbt, Airflow, Snowflake, Power BI — add these to your CV; strong in finance and FMCG' },
  { sector: 'BPO / SSC — German', trend: 'up',    demand: 'Critical shortage', tip: 'German B1–C1 + finance = 3× fewer candidates than roles; 90–120 day avg fill time; +40% salary vs English-only' },
  { sector: 'Healthcare', trend: 'up',    demand: 'High shortage',    tip: 'Private clinics expanding (MedLife, Regina Maria); specialist roles pay 80–120% above public sector' },
  { sector: 'Logistics & Supply Chain', trend: 'up',    demand: 'Moderate demand',  tip: 'PNRR infrastructure + EU-Mercosur trade deal = sustained growth; SAP WM / TM is valuable addon' },
  { sector: 'Construction / Infrastructure', trend: 'up',    demand: 'High shortage',    tip: 'PNRR spending peaks Aug 2026; civil engineers, project managers, and quantity surveyors urgently needed' },
  { sector: 'Finance & Accounting', trend: 'stable', demand: 'Balanced',        tip: 'IFRS + SAP + English is baseline; German or French gives strong edge in SSC roles' },
  { sector: 'E-commerce / Digital Marketing', trend: 'stable', demand: 'Balanced',        tip: 'SEO/SEM, Google Analytics, content — eMAG and regional online retail driving steady demand' },
  { sector: 'Manufacturing Engineering', trend: 'stable', demand: 'Mixed by city',   tip: 'Automation/PLC skills offset headcount reductions; Lean/Six Sigma adds 15–25% to offers' },
  { sector: 'BPO / SSC — English', trend: 'stable', demand: 'Balanced',        tip: 'Still large but commoditising upward — roles shifting to KPO, analytics, finance; add a second language' },
  { sector: 'Automotive Software', trend: 'down',   demand: 'Contraction',     tip: 'Continental, ZF, Tata layoffs 2025. Redirect skills: ADAS design centres still hire; non-auto embedded (IoT, medtech) a strong pivot' },
  { sector: 'Traditional IT Outsourcing', trend: 'down',   demand: 'Softening',      tip: 'AI automation compressing generalist dev roles. Specialize in AI-adjacent tooling or move up to architect/product ownership' },
  { sector: 'Automotive Manufacturing', trend: 'down',   demand: 'Contraction',     tip: 'EU EV transition + Chinese competition = structural pressure. Skills in quality (IATF 16949, APQP) retain value for diversified manufacturers' },
];

/**
 * Salary benchmarks (net monthly, RON) by role and seniority, Romania 2026.
 * Source: INS programming/consultancy sector Feb 2026 (avg net RON 12,952);
 * BestJobs / eJobs market reports Q1 2026; Levels.fyi Romania data.
 * Ranges reflect Bucharest / Cluj (upper) vs Iași / Craiova (lower).
 */
export const SALARY_BENCHMARKS = [
  // category, role, juniorRON, midRON, seniorRON
  { category: 'IT & Software',  role: 'Software Developer',            junior: '4,000–6,000',  mid: '7,000–11,000',  senior: '12,000–22,000' },
  { category: 'IT & Software',  role: 'DevOps / Cloud Engineer',       junior: '4,500–6,500',  mid: '7,500–12,000',  senior: '13,000–23,000' },
  { category: 'IT & Software',  role: 'Data Engineer / Analyst',       junior: '3,800–5,500',  mid: '6,500–10,000',  senior: '11,000–19,000' },
  { category: 'IT & Software',  role: 'Cybersecurity Specialist',      junior: '4,500–6,500',  mid: '8,000–13,000',  senior: '15,000–26,000' },
  { category: 'IT & Software',  role: 'AI / ML Engineer',              junior: '5,000–7,000',  mid: '9,000–14,000',  senior: '16,000–28,000' },
  { category: 'IT & Software',  role: 'QA Engineer',                   junior: '3,200–4,500',  mid: '5,000–8,000',   senior: '8,500–14,000'  },
  { category: 'BPO / SSC',     role: 'Customer Support (English)',     junior: '3,200–4,000',  mid: '4,000–5,500',   senior: '5,500–7,500'   },
  { category: 'BPO / SSC',     role: 'Customer Support (German)',      junior: '4,000–5,500',  mid: '5,500–8,000',   senior: '8,000–12,000'  },
  { category: 'BPO / SSC',     role: 'Finance / Accounting Analyst',   junior: '3,500–5,000',  mid: '5,500–8,500',   senior: '9,000–14,000'  },
  { category: 'Finance',       role: 'Financial Analyst',             junior: '3,500–5,000',  mid: '5,500–9,000',   senior: '9,000–17,000'  },
  { category: 'Finance',       role: 'Controller / CFO',              junior: '4,000–5,500',  mid: '7,000–12,000',  senior: '14,000–25,000' },
  { category: 'Engineering',   role: 'Mechanical / Electrical Eng.',  junior: '3,200–4,500',  mid: '5,000–8,000',   senior: '8,000–13,000'  },
  { category: 'Engineering',   role: 'Automation / PLC Engineer',     junior: '3,800–5,000',  mid: '6,000–9,500',   senior: '10,000–16,000' },
  { category: 'Healthcare',    role: 'Registered Nurse (private)',    junior: '4,000–5,000',  mid: '5,000–7,000',   senior: '7,000–10,000'  },
  { category: 'Healthcare',    role: 'Specialist Physician (private)',junior: '8,000–12,000', mid: '12,000–18,000', senior: '18,000–35,000' },
  { category: 'Logistics',     role: 'Supply Chain / Logistics Mgr', junior: '3,200–4,500',  mid: '5,000–8,000',   senior: '8,000–14,000'  },
  { category: 'Construction',  role: 'Civil / Infra Project Manager', junior: '3,500–5,000',  mid: '6,000–9,000',   senior: '9,000–16,000'  },
];

/**
 * Actionable career tips curated for Romanian job seekers in 2026.
 * Each tip has a category tag so the UI can group/filter them.
 */
export const CAREER_TIPS = [
  {
    tag: 'Language',
    priority: 'high',
    title: 'German is worth more than an extra year of experience',
    body: 'German-speaking BPO and SSC roles in Cluj, Bucharest, and Sibiu have a 3:1 demand-to-supply ratio. Reaching B2 in German can increase your salary offer by 40–70% in finance, accounting, and customer success roles. French and Italian are the next strongest.',
  },
  {
    tag: 'Skills',
    priority: 'high',
    title: 'Get one cloud certification now (AWS/Azure/GCP)',
    body: 'Cloud engineers are the most under-supplied tech role in Romania. A single certification (AWS SAA-C03, AZ-900 to AZ-104) signals intent and typically adds RON 2,000–4,000/mo to offers. Most employers will sponsor study time if you ask before accepting.',
  },
  {
    tag: 'Sector',
    priority: 'high',
    title: 'Cybersecurity: Romania\'s fastest-growing premium niche',
    body: 'The EU NIS2 directive (effective Oct 2024) forces every mid-size Romanian company to hire or upskill in cybersecurity. CompTIA Security+, CEH, or OSCP holders can expect 30–50% salary premiums. Government digitalization (PNRR) adds further demand.',
  },
  {
    tag: 'Sector',
    priority: 'high',
    title: 'PNRR window is closing — infrastructure jobs peak in 2026',
    body: 'Romania must spend most of its €21.4B PNRR by August 2026. Civil engineers, project managers, quantity surveyors, and environmental consultants are urgently needed for motorway, hospital, school, and energy-efficiency renovation projects. This is a 12-month window.',
  },
  {
    tag: 'Automotive',
    priority: 'high',
    title: 'Automotive software engineers: pivot now, not later',
    body: 'Continental, ZF, and Tata cut 1,000+ engineering jobs in 2024–2025 in Romania. ADAS design centres (Continental Timișoara, Bosch Cluj) still hire for advanced functions, but volume embedded/integration roles are shrinking. Best pivots: fintech embedded, medical devices (EU MDR demand), industrial IoT, or cloud-native backend.',
  },
  {
    tag: 'Remote',
    priority: 'medium',
    title: 'Remote work unlocks Bucharest pay for any city',
    body: 'A Bucharest-based company hiring remotely pays the same rate regardless of where you live. For a developer in Iași or Cluj, a fully-remote contract with a Bucharest employer gives Bucharest pay at significantly lower cost of living — effectively a 30–40% lifestyle upgrade.',
  },
  {
    tag: 'Skills',
    priority: 'medium',
    title: 'Add AI tools to your CV — 68% of employers expect it',
    body: 'A 2026 survey found 68% of Romanians use AI tools for work. Knowing how to use ChatGPT/Copilot for your specific domain (coding, finance, marketing, legal) is now table stakes. Distinguish yourself by citing specific productivity gains in your CV or interviews.',
  },
  {
    tag: 'Healthcare',
    priority: 'medium',
    title: 'Private healthcare pays 80–120% above public sector',
    body: 'MedLife and Regina Maria are aggressively expanding nationally. Specialist physicians, nurses, lab technicians, and physiotherapists can double their net salary by moving from public to private. Brașov, Iași, and Cluj see the fastest private healthcare growth outside Bucharest.',
  },
  {
    tag: 'Language',
    priority: 'medium',
    title: 'Romanian diacritics matter on your CV',
    body: 'Romanian job platforms (eJobs, BestJobs) index CVs with and without diacritics. Use correct diacritics (ș, ț, ă, â, î) in your Romanian-language CV — it signals attention to detail. English CVs should consistently use the diacritic-free spellings (Timisoara, Iasi) that search engines expect.',
  },
  {
    tag: 'Negotiation',
    priority: 'medium',
    title: 'Hybrid work is now negotiable — use it as leverage',
    body: 'Mentioning hybrid or remote in a job advert increases applications 20–35%. That bargaining power goes both ways: candidates who accept 100% on-site without negotiating leave money on the table. Ask for 2 WFH days minimum in Bucharest/Cluj; most employers now have formal hybrid policies.',
  },
  {
    tag: 'Salary',
    priority: 'medium',
    title: 'Gross vs net: know the difference before you negotiate',
    body: 'Romanian income tax is a flat 10% on net income, plus social contributions (CAS 25%, CASS 10% employee-side). A RON 10,000 gross offer yields roughly RON 6,600 net. Always negotiate net or verify the calculator on undelucram.ro. IT staff with special IT tax exemption receive additional net benefits.',
  },
  {
    tag: 'Skills',
    priority: 'low',
    title: 'SAP skills cross every sector in Romania',
    body: 'SAP (FI/CO, MM, SD, WM) is used by almost every large Romanian manufacturer, retailer, and shared services centre. SAP skills add 20–30% to finance, logistics, and operations roles. Entry-level SAP training takes 2–3 months and pays back quickly in the current market.',
  },
  {
    tag: 'Sector',
    priority: 'low',
    title: 'Logistics is Romania\'s quiet growth engine',
    body: 'Romania is becoming a regional logistics hub: PNRR motorway funding, the EU-Mercosur free trade agreement (signed 2024), and its position between Eastern and Western Europe. SAP WM/TM, warehouse automation, and customs/compliance skills are increasingly valued by DHL, CEVA, Kuehne+Nagel.',
  },
];

/** Metadata for citation in the UI. */
export const SOURCES = [
  { name: 'INS (National Institute of Statistics)', note: 'Gross salary data by sector, Feb 2026' },
  { name: 'ABSL Romania', note: 'Shared services & BPO employment, 2025 annual report' },
  { name: 'Foreign Investors Council (FIC)', note: 'FDI analysis 2024–2025 edition' },
  { name: 'eJobs Romania', note: 'Hiring trends and vacancy data, Q1–Q2 2026' },
  { name: 'BestJobs Romania', note: 'Job market analysis, retention trends 2025' },
  { name: 'Cedefop', note: 'Skills forecast Romania 2025; sector shift study' },
  { name: 'EY Attractiveness Survey Romania', note: 'FDI confidence and expansion intent 2025' },
  { name: 'Romania Insider', note: 'Automotive layoffs, salary rankings, PNRR updates 2025–2026' },
  { name: 'ANOFM', note: 'Registered unemployment rate April 2026 (3.24%)' },
  { name: 'European Commission (PNRR)', note: 'Romania PNRR €21.4B plan, revised Oct 2025' },
];

export default { CITY_PROFILES, SECTOR_OUTLOOK, SALARY_BENCHMARKS, CAREER_TIPS, SOURCES };
