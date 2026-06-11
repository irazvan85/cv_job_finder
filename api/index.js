/**
 * Vercel serverless entrypoint.
 *
 * An Express app is a (req, res) handler, so it can be exported directly.
 * vercel.json rewrites every /api/* request to this single function, and
 * the Express router dispatches /api/match and /api/providers from there.
 * Static files in public/ are served by Vercel's CDN, not by this function.
 */

import { createApp } from '../src/app.js';

export default createApp();
