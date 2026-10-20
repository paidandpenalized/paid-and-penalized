// The change gate's rule: emitted data may change only with a reason on record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENTRY, changeGate, parseNameStatus, reasonFor } from '../ci/change-gate.js';
import { sourceManifestHash } from '../../pipeline/contract.js';

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

const ENTRY_PATH = 'corrections/2026-11-01-hacrp.md';
const NEW_ENTRY = { status: 'A', path: ENTRY_PATH };
const FRESH = new Set([ENTRY_PATH]);

test('a deletion (or the delete half of a rename) needs a corrections entry', () => {
  const rename = [{ status: 'D', path: OLDER }, { status: 'A', path: 'data/emitted/hacrp/fy2025/hacrp-final.json' }];
  assert.equal(changeGate({ changed: rename, explained: new Set(['data/emitted/hacrp/fy2025/hacrp-final.json', OLDER]) }).ok, false);
  assert.equal(changeGate({ changed: [...rename, NEW_ENTRY], freshEntries: FRESH }).ok, true);
  assert.equal(changeGate({ changed: [{ status: 'D', path: OLDER }, NEW_ENTRY], freshEntries: FRESH }).ok, true, 'a deletion alone');
});

test('a new corrections entry covers the whole change', () => {
  assert.equal(changeGate({ changed: [M(EMITTED), M(OLDER), NEW_ENTRY], freshEntries: FRESH }).ok, true);
  assert.equal(changeGate({ changed: [M(EMITTED), NEW_ENTRY] }).ok, false, 'old or empty content under a new name');
});

test('the corrections log is append-only: editing, retyping or deleting an entry voids the cover, and says so', () => {
  for (const status of ['M', 'T', 'D']) {
    const other = { status, path: 'corrections/2026-10-01-old.md' };
    const r = changeGate({ changed: [M(EMITTED), NEW_ENTRY, other], freshEntries: FRESH });
    assert.equal(r.ok, false, status);
    assert.match(r.reason, /also edits or removes corrections\/2026-10-01-old\.md/);
  }
  const readme = { status: 'M', path: 'corrections/README.md' };
  assert.equal(changeGate({ changed: [M(EMITTED), NEW_ENTRY, readme], freshEntries: FRESH }).ok, true, 'a non-entry file is not the log');
});

test('ENTRY: real calendar-shaped dates and a slug that starts with a letter or digit', () => {
  for (const ok of ['corrections/2026-11-01-hacrp.md', 'corrections/2026-12-31-a.md', 'corrections/2027-02-28-x-y-2.md']) assert.match(ok, ENTRY);
  for (const bad of ['corrections/2026-13-01-a.md', 'corrections/2026-00-10-a.md', 'corrections/2026-11-32-a.md', 'corrections/2026-11-00-a.md',
    'corrections/9999-99-99--.md', 'corrections/2026-11-01--a.md', 'corrections/2026-11-01-A.md']) assert.doesNotMatch(bad, ENTRY);
});

test('only a dated markdown entry directly under corrections/ counts', () => {
  for (const p of ['corrections-old.md', 'docs/corrections/2026-11-01-x.md', 'corrections/README.md', 'corrections/.gitkeep',
    'corrections/2026-11-01-x.txt', 'corrections/sub/2026-11-01-x.md', 'docs/METHODS-LOG.md']) {
    assert.equal(changeGate({ changed: [M(EMITTED), { status: 'A', path: p }], freshEntries: new Set([p]) }).ok, false, p);
  }
});

const hash = (pins, ids) => sourceManifestHash(ids.map((id) => ({ id, sha256: pins.get(id) })));
const OLD = new Map([['a', '1'], ['b', '2']]);
const NEW = new Map([['a', '9'], ['b', '2']]);
const file = (version, sources = ['a'], pins = OLD) => ({ source_manifest: hash(pins, sources), methods_version: version, sources });
const SAME = { before: OLD, now: OLD };
const REPIN = { before: OLD, now: NEW };
const ctx = (before, now, { pins = SAME, latest = { now: 1, before: 1 }, added = false } = {}) =>
  reasonFor({ added, before, now, pins, latest });

test('reasonFor: added, re-pinned, bumped, or nothing', () => {
  assert.equal(ctx(undefined, file(1), { added: true }), 'added');
  assert.equal(ctx(file(1), file(1, ['a'], NEW), { pins: REPIN }), 're-pinned');
  assert.equal(ctx(file(1), file(2), { latest: { now: 2, before: 1 } }), 'bumped');
  assert.equal(ctx(file(1), file(1)), null, 'numbers moved, nothing else');
});

test('reasonFor: a re-pin needs the same sources and a new, truthful source_manifest', () => {
  assert.equal(ctx(file(1), { ...file(1, ['a'], NEW), source_manifest: 'f'.repeat(64) }, { pins: REPIN }), null, 'a forged hash');
  assert.equal(ctx(file(1), file(1, ['a'], OLD), { pins: REPIN }), null, 'a stale hash');
  assert.equal(ctx(file(1), file(1, ['a', 'b'], NEW), { pins: REPIN }), null, 'adding an input during a re-pin is a methods change');
  assert.equal(ctx(file(1, ['a', 'b']), file(1, ['a'], NEW), { pins: REPIN }), null, 'dropping one, likewise');
  assert.equal(ctx(file(1, ['b', 'a']), file(1, ['a', 'b'], NEW), { pins: REPIN }), null, 'reordering, likewise');
  assert.equal(ctx(file(1), file(1, ['c'], NEW), { pins: REPIN }), null, 'an input missing from the manifest');
  assert.equal(ctx(file(1), file(1)), null, 'the same hash');
  assert.equal(ctx(file(1, ['a'], NEW), file(1, ['a'], NEW), { pins: { before: NEW, now: NEW } }), null, 'no SHA-256 changed in this change');
  assert.equal(ctx(file(1), file(1, ['a'], NEW), { pins: { before: NEW, now: NEW } }), null, 'a re-emit after a pin in an earlier push');
  assert.equal(ctx(file(1), file(2, ['a'], NEW), { pins: REPIN, latest: { now: 2, before: 2 } }), null, 'a re-pin that also moves methods_version');
});

test('reasonFor: a bump counts only when the file moves to the new newest version', () => {
  assert.equal(ctx(file(1), file(1), { latest: { now: 2, before: 1 } }), null, 'an older year that kept its version');
  assert.equal(ctx(file(1), file(2), { latest: { now: 3, before: 1 } }), null, 'moved, but not to the newest');
  assert.equal(ctx(file(1), file(2), { latest: { now: 2, before: 2 } }), null, 'the log did not go up');
  assert.equal(ctx(file(2), file(1), { latest: { now: 1, before: 2 } }), null, 'a downgrade');
});

test('reasonFor: content that is not an emitted file explains nothing (and never throws)', () => {
  for (const bad of [undefined, null, 42, 'text', [], { methods_version: 1 }, { source_manifest: 'x' }]) {
    assert.equal(ctx(file(1), bad), null);
    assert.equal(ctx(undefined, bad, { added: true }), null);
  }
  assert.equal(ctx(null, file(1)), null, 'a modified file whose old content was the literal null is not "added"');
});

test('parseNameStatus reads git -z output, paths with spaces and newlines included', () => {
  assert.deepEqual(parseNameStatus('M\0a b.json\0D\0x\ny\0T\0z\0'), [
    { status: 'M', path: 'a b.json' },
    { status: 'D', path: 'x\ny' },
    { status: 'T', path: 'z' },
  ]);
  assert.deepEqual(parseNameStatus(''), []);
});
