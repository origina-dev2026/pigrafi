const DATA_URL = 'data/pigrafi.json';
const CITY_KEY = 'pigrafi:city';
const CONSENT_KEY = 'pigrafi:ads-consent'; // 'accepted' | 'rejected'

// Google AdSense: sostituire con i propri ID (vedi README). Finché sono i placeholder, niente annunci.
const ADSENSE_CLIENT = 'ca-pub-XXXXXXXXXXXXXXXX';
const ADSENSE_SLOT = 'XXXXXXXXXX';
const AD_EVERY = 6; // uno slot banner ogni N pigrafi

const $consent = document.getElementById('consent');
const adsConfigured = !ADSENSE_CLIENT.includes('XXXX');
let adsScriptLoaded = false;

function adsAllowed() {
  return adsConfigured && localStorage.getItem(CONSENT_KEY) === 'accepted';
}

// Lo script Google viene caricato solo dopo il consenso.
function loadAdsScript() {
  if (adsScriptLoaded) return;
  adsScriptLoaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(s);
}

function adSlot() {
  const wrap = document.createElement('div');
  wrap.className = 'ad';
  wrap.innerHTML = `<ins class="adsbygoogle" style="display:block"
      data-ad-client="${ADSENSE_CLIENT}" data-ad-slot="${ADSENSE_SLOT}"
      data-ad-format="auto" data-full-width-responsive="true"></ins>`;
  // inizializza il banner dopo l'inserimento nel DOM
  queueMicrotask(() => {
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { console.error(e); }
  });
  return wrap;
}

function setupConsent() {
  const choice = localStorage.getItem(CONSENT_KEY);
  if (!choice && adsConfigured) $consent.hidden = false;
  if (choice === 'accepted' && adsConfigured) loadAdsScript();
  document.getElementById('consent-accept').addEventListener('click', () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    $consent.hidden = true;
    loadAdsScript();
    render();
  });
  document.getElementById('consent-reject').addEventListener('click', () => {
    localStorage.setItem(CONSENT_KEY, 'rejected');
    $consent.hidden = true;
    render();
  });
}

const $city = document.getElementById('city');
const $surname = document.getElementById('surname');
const $list = document.getElementById('list');
const $status = document.getElementById('status');

let items = [];

// data di oggi in formato YYYY-MM-DD, ora locale del dispositivo
function todayIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function formatDate(iso) {
  if (!iso) return 'data non indicata';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function render() {
  const city = $city.value;
  const q = $surname.value.trim().toUpperCase();
  const today = todayIso();

  const filtered = items.filter((i) =>
    i.city === city && (!q || (i.surname || '').includes(q))
  );

  // in arrivo (o senza data) prima, in ordine di data; passate in fondo, dalla più recente
  const upcoming = filtered.filter((i) => !i.date || i.date >= today)
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const past = filtered.filter((i) => i.date && i.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  $list.innerHTML = '';
  const showAds = adsAllowed();
  [...upcoming, ...past].forEach((it, idx) => {
    if (showAds && idx > 0 && idx % AD_EVERY === 0) $list.appendChild(adSlot());
    const isPast = it.date && it.date < today;
    const card = document.createElement('article');
    card.className = 'card' + (isPast ? ' past' : '');
    card.innerHTML = `
      <img loading="lazy" alt="Pigrafe di ${escapeHtml(it.surname)}" src="${escapeAttr(it.image)}">
      <div class="info">
        <h2>${escapeHtml(it.surname || '—')}</h2>
        <p>${escapeHtml(formatDate(it.date))}</p>
        <p class="agency">${escapeHtml(it.agency)}</p>
        ${isPast ? '<span class="badge">scaduta</span>' : ''}
      </div>`;
    $list.appendChild(card);
  });

  if (!filtered.length) {
    $list.innerHTML = '<p class="empty">Nessuna pigrafe trovata.</p>';
  }
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function escapeAttr(s = '') { return escapeHtml(s); }

async function load() {
  try {
    const res = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    items = data.items || [];
    const cities = data.meta?.cities?.length
      ? data.meta.cities
      : [...new Set(items.map((i) => i.city))].sort();

    $city.innerHTML = cities.map((c) => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join('');
    const saved = localStorage.getItem(CITY_KEY);
    if (saved && cities.includes(saved)) $city.value = saved;

    const updated = data.meta?.updatedAt ? new Date(data.meta.updatedAt).toLocaleString('it-IT') : '—';
    $status.textContent = `Aggiornato il ${updated}`;
    render();
  } catch (err) {
    $status.textContent = 'Impossibile caricare i dati. Riprova più tardi.';
    console.error(err);
  }
}

$city.addEventListener('change', () => {
  localStorage.setItem(CITY_KEY, $city.value);
  render();
});
$surname.addEventListener('input', render);

// service worker: app installabile e utilizzabile offline con l'ultimo dato salvato
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

setupConsent();
load();
