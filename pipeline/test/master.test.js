// The hospital master as the sites read it (pipeline/master.js masterByCcn, web/render/format.js hospitalRecord): names as
// the pages print them, and a city no CMS file gives as empty text, so no reader needs a guard of its own. Synthetic
// records, then the real files checked by property.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPO_ROOT, masterPath, newestYear, readJson } from '../files.js';
import { masterByCcn } from '../master.js';
import { hospitalRecord, placeText } from '../../web/render/format.js';
import { loadHub } from '../../hub/data.js';
import { loadHacrp } from '../../sites/hacrp/web/data.js';
import { loadHrrp } from '../../sites/hrrp/web/data.js';

const SYNTHETIC = {
  hospitals: [
    { ccn: '990001', name: 'Uab Example Hospital', alias: 'Uab Example', city: 'Exampleton', state: 'AL' },
    { ccn: '990002', name: 'Sample Medical Center', city: null, state: 'SC' },
  ],
};

test('a missing city reads as empty text, and the place as the state alone', () => {
  const master = masterByCcn(SYNTHETIC);
  const none = master.get('990002');
  assert.equal(none.city, '');
  assert.equal(placeText(none), 'SC');
  assert.equal(`${none.city} ${none.state}`.includes('null'), false);
  assert.equal(master.get('990001').city, 'Exampleton');
});

test('names and aliases read as the pages print them; a record with no alias gets none', () => {
  const master = masterByCcn(SYNTHETIC);
  assert.equal(master.get('990001').name, 'UAB Example Hospital');
  assert.equal(master.get('990001').alias, 'UAB Example');
  assert.equal(Object.hasOwn(master.get('990002'), 'alias'), false);
  assert.deepEqual(hospitalRecord({ id: '990003', name: 'X', city: undefined }).city, '');
});

test('every site reads every hospital with a city as text, though the newest master has some with none', () => {
  const raw = readJson(REPO_ROOT + masterPath(newestYear('data/emitted/hospital')));
  assert.ok(raw.hospitals.some((r) => r.city === null), 'the newest master has a record with no city (if not, this test no longer covers one)');
  const textCity = (r) => typeof r.city === 'string';
  assert.ok([...loadHub().master.values()].every(textCity), 'hub');
  assert.ok([...loadHacrp().master.values()].every(textCity), 'HACRP');
  const hrrp = loadHrrp();
  assert.ok([...hrrp.master.values()].every(textCity), 'Readmissions, the master');
  assert.ok(hrrp.hospitals.every(textCity), 'Readmissions, its own file');
});
