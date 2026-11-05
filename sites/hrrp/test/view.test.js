// hospitalView: one hospital's record card, verdict and rank line as plain strings (no markup).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hospitalView } from '../web/view.js';
import { CUT, INACTIVE, NAME, NONE_BELOW, NONE_MEASURED, NONE_ROUNDED, hospital, ctxOf } from './fixtures.js';

const ctx = ctxOf();
const view = (h) => hospitalView(h, ctx);

test('each verdict variant has its sentence and stamp', () => {
  const cut = view(CUT);
  assert.deepEqual(cut.stamps, [{ label: 'Cut 1.00%', ink: false }]);
  assert.equal(cut.summary, `Medicare will pay ${NAME} 1.00% less on the base payment for every traditional-Medicare inpatient stay from October 1, 2026 through September 30, 2027. 1 of its 2 measured conditions came in above the peer-group median; heart failure added the most.`);

  const none = [view(NONE_MEASURED), view(NONE_BELOW), view(NONE_ROUNDED)];
  for (const v of none) assert.deepEqual(v.stamps, [{ label: 'No cut', ink: true }]);
  assert.equal(none[0].summary, `${NAME} has no FY2027 cut. None of its six conditions reached 25 cases in the data window, so none could count against it.`);
  assert.equal(none[1].summary, `${NAME} has no FY2027 cut. All 2 of its measured conditions came in at or below its peer group’s median.`);
  assert.equal(none[2].summary, `${NAME} has no FY2027 cut. Heart failure came in above the peer-group median, but its share of the hospital’s Medicare payments is small enough that the reduction rounded to zero.`);
});

test('an inactive hospital: the Inactive stamp, the cut stated without a year of payments, the inactive paragraph', () => {
  const v = view(INACTIVE);
  assert.deepEqual(v.stamps, [{ label: 'Cut 1.00%', ink: false }, { label: 'Inactive', ink: true }]);
  assert.ok(v.summary.startsWith(`CMS set the FY2027 cut for ${NAME} at 1.00%. `));
  assert.equal(v.inactive, 'CMS lists this hospital’s Medicare agreement under CCN 990005 as ended on March 30, 2026 (change in provider status). It will not be paid under this ID in FY2027, so its cut is unlikely to be collected.');
  assert.equal(view(CUT).inactive, null);
  const noDate = view(hospital({ inactive: { date: null, reason: 'closed' }, red: 0, paf: 1, c: {} })).inactive;
  assert.ok(noDate.includes('as ended (closed).') && noDate.endsWith('in FY2027.'));
});

test('the rank line: floor, the 99 cap, and "like N other hospitals"', () => {
  assert.equal(view(CUT).rank, 'Larger cut than 66% of hospitals nationally, 71% of the 7 in Zedland, and 75% in peer group 2.');
  const top = view(hospital({ id: '990030', red: 99, paf: 0.5 })).rank;
  assert.match(top, /^Larger cut than 99% of hospitals nationally/, 'a hospital is never above itself: 99, not 100');
  assert.equal(view(NONE_BELOW).rank, 'No reduction, like 4 other hospitals.');
});

test('the record card: location, county, metro link and type', () => {
  const v = view(CUT);
  assert.equal(v.location, 'Exampleton, ZZ 99001');
  assert.equal(v.county, 'Sample County');
  assert.deepEqual(v.metro, { value: 'Exampleton, ZZ', linkText: 'See this metro', href: '/hrrp/metro/99901/' });
  assert.equal(v.type, 'Minor teaching · 220 beds · Voluntary · Urban · Rural referral center');
  assert.equal(v.peer.value, '2 of 5');
  assert.equal(v.peer.note, '23.5% of stays dual-eligible');
});

test('outside a metro area the field links to the state', () => {
  const v = view(hospital({ cbsa: null, cbsaName: null }));
  assert.deepEqual(v.metro, { value: 'Outside metro areas', linkText: 'See Zedland', href: '/hrrp/state/zz/' });
});

test('a location with no zip or county', () => {
  const v = view(hospital({ zip: '', county: null }));
  assert.equal(v.location, 'Exampleton, ZZ');
  assert.equal(v.county, null);
});

test('the type line is a dash when empty; beds from the cost report are marked; special types are spelled out', () => {
  assert.equal(view(hospital({ teach: null, beds: null, own: null, urban: null, types: [] })).type, '—');
  assert.match(view(hospital({ bedsSrc: 'cr' })).type, /220 beds \(cost report\)/);
  const types = view(hospital({ types: ['SCH', 'MDH', 'RRC', 'IHS', 'EACH'], teach: null, beds: null, own: null, urban: null })).type;
  assert.equal(types, ['Sole community hospital', 'Medicare-dependent hospital', 'Rural referral center', 'Indian Health Service', 'Essential access community hospital'].join(' · '));
  assert.equal(view(hospital({ types: ['XYZ'], teach: null, beds: null, own: null, urban: null })).type, '—', 'a code with no words is dropped, not shown raw');
  assert.equal(view(hospital({ types: ['XYZ', 'SCH'], teach: null, beds: null, own: null, urban: null })).type, 'Sole community hospital');
  const rural = view(hospital({ urban: false })).type;
  assert.ok(rural.includes('· Rural\u00a0·') && !rural.includes('Urban'));
});

test('an alias is stated; none is null', () => {
  assert.equal(view(hospital({ alias: 'Example Medical' })).alias, 'Also listed by CMS as Example Medical');
  assert.equal(view(CUT).alias, null);
});

test('stars, or "Not rated"', () => {
  const v = view(CUT);
  assert.deepEqual({ ...v.stars, href: undefined }, { n: 4, filled: '★★★★', empty: '☆', text: '4 of 5 stars', href: undefined });
  assert.equal(v.stars.href, 'https://www.medicare.gov/care-compare/details/hospital/990001');
  const none = view(hospital({ star: null }));
  assert.deepEqual({ n: none.stars.n, text: none.stars.text }, { n: null, text: 'Not rated' });
});

test('fields A and B: the factor as CMS publishes it, and the estimated dollars', () => {
  const v = view(CUT);
  assert.deepEqual(v.factor, { value: '0.9900', note: 'CMS, final' });
  assert.deepEqual(v.dollars, { value: '$100K', estimated: true, note: 'on ≈ $10.0M of base payments' });
  assert.deepEqual(view(hospital({ pen: null, base: null })).dollars, { value: '—', estimated: false, note: 'no volume data' });
});

test('breadcrumb: region and division only when known; the state, then the metro', () => {
  assert.deepEqual(view(CUT).crumbs.map((c) => c.label), ['Nation', 'Westland', 'Pacific Coast', 'Zedland', 'Exampleton, ZZ']);
  assert.deepEqual(view(CUT).crumbs.map((c) => c.href), ['/hrrp/', '/hrrp/region/westland/', '/hrrp/division/pacific-coast/', '/hrrp/state/zz/', '/hrrp/metro/99901/']);
  assert.deepEqual(view(hospital({ region: null, division: null, cbsa: null, cbsaName: null })).crumbs.map((c) => c.label), ['Nation', 'Zedland']);
});

test('page text: a title and description of its own', () => {
  const a = view(CUT);
  const b = view(NONE_BELOW);
  assert.equal(a.heading, `${NAME}, Exampleton, ZZ: Hospital Readmissions Reduction Program, FY2027`);
  assert.notEqual(a.description, '');
  assert.ok(a.record.left.includes('FY2027') && a.record.right === 'CCN 990001');
  assert.equal(b.record.right, 'CCN 990003');
});

test('a hospital with no city: the place is the state alone', () => {
  const v = view(hospital({ city: '', zip: '' }));
  assert.equal(v.location, 'ZZ');
  assert.ok(v.heading.startsWith(`${NAME}, ZZ: `) && v.description.startsWith(`${NAME}, ZZ: `));
});

test('a metro code with no metro name reads as outside the metro areas; a hospital the master lacks is not in the hub', () => {
  const v = view(hospital({ cbsa: '99901', cbsaName: undefined }));
  assert.equal(v.metro.value, 'Outside metro areas');
  assert.ok(!v.crumbs.some((c) => c.href.includes('/metro/')));
  const master = new Map([[CUT.id, { programs: { hacrp: { inProgram: true } } }]]);
  const withMaster = { ...ctxOf(), master };
  assert.equal(hospitalView(CUT, withMaster).inHub, true);
  assert.equal(hospitalView(hospital({ id: '990050' }), withMaster).inHub, false, 'missing from the master');
  assert.equal(hospitalView(CUT, { ...ctxOf(), master: new Map([[CUT.id, { programs: {} }]]) }).inHub, false);
});
