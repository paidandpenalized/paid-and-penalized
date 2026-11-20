// The work-requirement Methods page: every section the method needs (its steps and parameters printed from the file's
// params, what it can't tell you, the lines 2 + 5 version and the other sensitivities with their numbers, who has no
// scenario and why, Maryland, the screens, the safety-net flag, the "exposed on both" rule with its constants and the
// population of its cut, the sources with each pin's SHA-256, the citation and the corrections link), and the as-of line
// both pages carry. Numbers are read from the file and formatted as the page formats them; no hospital is named.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../../pipeline/files.js';
import { textOf } from '../../../pipeline/site/html.js';
import { testAssets } from '../../../pipeline/test/helpers.js';
import { count, isoDate, money, pct } from '../../../web/render/format.js';
import { SITE } from '../../../web/site.js';
import { BOTH_QUANTILE, BOTH_SHARE, S10_LINES, SCENARIOS } from '../web/constants.js';
import { loadHubCcns, loadMedicaid, loadSourceGroups, sourceGroups } from '../web/data.js';
import { methodsFacts } from '../web/methods/facts.js';
import { COPY as MEDICAID_COPY } from '../../../web/medicaid/copy.js';
import { COPY as METHODS_COPY } from '../web/methods/copy.js';
import { COPY as PROGRAM_COPY } from '../web/copy.js';
import { SENSITIVITIES, methodsPage, mostMoved } from '../web/pages/methods.js';
import { programPage } from '../web/pages/program.js';
import { bothInput, bothModel } from '../web/program/both.js';
import { hospitalRows } from '../web/program/strips.js';

const data = loadMedicaid();
const rows = hospitalRows(data);
const hubCcns = loadHubCcns();
const both = bothModel(rows, bothInput(data, rows, hubCcns));
const groups = loadSourceGroups(data);
const assets = testAssets();
const page = methodsPage({ data, robots: 'noindex', assets, sources: groups, both });
const program = programPage({ data, robots: 'noindex', assets, hubCcns });
const words = (markup) => textOf(String(markup)).replace(/\s+/g, ' ').trim();
const text = words(page);
const col = Object.fromEntries(data.columns.map((name, i) => [name, i]));
const scenarioRows = [...data.hospitals.values()].filter((r) => r[col.cls] === 'scenario');
const sectionOf = (id) => {
  const m = new RegExp(`<section class="doc__sec[^"]*" id="${id}"[\\s\\S]*?</section>`).exec(page);
  assert.ok(m, `section #${id}`);
  return words(m[0]);
};

test('the sections, in order, each with its heading, beside a contents list that links each', () => {
  const ids = ['steps', 'cases', 'limits', 'lines', 'sensitivities', 'none', 'maryland', 'screens', 'safety', 'both', 'sources', 'changes'];
  const at = ids.map((id) => page.indexOf(`id="${id}"`));
  assert.ok(at.every((i) => i > 0), ids.filter((_, k) => at[k] < 0).join(', '));
  assert.deepEqual([...at].sort((a, b) => a - b), at);
  for (const id of ids) {
    assert.ok(page.includes(`<a href="#${id}">`), `contents: #${id}`);
    assert.ok(sectionOf(id).length > 40, `#${id} has words`);
  }
});

test('the steps print every parameter from the file\'s params', () => {
  const steps = sectionOf('steps');
  const p = data.params;
  for (const shown of [pct(p.uninsured_share, 0), pct(p.care_still_used, 0), pct(1 - p.care_still_used, 0), pct(p.use_min, 0), pct(p.use_max, 0), pct(p.use_default, 0),
    count(p.max_cost_ratio), count(p.min_medicaid_days), count(p.part_year_days), count(p.margin_fence_iqr), count(p.miur_sds), pct(p.low_income_share, 0), String(p.base_year)]) {
    assert.ok(steps.includes(shown), `steps: ${shown}`);
  }
  // Lines 9 and 10 cite their sources: CBO for the uninsured share, the Commonwealth Fund's appendix for care still used.
  assert.match(steps, /Congressional Budget Office/);
  assert.match(steps, /Commonwealth Fund/);
  // Only the scenario-state hospitals go through the steps, and the page says how many.
  assert.equal(methodsFacts(data).scenario, scenarioRows.length);
  assert.ok(steps.includes(`${count(scenarioRows.length)} hospitals, goes through the four steps`), count(scenarioRows.length));
});

test('what the method can\'t tell you: the law\'s optional inpatient-stay exception, which the scenario doesn\'t model', () => {
  const s = sectionOf('limits');
  assert.match(s, /Hospital stays\./);
  assert.match(s, /inpatient hospital care as meeting the requirement, when the person asks/);
  assert.match(s, /doesn.t model this choice/);
});

test('the lines 2 + 5 version: its numbers against the decided method\'s', () => {
  const s = sectionOf('lines');
  const alt = data.sensitivities.line2_5;
  for (const k of SCENARIOS) assert.ok(s.includes(money(alt[k].lost)), `lines 2 + 5, ${k}: ${money(alt[k].lost)}`);
  assert.ok(s.includes(money(data.national.middle.lost)));
  assert.ok(s.includes(money(alt.middle.added_uncompensated)));
  assert.ok(s.includes(count(alt.middle.falls_1pp)));
  assert.ok(s.includes(`line ${S10_LINES.revenue}`) && s.includes(`line ${S10_LINES.supplemental}`));
});

test('the sensitivities table: every alternative in the file, low, middle and high revenue lost, and the decided method first', () => {
  assert.deepEqual(SENSITIVITIES.map((s) => s.key).sort(), Object.keys(data.sensitivities).sort());
  const s = /<section class="doc__sec[^"]*" id="sensitivities"[\s\S]*?<\/section>/.exec(page)[0];
  const body = /<tbody>[\s\S]*?<\/tbody>/.exec(s)[0];
  const trs = body.match(/<tr>[\s\S]*?<\/tr>/g);
  assert.equal(trs.length, SENSITIVITIES.length + 1, 'the decided method and each alternative');
  for (const k of SCENARIOS) assert.ok(words(trs[0]).includes(money(data.national[k].lost)));
  for (const [i, { key }] of SENSITIVITIES.entries()) {
    for (const k of SCENARIOS) assert.ok(words(trs[i + 1]).includes(money(data.sensitivities[key][k].lost)), `${key} ${k}`);
  }
  assert.match(s, /class="scen-tag"/, 'the figure carries the scenario tag');
});

// The takeaway names the method choice that moves the middle case most: never a use-rate end (the reader's what-if,
// whose two ends move it by the same amount either way), and never one of two that print as the same move.
test('the sensitivities\' takeaway: the method choice that moves the middle case most, never the use rate, two when they tie', () => {
  const alt = (label, middle, whatIf = false) => ({ label, middle, whatIf });
  assert.deepEqual(mostMoved(100e6, [alt('a', 120e6), alt('b', 60e6), alt('use', 900e6, true)]), ['b']);
  assert.deepEqual(mostMoved(100e6, [alt('a', 140e6), alt('b', 60.01e6)]), ['a', 'b'], 'the same move as printed');
  assert.deepEqual(mostMoved(1e9, [alt('a', 1.5e9), alt('b', 1.4e9)]), ['a']);
  assert.throws(() => mostMoved(1, [alt('use', 2, true)]), /no method alternative/);
  const takeaway = words(/<figcaption class="fig__cap"[\s\S]*?<\/figcaption>/.exec(/<section class="doc__sec[^"]*" id="sensitivities"[\s\S]*?<\/section>/.exec(page)[0])[0]);
  const deltas = Object.entries(data.sensitivities).filter(([k]) => !k.startsWith('use_')).map(([k, v]) => [k, Math.abs(v.middle.lost - data.national.middle.lost)]).sort((a, b) => b[1] - a[1]);
  assert.equal(deltas[0][0], 'line2_5', 'the file\'s largest method move');
  assert.ok(takeaway.includes(`Lines ${S10_LINES.revenue} + ${S10_LINES.supplemental} counted`), takeaway);
  assert.doesNotMatch(takeaway, /: Use rate/);
});

test('who has no scenario: the states by class, Georgia\'s Pathways and Urban\'s expansion-only scope, the territories, NC and SD\'s quarters', () => {
  const s = sectionOf('none');
  const names = (cls) => Object.values(data.states).filter((st) => st.cls === cls).map((st) => st.name);
  for (const name of [...names('not_expansion'), ...names('territory'), ...names('no_viii_group')]) assert.ok(s.includes(name), name);
  assert.match(s, /Georgia Pathways/);
  assert.match(s, /covers some adults with incomes up to the poverty line, on the condition that they meet a community engagement requirement/);
  assert.match(s, /equivalent to minimum essential coverage/);
  assert.match(s, /expansion enrollees/);
  for (const name of names('no_viii_group')) assert.match(s, new RegExp(`Urban.s table includes ${name}.s waiver enrollees, but`));
  assert.match(s, /the pinned .+ file has no complete federal FY/);
  const latest = Object.values(data.states).filter((st) => st.viii_basis === 'latest4').map((st) => st.name);
  assert.equal(latest.length, 2);
  for (const name of latest) assert.ok(text.includes(name), `latest four quarters: ${name}`);
  const noReport = [...data.hospitals.values()].filter((r) => r[col.cls] === 'no_cost_report').length;
  assert.ok(s.includes(count(noReport)), 'hospitals with no cost report');
});

test('Maryland: not modeled, its hospitals counted, HSCRC named and linked', () => {
  const s = sectionOf('maryland');
  const md = [...data.hospitals.values()].filter((r) => r[col.cls] === 'all_payer').length;
  assert.ok(md > 0);
  assert.ok(s.includes(count(md)));
  assert.match(s, /Health Services Cost Review Commission/);
  assert.match(page, /href="https:\/\/hscrc\.maryland\.gov\//);
  // The inpatient exemption is HSCRC's reasoning; under the law it is a state's option, at the person's request.
  assert.match(s, /reasoning that an inpatient stay can exempt a person from it/);
  assert.match(s, /a state.s option, at the person.s request/);
  assert.doesNotMatch(s, /creates an exemption/);
});

test('the screens: filing errors, margin outliers (on hospital records, out of the margin roll-ups), the day floor, the part year, the cost cap', () => {
  const s = sectionOf('screens');
  const f = methodsFacts(data);
  const flagged = (flag) => scenarioRows.filter((r) => r[col.flags].includes(flag)).length;
  assert.equal(f.filingErrors, flagged('negative_medicaid_revenue') + flagged('medicaid_exceeds_patient_revenue'));
  for (const n of [f.filingErrors, flagged('margin_outlier'), flagged('few_medicaid_days'), flagged('part_year'), flagged('cost_ratio_capped')]) assert.ok(s.includes(count(n)), count(n));
  assert.match(s, /hospital record/i);
  assert.match(s, /roll-ups/);
  assert.ok(s.includes(count(data.params.min_medicaid_days)));
});

// The flag's column is a list of reasons ([] for none, null with no cost report), so a hospital is flagged when its list
// is non-empty; counted from the rows, Maryland's included (the groups' roll-up leaves Maryland out).
test('the safety-net flag: our rule with its constants, how many it flags in all and in scenario states', () => {
  const s = sectionOf('safety');
  assert.ok(s.includes(count(data.params.miur_sds)) && s.includes(pct(data.params.low_income_share, 0)));
  const flagged = (r) => Array.isArray(r[col.safety_net]) && r[col.safety_net].length > 0;
  const all = [...data.hospitals.values()].filter(flagged).length;
  const inScenario = scenarioRows.filter(flagged).length;
  assert.deepEqual(methodsFacts(data).safetyNet, { all, scenario: inScenario });
  assert.ok(inScenario < scenarioRows.length, 'an empty list is not a flag');
  // Pinned to the FY2023 file (task 11 review): 775 flagged in all, 598 of them in scenario states.
  assert.equal(all, 775);
  assert.equal(inScenario, 598);
  assert.ok(s.includes(`the flag marks ${count(all)} hospitals with a cost report; ${count(inScenario)} of them are in scenario states`), s);
  assert.match(s, /Maryland.s included/);
  assert.match(s, /not an official list/i);
});

// Stands in for the copy gate's METHOD_CONSTANTS check: the cut is this site's framing, so Methods prints its constants
// from the exports, and the population the quantile is taken over.
test('exposed on both: BOTH_SHARE, BOTH_QUANTILE and the cut\'s population, printed from the exports and the model', () => {
  const s = sectionOf('both');
  assert.ok(s.includes(`${pct(BOTH_SHARE, 0)} or more`), pct(BOTH_SHARE, 0));
  assert.ok(s.includes('top quarter'), 'the quarter in words');
  assert.equal(BOTH_QUANTILE, 0.75);
  assert.ok(s.includes('75th percentile'));
  assert.ok(s.includes(count(both.pts.length)), `the cut's population: ${count(both.pts.length)}`);
  assert.ok(s.includes(pct(both.cut, 3)), 'the cut itself');
  assert.match(s, /no penalty/i, 'hospitals with no penalty are in the population');
  assert.doesNotMatch(text, /\bworst\b/i);
});

test('the sources: every pin of the file, each with its full SHA-256, in three groups that cover the file\'s list', () => {
  const s = /<section class="doc__sec[^"]*" id="sources"[\s\S]*?<\/section>/.exec(page)[0];
  assert.equal(data.pins.length, data.meta.sources.length);
  for (const pin of data.pins) {
    assert.ok(s.includes(pin.sha256), `${pin.id}: its SHA-256`);
    assert.ok(s.includes(isoDate(pin.retrieved)), `${pin.id}: retrieved`);
  }
  assert.match(words(s), /A dash for the source.s date means the source gives no date of its own/);
  assert.deepEqual([...groups.scenario, ...groups.hospitals, ...groups.penalties].sort(), [...data.meta.sources].sort());
  assert.ok(groups.scenario.length && groups.hospitals.length && groups.penalties.length);
  assert.deepEqual(sourceGroups(['a', 'b', 'c', 'd'], new Set(['b']), new Set(['b', 'c'])), { scenario: ['a', 'd'], hospitals: ['b'], penalties: ['c'] });
  assert.ok(s.includes(`href="${SITE.repo}"`), 'the code');
});

test('the citation block, the corrections link, the methods version; no reviewer note', () => {
  assert.match(page, /<section class="block cite" aria-labelledby="cite-h"/);
  assert.ok(page.includes(assets.js.cite), 'the citation script');
  const cite = words(/<p class="cite__text"[\s\S]*?<\/p>/.exec(page)[0]);
  assert.ok(cite.includes(SITE.name) && cite.includes(`${SITE.origin}/work-requirement/methods/`));
  assert.ok(sectionOf('changes').includes(String(data.meta.methodsVersion)));
  assert.ok(page.includes(`href="${SITE.pages.corrections}"`));
  assert.doesNotMatch(text, /reviewer|peer review/i);
  assert.doesNotMatch(text, /NaN|undefined|Infinity/);
});

test('the as-of line on both pages: the cost reports\' CMS date and settled share, CMS-64\'s date, Urban\'s table, the penalty year, the day the numbers changed', () => {
  const cells = data.pins.find((p) => p.id === `hcris-fy${data.meta.fy}-cells`);
  const cms64 = data.pins.find((p) => p.id.startsWith('cms64-viii'));
  for (const markup of [page, program]) {
    const bar = /<aside class="asof asof--grid"[\s\S]*?<\/aside>/.exec(markup);
    assert.ok(bar, 'an as-of bar');
    const t = words(bar[0]);
    assert.ok(t.includes(isoDate(cells.derivedFrom.lastModified)), 'HCRIS file date');
    assert.ok(t.includes(pct(data.meta.hcris.settled_share, 0)), 'settled share');
    assert.ok(t.includes(isoDate(cms64.datasetModified)), 'CMS-64 date');
    assert.ok(t.includes(`FY${data.meta.penaltyFy}`), 'penalty year');
    assert.equal(data.meta.penaltiesChanged, '2026-10-23', 'the FY2026 dollar file\'s day');
    assert.ok(t.includes(`estimates, last changed ${isoDate(data.meta.penaltiesChanged)}`), 'the penalty estimates\' date');
    assert.ok(t.includes(isoDate(data.meta.changed)), 'numbers changed');
    assert.match(t, /Table A\.2/);
  }
});

// Dalton's review 11-11 (D2): the as-of block is a grid, not a narrow column: on both pages, the article's last child of
// its kind, five sources, each a small label over its value (a <div> holding one <dt> and one <dd>); the family's as-of
// grid (asofBar's grid, pages.css .asof--grid) lays them out one column on a phone, two from 560px and three across the
// page from 900px, label over value; the site's styles give it less air than the family's bar and a wider middle column,
// and the family's bar without the grid is unchanged.
test('the as-of block on both pages: five sources, each a label over its value, in a grid of three columns from 900px', () => {
  for (const [markup, article] of [[program, 'wrap page wr'], [page, 'wrap page wr-meth']]) {
    assert.ok(markup.includes(`<article class="${article}">`), article);
    const bar = /<aside class="asof asof--grid" aria-label="About this data">\n<dl class="asof__list">([\s\S]*?)<\/dl>/.exec(markup)?.[1];
    assert.ok(bar, `${article}: the as-of block`);
    const items = bar.match(/<div>[\s\S]*?<\/div>/g);
    assert.equal(items.length, 5, `${article}: five sources`);
    for (const item of items) assert.match(item, /^<div><dt>[^<]+<\/dt><dd>[\s\S]+<\/dd><\/div>$/, `${article}: a label over its value`);
    assert.deepEqual(items.map((item) => /<dt>([^<]+)<\/dt>/.exec(item)[1]), ['Cost reports', 'Expansion share', 'Enrollment declines', 'Medicare penalties', 'Numbers last changed']);
    // The block is the article's direct child, where the site's grid applies.
    assert.match(markup, new RegExp(`<article class="${article}">[\\s\\S]*\\n<aside class="asof asof--grid"[\\s\\S]*?</aside>\\n</article>`));
  }
  const css = readFileSync(`${REPO_ROOT}sites/work-requirement/web/styles.css`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [want, what] of [
    [':is(.wr, .wr-meth) > .asof { margin-top: 0; padding-top: 8px; }', 'less air around it'],
    ['@media (min-width: 900px) { :is(.wr, .wr-meth) .asof--grid .asof__list { grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 1fr); } }', 'three from 900px, the middle wider'],
  ]) assert.ok(css.includes(want), what);
  const family = readFileSync(`${REPO_ROOT}web/styles/pages.css`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [want, what] of [
    ['.asof--grid .asof__list { grid-template-columns: minmax(0, 1fr);', 'one column on a phone'],
    ['.asof--grid .asof__list > div { display: block; grid-column: auto; }', 'each label over its value'],
    ['@media (min-width: 560px) { .asof--grid .asof__list { grid-template-columns: repeat(2, minmax(0, 1fr)); } }', 'two from 560px'],
  ]) assert.ok(family.includes(want), what);
  // The family's bar without the grid is the same for every other site.
  assert.ok(family.includes('.asof__list { display: grid; grid-template-columns: max-content minmax(0, 1fr);'), 'the family\'s bar unchanged');
});

// DES-47: neutral verbs for what the requirement does to enrollment and revenue.
test('neutral verbs: no "cut" of enrollment, no people "removed", no revenue "taken"; the Commonwealth Fund\'s modeler named', () => {
  assert.doesNotMatch(text, /\bcuts?\b(?! today)/i);
  assert.doesNotMatch(text, /removes? from Medicaid|could take from|case shown takes/);
  const ws = words(program);
  assert.doesNotMatch(ws, /Commonwealth Fund.s modelers/);
});

// The same rule over every word the site and the hospital pages' band print (placeholders aside: {cut} is the corner's
// threshold): no "cut", "take" or "remove" in any sense, so none can read as the policy's verb (the Medicare penalties beside the scenario say "penalty").
test('neutral verbs in every copy file of the work-requirement pages: no cut, take or remove', () => {
  for (const [file, COPY] of [['copy.js', PROGRAM_COPY], ['methods/copy.js', METHODS_COPY], ['web/medicaid/copy.js', MEDICAID_COPY]]) {
    for (const [key, v] of Object.entries(COPY)) {
      assert.doesNotMatch((typeof v === 'string' ? v : v.text).replace(/\{\w+\}/g, ''), /\b(cut|cuts|cutting|take|takes|taken|taking|remov\w*)\b/i, `${file} ${key}`);
    }
  }
});

test('the hub\'s statement about the work-requirement pages\' as-of line and source list is no longer pending', () => {
  const register = readFileSync(`${REPO_ROOT}hub/CLAIMS.md`, 'utf8');
  const row = register.split('\n').find((line) => line.includes('the Medicaid work-requirement pages name each data source they use and its date'));
  assert.ok(row);
  assert.doesNotMatch(row.split(' | ').at(-1), /pending/i);
});
