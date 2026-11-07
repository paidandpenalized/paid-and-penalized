// A Readmissions hospital page: its record card, stamps, verdict, breadcrumb and feedback link, on synthetic hospitals
// and (for the whole file) on the data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chipOf, footerOf, headerOf } from '../../../pipeline/test/helpers.js';
import { textOf } from '../../../pipeline/site/html.js';
import { escapeHtml } from '../../../web/render/html.js';
import { money } from '../../../web/render/format.js';
import { feedbackFor } from '../../../web/render/layout.js';
import { SITE } from '../../../web/site.js';
import { hospitalPage } from '../web/pages/hospital.js';
import { shellOf } from '../web/pages/parts.js';
import { hospitalPath } from '../web/links.js';
import { loadHub } from '../../../hub/data.js';
import { hospitalContext, hospitalView } from '../web/view.js';
import { ASSETS, CUT, INACTIVE, NAME, NONE_BELOW, NONE_MEASURED, NONE_ROUNDED, ctxOf, hospital, loadHrrpOnce } from './fixtures.js';

const ctx = ctxOf();
const render = (h, robots = null) => hospitalPage({ view: hospitalView(h, ctx), robots, assets: ASSETS });
const crumbsOf = (text) => /<nav class="crumbs"[\s\S]*?<\/nav>/.exec(text)[0];

test('the record card holds the six numbered fields under its title bar', () => {
  const text = render(CUT);
  assert.match(text, /<p class="form__title"><span>Hospital record · FY2027<\/span><span>CCN 990001<\/span><\/p>/);
  // The record card and the verdict: what comes before the figures (Worksheet R, further down, has lettered fields of its own).
  const labels = [...text.slice(0, text.indexOf('<figure')).matchAll(/<p class="field__label"><span class="field__no">([^<]+)<\/span>([^<]+)<\/p>/g)].map((m) => `${m[1]} ${m[2]}`);
  assert.deepEqual(labels, ['1 Hospital', '2 Location', '3 Metro area', '4 Type', '5 Peer group', '6 Care Compare stars', 'A Payment adjustment factor', 'B Estimated dollars']);
  assert.match(text, new RegExp(`<h1 class="field__value hosp__name">${NAME}</h1>`));
  assert.equal(text.match(/<h1/g).length, 1, 'one h1');
  assert.ok(text.includes('Exampleton, ZZ 99001'));
  assert.ok(text.includes('Sample County'));
  assert.ok(text.includes('<a href="/hrrp/metro/99901/">See this metro</a>'));
  assert.ok(text.includes('23.5% of stays dual-eligible'));
  assert.ok(text.includes('<span class="stars" aria-hidden="true">★★★★<span class="stars__off">☆</span></span><span class="vh">4 of 5 stars</span>'));
  assert.match(text, /<a href="https:\/\/www\.medicare\.gov\/care-compare\/details\/hospital\/990001" target="_blank" rel="noopener">Open on Medicare\.gov/);
  assert.ok(text.includes('0.9900') && text.includes('$100K') && text.includes('CMS, final'));
  assert.match(text, /<a class="est-tag" href="\/hrrp\/methods\/#methods-dollars"[^>]*>estimate<\/a>/);
});

test('each verdict variant renders its sentence and stamp', () => {
  const stampOf = (text) => [...text.matchAll(/<p class="(stamp[^"]*)">([^<]+)<\/p>/g)].map((m) => [m[1], m[2]]);
  const cut = render(CUT);
  assert.deepEqual(stampOf(cut), [['stamp', 'Cut 1.00%']]);
  assert.ok(cut.includes(`<p class="hosp__summary">Medicare is paying ${NAME} 1.00% less`));
  for (const [h, sentence] of [[NONE_MEASURED, 'None of its six conditions reached 25 cases'], [NONE_BELOW, 'All 2 of its measured conditions came in at or below'], [NONE_ROUNDED, 'the reduction rounded to zero']]) {
    const text = render(h);
    assert.deepEqual(stampOf(text), [['stamp stamp--ink', 'No cut']]);
    assert.ok(text.includes(sentence), sentence);
  }
  const inactive = render(INACTIVE);
  assert.deepEqual(stampOf(inactive), [['stamp', 'Cut 1.00%'], ['stamp stamp--ink', 'Inactive']]);
  assert.match(inactive, /<p class="hosp__inactive">CMS lists this hospital’s Medicare agreement under CCN 990005 as ended on March 30, 2026/);
  assert.ok(!cut.includes('hosp__inactive'));
});

test('the type line is a dash when empty, and an alias, "Not rated" and an outside-metro link show', () => {
  const bare = render(hospital({ teach: null, beds: null, own: null, urban: null, types: [], star: null, alias: 'Example Medical', cbsa: null, cbsaName: null }));
  assert.match(bare, /<p class="field__value field__value--sm">—<\/p>/);
  assert.ok(bare.includes('Also listed by CMS as Example Medical'));
  assert.match(bare, /<p class="field__value">Not rated<\/p>/);
  assert.ok(bare.includes('Outside metro areas') && bare.includes('<a href="/hrrp/state/zz/">See Zedland</a>'));
});

test('the rank line and the Report a problem link', () => {
  const text = render(CUT);
  assert.ok(text.includes('<p class="hosp__rank">Larger cut than 66% of hospitals nationally, 71% of the 7 in Zedland, and 75% in peer group 2.</p>'));
  const href = feedbackFor({ path: hospitalPath('990001') });
  assert.ok(text.includes(`<a href="${escapeHtml(href)}" target="_blank" rel="noopener">Report a problem with this hospital’s data`));
  assert.ok(href.includes(encodeURIComponent(SITE.origin + hospitalPath('990001'))), 'it prefills the hospital\'s page address');
});

test('the breadcrumb: the last crumb is the current page; region and division only when known', () => {
  const full = crumbsOf(render(CUT));
  assert.equal(full.match(/<li>/g).length, 5, 'Nation, region, division, state, metro');
  assert.match(full, /<li aria-current="page">EXAMPLE GENERAL HOSPITAL<\/li>/);
  assert.equal(full.match(/aria-current/g).length, 1);
  assert.ok(full.includes('<a href="/hrrp/">Nation</a>') && full.includes('<a href="/hrrp/region/westland/">Westland</a>') && full.includes('<a href="/hrrp/division/pacific-coast/">Pacific Coast</a>') && full.includes('<a href="/hrrp/state/zz/">Zedland</a>') && full.includes('<a href="/hrrp/metro/99901/">Exampleton, ZZ</a>'));
  const partial = crumbsOf(render(hospital({ region: null, division: null, cbsa: null, cbsaName: null })));
  assert.deepEqual([...partial.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]), ['/hrrp/', '/hrrp/state/zz/']);
});

test('the page has its own title, description and canonical address, and the section menu marks Every hospital', () => {
  const a = render(CUT);
  const title = (text) => /<title>([^<]*)<\/title>/.exec(text)[1];
  assert.equal(title(a), escapeHtml(`${NAME}, Exampleton, ZZ: Hospital Readmissions Reduction Program, FY2027 · ${SITE.name}`));
  const desc = (text) => /<meta name="description" content="([^"]*)">/.exec(text)[1];
  assert.match(desc(a), /^EXAMPLE GENERAL HOSPITAL, Exampleton, ZZ: its record in the FY2027 /);
  assert.ok(!/\d+(\.\d+)?%|\$\d/.test(desc(a)), 'no cut or dollar figure in the preview');
  assert.ok(a.includes(`<link rel="canonical" href="${SITE.origin}/hrrp/hospital/990001/">`));
  assert.match(headerOf(a), /data-nav="explore" aria-current="true"/);
  assert.match(headerOf(a), /<a class="tab" href="\/hrrp\/hospital\/990001\/" aria-current="page">/);
});

test('the shell: six Parts and Methods, numbered, the picture Part labeled with the edition', () => {
  const header = headerOf(render(CUT));
  const items = [...header.matchAll(/<a href="([^"]+)" data-nav="([^"]+)"[^>]*><span class="nav__num">(\d)<\/span>([^<]+)<\/a>/g)].map((m) => [m[1], m[2], m[3], m[4]]);
  assert.deepEqual(items, [
    ['/hrrp/#how', 'how', '1', 'How it works'], ['/hrrp/#picture', 'picture', '2', 'The FY2027 picture'], ['/hrrp/#map', 'map', '3', 'Map'],
    ['/hrrp/#history', 'history', '4', 'History'], ['/hrrp/#explore', 'explore', '5', 'Every hospital'], ['/hrrp/#research', 'research', '6', 'Research'],
    ['/hrrp/methods/', 'methods', '7', 'Methods'],
  ]);
  assert.equal(shellOf({ edition: 'FY2027' }).sections, shellOf({ edition: 'FY2027' }).sections, 'built once for the pages that share it');
  assert.ok(footerOf(render(CUT)).includes('Readmissions'));
});

test('hostile text in a CMS string is escaped', () => {
  const evil = '<script>alert(1)</script>&"';
  const text = render(hospital({ name: evil, alias: evil, city: evil, county: evil, own: evil, cbsaName: evil, inactive: { date: null, reason: evil } }));
  assert.ok(!text.includes('<script>alert'), 'no raw script');
  assert.ok(text.includes(escapeHtml(evil)));
});

test('noindex while unreleased, indexable otherwise', () => {
  assert.match(render(CUT, 'noindex'), /<meta name="robots" content="noindex">/);
  assert.ok(!render(CUT).includes('name="robots"'));
});

test('text of the page reads as words', () => {
  const words = textOf(render(CUT));
  assert.ok(words.includes('Larger cut than'));
});

// On the data: every hospital's page.
const DATA = loadHrrpOnce();
const SHARED = hospitalContext(DATA);
const PAGES = DATA.hospitals.map((h) => {
  const view = hospitalView(h, SHARED);
  return [h, hospitalPage({ view, robots: null, assets: ASSETS }), view];
});

test('on the data: no page\'s text has NaN, undefined, null or [object Object]', () => {
  assert.equal(PAGES.length, DATA.hospitals.length);
  for (const [h, text] of PAGES) {
    const body = textOf(text.slice(text.indexOf('<main'), text.indexOf('</main>')));
    assert.doesNotMatch(body, /NaN|undefined|\bnull\b|\[object Object\]/, h.id);
    assert.doesNotMatch(text, /NaN|undefined|\[object Object\]|="null"/, h.id);
  }
});

test('on the data: the header links no hub or HACRP page the build lacks', () => {
  const dollars = new Set(loadHub().dollars.hospitals.map((r) => r.ccn));
  assert.deepEqual(PAGES.filter(([h, , view]) => view.inHub !== dollars.has(h.id)).map(([h]) => h), [], 'the master\'s HACRP membership is the dollar file\'s');
  const out = PAGES.find(([h]) => !dollars.has(h.id));
  assert.ok(out, 'the data has a hospital the dollar file lacks');
  assert.ok(!/href="\/(hacrp\/)?hospital\//.test(headerOf(out[1])), 'its header links neither the hub\'s nor HACRP\'s page for it');
  assert.ok(/href="\/hrrp\/hospital\//.test(headerOf(out[1])));
});

test('on the data: the chip carries the net the dollar file estimates, and none for a hospital without an estimate', () => {
  const rows = new Map(loadHub().dollars.hospitals.map((r) => [r.ccn, r]));
  const estimated = PAGES.filter(([h]) => rows.get(h.id)?.status === 'estimated');
  const without = PAGES.filter(([h]) => rows.get(h.id)?.status !== 'estimated');
  assert.ok(estimated.length > 0 && without.length > 0, 'the data has both kinds');
  for (const [h, text] of estimated) assert.ok(chipOf(headerOf(text)).includes(money(rows.get(h.id).net, { sign: true })), h.id);
  for (const [h, text] of without) assert.ok(!chipOf(headerOf(text)).includes('chip__v'), h.id);
});

test('on the data: each page has its own title and description', () => {
  const metaOf = (text) => [/<title>([^<]*)<\/title>/.exec(text)[1], /<meta name="description" content="([^"]*)">/.exec(text)[1]];
  const titles = new Set();
  const descriptions = new Set();
  for (const [, text] of PAGES) {
    const [title, description] = metaOf(text);
    titles.add(title);
    descriptions.add(description);
  }
  assert.equal(titles.size, PAGES.length, 'titles');
  assert.equal(descriptions.size, PAGES.length, 'descriptions');
});

test('on the data: every variant of the record card appears and renders', () => {
  const has = (pick) => PAGES.some(([h]) => pick(h));
  for (const [what, pick] of [['an alias', (h) => h.alias], ['a cost-report bed count', (h) => h.bedsSrc === 'cr'], ['an inactive hospital', (h) => h.inactive], ['no metro area', (h) => !h.cbsa], ['no stars', (h) => !h.star]]) {
    assert.ok(has(pick), `the data has ${what}`);
  }
  const text = (pick) => PAGES.find(([h]) => pick(h))[1];
  assert.ok(text((h) => h.bedsSrc === 'cr').includes('beds (cost report)'));
  assert.ok(text((h) => h.inactive).includes('hosp__inactive'));
  assert.ok(text((h) => h.red === 0).includes('No cut'));
});
