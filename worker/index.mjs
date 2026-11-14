// Worker Cloudflare: registrazione agenzie funebri -> D1 (database "pigrafi")
import { validateRegistration } from './validate.mjs';
import { sendConfirmation, sendInternalNotice } from './confirmation.mjs';

const AUTH_TEXT_VERSION = '2026-11-v1';
const AUTH_TEXT = "Autorizzo Pigrafi a riprodurre nell'app e nel sito i manifesti funebri pubblicati dalla mia agenzia sulla pagina indicata, indicando la fonte (nome dell'agenzia e link alla pagina). Posso revocare l'autorizzazione in qualsiasi momento scrivendo a collaborazioni@majime.it.";
const ALLOWED_ORIGINS = ['https://pigrafi.majime.it', 'https://origina-dev2026.github.io'];

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

const json = (obj, status, origin) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) },
  });

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (url.pathname === '/health') return json({ ok: true }, 200, origin);

    // elenco per lo scraper: solo agenzie autorizzate, attive e con configurazione verificata
    if (url.pathname === '/sources' && request.method === 'GET') {
      const auth = request.headers.get('Authorization') || '';
      if (!env.SOURCES_TOKEN || auth !== `Bearer ${env.SOURCES_TOKEN}`) return json({ error: 'unauthorized' }, 401, origin);
      const { results } = await env.DB.prepare(
        `SELECT name, city, necrologi_url, scraper_config FROM agencies
         WHERE active = 1 AND authorization_accepted_at IS NOT NULL`
      ).all();
      return json({
        agencies: results.map((r) => ({
          name: r.name, city: r.city, url: r.necrologi_url, mode: 'auto',
          ...(r.scraper_config ? JSON.parse(r.scraper_config) : {}),
        })),
      }, 200, origin);
    }
    if (url.pathname !== '/register' || request.method !== 'POST') return json({ error: 'not found' }, 404, origin);

    let body;
    try { body = await request.json(); } catch { return json({ ok: false, errors: ['Richiesta non valida'] }, 400, origin); }

    const { ok, errors, data } = validateRegistration(body);
    if (!ok) return json({ ok: false, errors }, 422, origin);

    // IP solo come hash (nessun dato personale grezzo nel database)
    const authHash = await sha256Hex(AUTH_TEXT);
    const now = new Date().toISOString();
    try {
      // archivia il testo dell'autorizzazione una volta per versione
      await env.DB.prepare(
        `INSERT OR IGNORE INTO consent_texts (version, text, sha256, created_at) VALUES (?, ?, ?, ?)`
      ).bind(AUTH_TEXT_VERSION, AUTH_TEXT, authHash, now).run();
    } catch { /* la registrazione va avanti comunque */ }
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ipHash = await sha256Hex(`${ip}|${env.IP_SALT || ''}`);

    try {
      await env.DB.prepare(
        `INSERT INTO agencies (name, contact_name, email, phone, city, website, necrologi_url,
           authorization_accepted_at, authorization_text_version, ip_hash, anniversari_url,
           privacy_accepted_at, auth_text_sha256)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        data.name, data.contact_name, data.email, data.phone, data.city, data.website, data.necrologi_url,
        now, AUTH_TEXT_VERSION, ipHash, data.anniversari_url || null, now, authHash
      ).run();
    } catch (err) {
      if (String(err.message || err).includes('UNIQUE')) {
        return json({ ok: false, errors: ['Esiste già una registrazione con questa email'] }, 409, origin);
      }
      return json({ ok: false, errors: ['Errore interno, riprova più tardi'] }, 500, origin);
    }
    try { await sendConfirmation(env, data); } catch { /* la registrazione resta valida */ }
    try { await sendInternalNotice(env, data); } catch { /* avviso interno facoltativo */ }
    return json({ ok: true }, 201, origin);
  },
};
