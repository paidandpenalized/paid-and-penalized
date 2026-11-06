// Task 28: the fixes from the review of the built program page, hero to Worksheet R. One test or more for each.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../../pipeline/files.js';
import { columns } from '../../../web/charts/columns.js';
import { figure } from '../../../web/charts/figure.js';
import { dualBins } from '../web/figures/how-data.js';
import { hospitalsAsset } from '../web/figures/explore-data.js';
import { hospitalOf, sheetRow, worksheetAsset } from '../web/figures/worksheet-data.js';
import { programPage } from '../web/pages/program.js';
import { buildPlaces } from '../web/places.js';
import { areaContext, programView } from '../web/view.js';
import { worksheetRows } from '../web/worksheet.js';
import { ASSETS, loadHrrpOnce } from './fixtures.js';

const CSS = readFileSync(`${REPO_ROOT}sites/hrrp/web/styles.css`, 'utf8');
const TOKENS = readFileSync(`${REPO_ROOT}web/styles/tokens.css`, 'utf8');
const KIT_CSS = readFileSync(`${REPO_ROOT}web/styles/charts.css`, 'utf8');
const rule = (selector) => new RegExp(`(^|\\n)${selector.replace(/[.[\]*#]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(CSS)?.[2] ?? null;

function page({ hospitalsUrl = '/assets/hrrp-hospitals.test.json', worksheetUrl = '/assets/hrrp-worksheet.test.json' } = {}) {
  const data = loadHrrpOnce();
  const view = programView(areaContext({ ...data, places: buildPlaces(data.hospitals, data.meta) }));
  return programPage({ view, robots: null, assets: ASSETS, hospitalsUrl, worksheetUrl });
}
const between = (text, from, to) => text.slice(text.indexOf(from), text.indexOf(to));

// ---------- the hero ----------

test('hero: the h1 is two lines, "Thirty Day" in ink and the program name in the penalty ink, then the search box, then the hints', () => {
  const text = page();
  assert.match(text, /<h1 class="prog__title"><span class="prog__title-lead">Thirty Day<\/span> <span class="prog__title-pen">Readmissions<\/span><\/h1>/);
  assert.match(rule('.prog__title'), /color: var\(--ink\)/);
  assert.match(rule('.prog__title-pen'), /color: var\(--pen\)/);
  assert.match(rule('.prog__title > span'), /display: block/);
  const find = text.slice(text.indexOf('class="prog__find'));
  assert.ok(find.indexOf('class="omni omni--hero"') >= 0 && find.indexOf('class="omni omni--hero"') < find.indexOf('class="prog__try"'), 'the box, then the hint line');
  assert.ok(text.indexOf('class="prog__deck"') < text.indexOf('class="omni omni--hero"'), 'under the deck');
  assert.ok(text.includes('data-src="/assets/hrrp-hospitals.test.json"'));
  assert.ok(text.includes('<script type="module" src="/assets/hrrp-program.test.js"'), 'the page script');
});

test('hero: without the hospitals asset there is no box and no script, and the hints stay', () => {
  const text = page({ hospitalsUrl: null, worksheetUrl: null });
  assert.ok(!text.includes('class="omni'));
  assert.ok(!text.includes('hrrp-program.test.js'));
  assert.ok(text.includes('class="prog__try"'));
});

test('hero: the At-a-glance bar holds to one line where the card is wide enough', () => {
  assert.match(CSS, /@container \(min-width: 4\d\dpx\) \{ \.prog__summary > \.form__title \{[^}]*flex-wrap: nowrap[^}]*white-space: nowrap/);
});

test('the hospitals asset carries the places the search finds, and the worksheet asset every hospital', () => {
  const data = loadHrrpOnce();
  const places = buildPlaces(data.hospitals, data.meta);
  const rows = places.list.map((p) => [p.kind, p.key, p.name, p.path, p.hospitals.length]);
  const asset = hospitalsAsset(data.hospitals, rows);
  assert.equal(asset.places.length, places.list.length);
  assert.ok(asset.places.every(([kind, , , path, n]) => ['region', 'division', 'state', 'metro'].includes(kind) && path.startsWith('/hrrp/') && n > 0));
  assert.deepEqual(hospitalsAsset(data.hospitals).places, [], 'none without the argument');
  const sheets = worksheetAsset(data.hospitals, data.meta);
  assert.equal(sheets.rows.length, data.hospitals.length);
  assert.deepEqual(sheets.meta, { nm: data.meta.nm, peerMedians: data.meta.peerMedians });
});

// ---------- Step 5: the browser's worksheet is the server's ----------

test('Worksheet R: a row from the asset gives the same worksheet as the hospital it came from, for every hospital', () => {
  const data = loadHrrpOnce();
  const sheets = worksheetAsset(data.hospitals, data.meta);
  const wire = JSON.parse(JSON.stringify(sheets));  // as the browser reads it
  const byId = new Map(data.hospitals.map((h) => [h.id, h]));
  for (const row of wire.rows) {
    const h = byId.get(row[0]);
    assert.deepEqual(worksheetRows(hospitalOf(row), wire.meta), worksheetRows(h, data.meta), row[0]);
  }
  assert.deepEqual(sheetRow(data.hospitals[0]), wire.rows.find((r) => r[0] === data.hospitals[0].id));
});

test('Step 5: the box above the sheet, the sheet in a holder that names the asset, the default hospital shown whole', () => {
  const text = page();
  const step = between(text, 'id="step-5"', 'id="picture"');
  assert.ok(step.indexOf('id="ws-pick"') >= 0 && step.indexOf('id="ws-pick"') < step.indexOf('class="wsr"'), 'the box is above the worksheet');
  assert.match(step, /<div class="wsr-holder" id="worksheet" data-src="\/assets\/hrrp-worksheet\.test\.json" data-context="[^"]+">\s*<div class="wsr">/);
  assert.ok(!text.includes('"rows":['), 'the asset is not inlined');
  const bare = between(page({ worksheetUrl: null }), 'id="step-5"', 'id="picture"');
  assert.ok(!bare.includes('ws-pick') && bare.includes('class="wsr"'), 'no box without the asset; the sheet still reads whole');
});

test('Worksheet R runs the page width: no cap on its parts, and the step is one column', () => {
  assert.match(rule('.hstep--wide'), /grid-template-columns: minmax\(0, 1fr\)/);
  for (const sel of ['.wsr__totals', '.wsr__totals li', '.wsr__id']) assert.match(rule(sel), /max-width: none/, sel);
  assert.match(rule('.wsr'), /min-width: 0/);
  const text = page();
  assert.match(text, /<section class="hstep hstep--wide" id="step-5"/);
});

// ---------- Step 4: the medians table shows ----------

// The bug: the table sat inside a collapsed <details> in the step's right column, so at desktop width the column held one
// line ("Peer-group medians for ...") and read as blank. It must be in the page's flow, not behind a toggle, and wide enough
// for six condition columns (a wide step: the table runs the page's width under the words).
test('Step 4: the medians table is not behind a disclosure, and the step gives it the full width', () => {
  const text = page();
  const step = between(text, 'id="step-4"', 'id="step-5"');
  assert.ok(step.includes('<table class="gb meds__table" aria-labelledby="meds-title">'), 'the table is in the step');
  assert.ok(!step.includes('<details'), 'no collapsed disclosure around it');
  assert.match(step, /^id="step-4"/);
  assert.match(text, /<section class="hstep hstep--wide" id="step-4"/);
  assert.match(rule('.hstep--wide .hstep__text'), /position: static/);
  assert.match(rule('.meds__table td.hi'), /background: var\(--pen-tint\)/);
  assert.equal(step.match(/<th scope="col"/g).length, 7, 'the group column and six conditions');
});

// ---------- the callouts ----------

test('the callouts are the same height, and their sources are one disclosure under both', () => {
  assert.match(CSS, /\.hgrid \{[^}]*align-items: stretch/);
  assert.match(CSS, /\.callout \{[^}]*align-content: start/, 'the box stretches, its words stay at the top');
  const text = page();
  const how = between(text, 'class="hgrid"', 'id="step-1"');
  assert.equal(how.match(/<details/g).length, 1);
  assert.ok(how.indexOf('class="srcs"') > how.indexOf('Who is in the program'), 'under both callouts');
});

// ---------- Fig. 1 ----------

test('Fig. 1: the note on the holes is in the step\'s words, not under the chart', () => {
  const text = page();
  const step1 = between(text, 'id="step-1"', 'id="step-2"');
  const fig = between(step1, '<figure', '</figure>');
  assert.ok(!fig.includes('A hole in a row'), 'not in the figure');
  assert.ok(step1.slice(0, step1.indexOf('hstep__fig')).includes('A hole in a row'), 'in the text column');
});

// ---------- Fig. 2 ----------

test('Fig. 2: each group\'s columns carry the group\'s tone, keyed, and every label reads Group n at every width', () => {
  const text = page();
  const step3 = between(text, 'id="step-3"', 'id="step-4"');
  for (const n of [1, 2, 3, 4, 5]) {
    assert.ok(step3.includes(`class="chart-col chart-cat-${n}"`), `columns in group ${n}`);
    assert.match(step3, new RegExp(`<span class="fig__swatch fig__swatch--cat-${n}" aria-hidden="true"></span>Group ${n} · \\d+%–\\d+% dual`), `key for group ${n}`);
  }
  assert.ok(!step3.includes('class="chart-col"'), 'every column has a group');
  // The tones are tokens in both themes and none is the penalty or reward ink.
  for (const n of [1, 2, 3, 4, 5]) {
    assert.equal(TOKENS.match(new RegExp(`--cat-${n}:`, 'g')).length, 2, `--cat-${n} in the light and dark blocks`);
    assert.match(KIT_CSS.match(new RegExp(`\\.chart-cat-${n} \\{([^}]*)\\}`))?.[1] ?? '', new RegExp(`fill: var\\(--cat-${n}\\)`));
    assert.match(KIT_CSS.match(new RegExp(`\\.fig__swatch--cat-${n} \\{([^}]*)\\}`))?.[1] ?? '', new RegExp(`background: var\\(--cat-${n}\\)`));
  }
  const tones = [...TOKENS.matchAll(/--cat-\d: (#[0-9a-f]{6})/g)].map((m) => m[1]);
  assert.equal(new Set(tones).size, tones.length, 'ten different values');
  const pen = [...TOKENS.matchAll(/--(?:pen|pen-ink|rew|pen-scar): (#[0-9a-f]{6})/g)].map((m) => m[1]);
  assert.ok(tones.every((t) => !pen.includes(t)));
  for (const svg of step3.match(/<svg [^>]*chart--columns[\s\S]*?<\/svg>/g)) {
    for (const n of [1, 2, 3, 4, 5]) assert.ok(svg.includes(`>Group ${n}<`), `Group ${n}`);
  }
});

test('columns: staggered labels never touch, stay inside the drawing, and none is left out, at phone and wide widths', () => {
  const data = loadHrrpOnce();
  const dual = dualBins(data.hospitals, data.meta.peerCutoffs);
  const CHAR = 6;
  for (const width of [300, 360, 560]) {
    const bands = dual.bands.map((b) => ({ x0: b.x0, x1: b.x1, label: `Group ${b.peer}`, short: String(b.peer) }));
    const svg = columns({ bins: dual.bins.map((b) => ({ ...b, cls: 'chart-col', tip: 'x' })), domain: [0, dual.top], ticks: dual.ticks, format: String, width, height: 150, bands, stagger: true }).text;
    const labels = [...svg.matchAll(/<text class="chart-band__label" x="([\d.]+)" y="([\d.]+)"[^>]*>([^<]*)</g)].map((r) => ({ x: Number(r[1]), y: Number(r[2]), text: r[3] }));
    assert.deepEqual(labels.map((l) => l.text), bands.map((b) => b.label), `${width}: every full label`);
    labels.forEach((a, i) => {
      assert.ok(a.x - (a.text.length * CHAR) / 2 >= 0 && a.x + (a.text.length * CHAR) / 2 <= width, `${width}: ${a.text} inside the drawing`);
      labels.slice(0, i).filter((b) => b.y === a.y).forEach((b) => assert.ok(b.x + (b.text.length * CHAR) / 2 < a.x - (a.text.length * CHAR) / 2, `${width}: ${b.text} and ${a.text} share a row and touch`));
    });
  }
});

test('figure: a categorical key swatch, and a free class or a bad swatch is refused', () => {
  const FIG = { n: 1, takeaway: 't', source: 's', alt: 'a', table: { columns: [{ name: 'x' }, { name: 'n', numeric: true }], rows: [['r', '1']] }, svg: columns({ bins: [{ x0: 0, x1: 1, n: 1, cls: 'chart-col', tip: 'x' }], domain: [0, 1], ticks: [0], format: String, width: 300, height: 100 }) };
  assert.ok(String(figure({ ...FIG, key: [{ swatch: 'cat-1', label: 'One' }] })).includes('<li><span class="fig__swatch fig__swatch--cat-1" aria-hidden="true"></span>One</li>'));
  for (const key of [[{ cls: 'swatch-g1', label: 'x' }], [{ swatch: 'cat-9', label: 'x' }], [{ swatch: 'this', label: '' }]]) assert.throws(() => figure({ ...FIG, key }), TypeError);
});

test('a Part spaces its blocks itself: one 28px rule, and the old lede-to-figure patch is gone', () => {
  assert.match(CSS, /\.part > :is\([^)]*\.pic[^)]*\.fig[^)]*\.mapcols[^)]*\.rsgrid[^)]*\)\s*\{\s*margin-top: 28px;/);
  assert.ok(!CSS.includes('.part__intro + .fig'), 'the sibling-only patch is removed');
});

test('a table beside a visible title is named by it (aria-labelledby), not by a hidden caption that says it a second time', () => {
  for (const [what, text] of [['the program page', page()]]) {
    const tables = [...text.matchAll(/<table class="gb [^"]*"([^>]*)>/g)];
    assert.ok(tables.length > 0, `${what} has tables`);
    for (const [tag, attrs] of tables) {
      const id = /aria-labelledby="([^"]+)"/.exec(attrs)?.[1];
      if (!id) continue;
      assert.ok(text.includes(`id="${id}"`), `${what}: ${tag.slice(0, 40)} is named by an element that exists (${id})`);
    }
    for (const id of ['wsr-title', 'meds-title']) assert.ok(text.includes(`id="${id}"`) && text.includes(`aria-labelledby="${id}"`), `${what}: ${id} names its table`);
    assert.ok(!/<caption class="vh" id="(?:wsr|meds)-cap"/.test(text), 'no second caption');
  }
});
