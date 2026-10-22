// The place pages (web/pages/place.js): a Census region, a division, a state or a metro area, rendered from the pinned
// data with the page's real arguments. Places are picked by property (the busiest state, a metro area across a state
// line, a place with no payment decision), never by name. The build writing a page for every place, and its
// indexing, are in pages.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { cmsText, count, decimal, ordinal, pct } from '../../../web/render/format.js';
import { FEW_DECIDED } from '../web/constants.js';
import { ancestors, placeCounts } from '../web/places.js';
import { DATA, PD, PLACES, SEARCH_URL, renderPlace } from './pinned.js';
import { ASSETS, esc } from './fixtures.js';

const of = (kind) => PLACES.list.filter((p) => p.kind === kind);
const busiest = (list) => [...list].sort((a, b) => b.counts.decided - a.counts.decided || (a.id < b.id ? -1 : 1))[0];
const NATION = PD.counts.yes / PD.counts.decided;

// The places these tests look at, by property.
const STATE = busiest(of('state').filter((s) => s.children.length > 0));
const REGION = of('region')[0];
const DIVISION = of('division').find((d) => d.children.length > 1);
const ACROSS = busiest(of('metro').filter((m) => m.stateCodes.length > 1 && m.counts.decided >= FEW_DECIDED));
const SMALL = of('metro').find((m) => m.counts.decided > 0 && m.counts.decided < FEW_DECIDED);
const NO_DECISION = of('state').find((s) => s.counts.decided === 0 && s.counts.scored > 0);

const h1s = (text) => [...text.matchAll(/<h1[\s>][\s\S]*?<\/h1>/g)].map((m) => m[0]);
// The summary form's fields: [label, value, note].
const card = (text) => [...text.matchAll(/<span class="field__no">\d<\/span>([^<]+)<\/p>\n<p class="field__value[^"]*">([\s\S]*?)<\/p>\n<div class="field__note">([\s\S]*?)<\/div>/g)].map((m) => [m[1], m[2], m[3]]);
const crumbs = (text) => [...(/<nav class="crumbs"[\s\S]*?<\/nav>/.exec(text)?.[0] ?? '').matchAll(/<li(?: aria-current="page")?>(?:<a href="([^"]+)">)?([^<]*)/g)].map((m) => [m[1] ?? null, m[2]]);
const points = (diff) => `${diff >= 0 ? '+' : '−'}${decimal(Math.abs(diff) * 100, 1)} pts`;

test('the places picked all exist in the pinned data', () => {
  for (const [what, place] of Object.entries({ STATE, REGION, DIVISION, ACROSS, SMALL, NO_DECISION })) assert.ok(place, `no place: ${what}`);
});

test('every place page: one h1 with its name, the title and canonical address, its own script, the Map item current', () => {
  for (const place of [STATE, REGION, DIVISION, ACROSS, SMALL, NO_DECISION]) {
    const text = renderPlace(place);
    assert.deepEqual(h1s(text), [`<h1 class="place__title">${esc(place.name)}</h1>`], place.id);
    assert.ok(text.includes(`<title>${esc(place.name)}: hospital-acquired conditions, FY${DATA.fy} · Paid &amp; Penalized</title>`), `${place.id}: title`);
    assert.ok(text.includes(`<link rel="canonical" href="https://paidandpenalized.org${place.path}">`), `${place.id}: canonical`);
    assert.match(text, new RegExp(`<meta name="description" content="CMS’s FY${DATA.fy} Hospital-Acquired Condition Reduction Program scores and payment decisions for hospitals in ${esc(place.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, compared with the nation\\.">`), place.id);
    assert.ok(text.includes(`<script type="module" src="${ASSETS.js['hacrp-place']}"></script>`), `${place.id}: the place script`);
    assert.ok(!text.includes(ASSETS.js['hacrp-program']), `${place.id}: not the program page's`);
    assert.match(text, /data-nav="map" aria-current="true"/, `${place.id}: the top bar's Map item`);
    assert.match(text, /<article class="wrap page page--prog page--place">/);
    // The kind in words, above the name.
    assert.match(text, new RegExp(`<p class="cap kicker prog__kicker">(Census region|Census division|State|Metro area)</p>\\n<h1`), place.id);
    // The standing line and the citation, named for this page; the way back to the nation.
    assert.ok(text.includes('<p class="standing">A penalty reflects how CMS’s formula scored relative performance; it is not a verdict on the quality of care.</p>'));
    assert.ok(text.includes(`${esc(place.name)}: hospital-acquired conditions, FY${DATA.fy}. https://paidandpenalized.org${place.path}.`), `${place.id}: citation`);
    assert.ok(text.includes('<p class="page__links"><a href="/hacrp/" data-print-href="https://paidandpenalized.org/hacrp/">Back to the national picture</a></p>'));
  }
  // A robots value is passed through: indexable pages carry no meta, the others noindex.
  assert.ok(!renderPlace(STATE).includes('name="robots"'));
  assert.ok(renderPlace(STATE, { robots: 'noindex' }).includes('<meta name="robots" content="noindex">'));
});

test('the breadcrumb: the nation, each place above this one (a metro area: its home state\'s chain), then this one, not a link', () => {
  for (const place of [STATE, REGION, DIVISION, ACROSS, SMALL, NO_DECISION]) {
    const above = ancestors(PLACES.places, place);
    const text = renderPlace(place);
    assert.match(text, /<nav class="crumbs" aria-label="Where this place sits"><ol>/, place.id);
    assert.deepEqual(crumbs(text), [['/hacrp/#map', 'Nation'], ...above.map((p) => [p.path, esc(p.name)]), [null, esc(place.name)]], place.id);
    assert.match(text, new RegExp(`<li aria-current="page">${esc(place.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</li>`));
  }
  assert.equal(crumbs(renderPlace(REGION)).length, 2, 'a region: the nation, then itself');
  assert.equal(crumbs(renderPlace(ACROSS)).length, 5, 'a metro area: nation, region, division, home state, itself');
});

test('the summary form: the place\'s counts against the nation\'s, from the places\' own counts', () => {
  const c = STATE.counts;
  const fields = Object.fromEntries(card(renderPlace(STATE)).map(([label, value, note]) => [label, [value, note]]));
  const share = c.yes / c.decided;
  const peers = of('state').filter((p) => p.counts.decided >= 1);
  const rank = 1 + peers.filter((p) => p.counts.yes / p.counts.decided > share + 1e-12).length;
  assert.deepEqual(fields['Hospitals cut'], [count(c.yes), `Of ${count(c.decided)} with a payment decision`]);
  assert.deepEqual(fields['Share cut'], [pct(share, 1), `${points(share - NATION)} vs the nation (${pct(NATION, 1)})`]);
  assert.deepEqual(fields.Rank, [`${ordinal(rank)} of ${count(peers.length)}`, 'Share cut, highest first, among the states and DC']);
  assert.deepEqual(fields['Median score'], [cmsText(decimal(c.median, 4)), `Nation: ${cmsText(decimal(PD.medianScore, 4))}`]);
  const allSix = PD.rows.filter((r) => r.ids.length === MEASURE_IDS.length).length / PD.rows.length;
  assert.deepEqual(fields[`Scored on all ${MEASURE_IDS.length}`], [count(c.allSix), `Of ${count(c.scored)} scored (${pct(c.allSix / c.scored, 0)}; nation ${pct(allSix, 0)})`]);
  assert.equal(fields['Scored without data'][0], count(c.assigned));
  // The deck says the same in a sentence, and the stamp the share.
  const text = renderPlace(STATE);
  assert.ok(text.includes(`CMS cut ${count(c.yes)} of the ${count(c.decided)} hospitals in ${esc(STATE.name)} with a payment decision for fiscal year ${DATA.fy}: ${pct(share, 1)}, against ${pct(NATION, 1)} nationally.`));
  assert.ok(text.includes(`<p class="${share <= NATION ? 'stamp stamp--ink' : 'stamp'}">${pct(share, 0)} cut</p>`));
  // The counts are the CMS rows': decided and cut are the pinned file's, state by state.
  const inState = DATA.hospitals.filter((h) => DATA.master.get(h.ccn).state === STATE.key.toUpperCase());
  assert.equal(c.file, inState.length);
  assert.equal(c.decided, inState.filter((h) => h.total !== null && ['Yes', 'No'].includes(h.paymentReduction)).length);
  assert.equal(c.yes, inState.filter((h) => h.total !== null && h.paymentReduction === 'Yes').length);
});

test('a metro area ranks only with enough hospitals with a decision, and says how many it needs; a region and a division are ranked among their kind', () => {
  const fields = (place) => Object.fromEntries(card(renderPlace(place)).map(([label, value, note]) => [label, [value, note]]));
  assert.ok(fields(ACROSS).Rank);
  assert.ok(fields(ACROSS).Rank[1].includes(`metro areas with at least ${count(FEW_DECIDED)} hospitals with a decision`));
  assert.equal(fields(SMALL).Rank, undefined, 'too few hospitals with a decision to rank');
  assert.equal(fields(REGION).Rank[0], `${ordinal(1 + of('region').filter((p) => p.counts.yes / p.counts.decided > REGION.counts.yes / REGION.counts.decided + 1e-12).length)} of ${of('region').length}`);
  assert.ok(fields(REGION).Rank[1].endsWith('among the regions'));
  assert.ok(fields(DIVISION).Rank[1].endsWith('among the divisions'));
});

test('notes: a metro area across a state line names its states; a small place says its share moves with one hospital; Maryland\'s is said to be scored, not subject', () => {
  const notes = (place) => [...renderPlace(place).matchAll(/<p class="note">([^<]*)<\/p>/g)].map((m) => m[1]);
  assert.ok(notes(ACROSS).includes(`This metro area reaches into ${ACROSS.stateCodes.join(', ')}; this page shows all of its hospitals.`));
  assert.ok(notes(SMALL).some((n) => n.startsWith('A share of a handful of hospitals moves a long way')));
  assert.ok(!notes(STATE).some((n) => n.startsWith('A share of a handful')), 'a place with enough has no such note');
  assert.ok(!notes(STATE).some((n) => n.startsWith('This metro area reaches')));
  // Maryland-style places: some scored hospital has no decision, so the note about CMS's agreement with the state.
  assert.ok(NO_DECISION.rows.some((r) => r.yes === null));
  assert.ok(notes(NO_DECISION).includes('Maryland’s hospitals are scored but not subject to the reduction: Maryland has a special payment arrangement with Medicare that exempts them.'));
  assert.ok(!notes(STATE).some((n) => n.startsWith('Maryland’s')));
});

test('a place with no hospital with a payment decision has no share, rank, stamp or score histogram, and says so', () => {
  const text = renderPlace(NO_DECISION);
  const c = NO_DECISION.counts;
  assert.ok(text.includes(`None of the ${count(c.file)} hospitals CMS lists in ${esc(NO_DECISION.name)} has a payment decision for fiscal year ${DATA.fy}.`));
  const labels = card(text).map(([label]) => label);
  assert.ok(!labels.includes('Share cut') && !labels.includes('Rank'), labels.join());
  assert.ok(labels.includes('Hospitals cut'));
  assert.doesNotMatch(text, /<p class="stamp/);
  assert.doesNotMatch(text, /id="scores"/, 'no histogram of scores with a decision');
  // Its map and its table are still there.
  assert.match(text, /id="where"/);
  assert.match(text, /class="block hospitals"/);
});

test('the figures: the map, the scores against the nation\'s and the measures, numbered from 1 with the rule above them', () => {
  const text = renderPlace(STATE);
  assert.deepEqual([...text.matchAll(/<figure class="fig" id="figure-(\d+)" data-figure>/g)].map((m) => Number(m[1])), [1, 2, 3]);
  assert.deepEqual([...text.matchAll(/<section class="psec" id="(\w+)"/g)].map((m) => m[1]), ['where', 'scores', 'measures']);
  // The rule is every hospital with a decision, with the place's ticked: it reads the hospitals asset for names.
  assert.match(text, new RegExp(`<figure class="rulefig" data-src="${SEARCH_URL.replaceAll('.', '\\.')}"`));
  assert.ok(text.includes(`Every hospital in the nation with a payment decision, lowest score to highest, each as tall as its score (above the rule, worse than average); the solid hairlines are ${esc(STATE.name)}’s, red where CMS cut.`));
  // The map's takeaway and the score figure's name this place's counts and the nation's share.
  const caps = Object.fromEntries([...text.matchAll(/<figcaption class="fig__cap" id="figure-(\d+)-cap"><span class="fig__n">Figure \d+\.<\/span> ([^<]*)<\/figcaption>/g)].map((m) => [m[1], m[2]]));
  assert.equal(caps[1], `${esc(STATE.name)}: ${count(STATE.counts.yes)} cut of ${count(STATE.counts.decided)} with a payment decision.`);
  assert.ok(caps[2].startsWith(`${pct(STATE.counts.yes / STATE.counts.decided, 1)} of hospitals here scored past CMS’s line, against ${pct(NATION, 1)} nationally; the middle score here is ${cmsText(decimal(STATE.counts.median, 4))}, and nationally ${cmsText(decimal(PD.medianScore, 4))}.`), caps[2]);
  // The measure figure's rows: each measure's hospitals here with a value, and the share above the national median.
  const table = text.slice(text.indexOf('id="figure-3"'));
  const rows = [...table.slice(table.indexOf('<tbody>')).matchAll(/<tr><th scope="row">([^<]*)<\/th><td class="num" data-value="[^"]*">([^<]*)<\/td><td class="num" data-value="[^"]*">([^<]*)<\/td><\/tr>/g)];
  assert.ok(rows.length > 0 && rows.length <= MEASURE_IDS.length);
  for (const [, , n, share] of rows) assert.match(share, /^\d+%$/, `${n}: a share`);
});

test('a state\'s metro areas and the rest of the state; a region\'s divisions; a division\'s states: a table row each, linked, with the counts', () => {
  const rowsOf = (text) => [...text.slice(text.indexOf('<section class="block place__kids"')).split('</section>')[0].matchAll(/<tr><th scope="row">(?:<a href="([^"]+)">)?([^<]*)(?:<\/a>)?<\/th><td class="num">([^<]*)<\/td><td class="num">([^<]*)<\/td>/g)].map((m) => [m[1] ?? null, m[2], m[3], m[4]]);
  for (const place of [REGION, DIVISION]) {
    const text = renderPlace(place);
    assert.deepEqual(rowsOf(text), place.children.map((id) => PLACES.places.get(id)).map((k) => [k.path, esc(k.name), count(k.counts.decided), count(k.counts.yes)]), place.id);
  }
  // A state: its metro areas, then "Outside any metro area" for the hospitals in none.
  const text = renderPlace(STATE);
  const rows = rowsOf(text);
  const metros = STATE.children.map((id) => PLACES.places.get(id));
  assert.deepEqual(rows.slice(0, metros.length), metros.map((k) => [k.path, esc(k.name), count(k.counts.decided), count(k.counts.yes)]));
  const inAMetro = new Set(metros.flatMap((k) => k.ccns));
  const outside = placeCounts(STATE.rows.filter((r) => !inAMetro.has(r.ccn)), 0);
  assert.ok(outside.scored > 0, 'the busiest state has hospitals outside every metro area');
  assert.deepEqual(rows.at(-1), [null, 'Outside any metro area', count(outside.decided), count(outside.yes)]);
  // A metro area has no children; the table is left out.
  assert.doesNotMatch(renderPlace(ACROSS), /place__kids/);
  // The table is labelled by its heading.
  assert.match(text, /<section class="block place__kids" aria-labelledby="kids-h">\n<h2 id="kids-h" class="psec__title">Its metro areas<\/h2>/);
  assert.match(renderPlace(REGION), /<h2 id="kids-h" class="psec__title">Its divisions<\/h2>/);
  assert.match(renderPlace(DIVISION), /<h2 id="kids-h" class="psec__title">Its states<\/h2>/);
});

test('the hospital table lists exactly the place\'s hospitals (data-area), its heading names the place, and a place page has no state menu', () => {
  for (const place of [STATE, REGION, DIVISION, ACROSS, SMALL, NO_DECISION]) {
    const text = renderPlace(place);
    const section = /<section class="block hospitals" aria-labelledby="hospitals-h" id="hospitals">([\s\S]*?)<\/section>/.exec(text)[1];
    const area = /<div class="ht" data-src="([^"]+)" data-area="([^"]*)" hidden>/.exec(section);
    assert.equal(area[1], SEARCH_URL, `${place.id}: the same asset as the search`);
    const ccns = area[2].split(' ');
    assert.equal(new Set(ccns).size, ccns.length, `${place.id}: each hospital once`);
    assert.deepEqual([...ccns].sort(), [...place.ccns].sort(), `${place.id}: exactly the place's hospitals`);
    assert.equal(ccns.length, place.counts.file);
    assert.ok(ccns.every((c) => /^[0-9A-Z]{6}$/.test(c)));
    assert.ok(section.includes(`<h2 id="hospitals-h">Every hospital in ${esc(place.name)}</h2>`), `${place.id}: heading`);
    assert.doesNotMatch(section, /id="ht-state"/, `${place.id}: no state menu`);
    assert.match(section, /<select id="ht-sort">/);
    assert.match(section, /<input id="ht-name" type="search"/);
    assert.match(section, /<tbody><\/tbody>/, 'no hospital row in the page');
    assert.match(section, /<p class="ht-nojs">/);
  }
  // The program page's own table lists everyone: no area.
});

test('hostile text in a place\'s name renders as text in the page, the title, the breadcrumb and the table heading', () => {
  const name = '</script><script>alert(1)</script> & "Sons" <b>';
  const text = renderPlace({ ...STATE, name });
  assert.ok(!text.includes('<script>alert'));
  assert.ok(!text.includes('<b>'));
  assert.ok(text.includes(`<h1 class="place__title">${esc(name)}</h1>`));
  assert.ok(text.includes(`<li aria-current="page">${esc(name)}</li>`));
  assert.ok(text.includes(`<h2 id="hospitals-h">Every hospital in ${esc(name)}</h2>`));
  assert.ok(text.includes(`<title>${esc(name)}: hospital-acquired conditions`));
  // A hostile name above a place (a division's) reaches the breadcrumb as text too.
  const division = PLACES.places.get(STATE.parent);
  const places = { ...PLACES, places: new Map([...PLACES.places, [division.id, { ...division, name }]]) };
  const below = renderPlace(STATE, { places });
  assert.ok(below.includes(`<a href="${division.path}">${esc(name)}</a>`));
  assert.ok(!below.includes('<script>alert'));
});
