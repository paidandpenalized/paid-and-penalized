// The TEAM Methods page (/team/methods/): every section the page and the calculator need explained (the sources and
// their dates, the episode floor, low volume, prices, quality percentiles, the composite score, the band's evidence,
// what can still move the target, what the calculator leaves out, the unknowns and where each real value lives, the
// area test), every number on it from the TEAM file, the manifest or a named constant, every claim it cites resolving
// in the register, and every pin the TEAM file names listed with its date and hash. Failures print counts, sections
// and keys, never a hospital.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT, newestYear, readJson, readManifest } from '../../../pipeline/files.js';
import { robotsFor } from '../../../pipeline/site/context.js';
import { textOf } from '../../../pipeline/site/html.js';
import { testAssets } from '../../../pipeline/test/helpers.js';
import { BAND_DEFAULT, BAND_MAX, BAND_MIN, CATEGORIES } from '../../../engine/js/team/params.js';
import { count, decimal, isoDate, money, ordinal, pct } from '../../../web/render/format.js';
import { SITE } from '../../../web/site.js';
import {
  BASELINE_YEARS, CITES, CJR_BAND, CQS_CAPS, CQS_SCALE, EXAMPLE, FALLS_PRF_CFR_YEAR, LOW_VOLUME, MEASURES, MISSING_QUALITY, OUTLIER_PERCENTILE,
  PY2_PERIODS, PY2_START, RECON_MONTHS, ERROR_DAYS, SUPPRESSED_MAX, TARGET_CAPS, TRACKS, DEFAULT_TRACK, yearOf,
} from '../web/constants.js';
import { loadSharedSources, loadSources, loadTeam } from '../web/data.js';
import { SOURCE_LINKS } from '../web/links.js';
import { HASH_NAME, METHODS_CITES } from '../web/methods/cites.js';
import { COPY } from '../web/methods/copy.js';
import { methodsFacts } from '../web/methods/facts.js';
import { methodsPage } from '../web/pages/methods.js';
import { PY2_NUMBER } from '../web/pages/parts.js';

const team = loadTeam();
const sources = loadSources(team);
const robots = robotsFor({ env: 'production', released: SITE.sites.team.released });
const page = methodsPage({ team, sources, shared: loadSharedSources(), robots, assets: testAssets() });
const words = (markup) => textOf(String(markup)).replace(/\s+/g, ' ').trim();
const main = /<main[\s\S]*?<\/main>/.exec(page)[0];
const sectionMarkup = (id) => {
  const m = new RegExp(`<section class="doc__sec" id="${id}"[\\s\\S]*?</section>`).exec(page);
  assert.ok(m, `section #${id}`);
  return m[0];
};
const sectionOf = (id) => words(sectionMarkup(id));
const IDS = ['sources', 'episodes', 'low-volume', 'prices', 'quality', 'cqs', 'band', 'moves', 'left-out', 'unknowns', 'area', 'other', 'code'];

test('the sections, in order, each with its heading, beside a contents list that links each', () => {
  const at = IDS.map((id) => page.indexOf(`<section class="doc__sec" id="${id}"`));
  assert.ok(at.every((i) => i > 0), IDS.filter((_, k) => at[k] < 0).join(', '));
  assert.deepEqual([...at].sort((a, b) => a - b), at);
  for (const id of IDS) {
    assert.ok(page.includes(`<a href="#${id}">`), `contents: #${id}`);
    assert.ok(sectionOf(id).length > 80, `#${id} has words`);
  }
  assert.equal(page.match(/<h1[ >]/g).length, 1);
});

test('noindex while the site is unreleased; never "penalty"', () => {
  assert.equal(SITE.sites.team.released, false);
  assert.ok(page.includes('<meta name="robots" content="noindex">'));
  assert.doesNotMatch(words(main), /penalt/i);
});

// The numbers a reader sees (citations dropped: they are references, held in constants.js CITES and methods/cites.js;
// each hash's start, checked against the manifest below; the contents' section numbers), as digit runs.
const digitRuns = (text) => text.match(/\d+(?:[.,]\d+)*/g) ?? [];
test('every Methods number is from data or a constant', () => {
  const m = team.method;
  const facts = methodsFacts(team);
  const status = Object.values(team.status).map(([code]) => code);
  const manifestDates = sources.flatMap((e) => [e.asOf, e.pdcReleased, e.pdcModified, e.datasetModified, e.derivedFrom?.lastModified, e.retrieved]).filter(Boolean).map(isoDate);
  const shown = [
    ...team.meta.mupYears.map(String), yearOf(PY2_START), PY2_NUMBER, String(team.fy), String(team.methods_version),
    count(LOW_VOLUME), String(BASELINE_YEARS), decimal(m.baselineScale, 1), count(SUPPRESSED_MAX), ordinal(OUTLIER_PERCENTILE), String(CQS_SCALE),
    ...Object.values(m.cohort).map(count), ...Object.values(m.qualityPeriods).flatMap(({ start, end }) => [isoDate(start), isoDate(end)]),
    ...Object.values(PY2_PERIODS).flatMap(({ start, end }) => [isoDate(start), isoDate(end)]), FALLS_PRF_CFR_YEAR,
    ...Object.values(TARGET_CAPS).map((x) => pct(x, 0)), ...Object.values(CQS_CAPS).flatMap((c) => [pct(c.gain, 0), pct(c.loss, 0)]),
    ...Object.keys(TRACKS), String(DEFAULT_TRACK), String(MISSING_QUALITY), String(RECON_MONTHS), String(ERROR_DAYS),
    pct(BAND_DEFAULT, 0), pct(BAND_MIN, 0), pct(BAND_MAX, 0), pct(CJR_BAND.within, 0), pct(CJR_BAND.wideWithin, 0),
    money(EXAMPLE.target), pct(-EXAMPLE.spend, 0), String(EXAMPLE.cqs), String(EXAMPLE.track),
    ...Object.entries(m.remaps).flatMap(([from, to]) => [from, ...Object.entries(to).flatMap(([d, share]) => [d, pct(share, 0)])]),
    ...Object.values(m.areaCheck).map(count), count(team.counts.selectedAreas),
    count(status.filter((c) => c === 'area_unknown').length), count(status.filter((c) => c === 'unlisted').length),
    count(facts.active), count(facts.noEpisodes),
    ...manifestDates, ...sources.map((e) => e.title), ...sources.map((e) => e.delineated).filter(Boolean),
    CITES.subpart, HASH_NAME, // a citation in a sentence, and the hash's name
  ];
  const allowed = new Set(shown.flatMap(digitRuns));
  const reading = main.replace(/<span class="(tm-cite|doc__toc-n)">[^<]*<\/span>/g, '').replace(/<code>[^<]*<\/code>/g, '').replace(/<a [^>]*href="[^"]*"/g, '<a');
  const stray = [...new Set(digitRuns(words(reading)))].filter((n) => !allowed.has(n));
  assert.deepEqual(stray, [], 'numbers on the Methods page with no source in the file, the manifest or a constant');
});

test('every claim the Methods copy cites resolves to a checked row of the register, and every citation it prints is one of its own', () => {
  const register = readFileSync(`${REPO_ROOT}sites/team/CLAIMS.md`, 'utf8');
  const rows = new Map(register.split('\n').filter((l) => /^\| TEAM-\d+ \|/.test(l)).map((l) => {
    const cells = l.split('|').slice(1, -1).map((c) => c.trim());
    return [cells[0], cells];
  }));
  for (const [key, { claim }] of Object.entries(COPY)) {
    for (const id of [claim].flat().filter(Boolean)) {
      assert.ok(rows.has(id), `${key}: ${id} has no row`);
      assert.match(rows.get(id)[4], /^\d{4}-\d{2}-\d{2}$/, `${key}: ${id} checked`);
      assert.doesNotMatch(rows.get(id)[4], /unverified/, `${key}: ${id}`);
    }
  }
  const printed = new Set([...main.matchAll(/<span class="tm-cite">([^<]*)<\/span>/g)].map((x) => x[1].trim()));
  const known = new Set([...Object.values(CITES), ...Object.values(METHODS_CITES)].map((c) => c.replace(/'/g, '&#39;')));
  for (const c of printed) assert.ok(known.has(c), `a citation not in CITES or METHODS_CITES: ${c}`);
  for (const [key, c] of Object.entries(METHODS_CITES)) assert.ok(printed.has(c.replace(/'/g, '&#39;')), `METHODS_CITES.${key} is printed`);
  // Every section that explains a rule cites one.
  for (const id of ['episodes', 'low-volume', 'prices', 'quality', 'cqs', 'band', 'moves', 'left-out', 'unknowns', 'area']) {
    assert.match(sectionMarkup(id), /class="tm-cite"/, `#${id} cites a source`);
  }
});

test('the episode floor (C16): hidden cells under the file\'s cut-off, no outpatient cases, one past year, the DRG remaps as a table', () => {
  const s = sectionOf('episodes');
  assert.ok(s.includes(`${count(SUPPRESSED_MAX)} or fewer discharges`));
  assert.match(s, /outpatient claim/);
  assert.match(s, /inpatient only/);
  assert.ok(s.includes(`${team.meta.mupYears.at(-1)}’s inpatient stays, not a forecast of ${yearOf(PY2_START)}’s`));
  assert.match(s, /no bound on what is missing/, 'hidden cells are never a bound');
  const table = /<table[\s\S]*?<\/table>/.exec(sectionMarkup('episodes'))[0];
  const rows = [...table.matchAll(/<tr><th scope="row">([^<]*)<\/th><td>([^<]*)<\/td><\/tr>/g)];
  assert.equal(rows.length, Object.keys(team.method.remaps).length);
  for (const [, from, to] of rows) {
    const map = team.method.remaps[from];
    assert.ok(map, `remap ${from}`);
    for (const drg of Object.keys(map)) assert.ok(to.includes(drg), `remap ${from} → ${drg}`);
  }
});

test('low volume: the rule, the approximation (two public years times the file\'s scale against the threshold), and its scope', () => {
  const s = sectionOf('low-volume');
  const [from, to] = team.meta.mupYears;
  assert.ok(s.includes(`fewer than ${LOW_VOLUME} episodes`));
  assert.ok(s.includes(`${from} and ${to}, multiplies the sum by ${decimal(team.method.baselineScale, 1)}`));
  assert.equal(team.method.baselineScale, BASELINE_YEARS / team.meta.mupYears.length, 'the file\'s scale is the baseline years over the data years');
  assert.match(s, /each episode’s amount before it sums them/);
});

test('quality: CMS\'s cohort and this site\'s, the cohort sizes and periods from the file, the missing-data score', () => {
  const s = sectionOf('quality');
  for (const n of Object.values(team.method.cohort)) assert.ok(s.includes(count(n)), 'a cohort size');
  for (const { start, end } of [...Object.values(team.method.qualityPeriods), ...Object.values(PY2_PERIODS)]) {
    assert.ok(s.includes(`${isoDate(start)} to ${isoDate(end)}`), 'a period');
  }
  assert.ok(s.includes(`counts at ${MISSING_QUALITY}`));
  assert.equal(Object.values(MEASURES).filter((x) => x.public).length, 2);
});

test('the composite score: the weights, the sum, the adjustment with each track\'s cap, and the fact sheet linked', () => {
  const s = sectionOf('cqs');
  assert.ok(s.includes(`from zero to ${CQS_SCALE}`));
  assert.ok(s.includes(`gives up as much as ${pct(CQS_CAPS[1].gain, 0)} of itself`));
  assert.ok(s.includes(`as much as ${pct(CQS_CAPS[2].loss, 0)} in Track 2 and ${pct(CQS_CAPS[3].loss, 0)} in Track 3`));
  assert.ok(sectionMarkup('cqs').includes(`href="${SOURCE_LINKS.qualityScoring}"`));
});

test('the band (#band, the calculator\'s "why?"): this site\'s own count, linked to CMS\'s CJR file, BPCI Advanced beside it, Track 2\'s limit', () => {
  const s = sectionOf('band');
  const m = sectionMarkup('band');
  assert.ok(s.includes('In those years, about half of hospitals ended a year within 5% of their target, and about three-quarters within 10%.'));
  assert.match(s, /this site’s own count/);
  assert.ok(m.includes(`href="${SOURCE_LINKS.cjrRecon}"`));
  assert.ok(m.includes(`href="${SOURCE_LINKS.bpciEval}"`));
  assert.equal(BAND_DEFAULT === TRACKS[2].gain && BAND_DEFAULT === TRACKS[2].loss, s.includes('Track 2’s limit on a gain and on a repayment'));
});

test('what can move the target and what the calculator leaves out: trend and normalization caps, risk adjustment, the post-episode adjustment, the high-cost cap', () => {
  const moves = sectionOf('moves');
  assert.ok(moves.includes(`within ${pct(TARGET_CAPS.normalization, 0)} either way`) && moves.includes(`within ${pct(TARGET_CAPS.trend, 0)} of`));
  assert.match(moves, /standardized dollar/);
  const left = sectionOf('left-out');
  assert.match(left, /Risk adjustment\./);
  assert.match(left, /post-episode spending adjustment/);
  assert.ok(left.includes(`${ordinal(OUTLIER_PERCENTILE)} percentile`));
});

test('the unknowns (C15): each says what the calculator assumes and where the real value lives; the falls and respiratory failure baseline cites both texts', () => {
  const m = sectionMarkup('unknowns');
  const items = [...m.matchAll(/<li>[\s\S]*?<\/li>/g)].map((x) => x[0]);
  assert.equal(items.length, 6);
  for (const item of items) {
    assert.match(words(item), /Assumed:/);
    assert.match(words(item), /Real value:/);
  }
  const s = words(m);
  for (const topic of [/Your track/, /Report dates/, /Falls with injury and postoperative respiratory failure/, /Low-volume status/, /Medicare-dependent hospitals/]) assert.match(s, topic);
  assert.ok(m.includes(METHODS_CITES.fallsCfr) && m.includes(METHODS_CITES.fallsCms), 'both texts cited');
  assert.ok(s.includes(`calendar ${FALLS_PRF_CFR_YEAR} baseline`) && s.includes(`calendar ${yearOf(PY2_START)}`));
  assert.match(s, /TEAM Portal/);
  assert.ok(m.includes('href="/team/#find"'), 'the reports are linked');
});

test('the area test: the delineation decides, the list-CBSA check\'s counts, area unknown and in an area but not listed', () => {
  const s = sectionOf('area');
  const { mandatory, placed, mismatched } = team.method.areaCheck;
  assert.ok(s.includes(`${count(mandatory)} mandatory participants`) && s.includes(`places ${count(placed)} of them`));
  assert.equal(mismatched === 0, s.includes('every one of those counties'));
  assert.match(s, /follows it for nearly every county but not all, so the delineation decides/);
  const n = (code) => count(Object.values(team.status).filter(([c]) => c === code).length);
  assert.ok(s.includes(`Area unknown: ${n('area_unknown')} hospitals`));
  assert.ok(s.includes(`In an area, not on the list: ${n('unlisted')} acute hospitals`));
});

test('the sources: every pin the TEAM file names, by title, publisher, date and link, TEAM\'s own first; each hash\'s start is the manifest\'s', () => {
  const m = sectionMarkup('sources');
  const byId = new Map(readManifest().map((e) => [e.id, e]));
  assert.deepEqual(sources.map((e) => e.id), team.sources);
  for (const e of sources) {
    assert.ok(m.includes(`<code>${byId.get(e.id).sha256.slice(0, 16)}</code>`), `${e.id}: hash`);
    assert.ok(words(m).includes(isoDate(e.retrieved)), `${e.id}: fetched`);
    const href = e.landingPage ?? e.downloadUrl ?? e.derivedFrom?.downloadUrl;
    if (href) assert.ok(m.includes(`href="${href}"`), `${e.id}: link`);
  }
  // The pins only TEAM reads (not the hospital master's): the hacrp Methods test leaves these to this page.
  const master = readJson(`${REPO_ROOT}data/emitted/hospital/fy${newestYear('data/emitted/hospital')}/hospital_master.json`);
  const own = team.sources.filter((id) => !master.sources.includes(id));
  const ownTable = /<table[\s\S]*?<\/table>/.exec(m)[0];
  for (const id of own) assert.ok(ownTable.includes(`<code>${byId.get(id).sha256.slice(0, 16)}</code>`), `${id}: in TEAM's own table`);
  for (const link of ['rule', 'faq', 'qualityScoring', 'fy2027Rule', 'mupMethod', 'cjrRecon', 'bpciEval']) assert.ok(m.includes(`href="${SOURCE_LINKS[link]}"`), link);
});

test('methodsFacts counts the participants still in TEAM and those of them with no episodes', () => {
  const synth = { participants: [
    { active: true, cats: { A: { n: 3, hidden: 0 }, B: { n: 0, hidden: 2 } } },
    { active: true, cats: { A: { n: 0, hidden: 0 } } },
    { active: false, cats: { A: { n: 0, hidden: 5 } } },
  ] };
  assert.deepEqual(methodsFacts(synth), { active: 2, noEpisodes: 1 });
  assert.equal(CATEGORIES.length, 5);
});
