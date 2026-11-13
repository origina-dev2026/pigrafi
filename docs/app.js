const DATA_URL = 'data/pigrafi.json';
const CITY_KEY = 'pigrafi:city';
const TYPE_KEY = 'pigrafi:type';
const CONSENT_KEY = 'pigrafi:ads-consent'; // 'accepted' | 'rejected'

// Google AdSense (publisher e slot reali)
const ADSENSE_CLIENT = 'ca-pub-2414957329781059';
const ADSENSE_SLOT = '5742781147';
const AD_EVERY = 6; // uno slot banner ogni N schede

const $city = document.getElementById('city');
const $surname = document.getElementById('surname');
const $list = document.getElementById('list');
const $status = document.getElementById('status');
const $summary = document.getElementById('summary');
const $consent = document.getElementById('consent');
const $tabs = document.querySelectorAll('.tab');

let items = [];
let type = localStorage.getItem(TYPE_KEY) === 'anniversario' ? 'anniversario' : 'funerale';

// ---------- utilità ----------
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

// data di oggi in formato YYYY-MM-DD, ora locale del dispositivo
function todayIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dateLabel(iso, today) {
  if (!iso) return 'Data non indicata';
  if (iso === today) return 'Oggi';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${GIORNI[dt.getDay()]} ${d} ${MESI[m - 1]} ${y}`;
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---------- annunci (Google AdSense) ----------
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

// Aggiorna il consenso per Google (lo script AdSense è già nell'head, con consenso negato di default).
function updateAdsConsent(granted) {
  if (typeof gtag !== 'function') return;
  const v = granted ? 'granted' : 'denied';
  gtag('consent', 'update', { ad_storage: v, ad_user_data: v, ad_personalization: v });
}

function setupConsent() {
  if (!localStorage.getItem(CONSENT_KEY)) $consent.hidden = false;
  document.getElementById('consent-accept').addEventListener('click', () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    $consent.hidden = true;
    updateAdsConsent(true);
    render();
  });
  document.getElementById('consent-reject').addEventListener('click', () => {
    localStorage.setItem(CONSENT_KEY, 'rejected');
    $consent.hidden = true;
    updateAdsConsent(false);
    render();
  });
}

// ---------- rendering ----------
function render() {
  const city = $city.value;
  const q = $surname.value.trim().toUpperCase();
  const today = todayIso();

  const filtered = items.filter((i) =>
    (i.type || 'funerale') === type &&
    (!city || i.city === city) &&
    (!q || (i.surname || '').toUpperCase().includes(q))
  );

  // in arrivo (o senza data) prima, in ordine di data; passate in fondo, dalla più recente
  const upcoming = filtered.filter((i) => !i.date || i.date >= today)
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const past = filtered.filter((i) => i.date && i.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));
  const ordered = [...upcoming, ...past];

  $summary.textContent = ordered.length
    ? `${ordered.length} ${type === 'funerale' ? (ordered.length === 1 ? 'funerale' : 'funerali') : (ordered.length === 1 ? 'anniversario' : 'anniversari')}${city ? ` a ${city}` : ''}`
    : '';

  $list.innerHTML = '';
  ordered.forEach((it, idx) => {
    if (idx > 0 && idx % AD_EVERY === 0) $list.appendChild(adSlot());
    const isPast = it.date && it.date < today;
    const isToday = it.date === today;
    const card = document.createElement('article');
    card.className = 'card' + (isPast ? ' past' : '');
    card.innerHTML = `
      <div class="photo">
        <img class="zoomable" loading="lazy" alt="Manifesto di ${escapeHtml(it.surname)}" src="${escapeHtml(it.image)}" title="Ingrandisci">
        <span class="date-chip${isToday ? ' today' : ''}">${escapeHtml(isPast ? 'Conclusa' : dateLabel(it.date, today))}</span>
      </div>
      <div class="info">
        <span class="kind">${it.type === 'anniversario' ? 'Anniversario' : 'Funerale'}</span>
        <h2>${escapeHtml(toTitle(it.surname))}</h2>
        <p class="place">${escapeHtml(it.city)}</p>
        <p class="agency">${escapeHtml(it.agency)}</p>
        ${mapLink(it, isPast)}
      </div>`;
    $list.appendChild(card);
  });

  if (!ordered.length) {
    $list.innerHTML = `<p class="empty">Nessun ${type === 'funerale' ? 'funerale' : 'anniversario'} trovato${city ? ` a ${escapeHtml(city)}` : ''}.</p>`;
  }
}

// link alla chiesa (solo per funerali non ancora svolti), apre Google Maps
function mapLink(it, isPast) {
  if (isPast) return '';
  const q = it.venue || (it.place ? `${it.place}` : '');
  if (!q) return '';
  const query = encodeURIComponent(`${q}${it.venue ? '' : ''}`.trim());
  return `<a class="map-link" href="https://www.google.com/maps/search/?api=1&query=${query}" target="_blank" rel="noopener">Dove si svolge · apri la mappa ↗</a>`;
}

// visualizzazione ingrandita del manifesto
const $viewer = document.getElementById('viewer');
$list.addEventListener('click', (e) => {
  const img = e.target.closest('img.zoomable');
  if (!img) return;
  $viewer.querySelector('img').src = img.src;
  $viewer.querySelector('img').alt = img.alt;
  $viewer.showModal();
});
$viewer.addEventListener('click', (e) => { if (e.target === $viewer || e.target.classList.contains('viewer-close')) $viewer.close(); });

// "ROSSI MARIA" -> "Rossi Maria"
function toTitle(s = '') {
  return s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}

// ---------- caricamento ----------
async function load() {
  try {
    const res = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    items = data.items || [];
    const cities = data.meta?.cities?.length
      ? data.meta.cities
      : [...new Set(items.map((i) => i.city))].sort();

    $city.innerHTML = cities.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    const saved = localStorage.getItem(CITY_KEY);
    if (saved && cities.includes(saved)) $city.value = saved;

    const updated = data.meta?.updatedAt ? new Date(data.meta.updatedAt).toLocaleString('it-IT') : '—';
    $status.textContent = `Aggiornato il ${updated}`;
    setTab(type);
    render();
  } catch (err) {
    $status.textContent = 'Impossibile caricare i dati. Riprova più tardi.';
    console.error(err);
  }
}

function setTab(t) {
  type = t;
  localStorage.setItem(TYPE_KEY, t);
  $tabs.forEach((b) => {
    const on = b.dataset.type === t;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
}

$tabs.forEach((b) => b.addEventListener('click', () => { setTab(b.dataset.type); render(); }));
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
