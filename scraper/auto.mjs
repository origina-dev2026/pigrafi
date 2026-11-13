// Rilevatore generico: trova il gruppo di "card" ripetute (fratelli con stessa struttura e un'immagine)
// e ne estrae immagine, nome e testo. Non richiede selettori scritti a mano.
import * as cheerio from 'cheerio';

const bgUrl = (style = '') => {
  const m = style.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
  return m ? m[1].trim() : null;
};

// firma strutturale di un elemento: tag + classi (senza numeri/id variabili)
const signature = (el) => {
  const cls = (el.attribs?.class || '').split(/\s+/).filter((c) => c && !/\d/.test(c)).sort().join('.');
  return `${el.tagName || el.name}.${cls}`;
};

// per ogni elemento, quanti figli diretti hanno la stessa firma e contengono un'immagine
export function findCardGroups($) {
  const groups = [];
  $('*').each((_, parent) => {
    const kids = $(parent).children().toArray();
    if (kids.length < 3) return;
    const bySig = new Map();
    for (const k of kids) {
      const sig = signature(k);
      if (!bySig.has(sig)) bySig.set(sig, []);
      bySig.get(sig).push(k);
    }
    for (const [sig, els] of bySig) {
      if (els.length < 3) continue;
      const withImg = els.filter((el) => $(el).find('img, [style*="background-image"]').length > 0);
      if (withImg.length >= 3 && withImg.length / els.length >= 0.7) {
        groups.push({ sig, els: withImg, score: withImg.length });
      }
    }
  });
  // il gruppo più grande vince; i gruppi con la stessa firma (es. slider doppi) vengono uniti
  groups.sort((a, b) => b.score - a.score);
  if (!groups.length) return null;
  const best = groups[0].sig;
  const els = groups.filter((g) => g.sig === best).flatMap((g) => g.els);
  return { sig: best, els: [...new Set(els)], score: els.length };
}

// estrae i dati di una card
export function extractCard($, el, baseUrl) {
  const $el = $(el);
  const $img = $el.find('img').first();
  const bgEl = $el.find('[style*="background-image"]').first();
  let src = $img.attr('data-src') || $img.attr('src') || bgUrl(bgEl.attr('style'));
  if (!src && $img.attr('srcset')) src = $img.attr('srcset').split(',')[0].trim().split(' ')[0];
  let imageUrl = null;
  try { imageUrl = src ? new URL(src, baseUrl).href : null; } catch { imageUrl = null; }
  // nome: attributo aria-label di un link, oppure il primo titolo
  const nameAttr = $el.find('[aria-label]').first().attr('aria-label');
  const heading = $el.find('h1,h2,h3,h4').first().text().replace(/\s+/g, ' ').trim();
  const text = $el.text().replace(/\s+/g, ' ').trim();
  return { imageUrl, name: (nameAttr || heading || '').trim(), text };
}

// punto di ingresso: estrae le card da una pagina HTML
export function autoDetect(html, baseUrl) {
  const $ = cheerio.load(html);
  const group = findCardGroups($);
  if (!group) return { ok: false, reason: 'nessun gruppo di card trovato', items: [] };
  const items = group.els
    .map((el) => extractCard($, el, baseUrl))
    .filter((c) => c.imageUrl);
  // le miniature WordPress hanno il suffisso -217x307: l'originale è senza
  for (const it of items) it.imageUrl = it.imageUrl.replace(/-\d+x\d+(\.[a-z]+)$/i, '$1');
  return { ok: items.length >= 3, reason: `gruppo ${group.sig} con ${items.length} card`, items };
}
