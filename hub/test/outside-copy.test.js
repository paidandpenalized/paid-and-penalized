// The words of a hospital's page outside Medicare's penalty programs (hub/hospital/outside-copy.js): a reason and a
// count noun for every group of outside hospitals, no word that counts the programs, no digit, a claim behind every
// reason and "own program" line, and the rule constants filled in by fillOutside itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIKE_GROUPS } from '../outside.js';
import { COPY, fillOutside } from '../hospital/outside-copy.js';
import { copyFiles } from '../../pipeline/test/helpers.js';

const texts = () => Object.entries(COPY).map(([key, v]) => [key, typeof v === 'string' ? v : v.text]);
const claimOf = (key) => (typeof COPY[key] === 'string' ? null : COPY[key]?.claim ?? null);
// The group whose page reuses the closed note instead of a reason of its own.
const NO_REASON = new Set(['inactive']);

test('every LIKE_GROUPS group has a reason (inactive excepted) and a likeCount noun', () => {
  for (const group of LIKE_GROUPS) {
    // The unlisted group's noun names the hospital-acquired conditions file's year.
    assert.equal(typeof fillOutside(`likeCount.${group}`, group === 'not_listed' ? { hacrpFy: 'X' } : {}), 'string', `likeCount.${group}`);
    if (NO_REASON.has(group) || group === 'not_listed') continue;
    assert.ok(fillOutside(`reason.${group}`, {}).length > 0, `reason.${group}`);
  }
  assert.ok(!(`reason.inactive` in COPY), 'inactive reuses the closed note');
  for (const key of ['notListedBoth', 'notListedHacrp', 'notListedHrrp', 'notInHrrpPuertoRico']) assert.ok(key in COPY, key);
});

test('every reason, reasonInstead and own line carries a claim', () => {
  const keyed = Object.keys(COPY).filter((k) => /^(reason|reasonInstead|own)\./.test(k) || k === 'notInHrrpPuertoRico');
  assert.ok(keyed.length >= LIKE_GROUPS.length, 'the reason keys are there');
  for (const key of keyed) assert.ok([claimOf(key)].flat().filter(Boolean).length > 0, `${key}: no claim`);
  for (const group of ['critical_access', 'psychiatric', 'va']) assert.ok(`own.${group}` in COPY, `own.${group}`);
});

test('no copy value counts the programs', () => {
  assert.ok('wbNoteOutside' in COPY);
  for (const [key, text] of texts()) assert.doesNotMatch(text, /\b(three|these three|both programs)\b/i, key);
});

test('no digits in copy', () => {
  for (const [key, text] of texts()) assert.doesNotMatch(text, /\d/, key);
});

test('the stamp reads exactly, with curly apostrophes', () => {
  assert.equal(fillOutside('stamp'), 'Not in Medicare’s hospital penalty programs');
  for (const [key, text] of texts()) assert.doesNotMatch(text, /'/, `${key}: a straight apostrophe`);
});

test('fillOutside fills the rule constants itself and the rest from values', () => {
  assert.match(fillOutside('reasonInstead.critical_access'), /\b101%/);
  assert.match(fillOutside('own.psychiatric'), /\btwo percentage points\b/);
  assert.match(fillOutside('notListedHrrp', { hrrpFy: '2027' }), /FY2027/);
  assert.throws(() => fillOutside('notListedHrrp'), /no value/);
  assert.throws(() => fillOutside('no such key'), /no copy key/);
});

test('the copy gate reads this file', () => {
  assert.ok(copyFiles().includes('hub/hospital/outside-copy.js'));
});

// What is true of every hospital in the group: the hospital-acquired conditions file lists none (its noun says so, with the
// file's year), and the Readmissions file lists none or some (the sentences say which, with that file's year).
test('the not_listed group\'s like-text says only what the files list, naming each file\'s year', () => {
  const textOf = (key) => (typeof COPY[key] === 'string' ? COPY[key] : COPY[key].text);
  assert.ok(textOf('likeCount.not_listed').includes('FY{hacrpFy}'), 'the noun names the hospital-acquired conditions file by year');
  const keys = Object.keys(COPY).filter((k) => k.startsWith('likeTextNotListed'));
  assert.equal(keys.length, 4, 'with and without a state, none listed and some');
  for (const key of keys) {
    const text = textOf(key);
    assert.ok(text.includes('{kinds}') && text.includes('FY{hrrpFy}'), `${key}: the noun, and the Readmissions file by year`);
    assert.ok(!/adjust|penalty program/i.test(text), `${key}: no claim beyond the files`);
  }
  assert.ok(!('likeTextSome' in COPY) && !('likeTextSomeNoState' in COPY), 'no "adjust {k} of them" left');
});
