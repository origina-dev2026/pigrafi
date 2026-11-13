import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asString, fill, buildAppleScript } from './make-drafts.mjs';

test('escape per AppleScript', () => {
  assert.equal(asString('a "b"\nc'), '"a \\"b\\"" & return & "c"');
});

test('segnaposto', () => {
  assert.equal(fill('Ciao {{name}} {{missing}}', { name: 'X' }), 'Ciao X ');
});

test('script senza invio', () => {
  const s = buildAppleScript([{ to: 'a@b.it', subject: 'Oggetto', body: 'Testo' }]);
  assert.match(s, /make new outgoing message/);
  assert.doesNotMatch(s, /\bsend\b/);
});
