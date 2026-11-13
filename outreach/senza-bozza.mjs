// Elenca le agenzie che NON hanno ancora una bozza: nessuna email o sito non verificato.
// Uso: node outreach/senza-bozza.mjs <elenco-indovinato.json> <bozze-verificate.csv> <output.csv>
import { readFile, writeFile } from 'node:fs/promises';
import { parseCsv } from './make-drafts.mjs';

const [, , sitesPath, draftsPath, outPath] = process.argv;
if (!sitesPath || !draftsPath || !outPath) {
  console.error('Uso: node outreach/senza-bozza.mjs <sites.json> <bozze.csv> <out.csv>');
  process.exit(1);
}

const sites = JSON.parse(await readFile(sitesPath, 'utf8')); // [{city, slug, site, status}]
const drafted = new Set(parseCsv(await readFile(draftsPath, 'utf8')).map((r) => r.agency_slug));

const rows = sites
  .filter((s) => !drafted.has(s.slug))
  .map((s) => ({
    city: s.city,
    agency_slug: s.slug,
    website: s.site ? `https://${s.site}/` : '',
    reason: s.site ? 'sito trovato, email non trovata' : 'sito non trovato',
  }));

const header = 'city,agency_slug,website,reason';
const body = rows.map((r) => [r.city, r.agency_slug, r.website, r.reason].join(','));
await writeFile(outPath, [header, ...body].join('\n') + '\n', 'utf8');
console.log(`Agenzie senza bozza: ${rows.length}. Salvate in ${outPath}`);
