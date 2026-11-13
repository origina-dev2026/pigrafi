// Crea le bozze in Apple Mail da un CSV con colonne: city, agency_slug, website, email
// (NON invia nulla). Uso:
//   node outreach/make-drafts-csv.mjs <file.csv> <cartella_output>
//   osascript <cartella_output>/create-drafts.applescript
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, fill, buildAppleScript } from './make-drafts.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const [, , csvPath, outDir] = process.argv;
if (!csvPath || !outDir) { console.error('Uso: node outreach/make-drafts-csv.mjs <csv> <cartella>'); process.exit(1); }

const FORM_URL = 'https://pigrafi.majime.it/agenzie.html';
const SENDER = 'collaborazioni@majime.it';
const SIGNATURE = 'Collaborazioni Pigrafi\ncollaborazioni@majime.it';

const cap = (s) => s.replace(/(^|\s|-)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const cityName = (slug) => cap(slug.replace(/-[a-z]{2}$/, '').replace(/-/g, ' '));

async function main() {
  const rows = parseCsv(await readFile(csvPath, 'utf8'));
  const template = await readFile(path.join(DIR, 'template.txt'), 'utf8');
  // una bozza per agenzia (primo indirizzo trovato)
  const byAgency = new Map();
  for (const r of rows) {
    if (!r.email) continue;
    if (!byAgency.has(r.agency_slug)) byAgency.set(r.agency_slug, r);
  }
  const drafts = [];
  for (const r of byAgency.values()) {
    const city = cityName(r.city);
    const name = `Onoranze Funebri di ${city}`;
    const body = fill(template, {
      name, city, necrologi_url: r.website, form_url: FORM_URL, sender: SENDER, signature: SIGNATURE,
    });
    const [subjectLine, ...rest] = body.split('\n');
    drafts.push({ to: r.email, subject: subjectLine.replace(/^Oggetto:\s*/, ''), body: rest.join('\n').replace(/^\n+/, '') });
  }
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'create-drafts.applescript'), buildAppleScript(drafts));
  console.log(`Bozze create nello script: ${drafts.length} (una per agenzia). Nessun invio.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
