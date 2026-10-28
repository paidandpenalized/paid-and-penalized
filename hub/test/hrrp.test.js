// The interim Readmissions pages (hub/hrrp/page.js): /hrrp/ and a page per hospital in the pinned Thirty Day Readmissions
// file, on the pinned data with rows picked by property, never by name or CCN, and on invented rows for the odd shapes.
// Failure messages say what was checked and print no hospital's name, CCN or figure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext } from '../../pipeline/site/context.js';
import { ASSETS, chipOf, headerOf, withTemp } from '../../pipeline/test/helpers.js';
import { programDek } from '../../web/programs.js';
import { count, decimal, money, pct } from '../../web/render/format.js';
import { escapeHtml } from '../../web/render/html.js';
import { SITE, hospitalPathOf } from '../../web/site.js';
import { loadHub } from '../data.js';
import { COPY } from '../hrrp/copy.js';
import { hrrpHospitalPage, hrrpProgramPage, summaryOf } from '../hrrp/page.js';
import { hubHospitals } from '../model.js';
import { generateHub } from '../pages.js';

const HUB = loadHub();
const HOSPITALS = hubHospitals(HUB);
const BY_CCN = new Map(HOSPITALS.map((h) => [h.ccn, h]));
const RECORDS = [...HUB.tdr.hospitals.values()];
const FY = String(HUB.tdr.fy);
const HUB_FY = String(ASSETS.shell.fy);
const esc = (text) => escapeHtml(text);
const NOINDEX = '<meta name="robots" content="noindex">';

const pick = (pred, what) => {
  const r = RECORDS.find((x) => pred(x, BY_CCN.get(x.id) ?? null));
  assert.ok(r, `the pinned file has ${what}`);
  return r;
};
const render = (record, h = BY_CCN.get(record.id) ?? null) => hrrpHospitalPage({ record, tdr: HUB.tdr, master: HUB.master.get(record.id), h, assets: ASSETS, robots: 'noindex' });
const mainOf = (page) => page.slice(page.indexOf('<main'), page.indexOf('</main>'));
const tabsOf = (page) => [...headerOf(page).matchAll(/<a class="tab[^"]*" href="([^"]*)"(?: title="[^"]*")?( aria-current="page")?>/g)].map((m) => [m[1], Boolean(m[2])]);

const CUT = pick((r, h) => r.paf < 1 && h?.est?.hrrpListed && h.est.hrrp < 0 && Object.keys(r.c).length >= 3, 'a hospital with a cut, an estimate and several conditions');
const NO_CUT = pick((r, h) => r.paf >= 1 && h?.est?.hrrpListed, 'a hospital with no cut and an estimate');
const OUT_OF_FY = pick((r, h) => h?.est && !h.est.hrrpListed, 'a hospital the FY2026 file does not list, with an estimate');
const NO_ESTIMATE = pick((r, h) => h && !h.est, 'a hospital in the dollar file with no estimate');
const NOT_IN_DOLLARS = pick((r, h) => h === null, 'a hospital the dollar file does not have');
// A condition counted by CMS, one above one that CMS did not count, and one with a ratio at or below one.
const hasCondition = (r, test) => Object.values(r.c).some(test);
const MIXED = pick((r) => hasCondition(r, (c) => c.flag === 1) && hasCondition(r, (c) => c.err > 1 && c.flag === 0) && hasCondition(r, (c) => c.err <= 1), 'a hospital with counted, uncounted-above-one and at-or-below-one conditions');

test('/hrrp/: the kicker, the masthead with its last word in the penalty ink, the dek, the summary card, the large link out and the year note', () => {
  const summary = summaryOf(HUB.tdr);
  const page = hrrpProgramPage({ tdr: HUB.tdr, assets: ASSETS, robots: 'noindex' });
  const main = mainOf(page);
  assert.equal(main.match(/<h1[\s>]/g)?.length, 1, 'one h1');
  assert.ok(main.includes('<p class="cap kicker rd__kicker">HRRP · Interim page</p>'), 'the kicker');
  assert.ok(main.includes('<h1 class="rd__title">Hospital <span class="rd__pen">Readmissions</span></h1>'), 'the masthead');
  assert.ok(main.includes(`<p class="dek">${esc(programDek('hrrp'))}</p>`), 'the program\'s dek');
  // The counts come from the pinned file by the rule "payment adjustment factor below one", and the share from the counts.
  assert.equal(summary.n, RECORDS.length, 'every hospital in the file');
  assert.equal(summary.cut, RECORDS.filter((r) => r.red > 0).length, 'a cut is a factor below one, a reduction above zero');
  for (const text of [count(summary.cut), `of ${count(summary.n)} in the file`, pct(summary.cut / summary.n, 1), `FY${FY}`]) assert.ok(main.includes(esc(text)), 'the summary card shows its figure');
  assert.ok(main.includes('Readmissions · FY' + FY) && main.includes('CMS final data'), 'the card\'s title bar');
  // The link out: Thirty Day Readmissions, in a new tab, in words.
  assert.ok(main.includes(`<p class="rd__go"><a href="${SITE.tdr.url}" target="_blank" rel="noopener">Full explorer on Thirty Day Readmissions `), 'the large link opens Thirty Day Readmissions in a new tab, in words');
  // The year note: this page is CMS's year, the net is the common one.
  assert.ok(main.includes(esc(`This page shows CMS’s FY${FY} values. The estimated dollars across all three programs, on the front page and each hospital’s page, use FY${HUB_FY}, the latest year all three programs share.`)), 'the year note');
  assert.ok(main.includes('Hospital or city') && main.includes('data-hub') && main.includes('data-only="hospital"'), 'the hospital search');
  // The program's tab is the current one, no hospital is followed, the page is noindex.
  assert.deepEqual(tabsOf(page).filter(([, current]) => current), [['/hrrp/', true]], 'the Readmissions tab is current');
  assert.ok(!/data-hospital/.test(headerOf(page)) && !chipOf(headerOf(page)), 'no hospital followed');
  assert.ok(page.includes(NOINDEX), 'noindex');
  assert.ok(page.includes(`<title>Hospital Readmissions Reduction Program, FY${FY} · Paid &amp; Penalized</title>`), 'the title');
  assert.ok(!page.includes('This program’s page is coming.'), 'not the coming placeholder');
});

test('a hospital with a cut: its record card with CMS\'s factor to four decimals and the reduction, the link to its page on Thirty Day Readmissions, the FY estimate', () => {
  const h = BY_CCN.get(CUT.id);
  const page = render(CUT);
  const main = mainOf(page);
  const master = HUB.master.get(CUT.id);
  assert.equal(main.match(/<h1[\s>]/g)?.length, 1, 'one h1');
  assert.ok(main.includes(`<h1 class="field__value hh__name">${esc(master.name)}</h1>`), 'the name is the h1, in the record card');
  assert.ok(main.includes(`<span>CCN ${CUT.id}</span>`) && main.includes(`<span>Readmissions · FY${FY}</span>`), 'the card\'s title bar');
  assert.ok(main.includes(`Payment adjustment factor, FY${FY}</p>\n<p class="field__value field__value--big">${decimal(CUT.paf, 4)}</p>`), 'CMS\'s factor, four decimals');
  assert.ok(main.includes(`<p class="field__value field__value--big">${decimal(CUT.red, 2)}%</p>`), 'the reduction, in percent');
  assert.ok(main.includes('<span class="pill pill--pen">cut</span>'), 'the word for it');
  // The deep link to this hospital's page on Thirty Day Readmissions, by the registry's address, opened in a new tab.
  assert.ok(main.includes(`<a href="${SITE.tdr.hospital(CUT.id)}" target="_blank" rel="noopener">Full explorer on Thirty Day Readmissions`), 'the link to its page there');
  // The estimate the net uses: the dollar file's year, labeled, with its tag, equal to money() of the dollars.
  assert.ok(main.includes(`Readmissions, estimated FY${HUB_FY} <a class="est-tag"`), 'the estimate\'s label says estimated and the year');
  assert.ok(main.includes(`<p class="hh__big">${money(h.est.hrrp)}</p>`), 'the estimate');
  assert.ok(main.includes(`<a class="hh__deep" href="${hospitalPathOf('hub', CUT.id)}">This hospital across the programs`), 'the link to its page across the programs');
  assert.ok(main.includes(esc(`The net across all three programs adds each program’s estimated dollars for FY${HUB_FY}, the latest year they share. Readmissions’ part can differ from the FY${FY} values on this page.`)), 'the two years explained');
  assert.ok(main.includes(esc('A cut is a program’s formula at work, not a verdict on a hospital’s care. Nothing on this page ranks hospitals.')), 'the fairness line');
  // Every dollar figure sits under a label that says estimated and the fiscal year.
  const label = main.indexOf(`Readmissions, estimated FY${HUB_FY}`);
  const dollars = [...main.matchAll(/[−+]?\$[\d.,]+[KMB]?/g)];
  assert.ok(dollars.length > 0 && dollars.every((m) => m.index > label), 'every dollar figure is under the estimate\'s label');
  assert.ok(!/NaN|undefined|Infinity/.test(page), 'no NaN, undefined or Infinity');
});

test('the header follows the hospital: its interim page current, the chip with the net, tabs to the hospital\'s other pages, the stop link to /hrrp/', () => {
  const h = BY_CCN.get(CUT.id);
  const header = headerOf(render(CUT));
  assert.ok(header.includes(`data-hospital="${CUT.id}"`), 'the header names the hospital');
  const interim = hospitalPathOf('hrrp', CUT.id, { inTdr: true });
  const named = tabsOf(render(CUT)).map(([href, current]) => [href === interim ? 'interim' : href === hospitalPathOf('hub', CUT.id) ? 'hub' : href === hospitalPathOf('hacrp', CUT.id) ? 'hacrp' : href, current]);
  assert.deepEqual(named, [['hub', false], ['interim', true], ['hacrp', false], ...SITE.programs.slice(2).map((p) => [p.path, false])]);
  const chip = chipOf(header);
  assert.ok(chip.includes(money(h.est.net, { sign: true })) && chip.includes('href="/hrrp/"'), 'the chip carries the net and stops at the program page');
  assert.ok(render(CUT).includes(`<link rel="canonical" href="${SITE.origin}${interim}">`), 'the canonical address');
});

test('a hospital with no cut: a factor of one, no reduction and the words "no cut"', () => {
  const main = mainOf(render(NO_CUT));
  assert.ok(main.includes(`<p class="field__value field__value--big">${decimal(NO_CUT.paf, 4)}</p>`), 'the factor');
  assert.ok(main.includes(`<p class="field__value field__value--big">${decimal(0, 2)}%</p>`), 'a reduction of none');
  // The card holds the word with no cut ink (the estimate below is another year's, which may be a cut).
  const card = main.slice(0, main.indexOf('<section class="hh__net'));
  assert.ok(card.includes('<span class="pill">no cut</span>') && !card.includes('pill--pen'), 'the word, with no cut ink');
  assert.ok(main.includes(`<p class="hh__big">${money(BY_CCN.get(NO_CUT.id).est.hrrp)}</p>`), 'the estimate');
});

test('the conditions: each the hospital has, in CMS\'s order, with its discharges, the ratio as CMS published it (four decimals), the words for its side of one and whether CMS counted it', () => {
  const main = mainOf(render(MIXED));
  const rows = [...main.matchAll(/<tr>\n<th scope="row">([^<]*)<\/th>\n<td class="num" data-label="[^"]*">([^<]*)<\/td>\n<td class="num" data-label="[^"]*"><span class="rd__r">([^<]*)<\/span> <span class="rd__w rd__w--(\w+)">([^<]*)<\/span><\/td>\n<td data-label="[^"]*">([^<]*)<\/td>\n<\/tr>/g)];
  const want = HUB.tdr.conditions.filter((c) => MIXED.c[c.key]);
  assert.equal(rows.length, want.length, 'one row per condition the hospital has');
  rows.forEach((row, i) => {
    const c = MIXED.c[want[i].key];
    assert.equal(row[1], esc(want[i].label), 'the condition\'s label');
    assert.equal(row[2], count(c.n), 'eligible discharges');
    assert.equal(row[3], decimal(c.err, 4), 'the ratio, four decimals as CMS published it');
    const above = Number(decimal(c.err, 4)) > 1;
    assert.equal(row[4], above ? 'above' : 'atOrBelow', 'its side of one, as printed');
    assert.equal(row[5], above ? 'above 1' : 'at or below 1', 'the words, not color alone');
    assert.equal(row[6], c.flag === 1 ? 'Yes' : 'No', 'counted by CMS');
  });
  assert.ok(rows.some((r) => r[4] === 'above' && r[6] === 'No') && rows.some((r) => r[4] === 'above' && r[6] === 'Yes') && rows.some((r) => r[4] === 'atOrBelow'), 'the page shows every combination');
  assert.ok(main.includes('<th scope="col">Condition</th>') && main.includes('<caption class="vh">'), 'a labeled table');
});

test('the estimate block by case: not in the FY file, no estimate, and a hospital the dollar file lacks', () => {
  const out = mainOf(render(OUT_OF_FY));
  assert.ok(out.includes('<span class="pill pill--na">Not in this program</span>') && out.includes(esc(`Not in CMS’s FY${HUB_FY} Readmissions file, so the net has no Readmissions dollars for this hospital.`)), 'not in the file');
  assert.ok(!/\$0|hh__big/.test(out), 'never $0 for not in the program');
  const none = mainOf(render(NO_ESTIMATE));
  assert.ok(none.includes('<p class="stamp stamp--ink">No estimate</p>') && none.includes(esc(`This site’s estimated FY${HUB_FY} dollars have no usable row for this hospital.`)), 'no estimate and why');
  assert.ok(none.includes(`href="${hospitalPathOf('hub', NO_ESTIMATE.id)}"`), 'its page across the programs says why, and is linked');
  assert.ok(!/hh__big|\$\d/.test(none), 'no dollar figure');
  // One the dollar file lacks has no page across the programs and none in hospital-acquired conditions: the header links neither,
  // and the page says no estimate without a link to a page that is not there.
  const lacking = render(NOT_IN_DOLLARS);
  const main = mainOf(lacking);
  assert.ok(main.includes('No estimate') && !main.includes('This hospital across the programs'), 'no estimate and no link to a missing page');
  const hrefs = tabsOf(lacking).map(([href]) => href);
  assert.equal(hrefs.some((href) => href.startsWith('/hospital/')), false, 'no tab opens a hospital page across the programs');
  assert.equal(hrefs.some((href) => href.startsWith('/hacrp/hospital/')), false, 'no tab opens a hospital-acquired conditions page');
  assert.equal(hrefs.includes(hospitalPathOf('hrrp', NOT_IN_DOLLARS.id, { inTdr: true })), true, 'the Readmissions tab is this page');
  const chip = chipOf(headerOf(lacking));
  assert.ok(chip && !chip.includes('chip__v') && !/href="\/hospital\//.test(chip), 'the chip names the hospital with no figure and no link to a missing page');
  assert.ok(!/NaN|undefined|Infinity/.test(lacking), 'no NaN, undefined or Infinity');
});

// ---------- invented rows: the odd shapes ----------
const CONDITIONS = [{ key: 'AA', short: 'A', label: 'Condition A' }, { key: 'BB', short: 'B', label: 'Condition B' }, { key: 'CC', short: 'C', label: 'Condition C' }];
const TDR = { fy: HUB.tdr.fy, conditions: CONDITIONS, hospitals: new Map() };
const record = (extra = {}) => ({ id: '990001', paf: 0.9876, red: 1.24, c: { CC: { n: 30, err: 1, flag: 0, ratio: 0.01 }, AA: { n: 3, err: 1.5, flag: 0, ratio: null } }, ...extra });
const master = (extra = {}) => ({ name: 'Invented Hospital', city: 'Exampleton', state: 'ZZ', beds: 120, teach: 'none', own: 'Nonprofit', urban: true, ...extra });
const synthetic = (rec, mast, h = null) => hrrpHospitalPage({ record: rec, tdr: TDR, master: mast, h, assets: ASSETS, robots: 'noindex' });

test('invented rows: conditions in the file\'s order, a ratio of exactly one reads "at or below", a ratio with no weight and few discharges still shows, a missing city drops the place', () => {
  const page = synthetic(record(), master({ city: null }));
  const main = mainOf(page);
  const labels = [...main.matchAll(/<th scope="row">([^<]*)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Condition A', 'Condition C'], 'the conditions it has, in the conditions list\'s order');
  assert.ok(main.includes('<span class="rd__r">1.5000</span> <span class="rd__w rd__w--above">above 1</span>'), 'a small count above one');
  assert.ok(main.includes('<span class="rd__r">1.0000</span> <span class="rd__w rd__w--atOrBelow">at or below 1</span>'), 'exactly one');
  // A pinned ratio a hair over one prints as CMS's 1.0000, and the words follow what is printed.
  const hair = mainOf(synthetic(record({ c: { AA: { n: 40, err: 1.00003, flag: 0, ratio: 0.01 } } }), master()));
  assert.ok(hair.includes('<span class="rd__r">1.0000</span> <span class="rd__w rd__w--atOrBelow">at or below 1</span>'), 'a ratio printed as one');
  assert.ok(main.includes('<p class="field__value">ZZ</p>'), 'a state alone is the location');
  assert.ok(page.includes('<title>Invented Hospital (ZZ): Hospital Readmissions Reduction Program, FY2027 · Paid &amp; Penalized</title>'), 'a title with the state alone');
  const bare = synthetic(record(), master({ city: null, state: null }));
  assert.ok(bare.includes('<title>Invented Hospital: Hospital Readmissions Reduction Program, FY2027 · Paid &amp; Penalized</title>') && !/\(\)|, ,|NaN|undefined/.test(bare), 'a title with no place at all');
  assert.ok(main.includes('No estimate') && !/NaN|undefined|Infinity/.test(page), 'no estimate, nothing printed as NaN');
  assert.ok(main.includes('<p class="field__value field__value--big">0.9876</p>') && main.includes('<p class="field__value field__value--big">1.24%</p>'), 'the factor and the reduction');
  const withPlace = synthetic(record(), master());
  assert.ok(withPlace.includes('<title>Invented Hospital (Exampleton, ZZ): Hospital Readmissions Reduction Program, FY2027 · Paid &amp; Penalized</title>'), 'a title with its place');
});

test('the program page counts a factor of exactly one as no cut, and an empty file stops the build', () => {
  const tdr = { fy: 2027, conditions: CONDITIONS, hospitals: new Map([['990001', record({ paf: 1, red: 0 })], ['990002', record({ id: '990002' })], ['990003', record({ id: '990003', paf: 0.99, red: 1 })], ['990004', record({ id: '990004', paf: 1, red: 0 })]]) };
  assert.deepEqual(summaryOf(tdr), { n: 4, cut: 2, share: 0.5 });
  assert.throws(() => summaryOf({ fy: 2027, conditions: [], hospitals: new Map() }), /no hospitals/);
});

test('the copy holds no digit, and nothing that judges, ranks or promises', () => {
  const source = readFileSync(new URL('../hrrp/copy.js', import.meta.url), 'utf8');
  assert.ok(!/\d/.test(source.replace(/^\/\/.*$/gm, '')), 'a digit in the copy file (numbers arrive through placeholders)');
  for (const text of Object.values(COPY)) assert.ok(!/\b(should|failed|could have avoided|worst|best|rank(s|ed|ing)?|within|promptly)\b/i.test(text.replace('Nothing on this page ranks hospitals.', '')), 'a judging or promising word in the copy');
});

test('the build writes /hrrp/ and a page per pinned hospital, never indexed, at the address the registry gives, each whole', () =>
  withTemp('pp-hrrp-', async (dir) => {
    const base = createContext({ outDir: join(dir, 'a'), env: 'production', assets: ASSETS });
    await generateHub(base, { hospitals: [] });
    const ctx = createContext({ outDir: join(dir, 'b'), env: 'production', assets: ASSETS });
    await generateHub(ctx);
    // The program's page is written either way; the hospitals' pages are the pinned file's, one each.
    assert.equal(ctx.pages - base.pages, HUB.dollars.hospitals.length + RECORDS.length, 'one page per hospital in each file');
    const program = readFileSync(join(dir, 'b', 'hrrp', 'index.html'), 'utf8');
    assert.ok(program.includes('<h1 class="rd__title">') && !program.includes("This program’s page is coming."), '/hrrp/ is the interim page, not the placeholder');
    assert.ok(program.includes(NOINDEX) && !ctx.indexable.some((p) => p.startsWith('/hrrp/')), 'never indexed, in the sitemap\'s list or the page');
    let missing = 0;
    let bad = 0;
    let wrong = 0;
    for (const r of RECORDS) {
      const path = hospitalPathOf('hrrp', r.id, { inTdr: true });
      const file = join(dir, 'b', path, 'index.html');
      if (!existsSync(file)) { missing += 1; continue; }
      const text = readFileSync(file, 'utf8');
      if (/NaN|undefined|Infinity|\[object/.test(text)) bad += 1;
      if (!text.includes(`<link rel="canonical" href="${SITE.origin}${path}">`) || !text.includes(NOINDEX) || text.match(/<h1[\s>]/g)?.length !== 1) wrong += 1;
    }
    assert.equal(missing, 0, 'pinned hospitals with no page');
    assert.equal(bad, 0, 'pages with NaN, undefined, Infinity or [object');
    assert.equal(wrong, 0, 'pages without their canonical address, noindex or exactly one h1');
    // A hospital in the dollar file that the pinned file does not have gets none.
    const outside = HOSPITALS.find((h) => !h.inTdr);
    assert.ok(outside && !existsSync(join(dir, 'b', 'hrrp', 'hospital', outside.ccn.toLowerCase())), 'no interim page for a hospital outside the pinned file');
  }));

test('a slice of hospitals gets the interim pages of its pinned hospitals only, and /hrrp/ always', () =>
  withTemp('pp-hrrp-slice-', async (dir) => {
    const slice = HOSPITALS.filter((h) => h.inTdr).slice(0, 3);
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    await generateHub(ctx, { hospitals: slice, master: HUB.master });
    assert.ok(existsSync(join(dir, 'hrrp', 'index.html')), '/hrrp/');
    for (const h of slice) assert.ok(existsSync(join(dir, 'hrrp', 'hospital', h.ccn.toLowerCase(), 'index.html')), 'a sliced hospital\'s page');
    assert.equal(RECORDS.filter((r) => existsSync(join(dir, 'hrrp', 'hospital', r.id.toLowerCase()))).length, slice.length, 'and no other');
  }));
