import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRegistration } from './validate.mjs';

const ok = {
  name: 'Agenzia Test', contact_name: 'Mario Rossi', email: 'Info@Test.it', city: 'Mirano',
  necrologi_url: "https://www.test.it/necrologi", authorization: true, privacy: true,
};

test('dati validi', () => {
  const r = validateRegistration(ok);
  assert.equal(r.ok, true);
  assert.equal(r.data.email, 'info@test.it');
});

test('autorizzazione obbligatoria', () => {
  const r = validateRegistration({ ...ok, authorization: false });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /autorizzazione/);
});

test('url necrologi non valido', () => {
  assert.equal(validateRegistration({ ...ok, necrologi_url: 'javascript:alert(1)' }).ok, false);
});

test('privacy obbligatoria', () => {
  const r = validateRegistration({ ...ok, privacy: false });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /privacy/);
});
