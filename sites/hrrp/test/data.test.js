import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPO_ROOT, hrrpPath, readJson, readManifest } from '../../../pipeline/files.js';
import { loadHrrp } from '../web/data.js';

const PIN_ID = 'tdr-hrrp-fy2027';
const emitted = loadHrrp();
const pinned = loadHrrp({ exists: () => false });
const keysOf = (o) => Object.keys(o).sort();

test('with the emitted file present, the loader reads it', () => {
  assert.equal(emitted.source, 'emitted');
  assert.equal(emitted.hospitals.length, 2912);
  assert.equal(emitted.fy, 2027);
  assert.equal(hrrpPath(2027), 'data/emitted/hrrp/fy2027/hrrp.json');
});

test('without it, the loader falls back to the pin, with the same body', () => {
  assert.equal(pinned.source, 'pin');
  assert.equal(pinned.fy, emitted.fy);
  assert.deepEqual(pinned.conditions, emitted.conditions);
  assert.deepEqual(pinned.hospitals.map((h) => h.id), emitted.hospitals.map((h) => h.id));
  for (const [i, h] of pinned.hospitals.entries()) assert.deepEqual(keysOf(h), keysOf(emitted.hospitals[i]), h.id);
  assert.deepEqual(pinned.history.years, emitted.history.years);
});

test("whatsNew, timeline and research come from the site's content files in both", () => {
  const content = (name) => readJson(`${REPO_ROOT}sites/hrrp/content/${name}.json`);
  for (const d of [emitted, pinned]) {
    assert.deepEqual(d.whatsNew, content('whats_new').items);
    assert.deepEqual(d.timeline, content('timeline'));
    assert.deepEqual(d.research, content('research'));
  }
});

test('pinsUsed ids are in the manifest, and the pin is named only when it was read', () => {
  const ids = new Set(readManifest().map((e) => e.id));
  for (const d of [emitted, pinned]) {
    assert.ok(d.pinsUsed.length > 0);
    for (const e of d.pinsUsed) assert.ok(ids.has(e.id), e.id);
  }
  assert.ok(!emitted.pinsUsed.some((e) => e.id === PIN_ID));
  assert.ok(pinned.pinsUsed.some((e) => e.id === PIN_ID));
});

test('cmsReleased is the file date, changedOn the newest built_at of the files read', () => {
  for (const d of [emitted, pinned]) {
    assert.equal(d.cmsReleased, d.meta.fileDate);
    const days = d.builtFiles.map(([, f]) => f.built_at.slice(0, 10)).sort();
    assert.equal(d.changedOn, days.at(-1));
  }
});

test('the master is keyed by CCN and the shapes cover the states', () => {
  assert.ok(emitted.master.has('010001'));
  assert.ok(emitted.shapes.size >= 50);
  assert.ok(emitted.manifest.length > 0);
});
