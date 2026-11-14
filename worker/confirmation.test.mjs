import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmationEmail } from './confirmation.mjs';

test('testo di conferma con nome agenzia e revoca', () => {
  const m = confirmationEmail({ name: 'Agenzia Test', contact_name: 'Mario Rossi' });
  assert.match(m.text, /Agenzia Test/);
  assert.match(m.text, /collaborazioni@majime\.it/);
  assert.match(m.subject, /Registrazione ricevuta/);
});
