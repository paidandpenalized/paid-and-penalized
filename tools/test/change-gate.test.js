// The change gate: emitted data may change only with a reason on record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeGate } from '../ci/change-gate.js';

const EMITTED = 'data/emitted/hacrp/fy2026/hacrp.json';

test('changes outside data/emitted/ pass', () => {
  assert.equal(changeGate({ changed: ['engine/js/csv.js', 'README.md'] }).ok, true);
  assert.equal(changeGate({ changed: [] }).ok, true);
});

test('an emitted change alone fails', () => {
  const r = changeGate({ changed: [EMITTED, 'engine/js/csv.js'] });
  assert.equal(r.ok, false);
  assert.match(r.reason, /data\/emitted/);
});

test('an emitted change passes with a re-pin, a methods_version bump, or a corrections entry', () => {
  assert.equal(changeGate({ changed: [EMITTED, 'data/pinned/manifest.json'], repinned: new Set([EMITTED]) }).ok, true);
  assert.equal(changeGate({ changed: [EMITTED, 'docs/METHODS-LOG.md'], bumped: new Set(['hacrp']) }).ok, true);
  assert.equal(changeGate({ changed: [EMITTED, 'corrections/2026-11-01-hacrp.md'] }).ok, true);
});

const OTHER = 'data/emitted/hvbp/fy2026/hvbp.json';

test('a re-pin counts only for the emitted files whose own source_manifest changed', () => {
  const r = changeGate({ changed: [EMITTED, OTHER, 'data/pinned/manifest.json'], repinned: new Set([EMITTED]) });
  assert.equal(r.ok, false);
  assert.match(r.reason, /hvbp\.json changed/);
  assert.doesNotMatch(r.reason, /hacrp\.json/);
  assert.equal(changeGate({ changed: [EMITTED, 'data/pinned/manifest.json'] }).ok, false);
});

test('a methods_version bump explains only its own site', () => {
  const bumped = new Set(['hacrp']);
  assert.equal(changeGate({ changed: [EMITTED, OTHER, 'docs/METHODS-LOG.md'], bumped }).ok, false);
  assert.equal(changeGate({ changed: [EMITTED, OTHER], bumped, repinned: new Set([OTHER]) }).ok, true);
});

test('a methods-log edit with no version bump is not a reason', () => {
  assert.equal(changeGate({ changed: [EMITTED, 'docs/METHODS-LOG.md'], bumped: new Set() }).ok, false);
});

test('near-misses do not count', () => {
  assert.equal(changeGate({ changed: [EMITTED, 'corrections-old.md'] }).ok, false);
  assert.equal(changeGate({ changed: [EMITTED, 'docs/corrections/x.md'] }).ok, false);
  assert.equal(changeGate({ changed: [EMITTED, 'data/pinned/tdr/notes.md'] }).ok, false);
  assert.equal(changeGate({ changed: ['data/emitted-notes.md'] }).ok, true);
});
