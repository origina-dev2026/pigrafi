// Crea le BOZZE in Apple Mail (non invia nulla). Uso:
//   node outreach/make-drafts.mjs            -> genera outreach/create-drafts.applescript
//   osascript outreach/create-drafts.applescript   -> apre le bozze in Mail, da inviare a mano
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FORM_URL = 'https://pigrafi.majime.it/agenzie.html';
const SENDER = 'segreteria@majime.it';
const SIGNATURE = 'Segreteria Pigrafi\nsegreteria@majime.it';

// CSV semplice (nessuna virgola dentro i campi)
export function parseCsv(text) {
  const [head, ...rows] = text.trim().split(/\r?\n/);
  const keys = head.split(',');
  return rows.map((r) => {
    const cols = r.split(',');
    return Object.fromEntries(keys.map((k, i) => [k, (cols[i] || '').trim()]));
  });
}

export function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

// escape per stringhe AppleScript; le righe vanno unite con "return"
export function asString(s) {
  const lines = String(s).split(/\r?\n/).map((l) => '"' + l.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"');
  return lines.join(' & return & ');
}

export function buildAppleScript(drafts) {
  const out = ['-- Bozze Pigrafi: NON invia nulla, crea le bozze in Mail.', 'tell application "Mail"'];
  for (const d of drafts) {
    out.push(
      '  set m to make new outgoing message with properties {visible:true, subject:' + asString(d.subject) +
      ', content:' + asString(d.body) + '}',
      '  tell m',
      '    make new to recipient at end of to recipients with properties {address:"' + d.to + '"}',
      '  end tell',
      '  -- la bozza resta in Mail, da inviare a mano',
    );
  }
  out.push('end tell');
  return out.join('\n') + '\n';
}

async function main() {
  const csv = parseCsv(await readFile(path.join(DIR, 'agencies.csv'), 'utf8'));
  const template = await readFile(path.join(DIR, 'template.txt'), 'utf8');
  const drafts = [];
  const skipped = [];
  for (const a of csv) {
    if (!a.email) { skipped.push(a.name); continue; }
    const vars = {
      name: a.name, city: a.city, necrologi_url: a.necrologi_url || a.website,
      form_url: FORM_URL, sender: SENDER, signature: SIGNATURE,
    };
    const body = fill(template, vars);
    const [subjectLine, ...rest] = body.split('\n');
    drafts.push({ to: a.email, subject: subjectLine.replace(/^Oggetto:\s*/, ''), body: rest.join('\n').replace(/^\n+/, '') });
  }
  await writeFile(path.join(DIR, 'create-drafts.applescript'), buildAppleScript(drafts));
  console.log(`Bozze pronte: ${drafts.length}. Senza email (da completare): ${skipped.length}`);
  if (skipped.length) console.log('  - ' + skipped.join('\n  - '));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
