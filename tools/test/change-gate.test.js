// The change gate's rule: emitted data may change only with a reason on record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeGate, parseNameStatus, reasonFor } from '../ci/change-gate.js';

const EMITTED = 'data/emitted/hacrp/fy2026/hacrp.json';
const OLDER = 'data/emitted/hacrp/fy2025/hacrp.json';
const M = (path) => ({ status: 'M', path });

test('changes outside data/emitted/ pass', () => {
  assert.equal(changeGate({ changed: [M('engine/js/csv.js'), M('README.md')] }).ok, true);
  assert.equal(changeGate({ changed: [] }).ok, true);
  assert.equal(changeGate({ changed: [M('data/emitted-notes.md')] }).ok, true);
});

test('an unexplained emitted change fails, naming only the unexplained files', () => {
  const r = changeGate({ changed: [M(EMITTED), M(OLDER), M('engine/js/csv.js')], explained: new Set([EMITTED]) });
  assert.equal(r.ok, false);
  assert.match(r.reason, /fy2025/);
  assert.doesNotMatch(r.reason, /fy2026/);
  assert.equal(changeGate({ changed: [M(EMITTED)], explained: new Set([EMITTED]) }).ok, true);
});

test('a deletion (or the delete half of a rename) needs a corrections entry', () => {
  const rename = [{ status: 'D', path: OLDER }, { status: 'A', path: 'data/emitted/hacrp/fy2025/hacrp-final.json' }];
  assert.equal(changeGate({ changed: rename, explained: new Set(['data/emitted/hacrp/fy2025/hacrp-final.json', OLDER]) }).ok, false);
  assert.equal(changeGate({ changed: [...rename, { status: 'A', path: 'corrections/2026-11-01.md' }] }).ok, true);
});

test('a corrections entry covers the whole change; near-misses do not', () => {
  assert.equal(changeGate({ changed: [M(EMITTED), M(OLDER), { status: 'A', path: 'corrections/2026-11-01-hacrp.md' }] }).ok, true);
  for (const p of ['corrections-old.md', 'docs/corrections/x.md', 'docs/METHODS-LOG.md']) {
    assert.equal(changeGate({ changed: [M(EMITTED), M(p)] }).ok, false, p);
  }
});

const file = (source, version) => ({ source_manifest: source, methods_version: version, sources: ['a'] });
const v = (now, before) => ({ now, before });

test('reasonFor: added, re-pinned, bumped, or nothing', () => {
  assert.equal(reasonFor(null, file('x', 1), v(1, 1)), 'added');
  assert.equal(reasonFor(file('x', 1), file('y', 1), v(1, 1)), 're-pinned');
  assert.equal(reasonFor(file('x', 1), file('x', 2), v(2, 1)), 'bumped');
  assert.equal(reasonFor(file('x', 1), file('x', 1), v(1, 1)), null, 'numbers moved, nothing else');
});

test('reasonFor: a bump counts only when the file moves to the new newest version', () => {
  assert.equal(reasonFor(file('x', 1), file('x', 1), v(2, 1)), null, 'an older year that kept its version');
  assert.equal(reasonFor(file('x', 1), file('x', 2), v(3, 1)), null, 'moved, but not to the newest');
  assert.equal(reasonFor(file('x', 1), file('x', 2), v(2, 2)), null, 'the log did not go up');
  assert.equal(reasonFor(file('x', 2), file('x', 1), v(1, 2)), null, 'a downgrade');
});

test('reasonFor: content that is not an emitted file explains nothing (and never throws)', () => {
  for (const bad of [undefined, null, 42, 'text', [], { methods_version: 1 }]) {
    assert.equal(reasonFor(file('x', 1), bad, v(1, 1)), null);
  }
  assert.equal(reasonFor(undefined, file('x', 1), v(1, 1)), null, 'unparseable before');
});

test('parseNameStatus reads git -z output, paths with spaces and newlines included', () => {
  assert.deepEqual(parseNameStatus('M\0a b.json\0D\0x\ny\0T\0z\0'), [
    { status: 'M', path: 'a b.json' },
    { status: 'D', path: 'x\ny' },
    { status: 'T', path: 'z' },
  ]);
  assert.deepEqual(parseNameStatus(''), []);
});
