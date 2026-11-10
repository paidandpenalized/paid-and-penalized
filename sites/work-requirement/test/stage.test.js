// The scroll story (client/stage.js) and its field (client/field.js): the stage only with the script from 900px wide; the
// stacked page without it; the step in view by the section menu's rule; each figure scaled to fit, never below the
// least; the field's dots where each figure's own layout puts them, in colors that stand 3:1 off the paper in both
// themes; and Figure 1's table following the use rate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../../pipeline/files.js';
import { testAssets } from '../../../pipeline/test/helpers.js';
import { standIn } from '../../../web/test/dom.js';
import { FIELD_CONTEXT, FIELD_STEPS, FIELD_TONES, FLIGHT_MS, STAGGER_MS, dotAt, fieldPoints, flightOf, onScreen } from '../client/field.js';
import { rebin } from '../client/page.js';
import { LINE_PX, MIN_DRAWING, MIN_ZOOM, STAGE_MEDIA, drawingShare, mountStage, stageMode, stepAt, zoomFor } from '../client/stage.js';
import { SCENARIOS } from '../web/constants.js';
import { loadHubCcns, loadMedicaid } from '../web/data.js';
import { programPage } from '../web/pages/program.js';
import { bothInput, bothLayout, bothModel, isBoth, xOf } from '../web/program/both.js';
import { statesLayout, statesModel } from '../web/program/states.js';
import { axisTop, binsOf, drawn, hospitalRows, stripsLayout } from '../web/program/strips.js';

const data = loadMedicaid();
const rows = hospitalRows(data);
const items = drawn(rows);
const top = axisTop(rows, data.params.use_max);
const hubCcns = loadHubCcns();
const states = statesModel(data, rows, hubCcns);
const both = bothModel(rows, bothInput(data, rows, hubCcns));
const page = programPage({ data, robots: 'noindex', assets: testAssets(), stripsUrl: '/assets/wr-strips.test.json', hubCcns });
const css = readFileSync(REPO_ROOT + 'sites/work-requirement/web/styles.css', 'utf8');
const STEPS = ['finding', 'how', 'states', 'hospital', 'both'];
// A selector list's selectors (commas inside :is() and :has() don't split).
const selectors = (list) => {
  const out = [''];
  let depth = 0;
  for (const ch of list) {
    if (ch === ',' && depth === 0) out.push('');
    else {
      depth += ch === '(' ? 1 : ch === ')' ? -1 : 0;
      out[out.length - 1] += ch;
    }
  }
  return out.map((s) => s.trim());
};
const sectionOf = (id) => new RegExp(`<section class="step wr-step[^"]*" id="${id}"[\\s\\S]*?</section>`).exec(page)?.[0] ?? '';

// ---------- review focus 5: the field's colors ----------

test('the field\'s mark and page-hospital colors stand 3:1 or more off --paper and --paper-2, light and dark; step 5\'s context tone is Figure 5\'s', () => {
  const tokens = readFileSync(REPO_ROOT + 'web/styles/tokens.css', 'utf8');
  const split = tokens.indexOf('@media (prefers-color-scheme: dark)');
  const blocks = { light: tokens.slice(0, split), dark: tokens.slice(split) };
  const token = (block, name) => new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(block)[1];
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  assert.ok(FIELD_TONES.includes('ink'), 'the page\'s hospital is drawn in ink');
  // The context tone (step 5's dots outside the corner) is pale by design and is the figure's own: no mark needs it to
  // read, since the corner's dots, its count and the table carry the finding.
  const css = readFileSync(REPO_ROOT + 'sites/work-requirement/web/styles.css', 'utf8');
  assert.equal(/^\.wr-bdots \{ stroke: var\(--([a-z0-9-]+)\); \}/m.exec(css)[1], FIELD_CONTEXT);
  for (const tone of FIELD_TONES.filter((x) => x !== FIELD_CONTEXT)) {
    for (const [theme, block] of Object.entries(blocks)) {
      for (const paper of ['paper', 'paper-2']) {
        const r = ratio(token(block, tone), token(block, paper));
        assert.ok(r >= 3, `--${tone} on --${paper}, ${theme}: ${r.toFixed(2)}:1`);
      }
    }
  }
  // Every tone a dot is given is one of those checked.
  const view = { scenario: 'middle', use: 1, stateCode: states.selected };
  for (const step of Object.keys(FIELD_STEPS)) {
    for (const p of fieldPoints(step, { view, items, top, states, both }).values()) assert.ok(FIELD_TONES.includes(p.tone), `${step}: ${p.tone}`);
  }
});

// ---------- the stage only with the script, from 900px ----------

test('without the script the page is the stacked one: every step\'s figure in its own step, no stage-only markup', () => {
  for (const [i, id] of STEPS.entries()) {
    const section = sectionOf(id);
    assert.ok(section, `${id} is on the page`);
    const words = section.indexOf('<div class="wr-step__words">');
    const stage = section.indexOf('<div class="wr-step__stage"');
    const figure = section.indexOf(`id="figure-${i + 1}"`);
    assert.ok(words >= 0 && words < stage && stage < figure, `${id}: words, then the stage holding Figure ${i + 1}`);
    assert.match(section.slice(figure), /<svg[^>]*class="chart/, `${id}: Figure ${i + 1} is drawn`);
  }
  for (const stageOnly of ['wr-scrolly--on', 'wr-step__pin', 'wr-step__fig', 'wr-field', '<canvas', 'data-on']) {
    assert.ok(!page.includes(stageOnly), `no ${stageOnly} in the markup`);
  }
  // The controls are hidden, not broken: the head is in the markup with hidden.
  assert.match(page, /<div class="wr-stage__head" data-stage-head hidden>/);
});

test('the story\'s rules apply only under the class the script sets; its wrappers are no boxes without it', () => {
  const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => [sel.trim(), body.trim()]);
  const story = rules.filter(([sel, body]) => /wr-step__(pin|fig)|wr-field/.test(sel) || /var\(--wr-(head|tail)/.test(body));
  assert.ok(story.length >= 6, 'the story has its rules');
  for (const [sel, body] of story) {
    if (/^\.wr-step__pin, \.wr-step__fig$/.test(sel)) assert.equal(body, 'display: contents;', 'without the script the wrappers are no boxes');
    else if (/^\.wr-field/.test(sel)) continue; // the canvas exists only once the script has made it
    else if (/> \*/.test(sel) && /min-width: 0/.test(body)) continue;
    else for (const part of selectors(sel)) assert.match(part, /^(\.page\.wr:has\(> )?\.wr-scrolly--on/, `"${part}" sits under .wr-scrolly--on`);
  }
  for (const [sel, body] of rules) {
    if (/position: (sticky|absolute|fixed)/.test(body) && /wr-step|wr-scrolly/.test(sel)) assert.match(sel, /wr-scrolly--on|wr-field/, `"${sel}" pins only in the story`);
  }
  // A figure not shown is only unseen: transparent and out of the pointer's way (the stage takes none; the shown figure's
  // part takes it back), never visibility, display or aria-hidden, so a screen reader still reads it.
  const body = (sel) => rules.find(([s]) => s === sel)?.[1] ?? '';
  assert.match(body('.wr-scrolly--on .wr-step__fig'), /opacity: 0;/);
  assert.match(body('.wr-scrolly--on .wr-step__stage'), /pointer-events: none;/);
  assert.match(body('.wr-scrolly--on .wr-step__stage[data-on] .wr-step__fig'), /opacity: 1; pointer-events: auto;/);
  for (const [sel, b] of rules) if (/wr-scrolly--on|wr-step__/.test(sel)) assert.doesNotMatch(b, /visibility: hidden|display: none/, sel);
  assert.ok(!readFileSync(REPO_ROOT + 'sites/work-requirement/client/stage.js', 'utf8').includes('aria-hidden'));
  // The stage's width is the two columns' breakpoint.
  assert.equal(STAGE_MEDIA, '(min-width: 900px)');
  assert.match(css, /@media \(min-width: 900px\) \{\s*\.wr-step \{ grid-template-columns/);
});

test('the stage\'s mode: off below 900px, a cut with reduced motion, the field otherwise', () => {
  assert.equal(stageMode({ wide: false, motion: true }), 'off');
  assert.equal(stageMode({ wide: false, motion: false }), 'off');
  assert.equal(stageMode({ wide: true, motion: false }), 'cut');
  assert.equal(stageMode({ wide: true, motion: true }), 'field');
});

// A stand-in page for mountStage: the story's five steps (words, then a stage; step 1's stage holds the head), boxes at
// fixed places, and media query lists the test can flip.
function storyPage(t, { wide }) {
  const make = (cls, { id = '', children = [], box = [0, 0] } = {}) => {
    const node = {
      className: cls, id, children: [], parentElement: null, hidden: false, attrs: new Set(), dataset: {},
      style: { zoom: '', width: '', props: {}, setProperty(k, v) { this.props[k] = v; }, getPropertyValue(k) { return this.props[k] ?? ''; } },
      classList: { set: new Set(cls.split(' ')), toggle(c, on) { if (on) this.set.add(c); else this.set.delete(c); }, contains(c) { return this.set.has(c); } },
      box,
      getBoundingClientRect() { return { top: node.box[0], bottom: node.box[1], height: node.box[1] - node.box[0], width: 600, left: 0, right: 600 }; },
      append(...xs) {
        for (const x of xs) {
          if (x.parentElement) x.parentElement.children = x.parentElement.children.filter((c) => c !== x);
          x.parentElement = node;
          node.children.push(x);
        }
      },
      contains(x) { for (let at = x; at; at = at.parentElement) if (at === node) return true; return false; },
      toggleAttribute(k, on) { if (on) node.attrs.add(k); else node.attrs.delete(k); },
      hasAttribute: (k) => node.attrs.has(k),
      removeAttribute(k) { node.attrs.delete(k); },
      matches: () => false,
      all() { return node.children.flatMap((c) => [c, ...c.all()]); },
      querySelectorAll(sel) {
        if (sel === ':scope > section.wr-step') return node.children.filter((c) => c.classList.contains('wr-step'));
        if (sel === 'details[open]') return [];
        return node.all().filter((c) => c.classList.contains(sel.slice(1)));
      },
      querySelector(sel) {
        const m = /^:scope > \.(.+)$/.exec(sel);
        if (m) return node.children.find((c) => c.classList.contains(m[1])) ?? null;
        return node.querySelectorAll(sel)[0] ?? null;
      },
    };
    node.append(...children);
    return node;
  };
  const head = make('wr-stage__head');
  const sections = STEPS.map((id, i) => make('step wr-step', {
    id,
    box: [100 + i * 1000, 1100 + i * 1000],
    children: [make('wr-step__words', { box: [100 + i * 1000, 1000 + i * 1000] }), make('wr-step__stage', { children: [...(i === 0 ? [head] : []), make('fig', { box: [0, 400] }), make('note', { box: [400, 420] })] })],
  }));
  const scrolly = make('wr-scrolly', { children: sections, box: [100, 5200] });
  const media = (matches) => {
    const list = { matches, fn: null, addEventListener(_, fn) { list.fn = fn; }, flip(v) { list.matches = v; list.fn(); } };
    return list;
  };
  const body = make('body');
  const headings = new Map(STEPS.map((id) => {
    const h = make('h2', { id: `${id}-h` });
    h.focused = false;
    h.setAttribute = (k, v) => { h[k] = v; };
    h.focus = (opts) => { h.focused = opts; document.activeElement = h; };
    return [`${id}-h`, h];
  }));
  const on = {};
  const scrolls = [];
  standIn(t, {
    document: { createElement: () => make(''), documentElement: { style: Object.assign(make('').style, { props: { '--sticky-top': '140px' } }) }, activeElement: body, body, addEventListener(type, fn) { on[type] = fn; }, getElementById: (id) => headings.get(id) ?? null },
    window: { innerHeight: 800, addEventListener() {}, scrollBy(o) { scrolls.push(o); } },
    getComputedStyle: () => ({ top: '140px', paddingTop: '10px', rowGap: '8px' }),
    requestAnimationFrame: (fn) => fn(),
  });
  const lists = { wide: media(wide), motion: media(true) };
  const story = mountStage(scrolly, lists);
  return { scrolly, sections, head, lists, story, on, scrolls, headings, body };
}

test('the stage mounts only from 900px: the class, the pins and the step shown follow the width', (t) => {
  const { scrolly, sections, head, lists } = storyPage(t, { wide: false });
  assert.ok(!scrolly.classList.contains('wr-scrolly--on'), 'narrow: the stacked page');
  assert.ok(sections.every((s) => !s.children[1].attrs.has('data-on')), 'narrow: no stage shown');
  // Each stage's parts now sit in a pin and a figure part (no boxes while narrow), step 1's head in its pin above the figure.
  for (const s of sections) {
    const [pin] = s.children[1].children;
    assert.equal(pin.className, 'wr-step__pin');
    assert.equal(pin.children[pin.children.length - 1].className, 'wr-step__fig');
  }
  assert.equal(sections[0].children[1].children[0].children[0], head);
  assert.ok(!sections[0].children[1].children[0].children[1].contains(head), 'the head never fades with Figure 1');
  lists.wide.flip(true);
  assert.ok(scrolly.classList.contains('wr-scrolly--on'), 'wide: the story');
  assert.deepEqual(sections.map((s) => s.children[1].attrs.has('data-on')), [true, false, false, false, false], 'the first step in view');
  lists.wide.flip(false);
  assert.ok(!scrolly.classList.contains('wr-scrolly--on'));
  assert.ok(sections.every((s) => !s.children[1].attrs.has('data-on')));
});

test('focus reaching a figure not shown makes its step the one in view, its words brought on screen; focus left in a figure as it goes moves to the new step\'s heading', (t) => {
  const { sections, lists, on, scrolls, headings } = storyPage(t, { wide: true });
  lists.wide.flip(true);
  const shown = () => sections.map((s) => s.children[1].attrs.has('data-on'));
  assert.deepEqual(shown(), [true, false, false, false, false]);
  // A Tab (or a screen reader's focus) into Figure 3's part, its step's top still below the line.
  const fig3 = sections[2].children[1].children[0].children[0];
  const control = { parentElement: fig3, matches: () => false };
  document.activeElement = control;
  on.focusin({ target: control });
  assert.deepEqual(shown(), [false, false, true, false, false], 'step 3 in view at once');
  assert.deepEqual(scrolls, [{ top: 2100 - 140, behavior: 'instant' }], 'its top brought under the header');
  // Focus reaching a figure whose dots are still flying: shown at once.
  sections[2].children[1].attrs.add('data-flying');
  on.focusin({ target: control });
  assert.ok(!sections[2].children[1].attrs.has('data-flying') && sections[2].children[1].attrs.has('data-on'), 'the flight cut short');
  // Its words leave the screen with focus still in the figure (the page scrolled back to the top): the focus moves to
  // the heading of the step now in view, without a scroll.
  on.focusin({ target: headings.get('finding-h') });
  assert.deepEqual(shown(), [true, false, false, false, false]);
  assert.deepEqual(headings.get('finding-h').focused, { preventScroll: true });
  assert.equal(headings.get('finding-h').tabindex, '-1');
  assert.equal(document.activeElement, headings.get('finding-h'));
});

test('the step in view: the last whose top passed the line under the header, else the first', () => {
  assert.equal(stepAt([0, 500, 1000], 188), 0);
  assert.equal(stepAt([-900, 188, 1000], 188), 1, 'a top on the line counts');
  assert.equal(stepAt([-2000, -1000, 100], 188), 2);
  assert.equal(stepAt([300, 900], 188), 0, 'the first before any passes');
  assert.equal(LINE_PX, 48, 'the section menu\'s rule (web/client/topbar.js)');
  assert.match(readFileSync(REPO_ROOT + 'web/client/topbar.js', 'utf8'), /Math\.max\(height, 0\) \+ 48/);
});

test('a figure scales to fit the room under the head, never up and never below the least', () => {
  assert.equal(zoomFor(500, 600), 1);
  assert.equal(zoomFor(600, 540), 0.9);
  assert.equal(zoomFor(1000, 100), MIN_ZOOM);
  assert.equal(MIN_ZOOM, 0.9, 'R26: legible at 1280 by 720');
  assert.equal(zoomFor(0, 500), 1);
});

// ---------- the field's dots ----------

const view = { scenario: 'high', use: 1.15, stateCode: states.selected };
const k = SCENARIOS.indexOf(view.scenario);

test('step 1\'s dots: every drawn hospital at its place in the selected case\'s strip', () => {
  const layout = stripsLayout({ items, drawing: 'wide', top, selected: view.scenario, use: view.use });
  const pts = fieldPoints('finding', { view, items, top, states, both });
  assert.equal(pts.size, items.length);
  items.forEach((r, i) => {
    const p = pts.get(r.ccn);
    assert.deepEqual([p.x, p.y], layout.strips[k].at[i]);
    assert.equal(p.tone, 'pen');
  });
  // A group lit on the chips: only its hospitals, where the group's strips put them.
  const only = (r) => r.state === 'TX';
  const lit = fieldPoints('finding', { view, items, top, only, states, both });
  assert.equal(lit.size, items.filter(only).length);
});

test('step 3\'s dots: every drawn hospital inside its own state\'s bubble', () => {
  const layout = statesLayout({ model: states, drawing: 'wide', k, use: view.use, selected: view.stateCode });
  const bubble = new Map(layout.points.map((p) => [p.code, p]));
  const pts = fieldPoints('states', { view, items, top, states, both });
  assert.equal(pts.size, items.filter((r) => bubble.has(r.state)).length);
  for (const r of items) {
    const p = pts.get(r.ccn);
    const b = bubble.get(r.state);
    if (!b) continue;
    assert.ok(Math.hypot(p.x - b.x, p.y - b.y) <= b.r, `${r.ccn} inside ${r.state}`);
  }
});

test('step 5\'s dots: every plotted hospital and every strip hospital where Figure 5 puts it, the corner in pen', () => {
  const layout = bothLayout({ model: both, drawing: 'wide', k, use: view.use });
  const pts = fieldPoints('both', { view, items, top, states, both });
  assert.equal(pts.size, both.pts.length + both.strip.length);
  const on = new Set(layout.on.map(String));
  const off = new Set(layout.off.map(String));
  for (const p of both.pts) {
    const d = pts.get(p.ccn);
    const where = String([d.x, d.y]);
    assert.ok(isBoth(both, p, k, view.use) ? on.has(where) : off.has(where), p.ccn);
    assert.equal(d.tone, isBoth(both, p, k, view.use) ? 'pen' : FIELD_CONTEXT);
    assert.equal(d.x, layout.sx(xOf(p, k, view.use)));
  }
  both.strip.forEach((s, i) => assert.deepEqual([pts.get(s.ccn).x, pts.get(s.ccn).y], layout.stripDots[i]));
});

test('the flight: a hospital in both figures moves, one only in the first fades out, one only in the second fades in; the page\'s last, in ink', () => {
  const from = new Map([['a', { x: 0, y: 0, r: 1, tone: 'pen' }], ['b', { x: 10, y: 10, r: 1, tone: 'pen' }], ['p', { x: 5, y: 5, r: 1, tone: 'pen' }]]);
  const to = new Map([['a', { x: 100, y: 50, r: 2, tone: 'pen-scar' }], ['c', { x: 30, y: 30, r: 2, tone: 'ink-3' }], ['p', { x: 60, y: 60, r: 2, tone: 'pen' }]]);
  const shown = flightOf(from, to, { shown: true, page: 'p' });
  const by = Object.fromEntries(shown.map((d) => [d.ccn, d]));
  assert.deepEqual([by.a.x0, by.a.x1, by.a.a0, by.a.a1, by.a.tone], [0, 100, 1, 1, 'pen-scar']);
  assert.deepEqual([by.b.x0, by.b.x1, by.b.a0, by.b.a1], [10, 10, 1, 0]);
  assert.deepEqual([by.c.x0, by.c.x1, by.c.a0, by.c.a1], [30, 30, 0, 1]);
  assert.equal(shown.at(-1).ccn, 'p');
  assert.equal(shown.at(-1).tone, 'ink');
  // From a figure not on screen (a step between): the dots appear as they fly.
  assert.ok(flightOf(from, to, { shown: false }).filter((d) => from.has(d.ccn)).every((d) => d.a0 === 0));
  // The run: where it left at the start, where it lands at the end.
  const d = by.a;
  assert.deepEqual(dotAt(d, 0, 1000), { x: 0, y: 0, r: 1, a: 1 });
  assert.deepEqual(dotAt(d, FLIGHT_MS + STAGGER_MS, 1000), { x: 100, y: 50, r: 2, a: 1 });
});

test('a drawing\'s points onto the screen box its SVG takes', () => {
  const pts = new Map([['a', { x: 340, y: 100, r: 2, tone: 'pen' }]]);
  assert.deepEqual(onScreen(pts, { width: 680, height: 400 }, { left: 600, top: 200, width: 340, height: 200 }).get('a'), { x: 770, y: 250, r: 1, tone: 'pen' });
});

// ---------- Figure 1's table follows the use rate ----------

test('Figure 1\'s table: the build\'s cells are binsOf at the default; the script rewrites them at any use rate and back', () => {
  const section = sectionOf('finding');
  const cells = [...section.matchAll(/<(td)([^>]*) data-bin="([^"]+)">([^<]*)<\/td>/g)].map(([, , attrs, bin, text]) => {
    const node = { dataset: { bin, value: /data-value="([^"]*)"/.exec(attrs)?.[1] }, textContent: text };
    return [node, ...bin.split(' ')];
  });
  const server = binsOf(items, top);
  assert.equal(cells.length, SCENARIOS.length * (server.edges.length - 1 + 1));
  const snapshot = () => cells.map(([node]) => `${node.textContent}|${node.dataset.value}`);
  const before = snapshot();
  rebin(cells, server);
  assert.deepEqual(snapshot(), before, 'the default rewrites to the build\'s own cells');
  const up = binsOf(items, top, 1.25);
  for (const c of up.counts) assert.equal(c.reduce((a, b) => a + b, 0), items.length, 'every drawn hospital in one bin');
  rebin(cells, up);
  assert.notDeepEqual(snapshot(), before);
  assert.ok(up.medians.every((m, i) => Math.abs(m - server.medians[i] * 1.25) < 1e-12), 'the medians scale with the use rate');
  rebin(cells, binsOf(items, top, 1));
  assert.deepEqual(snapshot(), before);
});

// A short window: past the least zoom the drawings give way (narrowed, so shortened), and the words keep their size.
test('drawingShare: the share of their width the drawings keep so the figure fits, never below MIN_DRAWING nor above 1', () => {
  assert.equal(drawingShare(0, 300), 1, 'not over: unchanged');
  assert.equal(drawingShare(-20, 300), 1);
  assert.equal(drawingShare(60, 300), 0.8, 'over by a fifth of the drawings\' height');
  assert.equal(drawingShare(1000, 300), MIN_DRAWING);
  assert.equal(drawingShare(50, 0), 1, 'no drawing to narrow');
  assert.ok(MIN_DRAWING >= 0.5 && MIN_DRAWING < 1);
});
