import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT, readPinned } from '../../../pipeline/files.js';
import { footnoteList, parseFootnotes, footnoteText } from '../footnotes.js';

const emitted = JSON.parse(readFileSync(REPO_ROOT + 'data/emitted/hacrp/fy2026/hacrp.json', 'utf8'));

test('the pinned crosswalk parses, with CMS text kept verbatim', () => {
  const map = parseFootnotes(readPinned('y9us-9xdf'));
  assert.ok(map.size > 0);
  assert.equal(footnoteText(map, '5'), 'Results are not available for this reporting period.');
  assert.match(footnoteText(map, 'a'), /^Maryland hospitals are waived/);
  // a quoted cell (with a comma inside) stays whole
  assert.match(footnoteText(map, '6'), /^Fewer than 100 patients completed the CAHPS survey\. Use these scores with caution, as/);
});

test('every footnote code in the emitted HACRP file has CMS text', () => {
  const map = parseFootnotes(readPinned('y9us-9xdf'));
  const codes = new Set();
  const add = (field) => {
    for (const code of String(field).split(',').map((c) => c.trim())) if (code) codes.add(code);
  };
  for (const h of emitted.hospitals) {
    for (const m of Object.values(h.measures)) {
      add(m.valueFootnote);
      add(m.zFootnote);
    }
    add(h.totalFootnote);
    add(h.paymentReductionFootnote);
  }
  assert.ok(codes.has('a'), 'the Maryland code is in use');
  assert.ok(codes.size > 1);
  for (const code of codes) assert.ok(footnoteText(map, code).length > 0, `text for "${code}"`);
});

test('an unknown code throws a RangeError naming it', () => {
  const map = parseFootnotes(readPinned('y9us-9xdf'));
  assert.throws(() => footnoteText(map, 'zz'), (e) => e instanceof RangeError && e.message.includes('"zz"'));
});

test('a crosswalk with a duplicate code or a missing column is rejected', () => {
  assert.throws(() => parseFootnotes('Footnote,Footnote Text\n1,x\n1,y\n'), RangeError);
  assert.throws(() => parseFootnotes('Code,Text\n1,x\n'), RangeError);
});

test('footnoteList splits a comma-separated field, trims, drops empties and repeats, and keeps CMS text', () => {
  const map = parseFootnotes('Footnote,Footnote Text\n5,Five text\n11,Eleven text\n');
  assert.deepEqual(footnoteList(map, ''), []);
  assert.deepEqual(footnoteList(map, '5'), [{ code: '5', text: 'Five text' }]);
  assert.deepEqual(footnoteList(map, ' 11, 5,,11 '), [
    { code: '11', text: 'Eleven text' },
    { code: '5', text: 'Five text' },
  ]);
  assert.throws(() => footnoteList(map, '5, zz'), RangeError);
});
