import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPO_ROOT, hrrpPath, masterPath, readJson, readManifest } from '../../../pipeline/files.js';
import { ATLAS_ID } from '../../../web/charts/geo.js';
import { loadHrrp, changedOn, PIN_ID } from '../web/data.js';

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

test('pinsUsed lists every manifest pin the read file was built from', () => {
  const manifestIds = new Set(readManifest().map((e) => e.id));
  const emittedFile = readJson(REPO_ROOT + hrrpPath(2027));
  const masterFile = readJson(REPO_ROOT + masterPath(2027));
  const want = { emitted: [...emittedFile.sources, ...masterFile.sources, ATLAS_ID], pin: [PIN_ID, ...masterFile.sources, ATLAS_ID] };
  for (const [mode, d] of [['emitted', emitted], ['pin', pinned]]) {
    const got = new Set(d.pinsUsed.map((e) => e.id));
    for (const e of d.pinsUsed) assert.ok(manifestIds.has(e.id), e.id);
    assert.ok(got.has(PIN_ID), `${mode}: the pin`);
    for (const id of want[mode].filter((i) => manifestIds.has(i))) assert.ok(got.has(id), `${mode}: ${id}`);
  }
});

test('the pin is read when the emitted directory is absent, without looking in it', () => {
  const asked = [];
  const d = loadHrrp({ exists: (p) => { asked.push(p); return false; } });
  assert.equal(d.source, 'pin');
  assert.ok(asked.length > 0);
  assert.ok(asked.every((p) => p.endsWith('data/emitted/hrrp')), 'only the directory was asked about');
});

test('an emitted folder with a year but no file stops the build and says to run make emit', () => {
  const asked = (p) => p.endsWith('data/emitted/hrrp');
  assert.throws(() => loadHrrp({ exists: asked, newest: () => 2027 }), (e) => e.message.includes('data/emitted/hrrp/fy2027/hrrp.json') && /make emit/.test(e.message));
});

test('an emitted folder with no year folder in it falls back to the pin', () => {
  const noYear = () => { throw new RangeError('no fy<YYYY> folder under data/emitted/hrrp'); };
  assert.equal(loadHrrp({ exists: (p) => p.endsWith('data/emitted/hrrp'), newest: noYear }).source, 'pin');
});

test('a built_at that is not a timestamp stops the build and names the file', () => {
  assert.throws(() => changedOn([['some/file.json', { built_at: 'yesterday' }]]), /some\/file\.json/);
});

test('cmsReleased is the file date, changedOn the newest built_at of the files read', () => {
  for (const d of [emitted, pinned]) {
    assert.equal(d.cmsReleased, d.meta.fileDate);
    const days = d.builtFiles.map(([, f]) => f.built_at.slice(0, 10)).sort();
    assert.equal(d.changedOn, days.at(-1));
  }
});

test('the master is keyed by CCN and the shapes cover the states', () => {
  assert.ok(emitted.master.has(emitted.hospitals[0].id));
  assert.ok(emitted.shapes.size >= 50);
  assert.ok(emitted.manifest.length > 0);
});
