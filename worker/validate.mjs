// Validazione dei dati del form di registrazione agenzia (funzione pura, testabile)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isHttpUrl(s) {
  try { const u = new URL(s); return u.protocol === 'https:' || u.protocol === 'http:'; } catch { return false; }
}

export function validateRegistration(input) {
  const errors = [];
  const v = (k, max) => String(input?.[k] ?? '').trim().slice(0, max);
  const data = {
    name: v('name', 120),
    contact_name: v('contact_name', 120),
    email: v('email', 254).toLowerCase(),
    phone: v('phone', 40),
    city: v('city', 80),
    website: v('website', 300),
    necrologi_url: v('necrologi_url', 300),
  };
  if (!data.name) errors.push('Nome agenzia obbligatorio');
  if (!data.contact_name) errors.push('Referente obbligatorio');
  if (!EMAIL.test(data.email)) errors.push('Email non valida');
  if (!data.city) errors.push('Città obbligatoria');
  if (!isHttpUrl(data.necrologi_url)) errors.push('Link alla pagina necrologi non valido');
  if (data.website && !isHttpUrl(data.website)) errors.push('Sito web non valido');
  if (input?.authorization !== true) errors.push('Serve l’autorizzazione alla pubblicazione dei manifesti');
  return { ok: errors.length === 0, errors, data };
}
