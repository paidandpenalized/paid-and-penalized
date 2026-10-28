import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COPY } from '../copy.js';
import { HAC_CUT_PCT, HRRP_CAP_PCT, VBP_WITHHOLD_PCT, programDek } from '../programs.js';
import { SITE, hospitalPathOf, programOf, siteOf } from '../site.js';

const IDS = ['hrrp', 'hacrp', 'hvbp', 'wage-index', 'dsh', 'ime', 'iqr', 'pi', 'team'];

test('the registry lists the nine programs in order, each with its names, folder, stage, group and whether the hub has its data', () => {
  const row = (p) => [p.id, p.name, p.ab, p.path, p.stage, p.group, p.inData];
  assert.deepEqual(SITE.programs.map(row), [
    ['hrrp', 'Readmissions', 'HRRP', '/hrrp/', 'interim', 'quality', true],
    ['hacrp', 'Hospital-acquired conditions', 'HACRP', '/hacrp/', 'live', 'quality', true],
    ['hvbp', 'Value-based purchasing', 'HVBP', '/hvbp/', 'soon', 'quality', true],
    ['wage-index', 'Local wages', 'Wage index', '/wage-index/', 'soon', 'price', false],
    ['dsh', 'Low-income patients', 'DSH + UC', '/dsh/', 'soon', 'price', false],
    ['ime', 'Teaching', 'IME', '/ime/', 'soon', 'price', false],
    ['iqr', 'Quality reporting', 'IQR', '/iqr/', 'soon', 'reporting', false],
    ['pi', 'Electronic health records', 'PI', '/pi/', 'soon', 'reporting', false],
    ['team', 'Surgical episodes', 'TEAM', '/team/', 'soon', 'episode', false],
  ]);
  assert.deepEqual(SITE.programs.map((p) => p.id), IDS);
});

test('every program has CMS\'s program name in `long`, and a path that is a lowercase folder ending in "/"', () => {
  for (const p of SITE.programs) {
    assert.equal(typeof p.long, 'string', p.id);
    assert.ok(p.long.length > p.name.length, `${p.id}: long is the full program name`);
    assert.match(p.path, /^\/[a-z0-9-]+\/$/, p.id);
    assert.ok(['live', 'interim', 'soon'].includes(p.stage), p.id);
    assert.ok(['quality', 'price', 'reporting', 'episode'].includes(p.group), p.id);
  }
  assert.equal(new Set(SITE.programs.map((p) => p.path)).size, SITE.programs.length, 'no two programs share a folder');
});

test('each program\'s `long` is CMS\'s name for it, exactly', () => {
  assert.deepEqual(Object.fromEntries(SITE.programs.map((p) => [p.id, p.long])), {
    hrrp: 'Hospital Readmissions Reduction Program',
    hacrp: 'Hospital-Acquired Condition Reduction Program',
    hvbp: 'Hospital Value-Based Purchasing Program',
    'wage-index': 'Hospital Wage Index',
    dsh: 'Medicare Disproportionate Share Hospital and Uncompensated Care Payments',
    ime: 'Indirect Medical Education Adjustment',
    iqr: 'Hospital Inpatient Quality Reporting Program',
    pi: 'Medicare Promoting Interoperability Program',
    team: 'Transforming Episode Accountability Model',
  });
});

test('the registry and SITE.sites agree on HACRP\'s folder; SITE.sites keeps only the program sites built in this repo', () => {
  assert.deepEqual(Object.keys(SITE.sites), ['hacrp']);
  assert.equal(SITE.sites.hacrp.path, SITE.programs.find((p) => p.id === 'hacrp').path);
  assert.equal(siteOf('/hacrp/hospital/990001/'), SITE.sites.hacrp);
  assert.equal(siteOf('/hrrp/'), null);
});

test('programOf names the program whose folder holds the path, or null for the family\'s own pages', () => {
  assert.equal(programOf('/hacrp/')?.id, 'hacrp');
  assert.equal(programOf('/hacrp/hospital/990001/')?.id, 'hacrp');
  assert.equal(programOf('/hrrp/hospital/990001/')?.id, 'hrrp');
  assert.equal(programOf('/wage-index/')?.id, 'wage-index');
  for (const path of ['/', '/methods/', '/hospital/990001/', '/hacrpx/', '/404.html']) assert.equal(programOf(path), null, path);
});

test('hospitalPathOf: the hub and HACRP always, Readmissions only for a hospital Thirty Day Readmissions has, no other program', () => {
  assert.equal(hospitalPathOf('hub', '990001'), '/hospital/990001/');
  assert.equal(hospitalPathOf('hacrp', '990001'), '/hacrp/hospital/990001/');
  assert.equal(hospitalPathOf('hrrp', '990001', { inTdr: true }), '/hrrp/hospital/990001/');
  assert.equal(hospitalPathOf('hrrp', '990001', { inTdr: false }), null);
  assert.equal(hospitalPathOf('hrrp', '990001'), null, 'no flag is not in Thirty Day Readmissions');
  for (const id of ['hvbp', 'wage-index', 'dsh', 'ime', 'iqr', 'pi', 'team', 'nope']) {
    assert.equal(hospitalPathOf(id, '990001', { inTdr: true }), null, id);
  }
  // A CCN with a letter is lowercased, since a folder is.
  assert.equal(hospitalPathOf('hub', '99A001'), '/hospital/99a001/');
  assert.equal(hospitalPathOf('hacrp', '99A001'), '/hacrp/hospital/99a001/');
});

test('Thirty Day Readmissions: its name, its address, and the link to one of its hospitals', () => {
  assert.equal(SITE.tdr.name, 'Thirty Day Readmissions');
  assert.equal(SITE.tdr.url, 'https://thirty-day-readmissions.vercel.app/');
  assert.equal(SITE.tdr.hospital('990001'), 'https://thirty-day-readmissions.vercel.app/#hospital-990001');
});

test('the method constants are the programs\' own rules: the 3% Readmissions cap, the 1% hospital-acquired conditions cut, the 2% withheld', () => {
  assert.deepEqual([HRRP_CAP_PCT, HAC_CUT_PCT, VBP_WITHHOLD_PCT], [3, 1, 2]);
});

test('each dek is copy with no digit, and fills with the rule\'s percent and nothing left over', () => {
  for (const id of IDS) {
    const key = `dek${id.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())}`;
    assert.equal(typeof COPY[key], 'string', `COPY.${key}`);
    assert.doesNotMatch(COPY[key], /\d/, key);
    const dek = programDek(id);
    assert.ok(dek.length > 40, id);
    assert.doesNotMatch(dek, /[{}]/, `${id}: every placeholder filled`);
    assert.match(dek, /^[A-Z].*\.$/, `${id}: a sentence`);
  }
  assert.match(programDek('hrrp'), /^Cuts pay by up to 3% when more patients than expected return to the hospital/);
  assert.match(programDek('hacrp'), /^Cuts pay by a flat 1% for the quarter of hospitals with the highest infection and patient-safety scores\.$/);
  assert.match(programDek('hvbp'), /^Holds back 2% of pay and returns it by quality score, as a bonus or a net cut\. Budget-neutral by design\.$/);
  assert.equal(programDek('wage-index'), 'Raises or lowers the labor share of each payment to match local wages.');
  assert.equal(programDek('team'), 'In selected areas, hospitals earn or owe money against a spending target for five surgeries.');
  // The deks that carry a percent are the three the constants name; no other dek has a digit in its output either.
  assert.deepEqual(IDS.filter((id) => /\d/.test(programDek(id))), ['hrrp', 'hacrp', 'hvbp']);
});

test('programDek: an unknown program throws', () => {
  assert.throws(() => programDek('nope'), RangeError);
  assert.throws(() => programDek(), RangeError);
});
