// The TEAM program page's Part 4 (web/program/bar.js): the picker server-rendered on BAR_DRG with its label, the price
// beside the words and Figure 4 from the emitted file's prices in the region of the hospital the calculator starts with (its region follows the calculator's hospital in the browser),
// the map shading regions only, and the table of every episode type's price in every region (its All rows, the derived
// one marked). Prices and counts come from the file; failures print counts and DRGs, never a hospital.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIVISIONS } from '../../../engine/js/divisions.js';
import { CATEGORIES } from '../../../engine/js/team/params.js';
import { textOf } from '../../../pipeline/site/html.js';
import { testAssets } from '../../../pipeline/test/helpers.js';
import { roundedDollars } from '../../../web/render/format.js';
import { BAR_DRG } from '../web/constants.js';
import { loadAtlas, loadMaster, loadTeam } from '../web/data.js';
import { programPage } from '../web/pages/program.js';
import { drgsByCategory, readerDivision } from '../web/program/bar.js';
import { extremes } from '../web/program/bar-data.js';

const team = loadTeam();
const search = { cols: ['ccn', 'name', 'city', 'state', 'kind'], rows: [[team.defaultCcn, 'Example Hospital', null, 'KY', 'acute']], states: {} };
const program = programPage({ team, master: loadMaster(), atlas: loadAtlas(), robots: 'noindex', assets: testAssets(), lookupUrl: '/assets/team-lookup.test.json', calcUrl: '/assets/team-calc.test.json', search });
// The text as a reader sees it: inline spans (the parts the script rewrites) add no space.
const words = (html) => textOf(html.replace(/<\/?span\b[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
const at = program.indexOf('<section class="tm-part" id="bar"');
const bar = program.slice(at, program.indexOf('<section class="tm-part"', at + 1));
const figure = /<figure class="fig"[\s\S]*?<\/figure>/.exec(bar)[0];
const all = /<details class="tm-all"[\s\S]*?<\/details>/.exec(bar)[0];
const reader = readerDivision(team);
const prices = team.prices[BAR_DRG];
const nameOf = (div) => DIVISIONS[div - 1][0];

test('BAR_DRG is an episode type in the price file, and the reader\'s region is the default hospital\'s division', () => {
  assert.ok(Object.hasOwn(team.prices, BAR_DRG));
  const row = team.participants.find((p) => p.ccn === team.defaultCcn);
  assert.equal(reader, row.division);
  assert.ok(reader >= 1 && reader <= DIVISIONS.length);
});

test('the picker: a labeled select, server-rendered on BAR_DRG, every episode type an option, grouped by category', () => {
  const picker = /<p class="tm-pick" data-bar-picker hidden>[\s\S]*?<\/p>/.exec(bar)?.[0];
  assert.ok(picker, 'the picker, hidden until the script shows it');
  assert.match(picker, /<label for="bar-drg">Episode type<\/label>/);
  assert.match(picker, /<select id="bar-drg" data-bar-pick>/);
  const options = [...picker.matchAll(/<option value="(\d+)"( selected)?>(\d+) · ([^<]+)<\/option>/g)];
  assert.deepEqual(options.filter((m) => m[2]).map((m) => m[1]), [BAR_DRG], 'DRG 470 alone selected');
  assert.ok(options.every((m) => m[1] === m[3]));
  // Each option names its episode type's category, in the category words the sentences use.
  assert.equal(options.find((m) => m[1] === BAR_DRG)[4], 'lower extremity joint replacement');
  for (const m of options) assert.match(picker, new RegExp(`data-cat="${m[4]}">[\\s\\S]*?value="${m[1]}"`), `DRG ${m[1]} under its own category`);
  assert.deepEqual(options.map((m) => m[1]).sort(), Object.keys(team.prices).sort(), 'every episode type in the file, once');
  const groups = [...picker.matchAll(/<optgroup label="([^"]+)" data-cat="([^"]+)">([\s\S]*?)<\/optgroup>/g)];
  assert.equal(groups.length, CATEGORIES.length);
  drgsByCategory(team).forEach(({ drgs }, i) => {
    assert.deepEqual([...groups[i][3].matchAll(/value="(\d+)"/g)].map((m) => m[1]), drgs, `category ${i + 1}'s DRGs, in number order`);
  });
});

test('the price beside the words: BAR_DRG in the reader\'s region, from the file, with its sentence', () => {
  const now = words(/<p class="tm-now"[\s\S]*?<\/p>/.exec(bar)[0]);
  assert.ok(now.startsWith(roundedDollars(prices[reader])), now.slice(0, 20));
  assert.match(now, new RegExp(`for DRG ${BAR_DRG} \\(lower extremity joint replacement\\) in ${nameOf(reader)}, the region of the hospital in the calculator below\\. Standardized dollars\\.`));
  // One announcement per pick: the script rewrites the paragraph a span at a time, and the region is read whole.
  assert.match(bar, /<p class="tm-now" aria-live="polite" aria-atomic="true">/);
});

test('Figure 4: the nine regions shaded by BAR_DRG\'s prices, each labeled, the reader\'s outlined; regions only, never a hospital', () => {
  const caption = words(/<figcaption[\s\S]*?<\/figcaption>/.exec(figure)[0]);
  const { lo, hi } = extremes(prices);
  assert.equal(caption, `Figure 4. DRG ${BAR_DRG} (lower extremity joint replacement): 2027’s preliminary target price in each of the nine regions, from ${roundedDollars(prices[lo])} in ${nameOf(lo)} to ${roundedDollars(prices[hi])} in ${nameOf(hi)}.`);
  for (const fit of ['narrow', 'wide']) {
    const svg = new RegExp(`<svg role="img" aria-label="[^"]+" data-fit="${fit}" class="chart chart--division-map"[\\s\\S]*?</svg>`).exec(figure)?.[0];
    assert.ok(svg, `the ${fit} drawing`);
    const marks = [...svg.matchAll(/data-div="(\d)" data-value="([^"]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
    assert.deepEqual(marks.map(([div]) => div), [1, 2, 3, 4, 5, 6, 7, 8, 9], `${fit}: all nine regions`);
    for (const [div, v] of marks) assert.equal(v, prices[div], `${fit}: region ${div}`);
    for (let div = 1; div <= 9; div++) assert.match(svg, new RegExp(`class="chart-div__price" data-div="${div}"[^>]*>\\${roundedDollars(prices[div])}<`));
    assert.match(svg, /class="chart-div chart-div--s\d chart-div--reader"/);
    assert.equal([...svg.matchAll(/chart-div--reader/g)].length, 1);
    assert.match(svg, /<path class="chart-div__reader" d="M/);
    // Nothing on the map is a hospital: no dot, no CCN.
    assert.doesNotMatch(svg, /chart-dots|data-ccn|data-href/);
  }
  assert.ok(figure.indexOf('chart-div--reader') > 0 && /data-div="(\d)" data-value="[^"]+"><title>[^<]+<\/title><path class="chart-div chart-div--s\d chart-div--reader"/.exec(figure)[1] === String(reader));
  // The figure's table: every region's price (figure() also checks every plotted value is in it).
  const rows = [...figure.matchAll(/<th scope="row">([^<]+)<\/th><td>[^<]+<\/td><td class="num" data-value="([^"]+)" data-div="(\d)">([^<]+)<\/td>/g)];
  assert.deepEqual(rows.map((m) => [m[1], Number(m[2]), Number(m[3])]), DIVISIONS.map(([name], i) => [name, prices[i + 1], i + 1]));
  assert.match(words(figure), /Standardized dollars\./);
  assert.match(words(figure), /Target price, standardized dollars/);
  assert.match(words(figure), new RegExp(`Outlined: ${nameOf(reader)}, the region of the hospital in the calculator\\. CMS prices Puerto Rico and the other territories with the Pacific region\\.`));
});

test('the table of every price: every episode type × every region from the file, each category\'s All row, the derived one marked', () => {
  const n = Object.keys(team.prices).length;
  assert.match(words(/<summary>[\s\S]*?<\/summary>/.exec(all)[0]), new RegExp(`^All ${n} episode types × ${DIVISIONS.length} regions$`));
  const head = [...all.matchAll(/<th scope="col" data-div="(\d)"[^>]*>/g)].map((m) => Number(m[1]));
  assert.deepEqual(head, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const rows = [...all.matchAll(/<tr data-drg="(\d+)"><th scope="row">DRG \1<\/th>([\s\S]*?)<\/tr>/g)];
  assert.equal(rows.length, n);
  let cells = 0;
  for (const [, drg, body] of rows) {
    const values = [...body.matchAll(/<td class="num[^"]*" data-value="([^"]+)">([^<]+)<\/td>/g)];
    assert.equal(values.length, DIVISIONS.length, `DRG ${drg}`);
    values.forEach(([, raw, text], i) => {
      assert.equal(Number(raw), team.prices[drg][i + 1], `DRG ${drg}, region ${i + 1}`);
      assert.equal(text, roundedDollars(team.prices[drg][i + 1]));
    });
    cells += values.length;
  }
  assert.equal(cells, n * DIVISIONS.length, `${cells} price cells`);
  // One All row per category, in category order, CMS's except where the file derived it.
  const avg = [...all.matchAll(/<tr class="tm-all__avg"( data-derived)?><th scope="row">([\s\S]*?)<\/th>([\s\S]*?)<\/tr>/g)];
  assert.equal(avg.length, CATEGORIES.length);
  avg.forEach(([, derived, label, body], i) => {
    const cat = CATEGORIES[i];
    const isDerived = team.categoryAvgDerived.includes(cat);
    assert.equal(Boolean(derived), isDerived, cat);
    assert.equal(words(label), isDerived ? 'All, this site’s mean*' : 'All, CMS’s row', cat);
    assert.deepEqual([...body.matchAll(/data-value="([^"]+)"/g)].map((m) => Number(m[1])), DIVISIONS.map((_, d) => team.categoryAvg[cat][d + 1]), cat);
  });
  assert.deepEqual(team.categoryAvgDerived, ['SPINAL'], 'the file derives spinal fusion\'s alone');
  assert.match(words(all), /\* CMS’s file has a row named All for each category but spinal fusion\. For spinal fusion, the All row here is the plain mean of the category’s episode types’ prices: this site’s arithmetic, not CMS’s\./);
  // The reader's region: its column shaded, head and cells.
  assert.equal([...all.matchAll(/tm-all__mine/g)].length, 1 + n + CATEGORIES.length);
  assert.match(all, new RegExp(`<th scope="col" data-div="${reader}" class="tm-all__mine">`));
  assert.match(words(all), /Standardized dollars\./);
});
