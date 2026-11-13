// Scraper delle pagine "pigrafi" delle agenzie funerarie.
// Esegue: node scraper/scrape.mjs
// Output: docs/data/pigrafi.json (il "database" pubblico letto dall'app) + docs/data/images/*
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), '..');
const DATA_FILE = path.join(ROOT, 'docs', 'data', 'pigrafi.json');
const IMG_DIR = path.join(ROOT, 'docs', 'data', 'images');
const KEEP_DAYS_AFTER_DATE = 7; // dopo questi giorni dalla data, la pigrafe viene rimossa
const UA = 'Mozilla/5.0 (compatible; PigrafiBot/1.0; +personal-use)';

const MESI = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12
};

const sha = (s) => createHash('sha1').update(s).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');
const isoDate = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

// Trova la prima data nel testo: "12/11/2026", "12-11-2026", "12 novembre 2026"
export function parseDate(text) {
  if (!text) return null;
  const num = text.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
  if (num) {
    const [, d, m, y] = num;
    return isoDate(+y, +m, +d);
  }
  const ita = text.toLowerCase().match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/);
  if (ita) return isoDate(+ita[3], MESI[ita[2]], +ita[1]);
  return null;
}

function absoluteUrl(src, base) {
  try { return new URL(src, base).href; } catch { return null; }
}

function pickImageSrc($img) {
  // gestisce lazy-loading comune
  for (const attr of ['data-src', 'data-lazy-src', 'data-original', 'src']) {
    const v = $img.attr(attr);
    if (v && !v.startsWith('data:')) return v;
  }
  const srcset = $img.attr('srcset') || $img.attr('data-srcset');
  if (srcset) return srcset.split(',')[0].trim().split(' ')[0];
  return null;
}

async function downloadImage(url) {
  const name = sha(url);
  const existing = (await readdirSafe()).find((f) => f.startsWith(name));
  if (existing) return `data/images/${existing}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`immagine HTTP ${res.status}: ${url}`);
  const type = res.headers.get('content-type') || '';
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('gif') ? 'gif' : type.includes('svg') ? 'svg' : 'jpg';
  const file = `${name}.${ext}`;
  await writeFile(path.join(IMG_DIR, file), Buffer.from(await res.arrayBuffer()));
  return `data/images/${file}`;
}

async function readdirSafe() {
  try { return await readdir(IMG_DIR); } catch { return []; }
}

async function scrapeAgency(agency, todayIso) {
  const html = await (await fetch(agency.url, { headers: { 'User-Agent': UA } })).text();
  const $ = cheerio.load(html);
  const items = [];
  const selector = agency.item || 'img';
  $(selector).each((_, el) => {
    const $el = $(el);
    const $img = agency.item && agency.item !== 'img' ? $el.find(agency.image || 'img').first() : $el;
    if (!$img.length) return;
    const src = pickImageSrc($img);
    const imgUrl = src && absoluteUrl(src, agency.url);
    if (!imgUrl) return;
    const surname = agency.surname
      ? $el.find(agency.surname).first().text().trim()
      : ($img.attr('alt') || '').trim();
    const text = $el.text().replace(/\s+/g, ' ').trim();
    items.push({
      id: sha(agency.url + imgUrl).slice(0, 16),
      city: agency.city,
      agency: agency.name,
      agencyUrl: agency.url,
      surname: surname.toUpperCase(),
      date: parseDate(text),
      imageUrl: imgUrl,
      sourceUrl: agency.url,
      lastSeen: todayIso
    });
  });
  // scarica le immagini in locale (l'app non dipende dai server delle agenzie)
  for (const it of items) {
    it.image = await downloadImage(it.imageUrl);
  }
  return items;
}

async function main() {
  await mkdir(IMG_DIR, { recursive: true });
  const config = JSON.parse(await readFile(path.join(ROOT, 'sources.json'), 'utf8'));
  const today = new Date();
  const todayIso = isoDate(today.getFullYear(), today.getMonth() + 1, today.getDate());

  let previous = { items: [] };
  try { previous = JSON.parse(await readFile(DATA_FILE, 'utf8')); } catch { /* primo avvio */ }
  const byId = new Map(previous.items.map((i) => [i.id, i]));

  const report = [];
  for (const agency of config.agencies) {
    try {
      const found = await scrapeAgency(agency, todayIso);
      for (const it of found) byId.set(it.id, { ...byId.get(it.id), ...it });
      report.push({ agency: agency.name, city: agency.city, ok: true, count: found.length });
      console.log(`✔ ${agency.city} – ${agency.name}: ${found.length} pigrafi`);
    } catch (err) {
      report.push({ agency: agency.name, city: agency.city, ok: false, error: String(err.message || err) });
      console.error(`✖ ${agency.name}: ${err.message}`);
    }
    await sleep(1000);
  }

  // pulizia: tiene le pigrafi viste nell'ultimo run oppure con data non ancora scaduta da 7 giorni
  const cutoff = new Date(today.getTime() - KEEP_DAYS_AFTER_DATE * 86400000);
  const cutoffIso = isoDate(cutoff.getFullYear(), cutoff.getMonth() + 1, cutoff.getDate());
  const items = [...byId.values()].filter((i) =>
    i.lastSeen === todayIso || (i.date && i.date >= cutoffIso)
  );
  items.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // rimuove immagini non più referenziate
  const used = new Set(items.map((i) => path.basename(i.image || '')));
  for (const f of await readdirSafe()) {
    if (!used.has(f)) await unlink(path.join(IMG_DIR, f));
  }

  const cities = [...new Set(config.agencies.map((a) => a.city))].sort();
  const out = {
    meta: { updatedAt: new Date().toISOString(), cities, agencies: report },
    items
  };
  await writeFile(DATA_FILE, JSON.stringify(out, null, 2) + '\n');
  console.log(`Salvate ${items.length} pigrafi in data/pigrafi.json`);
}

// esegue solo se lanciato direttamente (non quando importato nei test)
if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
