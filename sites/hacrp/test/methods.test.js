// The Methods page (/hacrp/methods/): as the build writes it, on the committed history, and its parts on the small
// synthetic history (history-fixtures.js): the receipt, the proof strips and decision rules' tables, the periods, the
// pipeline and the sources. Every total on the page is read back against the self-checks it summarizes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { yearCheck } from '../../../engine/js/hacrp/history.js';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { newestYear, readJson, REPO_ROOT } from '../../../pipeline/files.js';
import { createContext } from '../../../pipeline/site/context.js';
import { typeset } from '../../../web/render/components.js';
import { withTemp } from '../../../pipeline/test/helpers.js';
import { count, decimal, isoDate, listText } from '../../../web/render/format.js';
import { HISTORY_PINS } from '../pipeline/history.js';
import { FACT_SHEET_CUT, SHORT_NAMES } from '../web/constants.js';
import { COUNT_NOTE } from '../web/links.js';
import { generateHacrp } from '../web/generate.js';
import { historyData, yearRows } from '../web/history-data.js';
import { periodsFigure, pipeline, proofFigure, receipt, receipts, sidesFigure } from '../web/methods-figures.js';
import { ABOVE_BY, METHODS_PATH, methodsPage } from '../web/pages/methods.js';
import { ASSETS } from './fixtures.js';
import { DATA, HD } from './pinned.js';
import { NO_SCORE_AT, SYNTH_FYS, WITHHELD, synthHistory, synthMaster } from './history-fixtures.js';

const quiet = () => {};
const SRC = 'Source: test';
const read = (dir, path) => readFileSync(join(dir, path, 'index.html'), 'utf8');
const text = (s) => s.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
const strip = (markup) => text(markup.replace(/<[^>]+>/g, ''));
const numbers = (s) => Object.values(SHORT_NAMES).reduce((x, name) => x.replaceAll(name, ''), s).match(/[−+]?\d+(,\d{3})*(\.\d+)?%?/g) ?? [];

// A few pinned hospitals are enough for the page build: the history and the Methods page do not depend on them.
const SLICE = { ...DATA, hospitals: DATA.hospitals.slice(0, 40) };
const build = (data) => withTemp('pp-methods-', async (dir) => {
  const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
  await generateHacrp(ctx, { released: true, data, log: quiet });
  return { page: read(dir, METHODS_PATH), program: read(dir, '/hacrp/'), ctx };
});
const WITH = await build(SLICE);
const WITHOUT = await build({ ...SLICE, history: null });
const PAGE = WITH.page;

// ---------- the page ----------

test('the Methods page is written, indexable, with one h1, its ids once and every contents link and aria reference resolving', () => {
  assert.equal(PAGE.match(/<h1[\s>]/g).length, 1);
  assert.ok(PAGE.includes('<h1 class="meth__title">'));
  assert.ok(PAGE.includes('<link rel="canonical" href="https://paidandpenalized.org/hacrp/methods/">'));
  assert.ok(!PAGE.includes('<meta name="robots"'));
  assert.ok(WITH.ctx.indexable.includes(METHODS_PATH));
  const body = PAGE.replace(/<script[\s\S]*?<\/script>/g, '');
  const ids = [...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'ids repeat');
  const refs = [...body.matchAll(/\s(?:aria-labelledby|aria-controls|aria-describedby|for)="([^"]+)"/g)].flatMap((m) => m[1].split(' '));
  assert.deepEqual(refs.filter((r) => !ids.includes(r)), []);
  const levels = [...body.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  assert.ok(levels.every((l, i) => (i === 0 ? l === 1 : l <= levels[i - 1] + 1)), `heading levels ${levels}`);
});

test('the sections run pipeline, check, decisions, formula, estimate, dollars, periods, baseline, reading, sources, changed, glossary, more; the contents list links each', () => {
  const sections = [...PAGE.matchAll(/<section class="doc__sec msec(?: msec--fig)?" id="([^"]+)" aria-labelledby="([^"]+)-h">/g)].map((m) => m[1]);
  assert.deepEqual(sections, ['pipeline', 'check', 'decisions', 'formula', 'estimate', 'dollars', 'periods', 'baseline', 'reading', 'sources', 'changed', 'glossary', 'more']);
  const toc = [...PAGE.matchAll(/<li><a href="#([^"]+)"><span class="doc__toc-n">(\d+)<\/span>/g)].map((m) => [m[1], Number(m[2])]);
  assert.deepEqual(toc.map(([id]) => id), sections);
  assert.deepEqual(toc.map(([, n]) => n), sections.map((_, i) => i + 1));
  for (const id of sections) assert.ok(PAGE.includes(`<h2 class="doc__h" id="${id}-h">`), `${id}: heading`);
  // The family page's estimate section is linked from ours, and ours is the one the family page's "What is shown" points at.
  assert.ok(PAGE.includes('<a href="/methods/#estimate">'));
});

test('"Feedback, privacy and AI" points to the family\'s privacy page and the About page\'s AI section, and no longer says the site keeps nothing about readers', () => {
  const more = /<section class="doc__sec msec" id="more"[\s\S]*?<\/section>/.exec(PAGE)[0];
  assert.match(more, /<a href="\/privacy\/">what the site and its host can see<\/a>/);
  assert.match(more, /<a href="\/about\/#ai">how AI tools are used<\/a>/);
  assert.equal(strip(/<p>[\s\S]*?<\/p>/.exec(more)[0]), 'The same rules for feedback, privacy and AI tools cover every Paid & Penalized site: see what the site and its host can see and how AI tools are used.');
  assert.doesNotMatch(more, /keeps about you|\(nothing\)|href="\/methods\/"/);
});

test('"What changed" links the family\'s corrections log', () => {
  const changed = /<section class="doc__sec msec" id="changed"[\s\S]*?<\/section>/.exec(PAGE)[0];
  assert.match(changed, /<a href="\/corrections\/">corrections log<\/a>/);
  assert.ok(strip(changed).includes('Corrections go in the family’s public, dated corrections log; this site cannot change CMS’s values.'));
});

test('Methods carries the as-of bar the program page shows, the same items, after the page head and the sections', () => {
  const bar = (page) => page.match(/<aside class="asof"[\s\S]*?<\/aside>/g);
  assert.equal(bar(PAGE)?.length, 1, 'one bar');
  assert.deepEqual(bar(PAGE), bar(WITH.program));
  assert.ok(PAGE.indexOf('<aside class="asof"') > PAGE.indexOf('</header>') && PAGE.indexOf('<aside class="asof"') > PAGE.indexOf('id="more"'), 'after the head and the last section');
});

test('the glossary defines "Payment decision (in counts)" once, right after "Subject to the reduction", as the hospitals CMS scored and marked Yes or No', () => {
  const entries = [...PAGE.matchAll(/<div class="glossary__item"><dt>([^<]*)<\/dt><dd>([\s\S]*?)<\/dd><\/div>/g)].map((m) => [text(m[1]), strip(m[2])]);
  const terms = entries.map(([term]) => term);
  assert.equal(terms.filter((t) => t === 'Payment decision (in counts)').length, 1);
  assert.equal(terms.indexOf('Payment decision (in counts)'), terms.indexOf('Subject to the reduction') + 1);
  const definition = entries.find(([term]) => term === 'Payment decision (in counts)')[1];
  assert.match(definition, /^On these pages, a hospital CMS scored and marked Yes or No\. /);
  assert.doesNotMatch(definition, /\d/, 'no number in a definition');
});

test('the nav marks Methods as current and nothing else; the page loads the figure, cite, top-bar and search scripts', () => {
  const bar = /<header class="topbar">[\s\S]*?<\/header>/.exec(PAGE)[0];
  const current = [...bar.matchAll(/data-nav="(\w+)"( aria-current="true")?/g)].filter((m) => m[2]).map((m) => m[1]);
  assert.deepEqual(current, ['methods']);
  assert.deepEqual([...bar.matchAll(/data-nav="(\w+)"/g)].map((m) => m[1]), ['how', 'fy', 'money', 'map', 'history', 'methods']);
  for (const key of ['figure', 'topbar', 'hacrp-search']) assert.ok(PAGE.includes(`src="${ASSETS.js[key]}"`), key);
});

test('the receipt: a line a year, "none" for the year CMS scored no one, and totals that are the self-checks\' sums', () => {
  const card = /<div class="receipt">[\s\S]*?<\/dl>/.exec(PAGE)[0];
  const lines = [...card.matchAll(/<tr><th scope="row">FY(\d+)<\/th><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td class="receipt__ok">([^<]*)<\/td><\/tr>/g)];
  assert.deepEqual(lines.map((m) => Number(m[1])), HD.fys);
  HD.checks.forEach(({ check }, i) => {
    const [, , scored, miss, decided, ok] = lines[i];
    if (!check.scored && !check.decided) assert.deepEqual([scored, miss, decided, ok], ['—', '—', '—', 'none']);
    else assert.deepEqual([scored, miss, decided, ok], [count(check.scored), decimal(check.maxError, 5), count(check.decided), 'ok']);
  });
  // The totals.
  const sum = Object.fromEntries([...card.matchAll(/<div><dt>([^<]*)<\/dt><dd>([^<]*)<\/dd><\/div>/g)].map((m) => [m[1], m[2]]));
  const all = (f) => HD.checks.reduce((n, c) => n + f(c.check), 0);
  assert.equal(sum['Scores recomputed'], count(all((c) => c.scored)));
  assert.equal(sum['Decisions checked'], count(all((c) => c.decided)));
  assert.equal(sum['Out of order'], count(all((c) => c.wrongSide.length)));
  assert.equal(sum['Part withheld by CMS'], count(all((c) => c.withheld.length)));
  assert.equal(sum['Largest miss'], decimal(Math.max(...HD.checks.map((c) => c.check.maxError)), 5));
  assert.equal(sum['Build stops at'], '0.001');
  // The stamp under it.
  assert.ok(PAGE.includes('<p class="stamp">All checks pass</p>'));
});

test('the proof and decision figures, numbered 1 and 2, say the same totals as the receipt', () => {
  const caption = (n) => text(/<figcaption class="fig__cap" id="figure-\d+-cap"><span class="fig__n">Figure \d+\.<\/span> ([^<]*)<\/figcaption>/.exec(new RegExp(`<figure class="fig" id="figure-${n}" data-figure>[\\s\\S]*?</figure>`).exec(PAGE)[0])[1]);
  const scored = HD.checks.reduce((n, c) => n + c.check.scored, 0);
  const decided = HD.checks.reduce((n, c) => n + c.check.decided, 0);
  const first = HD.fys[0];
  const last = HD.fys.at(-1);
  assert.ok(caption(1).includes(`FY${first}–FY${last}`));
  assert.deepEqual(numbers(caption(1)).filter((x) => x !== String(first) && x !== String(last)).slice(0, 1), [count(scored)]);
  assert.ok(numbers(caption(1)).includes(decimal(Math.max(...HD.checks.map((c) => c.check.maxError)), 5)));
  assert.ok(numbers(caption(2)).includes(count(decided)));
  assert.ok(numbers(caption(2)).includes('0'), 'none out of order');
  assert.deepEqual([...PAGE.matchAll(/<figure class="fig" id="figure-(\d+)" data-figure>/g)].map((m) => Number(m[1])), [1, 2, 3, 4, 5], 'the proof strips, the decision rules, the payment order, the back-test and the periods');
});

test('the notes under the check state what the checks found: the rows withheld, CMS\'s rule for the line and where its line sits against it, and the biggest tie at the line', () => {
  const paragraphs = [...PAGE.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => strip(m[1]));
  const withheldYears = HD.checks.filter((c) => c.check.withheld.length).map((c) => `FY${c.fy}`);
  const nWithheld = HD.checks.reduce((n, c) => n + c.check.withheld.length, 0);
  const withheld = paragraphs.find((p) => p.includes('CMS left one part out of its file with a footnote'));
  assert.ok(withheld, 'a note about the withheld rows');
  assert.ok(withheld.includes(withheldYears.join(' and ')) && withheld.includes(count(nWithheld)), withheld);
  assert.deepEqual(withheldYears, ['FY2016', 'FY2017']);
  // CMS's rule for the line, then the years the decided scores' 75th percentile reproduces the cut, and the years
  // CMS's line sits above it, by how many hospitals scored above the percentile and were not cut.
  assert.ok(paragraphs.some((p) => p.startsWith('CMS puts its line at the 75th percentile of the scores of hospitals outside Maryland')));
  const decided = HD.checks.filter((c) => c.check.yes);
  const on = decided.filter((c) => c.check.p75InGap).map((c) => `FY${c.fy}`);
  assert.deepEqual(on, ['FY2015', 'FY2016'], 'the years the published scores reproduce the cut: true of the committed files');
  const onNote = paragraphs.find((p) => p.includes('reproduce the cut exactly'));
  assert.ok(onNote, 'a note about the years the percentile reproduces the cut');
  assert.ok(onNote.includes(listText(on)), `${onNote} vs ${on}`);
  const off = decided.filter((c) => !c.check.p75InGap);
  assert.ok(off.every((c) => c.check.aboveNotCut > 0), 'off the percentile, CMS\'s line is always above it, never below');
  const well = off.filter((c) => c.check.aboveNotCut / c.check.decided > ABOVE_BY);
  const few = off.filter((c) => !well.includes(c));
  assert.deepEqual(well.map((c) => c.fy), [2017, 2018], 'the two years well above: true of the committed files');
  const span = (cs) => cs.map((c) => c.check.aboveNotCut);
  const fewNote = paragraphs.find((p) => p.includes('a little above the percentile'));
  assert.ok(fewNote.includes(listText(few.map((c) => `FY${c.fy}`))) && fewNote.includes(`${count(Math.min(...span(few)))} to ${count(Math.max(...span(few)))} hospitals`), fewNote);
  const wellNote = paragraphs.find((p) => p.includes('further above'));
  assert.ok(wellNote.includes(listText(well.map((c) => `FY${c.fy}`))) && wellNote.includes(`${count(Math.min(...span(well)))} to ${count(Math.max(...span(well)))} hospitals`), wellNote);
  assert.ok(paragraphs.some((p) => p.startsWith('This site can’t say why')));
  assert.ok(off.length < 3 || listText(off.map((c) => `FY${c.fy}`)) === `${off.slice(0, -1).map((c) => `FY${c.fy}`).join(', ')}, and FY${off.at(-1).fy}`, 'the site\'s one list joiner, as the what-if writes lists');
  // The most hospitals tied at the line: the year, how many, and the score.
  const ties = [...HD.checks].sort((a, b) => b.check.atLine - a.check.atLine)[0];
  const tieNote = paragraphs.find((p) => p.startsWith('Ties matter'));
  assert.ok(tieNote);
  for (const x of [String(ties.fy), count(ties.check.atLine), decimal(ties.check.highestNo, 4)]) assert.ok(tieNote.includes(x), `${x} in "${tieNote}"`);
  // "For most" of the withheld rows is a Maryland hospital's PSI 90 score: true of the committed files.
  const rows = HD.checks.filter((c) => c.check.withheld.length).flatMap((c) => {
    const state = new Map(yearRows(DATA.history.years.find((y) => y.fy === c.fy)).map((r) => [r.ccn, r.state]));
    return c.check.withheld.map((ccn) => state.get(ccn));
  });
  assert.ok(rows.filter((s) => s === 'MD').length > rows.length / 2, `${rows.filter((s) => s === 'MD').length} of ${rows.length} withheld rows are Maryland's`);
});

test('the count note: CMS\'s fact-sheet count and the updated list\'s for the year they differ, under its anchor, linked from the program page\'s roll call', () => {
  const year = HD.checks.find((c) => c.fy === FACT_SHEET_CUT.fy);
  assert.notEqual(year.check.yes, FACT_SHEET_CUT.cut, 'the updated list differs from the fact sheet: true of the committed files');
  assert.equal(HD.counts[HD.fys.indexOf(FACT_SHEET_CUT.fy)].cut, year.check.yes, 'the roll call counts what the check counts');
  const note = PAGE.match(new RegExp(`<p id="${COUNT_NOTE}">([\\s\\S]*?)</p>`));
  assert.ok(note, 'the note, under its anchor');
  for (const x of [`fiscal year ${FACT_SHEET_CUT.fy}`, count(FACT_SHEET_CUT.cut), count(year.check.yes)]) assert.ok(strip(note[1]).includes(x), `${x} in "${strip(note[1])}"`);
  assert.equal(WITH.program.split(`<a href="${METHODS_PATH}#${COUNT_NOTE}">`).length, 2, 'the roll call links to it, once');
  assert.ok(!WITHOUT.program.includes(`#${COUNT_NOTE}`) && !WITHOUT.page.includes(`id="${COUNT_NOTE}"`), 'without the history, neither');
});

test('the estimate section: what is shown, where it comes from and how it is labeled, and the tolerance and largest miss from the estimate', () => {
  const section = /<section class="doc__sec msec" id="estimate"[\s\S]*?<\/section>/.exec(PAGE)[0];
  const rows = [...section.matchAll(/<tr><th scope="row">[^<]*<\/th><td>[\s\S]*?<\/td><td><span class="takes__tag takes__tag--(\w+)">/g)].map((m) => m[1]);
  assert.equal(rows.length, 8, 'CMS\'s values, its line, the recomputes, the derived constants, the medians, the what-ifs, earlier years and the dollar estimates');
  assert.deepEqual([...new Set(rows)].sort(), ['cms', 'hyp', 'site']);
  // The dollar estimates are a row of their own, made by this site and labeled as an estimate with a likely range.
  assert.match(section, /<th scope="row">Dollar estimates<\/th><td>Made by this site from CMS’s payment files<\/td><td><span class="takes__tag takes__tag--site">Estimate, with a likely range</);
  // The estimate tag is also on every dollar figure: a sentence says so, its section's name linking to that section.
  assert.match(section, /Every dollar figure carries the tag too: the dollars are this site’s estimate, explained under <a href="#dollars">How this site estimates the dollars<\/a>\./);
  const tagged = MEASURE_IDS.filter((id) => DATA.estimate[id].tagged);
  const body = strip(section);
  assert.ok(body.includes(tagged.map((id) => SHORT_NAMES[id]).join(' and ')), tagged.join());
  assert.ok(body.includes(decimal(Math.max(...tagged.map((id) => DATA.estimate[id].maxError)), 4)));
  assert.ok(body.includes('0.001'));
  assert.ok(section.includes(DATA.boundaryText.highestNo) && section.includes(DATA.boundaryText.lowestYes), 'CMS\'s own text for the line, kept whole');
});

test('the changes and the sources: every changelog entry with its date and items, every pin the history reads with its size and fingerprint', () => {
  const changed = /<ol class="changes" role="list">[\s\S]*?<\/ol>\n/.exec(PAGE)[0];
  assert.equal([...changed.matchAll(/<p class="changes__date">/g)].length, DATA.changes.length);
  for (const c of DATA.changes) {
    assert.ok(changed.includes(`<p class="changes__date">${isoDate(c.date)}</p>`), c.date);
    // Each item is typeset as copy is (curly apostrophes and quotes, z‑score with a non-breaking hyphen).
    for (const item of c.items) assert.ok(strip(changed).includes(typeset(item)), item);
  }
  assert.doesNotMatch(strip(changed), /\w'\w|z-score/, 'no straight apostrophe inside a word, no breaking hyphen in z-score');
  assert.match(strip(changed), /\w’\w/, 'the entries do hold apostrophes, set curly');
  const sources = /<table class="gb receipts">[\s\S]*?<\/table>/.exec(PAGE)[0];
  const manifest = DATA.manifest;
  for (const pin of HISTORY_PINS.flatMap((p) => [p.id, p.cutList]).filter(Boolean)) {
    const entry = manifest.find((e) => e.id === pin);
    assert.ok(sources.includes(`<code>${entry.sha256.slice(0, 16)}…</code>`), `${pin}: fingerprint`);
    assert.ok(sources.includes(`<td class="num">${count(entry.bytes)}</td>`), `${pin}: size`);
  }
  // The table lists the pins the HACRP pages read, not every pin.
  assert.equal([...sources.matchAll(/<tr><th scope="row">/g)].length, DATA.pinsUsed.length);
  // Every pin is one a page declares (in a `sources` list that feeds pinsUsed): the dollar estimates' sources joined
  // when the pages began to load them. This does not catch a page that reads a pin without declaring it.
  const used = new Set(DATA.pinsUsed.map((e) => e.id));
  assert.deepEqual(manifest.filter((e) => !used.has(e.id)).map((e) => e.id), []);
  // Only the newest year's dollars file is read (the pages load that one); an older year's file keeps the sources it
  // was built from and is not held to the pages' list.
  const dollarsSources = readJson(`${REPO_ROOT}data/emitted/dollars/fy${newestYear('data/emitted/dollars')}/dollars.json`).sources;
  for (const id of dollarsSources) assert.ok(used.has(id), `${id}: a dollar estimates source the Methods page lists`);
});

test('the pipeline\'s six stations carry the newest year\'s real numbers', () => {
  const stations = [.../<ol class="pipe" role="list">[\s\S]*?<\/ol>/.exec(PAGE)[0].matchAll(/<li class="pipe__st( pipe__st--check)?">\n<p class="pipe__n">(\d)<\/p>\n<p class="pipe__name">([^<]*)<\/p>\n<p class="pipe__value">([^<]*)<\/p>/g)];
  assert.deepEqual(stations.map((m) => m[2]), ['1', '2', '3', '4', '5', '6']);
  assert.deepEqual(stations.map((m) => Boolean(m[1])), [false, false, false, false, true, false], 'the check stands out');
  const last = HD.checks.at(-1).check;
  const pin = DATA.manifest.find((e) => e.id === DATA.source.id);
  assert.ok(stations[0][4].includes(count(DATA.sourceRows)));
  assert.ok(stations[1][4].includes(count(pin.bytes)));
  assert.ok(stations[2][4].includes(String(MEASURE_IDS.length)));
  assert.ok(stations[3][4].includes(count(last.scored)));
  assert.ok(stations[4][4].includes(decimal(last.maxError, 5)));
  assert.ok(PAGE.includes(`<span class="nw">${pin.sha256.slice(0, 12)}…</span>`));
  // The fingerprint's note: the algorithm and the fingerprint, then the consequence after a middle dot.
  assert.match(PAGE, /<p class="pipe__note">Fingerprint \([^)]+\) <span class="nw">[0-9a-f]{12}…<\/span> · if one byte changes, the tests fail<\/p>/);
  assert.ok(stations[5][4].includes(count(WITH.ctx.pages)), 'the pages the build wrote: the program page, Methods, the dictionary, every hospital and every place');
});

test('the periods figure: a row a year with the dates behind it, and the lead from the newest year\'s data to its payment year', () => {
  const fig = /<figure class="fig" id="figure-5" data-figure>[\s\S]*?<\/figure>/.exec(PAGE)[0];
  const rows = [...fig.slice(fig.indexOf('<tbody>')).matchAll(/<tr>(.*?)<\/tr>/gs)].map(([, tr]) => [...tr.matchAll(/<t[dh][^>]*>([^<]*)</g)].map((c) => text(c[1])));
  assert.equal(rows.length, HD.fys.length);
  assert.deepEqual(rows.map((r) => r[0]), HD.fys.map((fy) => `FY${fy}`));
  assert.ok(rows.every((r) => r.length === 4));
  // The payment year runs October 1 of the year before to September 30.
  rows.forEach((r, i) => assert.ok(r[3].includes(`October 1, ${HD.fys[i] - 1}`) && r[3].includes(`September 30, ${HD.fys[i]}`), r[3]));
  // The lead, in months, from the earliest start of the newest year's two periods to October 1 of the year before it.
  const newest = HD.years.at(-1).periods;
  const start = (d) => { const [m, , y] = d.split('/').map(Number); return y * 12 + m; };
  const lead = (HD.fys.at(-1) - 1) * 12 + 10 - Math.min(start(newest.psi90.start), start(newest.hai.start));
  const take = text(/<figcaption[^>]*>[\s\S]*?<\/figcaption>/.exec(fig)[0].replace(/<[^>]+>/g, ''));
  assert.ok(numbers(take).includes(String(lead)), `${lead} months in "${take}"`);
  // The three bars are named by their ink in a line under the chart (a note, not a swatch key).
  assert.match(text(/fig__note">([^<]*)</.exec(fig)[1]), new RegExp(`^Gray: ${SHORT_NAMES.PSI90} claims\\. Black: infection reports\\. Red: the fiscal year the cut applies\\.$`));
  assert.doesNotMatch(fig, /fig__key/);
});

// ---------- without the history ----------

test('a build without the history still writes the Methods page: the newest year\'s check alone, in the one-year words', () => {
  const page = WITHOUT.page;
  assert.equal(page.match(/<h1[\s>]/g).length, 1);
  const card = /<div class="receipt">[\s\S]*?<\/dl>/.exec(page)[0];
  assert.deepEqual([...card.matchAll(/<tr><th scope="row">FY(\d+)<\/th>/g)].map((m) => Number(m[1])), [DATA.fy]);
  assert.deepEqual([...page.matchAll(/<figure class="fig" id="figure-(\d+)"/g)].map((m) => Number(m[1])), [1, 2, 3, 4, 5]);
  assert.match(page, new RegExp(`This site recomputed [\\d,]+ scores for fiscal year ${DATA.fy}`));
  assert.match(page, new RegExp(`Of the [\\d,]+ payment decisions CMS published for fiscal year ${DATA.fy}`));
  // No withheld rows to count, so none are reported; the page names no other year.
  assert.doesNotMatch(page, /footnoted a part/);
  assert.doesNotMatch(WITHOUT.program, /id="history"/);
});

// ---------- the figures on the synthetic history ----------

const S = historyData({ history: synthHistory(), master: synthMaster() });
const checksOf = (hd = S) => hd.checks.map((c) => ({ fy: c.fy, rule: 'Average of the z-scores', check: c.check }));
const figCaption = (fig) => text(/<figcaption[^>]*>[\s\S]*?<\/figcaption>/.exec(String(fig))[0].replace(/<[^>]+>/g, '').replace(/^Figure \d+\.\s*/, ''));
const tableOf = (fig) => {
  const s = String(fig);
  return [...s.slice(s.indexOf('<tbody>')).matchAll(/<tr>(.*?)<\/tr>/gs)].map(([, tr]) => [...tr.matchAll(/<t[dh][^>]*>([^<]*)</g)].map((c) => text(c[1])));
};

test('proofFigure: a row a year of scores recomputed, within the limit, the largest miss, the rows withheld and the rule; the year CMS scored no one says so', () => {
  const checks = checksOf();
  const fig = proofFigure(checks, { n: 1, source: SRC });
  const rows = tableOf(fig);
  assert.equal(rows.length, S.fys.length);
  checks.forEach(({ fy, check }, i) => assert.deepEqual(rows[i], [`FY${fy}`, count(check.scored), count(check.within), decimal(check.maxError, 5), count(check.withheld.length), 'Average of the z-scores']));
  assert.deepEqual(rows[WITHHELD.at].slice(4, 5), ['1']);
  assert.deepEqual(rows[NO_SCORE_AT].slice(1), ['0', '0', '0.00000', '0', 'Average of the z-scores']);
  const scores = checks.reduce((n, c) => n + c.check.scored, 0);
  assert.ok(numbers(figCaption(fig)).includes(count(scores)));
  assert.ok(figCaption(fig).includes('FY2021–FY2025'));
  assert.ok(String(fig).includes('CMS scored no hospital'), 'the no-score year\'s note in the strips');
  // A single year has the one-year takeaway.
  const one = proofFigure([checks[0]], { n: 1, source: SRC });
  assert.match(figCaption(one), /for fiscal year 2021/);
  assert.ok(numbers(figCaption(one)).includes(count(checks[0].check.scored)));
});

test('sidesFigure: a row a year of decisions, the cut, the highest score not cut, the lowest cut, those out of order and the line as a percentile', () => {
  const checks = checksOf();
  const fig = sidesFigure(checks, { n: 2, source: SRC });
  const rows = tableOf(fig);
  checks.forEach(({ fy, check: c }, i) => {
    assert.deepEqual(rows[i].slice(0, 3), [`FY${fy}`, count(c.decided), count(c.yes)]);
    assert.equal(rows[i][5], count(c.wrongSide.length));
    if (c.yes) {
      assert.equal(rows[i][3], decimal(c.highestNo, 4));
      assert.equal(rows[i][4], decimal(c.lowestYes, 4));
      assert.equal(rows[i][6], decimal(c.linePctDecided * 100, 1));
    } else assert.deepEqual([rows[i][3], rows[i][4], rows[i][6]], ['', '', ''], `FY${fy}: no cut, no line`);
  });
  const decided = checks.reduce((n, c) => n + c.check.decided, 0);
  assert.ok(numbers(figCaption(fig)).includes(count(decided)));
  assert.ok(String(fig).includes('No hospital cut'));
  assert.match(figCaption(sidesFigure([checks[0]], { n: 1, source: SRC })), /fiscal year 2021/);
  // A decision out of order is counted in the takeaway.
  const bad = yearCheck([{ ccn: '990001', total: 5, recomputed: 5, decision: 'Yes' }, { ccn: '990002', total: 9, recomputed: 9, decision: 'No' }]);
  assert.ok(numbers(figCaption(sidesFigure([{ fy: 2025, rule: 'x', check: bad }], { n: 1, source: SRC }))).includes('2'), 'both ends of the swap');
});

test('periodsFigure: every year\'s two data periods and its payment year; a period CMS gave none for is said so; the lead is from the newest year', () => {
  const years = S.years.map((y, i) => ({ fy: y.fy, periods: i === 1 ? { psi90: null, hai: y.periods.hai } : y.periods }));
  const fig = periodsFigure(years, { n: 3, source: SRC });
  const rows = tableOf(fig);
  assert.equal(rows.length, years.length);
  assert.ok(rows[0][1].includes('July 1, 2019') && rows[0][1].includes('June 30, 2021'));
  assert.ok(rows[0][3].includes('October 1, 2020') && rows[0][3].includes('September 30, 2021'));
  assert.ok(!rows[1][1].includes('2019'), 'no PSI 90 period in FY2022');
  // Newest year FY2025: data from July 2019, payment from October 2024: 5 years and 3 months earlier.
  assert.ok(numbers(figCaption(fig)).includes('63'), figCaption(fig));
});

test('pipeline: six numbered stations, the fifth the check, each with the number it is given', () => {
  const check = S.checks.at(-1).check;
  const out = String(pipeline({ rows: 3055, source: { id: 'abcd-1234', pdcReleased: '2026-08-13' }, pin: { bytes: 595701, sha256: 'a'.repeat(64) }, measures: 6, check, pages: 3500 }));
  const stations = [...out.matchAll(/<li class="pipe__st( pipe__st--check)?">/g)];
  assert.equal(stations.length, 6);
  assert.equal(stations.findIndex((m) => m[1]), 4);
  for (const x of ['3,055', '595,701', 'abcd-1234', 'August 13, 2026', `${'a'.repeat(12)}…`, count(check.scored), decimal(check.maxError, 5), count(check.decided), '3,500']) assert.ok(out.includes(x), x);
  assert.deepEqual([...out.matchAll(/<p class="pipe__n">(\d)<\/p>/g)].map((m) => m[1]), ['1', '2', '3', '4', '5', '6']);
});

test('receipts: a row for each pin with its size and the start of its fingerprint, linked where the pin has an address', () => {
  const pins = [
    { title: 'A file <one>', bytes: 1234567, sha256: '0123456789abcdef'.repeat(4), retrieved: '2026-10-01', landingPage: 'https://example.org/a' },
    { title: 'Another', bytes: 12, sha256: 'f'.repeat(64), retrieved: '2026-10-02', downloadUrl: 'https://example.org/b.csv' },
    { title: 'No address', bytes: 0, sha256: 'e'.repeat(64), retrieved: '2026-10-03' },
  ];
  const out = String(receipts(pins));
  assert.equal([...out.matchAll(/<tr><th scope="row">/g)].length, 3);
  assert.ok(out.includes('<a href="https://example.org/a">A file &lt;one&gt;</a>'), 'escaped, linked');
  assert.ok(out.includes('<a href="https://example.org/b.csv">Another</a>'));
  assert.ok(out.includes('<th scope="row">No address</th>'));
  assert.ok(out.includes('<td class="num">1,234,567</td>'));
  assert.ok(out.includes('<code>0123456789abcdef…</code>'));
  assert.ok(out.includes('October 3, 2026') || out.includes('2026-10-03'));
});

test('receipt: the year CMS scored no one is "none" with dashes, a year that fails says so, and the withheld line appears only when rows were withheld', () => {
  const checks = checksOf();
  const out = String(receipt(checks));
  const lines = [...out.matchAll(/<tr><th scope="row">FY(\d+)<\/th><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td class="receipt__ok">([^<]*)<\/td><\/tr>/g)];
  assert.equal(lines.length, 5);
  assert.deepEqual(lines[NO_SCORE_AT].slice(2), ['—', '—', '—', 'none']);
  assert.ok(lines.filter((_, i) => i !== NO_SCORE_AT).every((m) => m[5] === 'ok'));
  assert.ok(out.includes('<dt>Part withheld by CMS</dt><dd>1</dd>'));
  // Without a withheld row, no such line; with an unexplained miss, the year fails.
  const clean = checks.map((c) => ({ ...c, check: { ...c.check, withheld: [] } }));
  assert.ok(!String(receipt(clean)).includes('Part withheld by CMS'));
  const miss = yearCheck([{ ccn: '990001', total: 1, recomputed: 1.5, decision: 'No' }, { ccn: '990002', total: 2, recomputed: 2, decision: 'Yes' }]);
  const failing = String(receipt([...checks.slice(0, 1), { fy: 2030, rule: 'x', check: miss }]));
  assert.match(failing, /<th scope="row">FY2030<\/th><td>2<\/td><td>0\.50000<\/td><td>2<\/td><td class="receipt__ok">fail<\/td>/);
  assert.ok(failing.includes('<dt>Largest miss</dt><dd>0.50000</dd>'));
});

test('methodsPage direct: the same page from the synthetic history, with the totals of its own checks', () => {
  const checks = checksOf();
  const years = S.years.map((y) => ({ fy: y.fy, periods: y.periods }));
  const pin = DATA.manifest.find((e) => e.id === DATA.source.id);
  const page = methodsPage({
    fy: 2025, checks, years, newest: { rows: 3, source: DATA.source, periods: DATA.periods, pin, measures: 6, pages: 10, sourceLine: SRC },
    pins: [pin], changes: DATA.changes, estimate: { tolerance: 0.001, tagged: 'PSI 90', maxError: 0.002 }, boundaryText: DATA.boundaryText, eqFy: 2020, zFy: 2018,
    robots: null, assets: ASSETS, searchUrl: '/assets/h.json',
  });
  assert.equal(page.match(/<h1[\s>]/g).length, 1);
  const total = checks.reduce((n, c) => n + c.check.scored, 0);
  assert.ok(page.includes(`<dt>Scores recomputed</dt><dd>${count(total)}</dd>`));
  assert.ok(page.includes('<dt>Part withheld by CMS</dt><dd>1</dd>'));
  assert.match(page, /<section class="doc__sec msec" id="estimate"/);
  // Without the dollar estimates there is no dollars section, and no sentence pointing at one.
  assert.doesNotMatch(page, /id="dollars"/);
  assert.doesNotMatch(page, /href="#dollars"/);
  assert.doesNotMatch(page, /Every dollar figure carries the tag/);
});

test('the line notes say which side of the percentile CMS\'s line sits: a year with no hospital above the percentile left uncut, or none left uncut at all, sits below it', () => {
  const base = HD.checks.filter((c) => c.check.yes);
  // Patch the two newest years, leaving the others (the years well above among them) as they are.
  assert.ok(base.length >= 4, 'the committed history has the years this test patches');
  const at = (c, over) => ({ ...c, check: { ...c.check, ...over } });
  // One year where CMS cut everyone above the percentile and more (none above it uncut, off its gap), one where it cut
  // every hospital it decided on (no uncut hospital, so no side to say).
  const lower = at(base.at(-1), { p75InGap: false, aboveNotCut: 0 });
  const allCut = at(base.at(-2), { p75InGap: false, aboveNotCut: null });
  const checks = HD.checks.map((c) => (c.fy === lower.fy ? lower : c.fy === allCut.fy ? allCut : c));
  const pin = DATA.manifest.find((e) => e.id === DATA.source.id);
  const page = methodsPage({
    fy: 2026, checks, years: HD.years ?? DATA.history.years.map((y) => ({ fy: y.fy, periods: y.periods })), newest: { rows: 3, source: DATA.source, periods: DATA.periods, pin, measures: 6, pages: 10, sourceLine: SRC },
    pins: [pin], changes: DATA.changes, estimate: { tolerance: 0.001, tagged: 'PSI 90', maxError: 0.002 }, boundaryText: DATA.boundaryText, eqFy: 2020, zFy: 2018,
    robots: null, assets: ASSETS, searchUrl: '/assets/h.json',
  });
  const paragraphs = [...page.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => strip(m[1]));
  const lowerNote = paragraphs.find((p) => p.includes('sits below the percentile'));
  assert.ok(lowerNote && lowerNote.includes(`FY${lower.fy}`) && lowerNote.includes(`FY${allCut.fy}`), lowerNote);
  assert.ok(paragraphs.some((p) => p.startsWith('This site can’t say why')));
  for (const key of ['a little above the percentile', 'further above']) {
    const note = paragraphs.find((p) => p.includes(key));
    assert.ok(note, `the note "${key}" is still there for the other years`);
    assert.ok(!note.includes(`FY${lower.fy}`) && !note.includes(`FY${allCut.fy}`), note);
  }
});
