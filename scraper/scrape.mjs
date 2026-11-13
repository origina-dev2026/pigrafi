// Scraper delle pagine "pigrafi" / necrologi / anniversari delle agenzie funerarie.
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

// Data dell'evento (funerale / messa / anniversario), non la data del decesso.
// Preferisce una data preceduta da parole come "funerali", "esequie", "messa"; scarta "il giorno ... è mancato".
export function parseEventDate(text) {
  if (!text) return null;
  const re = /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})|(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/gi;
  const candidates = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 90), m.index).toLowerCase();
    const iso = m[1] ? parseDate(`${m[1]} ${m[2]} ${m[3]}`) : parseDate(`${m[4]}/${m[5]}/${m[6]}`);
    candidates.push({ iso, before });
  }
  const evento = candidates.find((c) => /funeral|esequi|messa|cerimonia|anniversario|ricordo|luogo/.test(c.before));
  if (evento) return evento.iso;
  const altro = candidates.find((c) => !/mancat|scompars|il giorno|decedut|deceduto|morto/.test(c.before));
  return altro ? altro.iso : null;
}

// Luoghi della zona: usati se l'OCR trova il nome del paese/quartiere senza la parola chiave
const LUOGHI_NOTI = [
  'Mestre', 'Mirano', 'Venezia', 'Marghera', 'Favaro Veneto', 'Chirignago', 'Zelarino',
  'Spinea', 'Dolo', 'Noale', 'Salzano', 'Martellago', 'Scorzè', 'Mira', 'Oriago',
  'Preganziol', 'Treviso', 'Padova', 'Castelfranco Veneto', 'Vigonovo', 'Pianiga'
];

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

// Trova il luogo delle esequie nel testo dell'immagine (OCR):
// "nella chiesa San Leopoldo Mandic' di Mirano" -> "Mirano"; "... a Mestre" -> "Mestre"
export function parsePlace(text) {
  if (!text) return null;
  const luogoIn = (s) => LUOGHI_NOTI.find((l) => new RegExp(`\\b${l}\\b`, 'i').test(s)) || null;
  // 1) il luogo nella frase della chiesa/cerimonia (es. "chiesa ... di Mestre")
  const frasi = text.match(/(?:chiesa|parrocchia|duomo|santuario|basilica|cappella|oratorio|cattedrale|pieve|abbazia)[^.\n]{0,120}/giu) || [];
  for (const f of frasi) {
    const l = luogoIn(f);
    if (l) return l;
  }
  // 2) un luogo noto in tutto il testo
  const l = luogoIn(text);
  if (l) return l;
  // 3) "... di <Nome>" dopo la parola chiave della cerimonia
  const m = text.match(/(?:chiesa|parrocchia|duomo|santuario|basilica|cappella|oratorio|cimitero|crematorio|cattedrale|pieve|abbazia)[^.\n]{0,90}?\b(?:di|in|a)\s+([A-ZÀ-Ú][\p{L}'’\-]+)/u);
  return m ? m[1].replace(/[’']$/, '').trim() : null;
}

// Nome della chiesa/luogo di cerimonia, come scritto nel manifesto (per il link alla mappa)
// "nella chiesa San Leopoldo Mandic' di Mirano" -> "chiesa San Leopoldo Mandic' di Mirano"
export function parseVenue(text) {
  if (!text) return null;
  const kw = '(?:[Cc]hiesa|[Pp]arrocchia|[Dd]uomo|[Ss]antuario|[Bb]asilica|[Cc]appella|[Cc]attedrale|[Pp]ieve|[Aa]bbazia)';
  const m = text.match(new RegExp(kw + '\\s+[A-ZÀ-Ú][^.\\n]{1,90}?(?=\\s+(?:alle|ore|il|dopo|si|per)\\b|[.\\n,;]|\\s+\\d|$)', 'u'));
  if (!m) return null;
  return m[0].replace(/\s+/g, ' ').trim();
}

// Il pigrafe è un anniversario? (titolo, testo della scheda o testo OCR)
export function classifyType(...parts) {
  return /anniversar/i.test(parts.filter(Boolean).join(' ')) ? 'anniversario' : 'funerale';
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

// WordPress crea le miniature con il suffisso -217x307: l'originale è senza suffisso
export function fullSizeUrl(url) {
  return url.replace(/-\d+x\d+(\.[a-z]+)$/i, '$1');
}

async function downloadImage(url) {
  const name = sha(url);
  const existing = (await readdirSafe()).find((f) => f.startsWith(name));
  if (existing) return `data/images/${existing}`;
  // rete instabile: fino a 3 tentativi con pausa crescente, una pausa tra un'immagine e l'altra
  let res = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA, 'Connection': 'close' } });
      break;
    } catch (err) {
      if (attempt === 3) { console.error('  download fallito: ' + url); throw err; }
      await sleep(1000 * attempt);
    }
  }
  await sleep(300);
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

// OCR lazy: il worker viene creato solo se serve (tesseract, lingua italiana)
let ocrWorker = null;
async function ocrText(localPath) {
  if (!ocrWorker) {
    const { createWorker } = await import('tesseract.js');
    ocrWorker = await createWorker('ita');
  }
  // localPath è relativo a docs/ (es. "data/images/x.jpg")
  const { data } = await ocrWorker.recognize(path.join(ROOT, 'docs', localPath));
  return data.text.replace(/\s+/g, ' ').trim();
}
export async function stopOcr() {
  if (ocrWorker) { await ocrWorker.terminate(); ocrWorker = null; }
}

// SvelteKit: i dati della pagina sono in /<pagina>/__data.json in formato "devalue" (indici nell'array piatto)
export function decodeSvelteKit(json) {
  const arr = json.nodes.filter(Boolean).find((n) => Array.isArray(n.data))?.data;
  if (!arr) return null;
  const memo = new Map();
  const rv = (i) => {
    if (typeof i !== 'number' || i < 0) return i;
    if (memo.has(i)) return memo.get(i);
    const v = arr[i];
    if (v === null || typeof v !== 'object') { memo.set(i, v); return v; }
    if (Array.isArray(v)) {
      const out = []; memo.set(i, out);
      for (const k of v) out.push(rv(k));
      return out;
    }
    const out = {}; memo.set(i, out);
    for (const [k, val] of Object.entries(v)) out[k] = rv(val);
    return out;
  };
  return rv(0);
}

// trova ricorsivamente gli oggetti che hanno una chiave immagine (es. immagineNecrologioUrl)
export function findRecords(node, key, out = []) {
  if (Array.isArray(node)) { node.forEach((n) => findRecords(n, key, out)); }
  else if (node && typeof node === 'object') {
    if (key in node) out.push(node);
    else Object.values(node).forEach((n) => findRecords(n, key, out));
  }
  return out;
}

// Estrae gli elementi dalla pagina, in base alla modalità dell'agenzia
function extractItems($, agency, todayIso) {
  const items = [];
  if (agency.mode === 'carousel') {
    // WordPress "post carousel": immagine come background-image, titolo = "COGNOME Nome"
    $(agency.item || '.sow-carousel-item').each((_, el) => {
      const $el = $(el);
      const style = $el.find('.sow-carousel-thumbnail a').attr('style') || '';
      const bg = style.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
      if (!bg) return;
      const imgUrl = absoluteUrl(fullSizeUrl(bg[1].trim()), agency.url);
      const title = $el.find('.sow-carousel-item-title').text().replace(/\s+/g, ' ').trim();
      const link = $el.find('.sow-carousel-item-title a').attr('href') || agency.url;
      items.push({
        id: sha(agency.url + imgUrl).slice(0, 16),
        city: agency.city,
        agency: agency.name,
        agencyUrl: agency.url,
        surname: title.toUpperCase(),
        title,
        type: classifyType(title),
        date: null,
        imageUrl: imgUrl,
        sourceUrl: link,
        lastSeen: todayIso
      });
    });
    return items;
  }

  const selector = agency.item || 'img';
  $(selector).each((_, el) => {
    const $el = $(el);
    const $img = agency.item && agency.item !== 'img' ? $el.find(agency.image || 'img').first() : $el;
    if (!$img.length) return;
    const src = pickImageSrc($img);
    const imgUrl = src && absoluteUrl(src, agency.url);
    if (!imgUrl) return;
    // nome: testo di un elemento, oppure un attributo (es. aria-label del link)
    const surname = agency.surnameAttr
      ? ($el.find(agency.surname).first().attr(agency.surnameAttr) || '').trim()
      : agency.surname
        ? $el.find(agency.surname).first().text().trim()
        : ($img.attr('alt') || '').trim();
    const text = $el.text().replace(/\s+/g, ' ').trim();
    // città: dalla scheda se l'agenzia copre più comuni (citySelector), altrimenti quella fissa
    const cityFromCard = agency.citySelector
      ? $el.find(agency.citySelector).first().contents().first().text().trim()
      : '';
    items.push({
      id: sha(agency.url + imgUrl).slice(0, 16),
      city: cityFromCard || agency.city,
      agency: agency.name,
      agencyUrl: agency.url,
      surname: surname.toUpperCase(),
      type: classifyType(text),
      date: parseDate(text),
      imageUrl: imgUrl,
      sourceUrl: agency.url,
      lastSeen: todayIso
    });
  });
  return items;
}

// pagina HTML con nuovi tentativi (la rete di alcuni siti chiude la connessione a metà)
async function getText(url) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      await sleep(1500 * attempt);
    }
  }
  throw lastErr;
}

async function scrapeSvelteKit(agency, todayIso) {
  const dataUrl = new URL('__data.json', agency.url).href;
  const res = await fetch(dataUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} su ${dataUrl}`);
  const root = decodeSvelteKit(await res.json());
  const key = agency.imageKey || 'immagineNecrologioUrl';
  const records = findRecords(root, key);
  const items = [];
  for (const r of records) {
    const imgUrl = absoluteUrl(r[key], agency.url);
    if (!imgUrl) continue;
    const nome = String(r.nome || '').trim();
    const cognome = String(r.cognome || '').trim();
    items.push({
      id: sha(agency.url + imgUrl).slice(0, 16),
      city: agency.city,
      agency: agency.name,
      agencyUrl: agency.url,
      surname: cognome.toUpperCase(),
      title: `${nome} ${cognome}`.trim(),
      type: classifyType(nome, cognome),
      date: r.dataFunerale ? String(r.dataFunerale).slice(0, 10) : null,
      imageUrl: imgUrl,
      sourceUrl: r.slug ? new URL(r.slug, agency.url).href : agency.url,
      lastSeen: todayIso
    });
  }
  return items;
}

async function scrapeAgency(agency, todayIso, byId) {
  const items = agency.mode === 'sveltekit'
    ? await scrapeSvelteKit(agency, todayIso)
    : extractItems(cheerio.load(await getText(agency.url)), agency, todayIso);

  for (const it of items) {
    // scarica le immagini in locale (l'app non dipende dai server delle agenzie)
    it.image = await downloadImage(it.imageUrl);

    const prev = byId.get(it.id);
    if (agency.ocr && !prev?.ocrDone) {
      // legge il testo del manifesto: luogo delle esequie, data e tipo (funerale/anniversario)
      try {
        const text = await ocrText(it.image);
        const place = parsePlace(text);
        it.ocrDone = true;
        it.place = place;
        it.date = parseEventDate(text) || it.date;
        it.type = classifyType(it.title, text);
        it.venue = parseVenue(text);
        it.city = place || it.city;
      } catch (err) {
        console.error(`  OCR fallito per ${it.surname}: ${err.message}`);
      }
    } else if (prev?.ocrDone) {
      // già letto in un run precedente: riusa il risultato
      it.ocrDone = true;
      it.place = prev.place;
      it.city = prev.place || it.city;
      it.date = prev.date || it.date;
      it.type = prev.type || it.type;
      it.venue = prev.venue || null;
    }
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
      const found = await scrapeAgency(agency, todayIso, byId);
      for (const it of found) byId.set(it.id, { ...byId.get(it.id), ...it });
      report.push({ agency: agency.name, city: agency.city, ok: true, count: found.length });
      console.log(`✔ ${agency.city} – ${agency.name}: ${found.length} pigrafi`);
    } catch (err) {
      report.push({ agency: agency.name, city: agency.city, ok: false, error: String(err.message || err) });
      console.error(`✖ ${agency.name}: ${err.message}${err.cause ? " (" + (err.cause.code || err.cause.message) + ")" : ""}`);
    }
    await sleep(1000);
  }
  await stopOcr();

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

  const cities = [...new Set([...config.agencies.map((a) => a.city), ...items.map((i) => i.city)])]
    .filter(Boolean).sort();
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
