# Europass Job Matcher

Upload a **Europass CV** and get back a ranked **table of matching jobs from
European job platforms**, each with an **estimated hiring chance**.

```
CV (Europass XML / JSON / PDF)
        │ parse → profile (skills, titles, languages, location, seniority)
        ▼
Fan-out search across European job platforms (parallel, fault-tolerant)
        ▼
Score every vacancy against the profile → ranked table + CSV export
```

## Supported CV formats

| Format | Notes |
| ------ | ----- |
| Europass XML | Classic `SkillsPassport` v3.x schema (europass.cedefop) |
| Europass JSON | New europass.europa.eu profile export |
| Europass PDF | The embedded XML/JSON attachment is extracted; plain-text extraction is the fallback |

## Job sources ("all European platforms")

| Source | Coverage | API key |
| ------ | -------- | ------- |
| **EURES** | The European Commission's portal aggregating vacancies from the **public employment services of every EU/EEA country + Switzerland** — the broadest single European source | none |
| **Arbeitnow** | Germany/DACH and English-speaking roles across Europe | none |
| **Remotive** | Remote jobs open to candidates in Europe | none |
| **Adzuna** | AT, BE, CH, DE, ES, FR, GB, IT, NL, PL | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` ([free](https://developer.adzuna.com/)) |
| **Jooble** | Aggregator covering most European countries | `JOOBLE_API_KEY` ([free](https://jooble.org/api/about)) |
| **Reed** | United Kingdom | `REED_API_KEY` ([free](https://www.reed.co.uk/developers)) |

Providers without a configured key are skipped and reported as such; a
provider that errors never sinks the others. Commercial boards without public
APIs (LinkedIn, Indeed, StepStone, …) cannot be queried directly — EURES,
Adzuna and Jooble are aggregators that cover much of the same inventory.

## Estimated hiring chance

A transparent, explainable heuristic (not a prediction model). Five signals,
each 0–1, weighted into a percentage (clamped to 2–97%):

| Signal | Weight | What it measures |
| ------ | ------ | ---------------- |
| Skills | 45% | How many of the skills mentioned in the job ad appear in the CV |
| Title | 25% | Word overlap between your job titles and the ad title |
| Location | 15% | Same city > same country > elsewhere in Europe; remote = full score |
| Language | 10% | CV languages vs languages the ad requires |
| Seniority | 5% | junior/mid/senior alignment (derived from total experience years) |

Every row shows **which skills matched**, so each number can be sanity-checked.
≥65% = High, 40–64% = Medium, otherwise Low.

## Run it locally

```bash
cd europass-job-matcher
npm install
npm start            # web UI at http://localhost:3000
```

Upload your CV, get the sortable results table, export to CSV. Tick
**Demo mode** to exercise the pipeline with built-in sample vacancies when the
live APIs are unreachable (some sandboxed networks block them).

## Deploy to Vercel

The project is laid out for Vercel's zero-config Node runtime:

- `api/index.js` — single serverless function exporting the Express app.
  `vercel.json` rewrites every `/api/*` request to it, and Express routes
  `/api/match` and `/api/providers` from there.
- `public/` — served as static files from Vercel's CDN (no framework, no
  build step; with no build output Vercel serves `public/` automatically).
- `server.js` — local development only (`npm start`); it is never invoked
  on Vercel.

```bash
npm i -g vercel
vercel            # preview deploy
vercel --prod     # production
```

Set the optional provider keys as Vercel **Environment Variables**
(Project → Settings → Environment Variables): `ADZUNA_APP_ID`,
`ADZUNA_APP_KEY`, `JOOBLE_API_KEY`, `REED_API_KEY`. `DEMO=1` forces demo
mode globally if you want a keyless show-case deployment.

Platform limits baked into the code/config:

- **Upload size 4 MB** (`MAX_UPLOAD_BYTES` in `src/app.js`): Vercel rejects
  request bodies over ~4.5 MB before they reach the function, so the multer
  limit and the client-side check are aligned just under it. Oversize
  uploads return a clean `413` JSON error.
- **`maxDuration: 30`** in `vercel.json`: the provider fan-out runs in
  parallel with a 9 s per-request timeout, so the slowest provider — not
  the sum — bounds the response. The default 10 s budget on Hobby was too
  tight for cold start + parse + search.
- **pdf-parse is imported as `pdf-parse/lib/pdf-parse.js`**: the package
  root of older 1.x releases runs a debug block at require-time that reads
  a test PDF not present in the serverless bundle, crashing the function
  at cold start. The direct lib import avoids it on every version.

### CLI

```bash
npm run match -- path/to/your-cv.xml          # live search
npm run match -- samples/sample-europass-cv.xml --demo
```

Prints the ranked table to the terminal and writes `job-matches.csv`.

### API

```bash
curl -X POST -F cv=@your-cv.pdf https://<your-deployment>.vercel.app/api/match
```

Returns `{ profile, jobs (ranked), providerStatus }`.

## Tests

```bash
npm test
```

Covers XML/JSON/text parsing, skill extraction, scoring behaviour, the
end-to-end demo pipeline, and a smoke test of the Vercel function entrypoint
(`api/index.js`) over real HTTP, including the 413 oversize-upload path.

## Privacy

The CV is parsed in-process and never stored; only derived search keywords
(job title, location) are sent to the job APIs.
