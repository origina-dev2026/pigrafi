// Test: node --test scraper/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDate } from './scrape.mjs';

test('data numerica', () => {
  assert.equal(parseDate('Funerale: 12/11/2026 ore 10'), '2026-11-12');
  assert.equal(parseDate('dal 3-1-2027'), '2027-01-03');
});

test('data in lettere', () => {
  assert.equal(parseDate('Lunedì 5 gennaio 2026 alle 15:00'), '2026-01-05');
});

test('nessuna data', () => {
  assert.equal(parseDate('Nessuna data qui'), null);
  assert.equal(parseDate(''), null);
});

import { parsePlace, classifyType, fullSizeUrl } from './scrape.mjs';

test('luogo esequie: chiesa di Mirano', () => {
  const t = "Martedì 17 Novembre 2026 alle ore 11,00 nella chiesa San Leopoldo Mandic' di Mirano. Dopo la cerimonia si proseguirà per il crematorio.";
  assert.equal(parsePlace(t), 'Mirano');
});

test('luogo esequie: Mestre anche se l\'agenzia è di Mirano', () => {
  assert.equal(parsePlace('I funerali avranno luogo nella chiesa di Santa Maria Assunta di Mestre alle 10'), 'Mestre');
  assert.equal(parsePlace('esequie a Mestre, cimitero'), 'Mestre');
});

test('luogo non trovato', () => {
  assert.equal(parsePlace('testo senza luoghi'), null);
});

test('tipo: anniversario vs funerale', () => {
  assert.equal(classifyType('Tomaello Cristian 3° anniversario'), 'anniversario');
  assert.equal(classifyType('Vescovo Vittorino', 'nella chiesa'), 'funerale');
});

test('immagine a dimensione piena', () => {
  assert.equal(fullSizeUrl('https://x.it/wp-content/uploads/2026/11/Zara-Gabriella-217x307.jpg'), 'https://x.it/wp-content/uploads/2026/11/Zara-Gabriella.jpg');
});

import { parseEventDate } from './scrape.mjs';

test('data evento: funerale, non data del decesso', () => {
  const t = "Il giorno 10 Novembre 2026 amorevolmente assistito dai propri cari è mancato ... I funerali avranno luogo Martedì 17 Novembre 2026 alle ore 11,00 nella chiesa di Mirano";
  assert.equal(parseEventDate(t), '2026-11-17');
});

test('data evento: solo data del decesso -> null se marcata come decesso', () => {
  assert.equal(parseEventDate('Il giorno 10 Novembre 2026 è mancato'), null);
});

import { decodeSvelteKit, findRecords } from './scrape.mjs';

test('SvelteKit devalue: decodifica elenco defunti', () => {
  const json = { nodes: [null, null, { type: 'data', data: [{ defunti: 1 }, [2], { id: 3, nome: 4, immagineNecrologioUrl: 5 }, 1557, 'SILVANA', '/img/1'] }] };
  const root = decodeSvelteKit(json);
  const recs = findRecords(root, 'immagineNecrologioUrl');
  assert.equal(recs.length, 1);
  assert.equal(recs[0].nome, 'SILVANA');
  assert.equal(recs[0].id, 1557);
});
