// The change gate's rule: emitted data may change only with a reason on record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeGate } from '../ci/change-gate.js';

const EMITTED = 'data/emitted/hacrp/fy2026/hacrp.json';
const OLDER = 'data/emitted/hacrp/fy2025/hacrp.json';

test('changes outside data/emitted/ pass', () => {
  assert.equal(changeGate({ changed: ['engine/js/csv.js', 'README.md'] }).ok, true);
  assert.equal(changeGate({ changed: [] }).ok, true);
  assert.equal(changeGate({ changed: ['data/emitted-notes.md'] }).ok, true);
});

test('an emitted change alone fails, naming the file', () => {
  const r = changeGate({ changed: [EMITTED, 'engine/js/csv.js'] });
  assert.equal(r.ok, false);
  assert.match(r.reason, /fy2026\/hacrp\.json changed/);
});

test('each per-file reason explains only its own file', () => {
  for (const key of ['added', 'repinned', 'bumped']) {
    assert.equal(changeGate({ changed: [EMITTED], [key]: new Set([EMITTED]) }).ok, true, key);
    const r = changeGate({ changed: [EMITTED, OLDER], [key]: new Set([EMITTED]) });
    assert.equal(r.ok, false, key);
    assert.match(r.reason, /fy2025/);
    assert.doesNotMatch(r.reason, /fy2026/);
  }
});

test('a corrections entry covers the whole change; near-misses do not', () => {
  assert.equal(changeGate({ changed: [EMITTED, OLDER, 'corrections/2026-11-01-hacrp.md'] }).ok, true);
  assert.equal(changeGate({ changed: [EMITTED, 'corrections-old.md'] }).ok, false);
  assert.equal(changeGate({ changed: [EMITTED, 'docs/corrections/x.md'] }).ok, false);
  assert.equal(changeGate({ changed: [EMITTED, 'docs/METHODS-LOG.md'] }).ok, false);
});
