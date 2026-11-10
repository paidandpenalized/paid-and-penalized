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
import { SENSITIVITIES, methodsPage } from '../web/pages/methods.js';
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

test('who has no scenario: the states by class, Georgia\'s Pathways and Urban\'s expansion-only scope, the territories, NC and SD\'s quarters', () => {
  const s = sectionOf('none');
  const names = (cls) => Object.values(data.states).filter((st) => st.cls === cls).map((st) => st.name);
  for (const name of [...names('not_expansion'), ...names('territory'), ...names('no_viii_group')]) assert.ok(s.includes(name), name);
  assert.match(s, /Georgia Pathways/);
  assert.match(s, /expansion enrollees/);
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

test('the safety-net flag: our rule with its constants, how many it flags', () => {
  const s = sectionOf('safety');
  assert.ok(s.includes(count(data.params.miur_sds)) && s.includes(pct(data.params.low_income_share, 0)));
  assert.ok(s.includes(count(data.groups.safety_net.middle.hospitals)));
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
    const bar = /<aside class="asof"[\s\S]*?<\/aside>/.exec(markup);
    assert.ok(bar, 'an as-of bar');
    const t = words(bar[0]);
    assert.ok(t.includes(isoDate(cells.derivedFrom.lastModified)), 'HCRIS file date');
    assert.ok(t.includes(pct(data.meta.hcris.settled_share, 0)), 'settled share');
    assert.ok(t.includes(isoDate(cms64.datasetModified)), 'CMS-64 date');
    assert.ok(t.includes(`FY${data.meta.penaltyFy}`), 'penalty year');
    assert.ok(t.includes(isoDate(data.meta.changed)), 'numbers changed');
    assert.match(t, /Table A\.2/);
  }
});

test('the hub\'s statement about the work-requirement pages\' as-of line and source list is no longer pending', () => {
  const register = readFileSync(`${REPO_ROOT}hub/CLAIMS.md`, 'utf8');
  const row = register.split('\n').find((line) => line.includes('the Medicaid work-requirement pages name each data source they use and its date'));
  assert.ok(row);
  assert.doesNotMatch(row.split(' | ').at(-1), /pending/i);
});
