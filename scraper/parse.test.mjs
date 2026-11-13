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
