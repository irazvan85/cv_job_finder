/**
 * PDF extraction for Europass CVs.
 *
 * Official Europass PDFs carry the machine-readable CV as an embedded
 * file attachment (XML for the classic format, JSON for the new
 * europass.europa.eu one). We scan the raw PDF for Flate-compressed
 * streams, inflate them with zlib, and look for the Europass payload.
 * If no attachment is found we fall back to plain text extraction via
 * pdf-parse so at least keyword matching still works.
 */

import zlib from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * @param {Buffer} buffer
 * @returns {Promise<{xml: string|null, json: string|null, text: string}>}
 */
export async function extractFromPdf(buffer) {
  const embedded = extractEmbeddedDocument(buffer);
  if (embedded.xml || embedded.json) return { ...embedded, text: '' };

  let text = '';
  try {
    // Import the library module directly, NOT the package root:
    // pdf-parse <= 1.1.1's index.js runs a "debug mode" block when it has
    // no module.parent (always the case under createRequire from ESM) that
    // reads ./test/data/05-versions-space.pdf — a file Vercel's bundler
    // does not include — crashing the serverless function at cold start
    // with ENOENT. The lib path works on every 1.x release, so this is
    // safe whichever version the deploy resolves.
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    const result = await pdfParse(buffer);
    text = result.text || '';
  } catch {
    // pdf-parse can fail on malformed files; matching then runs on nothing,
    // which the caller reports to the user.
  }
  return { xml: null, json: null, text };
}

/**
 * Scan every `stream ... endstream` section, try to inflate it, and
 * check whether it contains a Europass XML or JSON document.
 * @param {Buffer} buffer
 */
export function extractEmbeddedDocument(buffer) {
  const STREAM = Buffer.from('stream');
  const ENDSTREAM = Buffer.from('endstream');
  let offset = 0;

  while (offset < buffer.length) {
    const start = buffer.indexOf(STREAM, offset);
    if (start === -1) break;
    let dataStart = start + STREAM.length;
    if (buffer[dataStart] === 0x0d) dataStart++; // \r
    if (buffer[dataStart] === 0x0a) dataStart++; // \n
    const end = buffer.indexOf(ENDSTREAM, dataStart);
    if (end === -1) break;
    offset = end + ENDSTREAM.length;

    const raw = buffer.subarray(dataStart, end);
    let inflated = null;
    try {
      inflated = zlib.inflateSync(raw);
    } catch {
      inflated = raw; // attachment streams can also be stored uncompressed
    }
    const content = inflated.toString('utf8');
    if (content.includes('SkillsPassport') && content.includes('<')) {
      const xmlStart = content.indexOf('<?xml') >= 0 ? content.indexOf('<?xml') : content.indexOf('<SkillsPassport');
      if (xmlStart >= 0) return { xml: content.slice(xmlStart), json: null };
    }
    if (/"(profile|personalInformation)"\s*:/.test(content) && content.trimStart().startsWith('{')) {
      return { xml: null, json: content.trim() };
    }
  }
  return { xml: null, json: null };
}
