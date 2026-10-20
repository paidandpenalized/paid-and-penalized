// The commit blocklist: parsing and matching. Entries here are invented; real ones never enter the repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBlocklist, findHits } from '../hygiene/blocklist.js';
import { mulberry32 } from '../../engine/js/test/prng.js';

const ENTRIES = ['Jane Placeholder', 'j.q@example.test', 'a.b', 'Émile Exemple'];

test('parses entries, skipping blanks and comments', () => {
  assert.deepEqual(parseBlocklist('# comment\n\n  Jane Placeholder  \r\nj.q@example.test\n'), ['Jane Placeholder', 'j.q@example.test']);
});

test('an empty list throws', () => {
  assert.throws(() => parseBlocklist('# only a comment\n\n'), RangeError);
});

test('matches across whitespace and line breaks, any case', () => {
  assert.deepEqual(findHits('see jane\n  PLACEHOLDER here', ENTRIES), [{ entry: 1, line: 1 }]);
  assert.deepEqual(findHits('JANE\tplaceholder', ENTRIES), [{ entry: 1, line: 1 }]);
  assert.deepEqual(findHits('émile EXEMPLE', ENTRIES), [{ entry: 4, line: 1 }]);
});

test('no hit inside a longer word', () => {
  assert.deepEqual(findHits('Janet Placeholderson and Jane Placeholders', ENTRIES), []);
  assert.deepEqual(findHits("Jane Placeholder's note", ENTRIES), [{ entry: 1, line: 1 }]);
  assert.deepEqual(findHits('xj.q@example.test', ENTRIES), []);
});

test('entries are literal', () => {
  assert.deepEqual(findHits('axb', ENTRIES), []);
  assert.deepEqual(findHits('see a.b now', ENTRIES), [{ entry: 3, line: 1 }]);
});

test('reports the line where the match starts', () => {
  assert.deepEqual(findHits('one\ntwo\nthree Jane\nPlaceholder\nmail j.q@example.test', ENTRIES), [
    { entry: 1, line: 3 },
    { entry: 2, line: 5 },
  ]);
});

test('property: an entry with random case and spacing between random words is always found (2,000 trials)', () => {
  const rand = mulberry32(20261020);
  const pick = (xs) => xs[Math.floor(rand() * xs.length)];
  const words = ['alpha', 'beta', 'gamma', 'delta', '12', 'x'];
  const spaces = [' ', '\t', '\n', '\r\n'];
  const names = ['Jane Placeholder', 'Émile Exemple'];
  for (let i = 0; i < 2000; i++) {
    const index = Math.floor(rand() * names.length);
    const variant = [...names[index]]
      .map((ch) => (ch === ' ' ? Array.from({ length: 1 + Math.floor(rand() * 3) }, () => pick(spaces)).join('') : rand() < 0.5 ? ch.toUpperCase() : ch.toLowerCase()))
      .join('');
    const before = Array.from({ length: Math.floor(rand() * 4) }, () => pick(words)).join(' ');
    const after = Array.from({ length: Math.floor(rand() * 4) }, () => pick(words)).join(' ');
    const hits = findHits(`${before} ${variant} ${after}`, names);
    assert.equal(hits.length, 1, `trial ${i}: ${JSON.stringify(variant)}`);
    assert.equal(hits[0].entry, index + 1);
  }
});
