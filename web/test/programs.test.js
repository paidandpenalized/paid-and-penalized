import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COPY } from '../copy.js';
import { HAC_CUT_PCT, HRRP_CAP_PCT, VBP_WITHHOLD_PCT, programDek } from '../programs.js';
import { LISTED_PROGRAMS, PLACEHOLDER_PROGRAMS, SITE, UNLISTED_PROGRAMS, hospitalPathOf, programOf, siteOf } from '../site.js';

const IDS = ['hrrp', 'hacrp', 'hvbp', 'wage-index', 'dsh', 'ime', 'iqr', 'pi', 'team'];

test('the registry lists the nine programs in order, each with its names (CMS\'s, exactly, in `long`), folder, stage, group and whether the hub has its data', () => {
  const row = (p) => [p.id, p.name, p.ab, p.long, p.path, p.stage, p.group, p.inData];
  assert.deepEqual(SITE.programs.map(row), [
    ['hrrp', 'Readmissions', 'HRRP', 'Hospital Readmissions Reduction Program', '/hrrp/', 'interim', 'quality', true],
    ['hacrp', 'Hospital-acquired conditions', 'HACRP', 'Hospital-Acquired Condition Reduction Program', '/hacrp/', 'live', 'quality', true],
    ['hvbp', 'Value-based purchasing', 'HVBP', 'Hospital Value-Based Purchasing Program', '/hvbp/', 'soon', 'quality', true],
    ['wage-index', 'Local wages', 'Wage index', 'Hospital Wage Index', '/wage-index/', 'soon', 'price', false],
    ['dsh', 'Low-income patients', 'DSH + UC', 'Medicare Disproportionate Share Hospital and Uncompensated Care Payments', '/dsh/', 'soon', 'price', false],
    ['ime', 'Teaching', 'IME', 'Indirect Medical Education Adjustment', '/ime/', 'soon', 'price', false],
    ['iqr', 'Quality reporting', 'IQR', 'Hospital Inpatient Quality Reporting Program', '/iqr/', 'soon', 'reporting', false],
    ['pi', 'Electronic health records', 'PI', 'Medicare Promoting Interoperability Program', '/pi/', 'soon', 'reporting', false],
    ['team', 'Surgical episodes', 'TEAM', 'Transforming Episode Accountability Model', '/team/', 'soon', 'episode', false],
  ]);
});

test('every program\'s path is a lowercase folder ending in "/", and no two programs share one', () => {
  for (const p of SITE.programs) assert.match(p.path, /^\/[a-z0-9-]+\/$/, p.id);
  assert.equal(new Set(SITE.programs.map((p) => p.path)).size, SITE.programs.length);
});

test('the registry\'s groups: listed (full tabs and the footer\'s figures), unlisted (dashed), and those with a placeholder (no site here)', () => {
  const ids = (list) => list.map((p) => p.id);
  assert.deepEqual(ids(LISTED_PROGRAMS), ['hrrp', 'hacrp', 'hvbp']);
  assert.deepEqual(ids(UNLISTED_PROGRAMS), ['wage-index', 'dsh', 'ime', 'iqr', 'pi', 'team']);
  assert.deepEqual(ids(PLACEHOLDER_PROGRAMS), ['hrrp', 'hvbp', 'wage-index', 'dsh', 'ime', 'iqr', 'pi', 'team']);
  for (const list of [LISTED_PROGRAMS, UNLISTED_PROGRAMS, PLACEHOLDER_PROGRAMS]) assert.ok(Object.isFrozen(list));
});

test('the registry and SITE.sites agree on HACRP\'s folder; SITE.sites keeps only the program sites built in this repo', () => {
  assert.deepEqual(Object.keys(SITE.sites), ['hacrp']);
  assert.equal(SITE.sites.hacrp.path, SITE.programs.find((p) => p.id === 'hacrp').path);
  assert.equal(siteOf('/hacrp/hospital/990001/'), SITE.sites.hacrp);
  assert.equal(siteOf('/hrrp/'), null);
});

test('the registry\'s stage and SITE.sites agree: every live program has a site here at its folder, and no placeholder program (interim or soon) has one; every site is a live program', () => {
  for (const p of SITE.programs) {
    const site = Object.hasOwn(SITE.sites, p.id) ? SITE.sites[p.id] : null;
    if (p.stage === 'live') assert.equal(site?.path, p.path, `${p.id}: a live program has a site at its folder`);
    else assert.equal(site, null, `${p.id}: a ${p.stage} program has no entry in SITE.sites`);
  }
  for (const p of PLACEHOLDER_PROGRAMS) assert.ok(!Object.hasOwn(SITE.sites, p.id), p.id);
  for (const id of Object.keys(SITE.sites)) assert.equal(SITE.programs.find((p) => p.id === id)?.stage, 'live', `SITE.sites.${id} is a live program`);
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
