// The hospitals outside the dollar file (hub/outside.js), on the pinned data. Rows are picked by property; failure
// messages name no hospital, CCN or figure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hubModel, loadHub } from '../data.js';
import { LIKE_GROUPS, likeCounts, likeGroupOf, outsideHospitals } from '../outside.js';
import { deepLink, pageOf } from '../hospital/record.js';
import { programById } from '../../web/site.js';

const HUB = loadHub();
const dollarCcns = new Set(HUB.dollars.hospitals.map((r) => r.ccn));
const OUTSIDE = outsideHospitals({ master: HUB.master, dollarCcns, hrrp: HUB.hrrp });

// The rule, written out again from the master's own fields.
const groupByRule = (r) => {
  const code = r.programs.hacrp.reason ?? r.programs.hrrp.reason;
  if (code !== 'federal') return code;
  assert.ok(r.kind === 'va' || r.kind === 'dod', 'a federal hospital is va or dod');
  return r.kind;
};

test('outsideHospitals: one per master record not in the dollar file', () => {
  assert.equal(OUTSIDE.length, HUB.master.size - HUB.dollars.hospitals.length, 'the count is the master less the dollar file');
  const ccns = OUTSIDE.map((h) => h.ccn);
  assert.equal(new Set(ccns).size, ccns.length, 'no CCN repeats');
  assert.ok(ccns.every((c) => !dollarCcns.has(c)), 'none is in the dollar file');
  assert.deepEqual(ccns, [...HUB.master.keys()].filter((c) => !dollarCcns.has(c)), 'master order');
});

test('outsideHospitals: counts by group match the master', () => {
  const counts = likeCounts(OUTSIDE);
  let sum = 0;
  for (const group of LIKE_GROUPS) {
    const want = [...HUB.master.values()].filter((r) => !dollarCcns.has(r.ccn) && groupByRule(r) === group).length;
    assert.equal(counts.get(group)?.n ?? 0, want, `group ${group}: the count`);
    const byState = counts.get(group)?.byState ?? new Map();
    assert.equal([...byState.values()].reduce((a, b) => a + b, 0), want, `group ${group}: states sum to the group`);
    sum += want;
  }
  assert.equal(sum, OUTSIDE.length, 'the groups cover every outside hospital');
  assert.ok(OUTSIDE.every((h) => LIKE_GROUPS.includes(h.group)), 'every row has a known group');
});

test('outsideHospitals: listed is true exactly when a program lists it', () => {
  const listed = OUTSIDE.filter((h) => h.listed);
  assert.ok(listed.length > 0, 'the data has an outside hospital a program lists');
  assert.ok(listed.every((h) => h.inHrrp || HUB.master.get(h.ccn).programs.hacrp.inProgram), 'each listed row is in a program');
  for (const h of OUTSIDE) {
    const r = HUB.master.get(h.ccn);
    assert.equal(h.listed, r.programs.hacrp.inProgram || r.programs.hrrp.inProgram, 'listed follows the master');
    assert.equal(h.inHrrp, HUB.hrrp.hospitals.has(h.ccn), 'inHrrp follows the Readmissions file');
  }
});

// An outside hospital has no HACRP page (the HACRP site writes one only for the dollar file's hospitals): its rows say
// so, and its links follow them.
test('outsideHospitals: every row carries inHacrp false, and deepLink to HACRP opens the program, not a hospital page', () => {
  assert.ok(OUTSIDE.every((h) => h.inHacrp === false), 'inHacrp false on every row');
  const h = OUTSIDE[0];
  assert.equal(pageOf(h, 'hacrp'), null, 'no HACRP page');
  const link = String(deepLink(h, 'hacrp'));
  assert.ok(link.includes(`href="${programById('hacrp').path}"`), 'the program\'s folder');
  assert.ok(!link.includes('/hacrp/hospital/'), 'not a HACRP hospital page');
  // A dollar-file hospital (no inHacrp on its row) keeps its HACRP page.
  assert.ok(pageOf({ ccn: '990001' }, 'hacrp')?.startsWith('/hacrp/hospital/'), 'the default: a HACRP page');
});

test('likeGroupOf: federal splits by kind; an unknown reason throws', () => {
  const rec = (hacrp, hrrp, kind = 'acute') => ({ kind, programs: { hacrp: { reason: hacrp }, hrrp: { reason: hrrp } } });
  assert.equal(likeGroupOf(rec('federal', 'federal', 'va')), 'va');
  assert.equal(likeGroupOf(rec('federal', 'federal', 'dod')), 'dod');
  assert.equal(likeGroupOf(rec(null, 'psychiatric')), 'psychiatric', 'falls to the second program');
  assert.equal(likeGroupOf(rec('critical_access', 'psychiatric')), 'critical_access', 'the first non-null wins');
  assert.throws(() => likeGroupOf(rec('invented_reason', null)), (e) => e instanceof RangeError && e.message.includes('invented_reason'));
  assert.throws(() => likeGroupOf(rec(null, null)), RangeError, 'no reason at all');
  assert.throws(() => likeGroupOf(rec('federal', 'federal', 'acute')), (e) => e instanceof RangeError && e.message.includes('"acute"'), 'a federal hospital of another kind');
});

test('hubModel: outside and counties are there', () => {
  const m = hubModel();
  assert.equal(m.outside.length, OUTSIDE.length);
  assert.ok(Array.isArray(HUB.counties) && HUB.counties.length > 0, 'the county shapes are loaded');
});
