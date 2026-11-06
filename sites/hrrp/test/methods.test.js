// The Readmissions Methods page in full: the accuracy line and assumptions behind the dollars, the peer-group medians
// table, the history's totals, feedback and privacy, the pinned files, the 14-term glossary and reuse. Synthetic
// hospitals (fixtures.js); the pins, the dollar check and the totals are stated here, never read from the data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textOf } from '../../../pipeline/site/html.js';
import { ASSETS } from '../../../pipeline/test/helpers.js';
import { methodsPage } from '../web/pages/methods.js';
import { NTAP_AMOUNT } from '../web/constants.js';
import { buildPlaces } from '../web/places.js';
import { areaContext, methodsView } from '../web/view.js';
import { ALL, CONDITIONS, CUT, HISTORY, META, hospital, loadHrrpOnce } from './fixtures.js';

const DOLLAR_META = {
  ...META,
  totals: { modelBase: 90000000000, modelPen: 340000000, cmsEst: 360000000, cmsSrc: { kind: 'CMS', label: 'CMS model, Table X', url: 'https://example.org/table' } },
  mdh: { endDate: '2026-12-31', maxShortfall: 33 },
  dollarCheck: { asOf: '2026-10-11', costFy: 2024, rateDrift: 1.066, within15: 85, within15Small: 73.7 },
  geocode: { address: 2526, zip: 371, county: 15, none: 0 },
};
const PINS = [
  { id: 'a', title: 'Example file A', bytes: 1234567, sha256: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789', retrieved: '2026-10-20', landingPage: 'https://example.org/a', downloadUrl: 'https://example.org/a.csv' },
  { id: 'b', title: 'Example file B', bytes: 42, sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', retrieved: '2026-10-21', downloadUrl: 'http://insecure.example/b' },
];
const ctxOf = ({ hospitals = ALL, meta = DOLLAR_META, history = HISTORY, pinsUsed = PINS } = {}) => areaContext({ hospitals, meta, history, conditions: CONDITIONS, places: buildPlaces(hospitals, meta), pinsUsed });
const page = (ctx = ctxOf()) => methodsPage({ view: methodsView(ctx), robots: null, assets: ASSETS });
const rowsOf = (text) => [...text.matchAll(/<tr><th scope="row">([^<]*(?:<[^>]+>[^<]*)*?)<\/th><td>(.*?)<\/td><\/tr>/gs)].map(([, a, e]) => [textOf(a), textOf(e)]);
const assumptions = (text) => rowsOf(text.slice(text.indexOf('<table class="gb assume">'), text.indexOf('</table>', text.indexOf('<table class="gb assume">'))));

test('the accuracy line states the check against cost reports, and is dropped without the dollar check', () => {
  const text = textOf(page());
  assert.ok(text.includes('In an October 2026 check against hospitals’ FY2024 Medicare cost reports, 85% of estimates land within 15% after allowing for payment-rate growth from FY2024 to FY2027 (73.7% for hospitals under 100 beds)'.replace('73.7%', '74%')));
  const bare = textOf(page(ctxOf({ meta: { ...DOLLAR_META, dollarCheck: undefined } })));
  assert.ok(!bare.includes('cost reports,') && !bare.includes('Accuracy'));
  assert.ok(bare.includes('Assumptions'), 'the assumptions stay');
});

test('the assumptions: the fixed rows, the Medicare-dependent row with its end date and largest shortfall', () => {
  const rows = assumptions(page());
  const a = rows.map((r) => r[0]);
  assert.ok(a[0].startsWith('The penalty is the FY2027 cut'));
  assert.deepEqual(rows[1], ['Payments are priced at FY2027 rates.', 'They run about 6.6% above FY2024 cost reports, by design.']);
  assert.equal(rows[2][0], 'Medicare volume is taken from FY2025.');
  assert.ok(a.includes('Traditional Medicare only.') && a.includes('New hospitals use partial-year volume.'));
  const mdh = rows.find((r) => r[0].startsWith('The Medicare-dependent'));
  assert.equal(mdh[0], 'The Medicare-dependent hospital-specific rate counts for Oct–Dec 2026 only, assuming that status ends December 31, 2026, as current law says (0 hospitals).'.replace('0 hospitals', '0 hospitals'));
  assert.ok(mdh[1].includes('up to about 33% for some'));
  // An end date after the year's last day: the whole year counts and the shortfall line is gone.
  const whole = assumptions(page(ctxOf({ meta: { ...DOLLAR_META, mdh: { endDate: '2027-12-31', maxShortfall: 33 } } }))).find((r) => r[0].startsWith('The Medicare-dependent'));
  assert.ok(whole[0].includes('for the whole year') && !whole[1].includes('33'));
  assert.ok(!assumptions(page(ctxOf({ meta: { ...DOLLAR_META, mdh: undefined } }))).some((r) => r[0].startsWith('The Medicare-dependent')));
});

test('the Medicare-dependent row counts the hospitals of that type', () => {
  const list = [CUT, hospital({ id: '990011', types: ['MDH'] }), hospital({ id: '990012', types: ['MDH', 'SCH'] })];
  const row = assumptions(page(ctxOf({ hospitals: list }))).find((r) => r[0].startsWith('The Medicare-dependent'));
  assert.ok(row[0].endsWith('(2 hospitals).'));
});

test('the new-technology share is computed from the data, not typed', () => {
  const row = (meta) => assumptions(page(ctxOf({ meta }))).find((r) => r[0].startsWith('New-technology'));
  assert.ok(row(DOLLAR_META)[1].includes(`about ${(NTAP_AMOUNT / 90000000000 * 100).toFixed(1)}% low overall`));
  assert.ok(row(DOLLAR_META)[1].includes('about $1.7B'));
  assert.ok(row({ ...DOLLAR_META, totals: { ...DOLLAR_META.totals, modelBase: 180000000000 } })[1].includes('about 1.0% low overall'));
  assert.equal(row({ ...DOLLAR_META, totals: { modelPen: 1, cmsEst: 1 } }), undefined, 'no base, no share');
});

test('the Pennsylvania rural model row while it runs into the payment year; inactive and no-estimate rows when any', () => {
  const text = page();
  const rows = assumptions(text);
  const parhm = rows.find((r) => r[0].startsWith('Pennsylvania Rural Health Model'));
  assert.ok(parhm && parhm[1].includes('until the model ends December 31, 2026') && parhm[1].includes('Oct–Dec 2026'));
  const later = assumptions(page(ctxOf({ meta: { ...DOLLAR_META, fy: 2028 } })));
  assert.ok(!later.some((r) => r[0].startsWith('Pennsylvania')), 'the row drops out once the model has ended');
  const one = rows.find((r) => r[0].includes('no longer active'));
  assert.equal(one[0], '1 hospital that CMS lists as no longer active is still shown.');
  assert.ok(!rows.some((r) => r[0].includes('missing from the impact file')));
  const many = ctxOf({ hospitals: [...ALL, hospital({ id: '990020', inactive: { date: null, reason: 'closed' } }), hospital({ id: '990021', pen: null }), hospital({ id: '990022', pen: null })] });
  const manyRows = assumptions(page(many));
  assert.equal(manyRows.find((r) => r[0].includes('no longer active'))[0], '2 hospitals that CMS lists as no longer active are still shown.');
  assert.equal(manyRows.find((r) => r[0].includes('missing from the impact file'))[0], '2 hospitals missing from the impact file get no estimate.');
  const none = assumptions(page(ctxOf({ hospitals: [CUT] })));
  assert.ok(!none.some((r) => r[0].includes('no longer active') || r[0].includes('missing from the impact file')));
});

test('the modeled totals against CMS’s, with only an https source linked', () => {
  const text = page();
  assert.ok(textOf(text).includes('about $90.0B in base payments and $340M in penalties. CMS’s own estimate of the penalties was $360M (CMS model, Table X)'));
  assert.ok(text.includes('href="https://example.org/table"'));
  const http = page(ctxOf({ meta: { ...DOLLAR_META, totals: { ...DOLLAR_META.totals, cmsSrc: { label: 'x', url: 'http://insecure.example/' } } } }));
  assert.ok(!http.includes('insecure.example'));
});

test('the peer-group medians table sits in the formula section, collapsed', () => {
  const text = page();
  const formula = text.slice(text.indexOf('id="formula"'), text.indexOf('id="methods-dollars"'));
  assert.match(formula, /<details class="meds">\s*<summary>Peer-group medians for FY2027<\/summary>/);
  assert.equal(formula.match(/<tbody>[\s\S]*?<\/tbody>/)[0].match(/<tr>/g).length, 5);
});

test('places: the geocode counts; history: the early-file exclusions, and each year’s total with its source', () => {
  const text = textOf(page());
  assert.ok(text.includes('(2,526 hospitals)') && text.includes('ZIP code (371)') && text.includes('county (15)') && !text.includes('have no dot'));
  assert.ok(textOf(page(ctxOf({ meta: { ...DOLLAR_META, geocode: { address: 1, zip: 1, county: 1, none: 3 } } }))).includes('3 hospitals have no dot.'));
  assert.ok(text.includes('for FY2013 through FY2018 it leaves out Maryland, Puerto Rico, and hospitals with no data for any condition'));
  const history = { ...HISTORY, national: [
    { fy: 2024, totalEst: 500000000, totalSrc: { kind: 'CMS', label: 'CMS rule table', url: 'https://example.org/rule' } },
    { fy: 2025, totalEst: 316000000, totalSrc: { kind: 'CMS', label: 'CMS simulation of FY2025 penalties', url: 'http://insecure.example/' } },
    { fy: 2026, totalEst: null },
  ] };
  const html = page(ctxOf({ history }));
  const t = textOf(html);
  assert.ok(t.includes('for FY2025, a later simulation of that year under the earlier method'));
  assert.ok(t.includes('No total for FY2026.'));
  assert.ok(html.includes('href="https://example.org/rule"') && !html.includes('insecure.example'));
  assert.match(html, /<th scope="row">FY2024<\/th><td class="num">\$500M<\/td>/);
});

test('feedback and privacy: the family page holds the privacy claims; no cookie or collection promise here, no reply time', () => {
  const html = page();
  const t = textOf(html);
  assert.match(html, /<a href="\/privacy\/">privacy<\/a>/);
  assert.match(html, /<a href="\/accessibility\/">accessibility<\/a>/);
  assert.ok(t.includes('opens a Google Form, so Google sees what you send and your IP address'));
  assert.ok(t.includes('leave out any patient information'));
  assert.doesNotMatch(t, /collects nothing|no cookies|sets no cookies|I read every message|(reply|respond|answer) (within|in) |will reply|we will respond|delete your/i);
});

test('sources: the pinned files table lists exactly the pins used, with the hash prefix and size', () => {
  const html = page();
  const section = html.slice(html.indexOf('id="pins"'), html.indexOf('id="reuse"'));
  const rows = [...section.matchAll(/<tr><th scope="row">(.*?)<\/th><td class="num">([^<]*)<\/td><td><code>([^<]*)<\/code><\/td><td>([^<]*)<\/td><\/tr>/g)];
  assert.equal(rows.length, PINS.length);
  assert.deepEqual(rows.map((r) => [textOf(r[1]).replace(/ \(opens in a new tab\)/, '').trim(), r[2], r[3], r[4]]), [['Example file A', '1,234,567', 'abcdef0123456789…', 'October 20, 2026'], ['Example file B', '42', '0123456789abcdef…', 'October 21, 2026']]);
  assert.ok(section.includes('href="https://example.org/a"') && !section.includes('insecure.example'), 'a landing page is preferred; an http address is not linked');
  assert.equal(methodsView(ctxOf({ pinsUsed: [] })).pins.length, 0);
});

test('the glossary has 14 terms, each with a definition', () => {
  const html = page();
  const gl = html.slice(html.indexOf('<dl class="glossary">'), html.indexOf('</dl>', html.indexOf('<dl class="glossary">')));
  const terms = [...gl.matchAll(/<dt>([^<]*)<\/dt>\s*<dd>([^<]+)<\/dd>/g)];
  assert.equal(terms.length, 14);
  assert.ok(terms.every((m) => m[2].trim().length > 20));
  assert.ok(gl.includes('the lowest it goes is the cap’s 0.97') && gl.includes('ratio of 0.25 or more'));
});

test('reuse: the CCN is plain text to open as text, never the spreadsheet formula', () => {
  const html = page();
  const t = textOf(html);
  assert.ok(t.includes('the CCN is plain text, so open its column as text in a spreadsheet to keep the leading zero'));
  assert.ok(!html.includes('="990001"') && !html.includes('=&quot;'));
  assert.ok(t.includes('fewer than 25 cases'));
  assert.match(html, /<section class="meth__sec" id="methods-dollars"/);
});

test('the formula says a condition at or below its median adds nothing, and does not say the ratio is floored', () => {
  const t = textOf(page());
  assert.ok(t.includes('A condition at or below its peer group’s median adds nothing.'));
  assert.ok(!/not less than/i.test(t));
});

test('on the data: Methods holds every pin the data read, each claim sentence reads as words', () => {
  const data = loadHrrpOnce();
  const places = buildPlaces(data.hospitals, data.meta);
  const ctx = areaContext({ ...data, places });
  const html = page(ctx);
  assert.equal(methodsView(ctx).pins.length, data.pinsUsed.length);
  assert.ok(data.pinsUsed.length > 0);
  assert.doesNotMatch(textOf(html), /NaN|undefined|\bnull\b|\[object Object\]/);
  const t = textOf(html);
  assert.match(t, /\d+% of estimates land within 15%/);
  assert.match(t, /about \d\.\d% low overall/);
  assert.ok(html.length < 200000);
});
