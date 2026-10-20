// The change gate: emitted data may change only with a reason on record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeGate, parseLabels } from '../ci/change-gate.js';

const EMITTED = 'data/emitted/hacrp/fy2026/hacrp.json';

test('changes outside data/emitted/ pass', () => {
  assert.equal(changeGate({ changed: ['engine/js/csv.js', 'README.md'], labels: [] }).ok, true);
  assert.equal(changeGate({ changed: [], labels: [] }).ok, true);
});

test('an emitted change alone fails', () => {
  const r = changeGate({ changed: [EMITTED, 'engine/js/csv.js'], labels: [] });
  assert.equal(r.ok, false);
  assert.match(r.reason, /data\/emitted/);
});

const NEW_HEADING = '@@ -9,0 +10,3 @@\n+## hacrp methods_version 2 (2026-11-02)\n+- what changed\n';

test('an emitted change passes with a re-pin, the label, a new methods-version heading, or a corrections entry', () => {
  const repin = `diff --git a/${EMITTED} b/${EMITTED}\n@@ -4 +4 @@\n-"source_manifest": "aa",\n+"source_manifest": "bb",\n`;
  assert.equal(changeGate({ changed: [EMITTED, 'data/pinned/manifest.json'], labels: [], emittedDiff: repin }).ok, true);
  assert.equal(changeGate({ changed: [EMITTED], labels: ['new-cms-release'] }).ok, true);
  assert.equal(changeGate({ changed: [EMITTED, 'docs/METHODS-LOG.md'], labels: [], logDiff: NEW_HEADING }).ok, true);
  assert.equal(changeGate({ changed: [EMITTED, 'corrections/2026-11-01-hacrp.md'], labels: [] }).ok, true);
});

test('a re-pin counts only for the emitted files whose own source_manifest changed', () => {
  const other = 'data/emitted/hvbp/fy2026/hvbp.json';
  const diff = [
    `diff --git a/${EMITTED} b/${EMITTED}\n@@ -4 +4 @@\n-"source_manifest": "aa",\n+"source_manifest": "bb",\n`,
    `diff --git a/${other} b/${other}\n@@ -20 +20 @@\n-{"ccn":"000001"}\n+{"ccn":"000002"}\n`,
  ].join('');
  assert.equal(changeGate({ changed: [EMITTED, other, 'data/pinned/manifest.json'], labels: [], emittedDiff: diff }).ok, false);
  assert.equal(changeGate({ changed: [EMITTED, 'data/pinned/manifest.json'], labels: [], emittedDiff: '' }).ok, false);
});

test('a methods-log edit that adds no methods_version heading is not a reason', () => {
  const typo = '@@ -12 +12 @@\n-- teh file\n+- the file\n';
  const removed = '@@ -9,3 +8,0 @@\n-## hacrp methods_version 1 (2026-10-20)\n';
  for (const logDiff of [typo, removed, '']) {
    assert.equal(changeGate({ changed: [EMITTED, 'docs/METHODS-LOG.md'], labels: [], logDiff }).ok, false, logDiff);
  }
});

test('near-misses do not count', () => {
  assert.equal(changeGate({ changed: [EMITTED, 'corrections-old.md'], labels: [] }).ok, false);
  assert.equal(changeGate({ changed: [EMITTED, 'docs/corrections/x.md'], labels: [] }).ok, false);
  assert.equal(changeGate({ changed: [EMITTED, 'data/pinned/tdr/notes.md'], labels: [] }).ok, false);
  assert.equal(changeGate({ changed: [EMITTED], labels: ['new-cms-release-ish', 'New-CMS-Release'] }).ok, false);
  assert.equal(changeGate({ changed: ['data/emitted-notes.md'], labels: [] }).ok, true);
});

test('PR_LABELS: a JSON array of strings; null or empty means none; anything else fails', () => {
  assert.deepEqual(parseLabels('["a","b"]'), ['a', 'b']);
  assert.deepEqual(parseLabels('null'), []);
  assert.deepEqual(parseLabels(''), []);
  assert.deepEqual(parseLabels(undefined), []);
  for (const bad of ['"new-cms-release"', '{"0":"x"}', '[1]', 'not json']) assert.throws(() => parseLabels(bad), RangeError, bad);
});
