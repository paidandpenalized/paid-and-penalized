// The hospital master as the sites read it (pipeline/master.js masterByCcn, web/render/format.js hospitalRecord): names as
// the pages print them, and a city no CMS file gives as empty text, so no reader needs a guard of its own. Synthetic
// records, then the real files checked by property.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT, masterPath, newestYear, readJson } from '../files.js';
import { cmsNamed, masterByCcn } from '../master.js';
import { hospitalRecord, placeText } from '../../web/render/format.js';
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

test('every hospital reads with a city as text, though the newest master has some with none', () => {
  const raw = readJson(REPO_ROOT + masterPath(newestYear('data/emitted/hospital')));
  assert.ok(raw.hospitals.some((r) => r.city === null), 'the newest master has a record with no city (if not, this test no longer covers one)');
  const textCity = (r) => typeof r.city === 'string';
  // The hub and the HACRP site read the master through masterByCcn alone; the Readmissions site reads its own file too.
  assert.ok([...masterByCcn(raw).values()].every(textCity), 'the master');
  assert.ok(loadHrrp().hospitals.every(textCity), 'Readmissions, its own file');
});

test('the stand-in name cmsNamed reads is the one the hospital master writes', () => {
  const master = readFileSync(REPO_ROOT + 'engine/py/pp_engine/master.py', 'utf8');
  assert.ok(master.includes('f"Hospital {ccn} (name not in CMS files)"'), 'pp_engine/master.py build_record: update cmsNamed with it');
  assert.equal(cmsNamed('Hospital 990001 (name not in CMS files)', '990001'), false);
  assert.equal(cmsNamed('Example General Hospital', '990001'), true);
});
