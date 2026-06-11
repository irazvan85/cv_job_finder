/**
 * Europass Job Matcher — local development server.
 *
 * On Vercel the API runs as a serverless function (see api/index.js) and
 * public/ is served from the CDN; this file is only used for `npm start`
 * locally, where Express serves both the API and the static UI.
 */

import path from 'node:path';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { createApp } from './src/app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = createApp();
app.use(express.static(path.join(__dirname, 'public')));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Europass Job Matcher running at http://localhost:${port}`);
  console.log('Optional API keys: ADZUNA_APP_ID/ADZUNA_APP_KEY, JOOBLE_API_KEY, REED_API_KEY');
});
