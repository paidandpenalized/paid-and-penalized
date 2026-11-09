// The Readmissions program page, place pages and Methods (and the family's 404 line): the words and record cards, on
// synthetic hospitals and (the whole build) on the data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textOf } from '../../../pipeline/site/html.js';
import { ASSETS } from '../../../pipeline/test/helpers.js';
import { CAP_PCT } from '../../../engine/js/hrrp/formula.js';
import { summarize } from '../../../engine/js/hrrp/summary.js';
import { methodsPage } from '../web/pages/methods.js';
import { placePage } from '../web/pages/place.js';
import { programPage } from '../web/pages/program.js';
import { METHODS_PATH, PROGRAM_PATH } from '../web/links.js';
import { buildPlaces } from '../web/places.js';
import { SHEET_FIELD } from '../web/worksheet.js';
import { COPY as SHARED } from '../../../web/copy.js';
import { fillCopy } from '../../../web/render/components.js';
import { areaContext, methodsView, placeView, programView } from '../web/view.js';
import { ALL, META, areaOf, hospital, loadHrrpOnce } from './fixtures.js';

const area = areaOf();
const program = (ctx = area) => programPage({ view: programView(ctx), robots: null, assets: ASSETS });
const placeOf = (kind, key, ctx = area) => ctx.places.list.find((p) => p.kind === kind && p.key === key);
const placeHtml = (place, ctx = area) => placePage({ view: placeView(place, ctx), robots: null, assets: ASSETS });
const methods = (ctx = area) => methodsPage({ view: methodsView(ctx), robots: null, assets: ASSETS });
const main = (text) => text.slice(text.indexOf('<main'), text.indexOf('</main>'));
// The record cards' numbered fields, "1 Label"; Worksheet R's lettered fields (A to C, class SHEET_FIELD) are left out.
const labels = (text) => [...text.matchAll(/<div class="field([^"]*)">\n<p class="field__label"><span class="field__no">([^<]+)<\/span>([^<]+)<\/p>/g)]
  .filter((m) => !m[1].split(' ').includes(SHEET_FIELD)).map((m) => `${m[2]} ${m[3]}`);

test('the program page: the kicker, the name, the deck with the count, and the eight At-a-glance fields', () => {
  const text = program();
  assert.match(text, /<p class="cap kicker prog__kicker">FY2027 edition · Year 3 of Medicare readmission penalties<\/p>/);
  assert.match(text, /<h1 class="prog__title"><span class="prog__title-lead">Thirty Day<\/span> <span class="prog__title-pen">Readmissions<\/span><\/h1>/);
  assert.equal(text.match(/<h1/g).length, 1);
  assert.match(text, /Starting October 1, 2026, <strong>\d+ of the 9 hospitals<\/strong> CMS evaluated take a cut\. That is \d+% of the \d+ hospitals measured on at least one condition\./);
  assert.ok(text.includes('within thirty days of going home'));
  assert.deepEqual(labels(text), ['1 Hospitals evaluated', '2 Hospitals penalized', '3 Average cut, all hospitals', '4 Average cut, penalized only', `5 At the ${CAP_PCT}% maximum`,
    '6 Estimated dollars', '7 Data window', '8 Payment year']);
  assert.match(text, /<p class="form__title"><span>FY2027 at a glance<\/span><span>All figures from CMS unless marked<\/span><\/p>/);
  assert.ok(text.includes('≈ $341M') && text.includes('Jul 1, 2023 – Jun 30, 2025') && text.includes('Oct 1, 2026 – Sep 30, 2027'));
  assert.ok(text.includes("CMS’s rule-time estimate, from preliminary data: $361M."));
  assert.match(text, /<p class="stamp">Final · posted Oct 7, 2026<\/p>/);
  assert.match(text, /<a class="est-tag" href="\/hrrp\/methods\/#methods-dollars"/);
});

test('the hero hints link the state and the metro area with the most hospitals, every hospital and how it works', () => {
  const view = programView(area);
  assert.equal(view.try.state.path, '/hrrp/state/zz/', 'ZZ holds the most hospitals');
  assert.equal(view.try.metro.path, '/hrrp/metro/99901/');
  const text = program();
  assert.match(text, /Try <a href="\/hrrp\/state\/zz\/">Zedland<\/a>, <a href="\/hrrp\/metro\/99901\/">Exampleton, ZZ<\/a>, or <a href="#explore">browse every hospital<\/a>\. New to this\? Start with <a href="#how">how the penalty works<\/a>\./);
  // The pick follows the data, not a name: a second state with more hospitals takes the first place.
  const more = [...ALL, ...[1, 2, 3, 4, 5, 6].map((i) => hospital({ id: `9900${20 + i}`, st: 'ZY', cbsa: null, cbsaName: null }))];
  assert.equal(programView(areaOf(more)).try.state.path, '/hrrp/state/zy/');
});

test('the program page has every Part the section menu links, and no search box without its script', () => {
  const text = program();
  for (const id of ['how', 'picture', 'map', 'history', 'explore', 'research']) assert.match(text, new RegExp(`<section class="part" id="${id}"`), id);
  assert.ok(text.includes('The FY2027 picture'));
  assert.ok(!main(text).includes('class="omni'));
});

test('a place page: the kind, the deck (take/takes, the average, the state rank, the total) and the six-field card', () => {
  const zz = placeOf('state', 'zz');
  const text = placeHtml(zz);
  const S = summarize(zz.hospitals);
  assert.match(text, /<p class="cap kicker">State<\/p>\s*<h1 class="place__title">Zedland<\/h1>/);
  assert.ok(text.includes(`${S.nPen} of ${S.n} hospitals take a cut in FY2027:`));
  assert.match(text, /The average cut, counting all 7 hospitals, is \d\.\d\d%, the (largest|smallest) among the 2 states in the program\./);
  assert.match(text, /Estimated total: \$[\d.]+[KMB]?<a class="est-tag"/);
  assert.deepEqual(labels(text), ['1 Hospitals', '2 Penalized', '3 Average cut', '4 Cut 1% or more', `5 At the ${CAP_PCT}% cap`, '6 Estimated dollars']);
  assert.match(text, /<span>Zedland · FY2027<\/span><span>Compared with all hospitals nationally<\/span>/);
});

test('the deck: "the largest", "the Nth-largest", "one hospital", and none measured', () => {
  const two = areaOf(); // ZZ and ZY
  const ranks = ['zz', 'zy'].map((k) => placeView(placeOf('state', k, two), two).deck.average);
  assert.ok(ranks.some((r) => r.includes('the largest among the 2 states in the program. ')), ranks.join('|'));
  assert.ok(ranks.some((r) => r.includes('the smallest among the 2 states in the program. ')), ranks.join('|'));
  assert.ok(!ranks.some((r) => r.includes('2nd-largest')), 'the last place is the smallest, not the Nth-largest');
  assert.ok(!placeView(placeOf('metro', '99901', two), two).deck.average.includes('states'), 'only states are ranked');
  const one = areaOf([hospital({ id: '990070', st: 'ZY', cbsa: null, cbsaName: null, c: { HF: { n: 10, err: 1.2, flag: 0, ratio: 0.1 } }, paf: 1, red: 0, pen: 0 })]);
  const view = placeView(placeOf('state', 'zy', one), one);
  assert.equal(view.deck.lead, '0 of 1 hospital takes a cut in FY2027: it is not measured on any condition. ');
  assert.ok(view.deck.average.startsWith('The average cut, counting its one hospital, is 0.00%'));
});

test('the state and metro rules: a metro across a state line says so, a state lists its metros and the hospitals outside them', () => {
  const metro = placeOf('metro', '99901');
  assert.equal(placeView(metro, area).kicker, 'Metro area · spans ZZ, ZY');
  const state = placeView(placeOf('state', 'zy'), area);
  assert.equal(state.children.title, 'Metro areas');
  assert.ok(state.children.rows[0].label.endsWith('(ZY part)'));
  const withRural = areaOf([...ALL, hospital({ id: '990071', cbsa: null, cbsaName: null })]);
  assert.ok(placeView(placeOf('state', 'zz', withRural), withRural).children.rows.some((r) => r.label === 'Outside metro areas' && r.href === null));
  assert.equal(placeView(metro, area).children, null);
});

test('place breadcrumbs: nation first, the last crumb is the page and not a link', () => {
  const text = placeHtml(placeOf('metro', '99901'));
  const crumbs = /<nav class="crumbs"[\s\S]*?<\/nav>/.exec(text)[0];
  assert.match(crumbs, /<li><a href="\/hrrp\/">Nation<\/a><\/li>/);
  assert.match(crumbs, /<a href="\/hrrp\/region\/westland\/">Westland<\/a>/);
  assert.match(crumbs, /<a href="\/hrrp\/state\/zz\/">Zedland<\/a>/);
  assert.match(crumbs, /<li aria-current="page">Exampleton, ZZ<\/li>/);
  assert.equal([...crumbs.matchAll(/aria-current/g)].length, 1);
});

test('Methods: the kicker, heading, both formulas, the neutrality modifier at four decimals and the replication sentence', () => {
  const text = methods();
  assert.match(text, /<p class="cap kicker">Methods &amp; sources<\/p>\s*<h1>How this was made<\/h1>/);
  assert.equal(text.match(/<pre class="formula">/g).length, 2);
  assert.ok(text.includes('neutrality modifier × payment weight × (ratio − peer median)'));
  assert.ok(text.includes('cases × case-mix index × (labor amount × wage index + non-labor amount × cost-of-living adjustment)'));
  assert.ok(text.includes('This year the neutrality modifier is 1.0000.'));
  assert.ok(text.includes(`capped at ${CAP_PCT}%`));
  assert.ok(text.includes('reproduces its factor exactly for all 9 hospitals.'));
  assert.match(text, /<section class="meth__sec" id="methods-dollars"/);
  const some = areaOf();
  some.meta = { ...META, nm: 0.962847, replication: { exact: 8, total: 9 } };
  assert.ok(methods(some).includes('0.9628.') && methods(some).includes('exactly for 8 of 9 hospitals.'));
  // Only https sources are linked.
  assert.ok(text.includes('href="https://example.org/file.zip"') && text.includes('<li>Example source without an address</li>') && !text.includes('insecure.example'));
  assert.match(text, /<a href="https:\/\/docs\.google\.com\/forms\//);
});

test('each page has its own title and description; noindex while unreleased', () => {
  const metaOf = (text) => [/<title>([^<]*)<\/title>/.exec(text)[1], /<meta name="description" content="([^"]*)">/.exec(text)[1]];
  const pages = [program(), methods(), ...area.places.list.map((p) => placeHtml(p))];
  assert.equal(new Set(pages.map((t) => metaOf(t)[0])).size, pages.length);
  assert.equal(new Set(pages.map((t) => metaOf(t)[1])).size, pages.length);
  assert.match(programPage({ view: programView(area), robots: 'noindex', assets: ASSETS }), /<meta name="robots" content="noindex">/);
});

test('hostile text in a place name is escaped', () => {
  const evil = '<script>alert(1)</script>';
  const ctx = areaOf([hospital({ cbsaName: evil, st: 'ZZ' })]);
  const text = placeHtml(placeOf('metro', '99901', ctx), ctx);
  assert.ok(!text.includes('<script>alert'));
});

test('the 404 line is a Readmissions sentence with no digit (the family 404 page prints it: hub/test/pages.test.js)', () => {
  assert.equal(fillCopy(SHARED, 'notInHrrp'), 'The Readmissions program covers the hospitals in the fifty states and the District of Columbia that Medicare pays under its inpatient payment system, so critical access hospitals, the hospitals paid outside it (children’s, cancer, psychiatric, rehabilitation and long-term care hospitals) and Puerto Rico’s hospitals are not in it and have no page here.');
});

// On the data.
const DATA = loadHrrpOnce();
const PLACES = buildPlaces(DATA.hospitals, DATA.meta);
const DATA_AREA = areaContext({ ...DATA, places: PLACES });

test('on the data: the program page, every place page and Methods read as words', () => {
  const pages = [[PROGRAM_PATH, program(DATA_AREA)], [METHODS_PATH, methods(DATA_AREA)], ...PLACES.list.map((p) => [p.path, placeHtml(p, DATA_AREA)])];
  assert.equal(pages.length, 2 + PLACES.list.length);
  for (const [path, text] of pages) {
    assert.doesNotMatch(textOf(main(text)), /NaN|undefined|\bnull\b|\[object Object\]/, path);
    assert.doesNotMatch(text, /NaN|undefined|\[object Object\]|="null"/, path);
  }
  const metaOf = (text) => [/<title>([^<]*)<\/title>/.exec(text)[1], /<meta name="description" content="([^"]*)">/.exec(text)[1]];
  assert.equal(new Set(pages.map(([, t]) => metaOf(t)[0])).size, pages.length, 'titles');
  assert.equal(new Set(pages.map(([, t]) => metaOf(t)[1])).size, pages.length, 'descriptions');
});

test('on the data: the At-a-glance count is the data\'s, and the neutrality modifier is shown at four decimals', () => {
  const S = summarize(DATA.hospitals);
  const text = program(DATA_AREA);
  assert.ok(text.includes(`${S.nPen.toLocaleString('en-US')} of the ${S.n.toLocaleString('en-US')} hospitals`));
  assert.ok(methods(DATA_AREA).includes(`the neutrality modifier is ${DATA.meta.nm.toFixed(4)}.`));
});

test('on the data: a state is ranked, and its rank is among the states and DC', () => {
  const ranks = PLACES.list.filter((p) => p.kind === 'state').map((p) => placeView(p, DATA_AREA).deck.average);
  assert.equal(ranks.filter((r) => r.includes('the largest among')).length, 1);
  assert.ok(ranks.every((r) => r.includes('states and DC in the program')));
  assert.equal(ranks.filter((r) => r.includes('the smallest among')).length, 1, 'the last place is the smallest');
  assert.ok(!ranks.some((r) => /the (\d+)(st|nd|rd|th)-largest among the (\d+) states/.test(r) && Number(/the (\d+)(?:st|nd|rd|th)-largest/.exec(r)[1]) > Number(/among the (\d+) states/.exec(r)[1]) + 1), 'no rank past the count');
});

// The cards' and the deck's notes, as exact strings.
const noteOf = (view, label) => view.card.fields.find((f) => f.label === label).note;
const below = (id, st) => hospital({ id, st, cbsa: null, cbsaName: null, paf: 1, red: 0, pen: 0, c: { HF: { n: 40, err: 0.9, flag: 0, ratio: 0.1 } } });
const cut = (id, st, extra = {}) => hospital({ id, st, cbsa: null, cbsaName: null, ...extra });

test('the At-a-glance notes: penalized of measured, and the maximum\'s "hospitals"', () => {
  const fields = programView(area).card.fields;
  const S = summarize(ALL);
  assert.equal(fields[1].note, `${Math.round(S.pctPen)}% of the ${S.nMeasured} measured on at least one condition`);
  assert.equal(fields[1].note, '50% of the 8 measured on at least one condition');
  assert.deepEqual([fields[4].label, fields[4].value, fields[4].note], ['At the 3% maximum', '0', 'hospitals']);
});

test('the place Penalized note: the gap to the nation both ways, same as nation, and none measured', () => {
  // Five hospitals, three of them cut: the nation is 60%. ZZ has two cut of two (+40 pts); ZY has one cut of three (33%, -27 pts).
  const ctx = areaOf([cut('990081', 'ZZ'), cut('990082', 'ZZ'), cut('990083', 'ZY'), below('990084', 'ZY'), below('990085', 'ZY')]);
  const zz = placeView(placeOf('state', 'zz', ctx), ctx);
  const zy = placeView(placeOf('state', 'zy', ctx), ctx);
  assert.equal(noteOf(zz, 'Penalized'), 'of 2 measured · +40 pts vs nation');
  assert.equal(noteOf(zy, 'Penalized'), 'of 3 measured · −27 pts vs nation');
  assert.equal(noteOf(placeView(placeOf('state', 'zz'), area), 'Penalized'), 'of 6 measured · same as nation');
  assert.equal(noteOf(zz, 'Average cut'), '+0.40 pts vs nation');
  const none = areaOf([hospital({ id: '990086', st: 'ZY', cbsa: null, cbsaName: null, pen: null, paf: 1, red: 0, c: { HF: { n: 10, err: 1.2, flag: 0, ratio: 0.1 } } })]);
  const v = placeView(placeOf('state', 'zy', none), none);
  assert.equal(noteOf(v, 'Penalized'), 'of 0 measured');
  assert.equal(noteOf(v, 'Average cut'), 'same as nation');
  assert.equal(noteOf(v, 'Estimated dollars'), '1 hospital has no estimate and is left out of the total.');
  assert.equal(v.deck.totalNote, ' (1 hospital has no estimate and is left out of the total)');
});

test('the "Cut 1% or more" note: the area\'s share and the nation\'s', () => {
  const zz = placeView(placeOf('state', 'zz'), area);
  assert.equal(noteOf(zz, 'Cut 1% or more'), '29% of hospitals (nation 33%)');
  assert.equal(noteOf(placeView(placeOf('state', 'zy'), area), 'Cut 1% or more'), '50% of hospitals (nation 33%)');
});

test('the hero drops the metro suggestion when no hospital is in a metro area', () => {
  const ctx = areaOf([cut('990087', 'ZZ'), cut('990088', 'ZY')]);
  assert.equal(programView(ctx).try.metro, null);
  assert.match(program(ctx), /Try <a href="\/hrrp\/state\/z[zy]\/">[^<]+<\/a>, or <a href="#explore">browse every hospital<\/a>\./);
});

test('"spans" lists the state with the most hospitals first; DC is counted from the places, not the state list', () => {
  const ctx = areaOf([cut('990089', 'ZY', { cbsa: '1', cbsaName: 'M' }), cut('990090', 'ZY', { cbsa: '1', cbsaName: 'M' }), cut('990091', 'ZZ', { cbsa: '1', cbsaName: 'M' })]);
  assert.equal(placeView(placeOf('metro', '1', ctx), ctx).kicker, 'Metro area · spans ZY, ZZ');
  assert.equal(ctx.hasDc, false);
  assert.equal(areaOf([cut('990092', 'DC')]).hasDc, true);
});
