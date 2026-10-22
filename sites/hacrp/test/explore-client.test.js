// The explorable figures' scripts (client/explore.js) against a stand-in DOM: the explore asset's loader, the measure
// buttons that show one measure's panel in every figure that has it, the halving button, the US map's two modes and
// a state picked on it, a place map's dots, and the score rule's order, which must be the order the build draws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exploreLoader, mountHalving, mountMeasureToggles, mountPlaceMaps, mountUsMap, ruleOrder } from '../client/explore.js';
import { hospitalRows } from '../web/generate.js';
import { PD, VIEWS } from './pinned.js';

// An element that keeps attributes, classes, listeners and children, and answers the few queries the scripts make.
function el(over = {}) {
  const node = {
    hidden: false, dataset: {}, attrs: {}, classes: new Set(), handlers: {}, textContent: '', children: [],
    setAttribute(k, v) { node.attrs[k] = String(v); },
    getAttribute: (k) => node.attrs[k] ?? null,
    addEventListener(type, fn) { node.handlers[type] = fn; },
    classList: { toggle: (c, on) => (on ? node.classes.add(c) : node.classes.delete(c)) },
    querySelector: () => null,
    querySelectorAll: () => [],
    ...over,
  };
  return node;
}

test('ruleOrder: the decided hospitals, lowest score first, ties by CCN, as the build draws the score rule', () => {
  const rows = [
    ['990003', 'C', 'X', 'AL', '0.5000', 'Yes'], ['990001', 'A', 'X', 'AL', '-0.2000', 'No'], ['990002', 'B', 'X', 'AL', '0.5000', 'No'],
    ['990004', 'D', 'X', 'AL', 'N/A', 'No'], ['990005', 'E', 'X', 'MD', '0.9000', 'N/A'], ['990006', 'F', 'X', 'AL', 'N/A', 'Yes'], ['990007', 'G', 'X', 'AL', '', 'No'],
  ];
  assert.deepEqual(ruleOrder(rows).map((h) => h.ccn), ['990001', '990002', '990003']);
  const [first] = ruleOrder(rows);
  assert.deepEqual(first, { ccn: '990001', name: 'A', city: 'X', state: 'AL', total: -0.2, text: '-0.2000', decision: 'No' });
  // On the pinned file, the browser's order from the hospitals asset is the build's from the data.
  const built = [...PD.decidedRows].sort((a, b) => a.total - b.total || (a.ccn < b.ccn ? -1 : 1)).map((r) => r.ccn);
  assert.deepEqual(ruleOrder(hospitalRows(VIEWS).rows).map((h) => h.ccn), built);
});

test('exploreLoader fetches the asset once, and lets a failure go so the next ask fetches again', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const responses = [{ ok: false, status: 503 }, { ok: true, json: async () => ({ rows: [] }) }];
  const fetched = [];
  globalThis.fetch = async (url) => { fetched.push(url); return responses.shift(); };
  const load = exploreLoader('/assets/hacrp-explore.test.json');
  await assert.rejects(load(), /HTTP 503/);
  const data = await load();
  assert.deepEqual(data, { rows: [] });
  assert.equal(await load(), data);
  assert.deepEqual(fetched, ['/assets/hacrp-explore.test.json', '/assets/hacrp-explore.test.json']);
});

test('the measure buttons show one measure\'s panel in every figure that has that measure', () => {
  const panels = (ids) => ids.map((id, i) => el({ dataset: { measure: id }, hidden: i > 0 }));
  const figure = (ids) => {
    const ps = panels(ids);
    const buttons = ids.map((id, i) => el({ dataset: { measure: id }, attrs: { 'aria-pressed': String(i === 0) } }));
    const group = el({ hidden: true, querySelectorAll: () => buttons });
    const fig = el({
      querySelector: (s) => ps.find((p) => s === `.mpanel[data-measure="${p.dataset.measure}"]`) ?? null,
      querySelectorAll: () => ps,
    });
    group.closest = () => fig;
    return { group, ps, buttons };
  };
  const one = figure(['A', 'B', 'C']);
  const two = figure(['A', 'B']);
  mountMeasureToggles({ querySelectorAll: () => [one.group, two.group] });
  assert.deepEqual([one.group.hidden, two.group.hidden], [false, false], 'the buttons appear when the script runs');
  // Pick B in the first figure: B shows in both.
  one.group.handlers.click({ target: { closest: () => one.buttons[1] } });
  for (const f of [one, two]) {
    assert.deepEqual(f.ps.map((p) => p.hidden), f.ps.map((p) => p.dataset.measure !== 'B'));
    assert.deepEqual(f.buttons.map((b) => b.attrs['aria-pressed']), f.buttons.map((b) => String(b.dataset.measure === 'B')));
  }
  // C is only in the first figure: the second keeps showing B.
  one.group.handlers.click({ target: { closest: () => one.buttons[2] } });
  assert.deepEqual(one.ps.map((p) => p.hidden), [true, true, false]);
  assert.deepEqual(two.ps.map((p) => p.hidden), [true, false], 'a figure without that measure is left as it was');
  // A click off the buttons does nothing.
  one.group.handlers.click({ target: { closest: () => null } });
  assert.deepEqual(one.ps.map((p) => p.hidden), [true, true, false]);
});

test('the halving button swaps its words and the top label, and moves the values\' dots while the z-scores stay', () => {
  const shape = el();
  const label = el();
  const button = el({ hidden: true, dataset: { on: 'Back to as reported', off: 'Halve', topOn: 'half', topOff: 'as reported' }, textContent: 'Halve' });
  button.closest = () => el({ querySelectorAll: (s) => (s === '[data-shift]' ? [shape] : s === '[data-shift-label]' ? [label] : []) });
  mountHalving({ querySelectorAll: (s) => (s === '[data-halve]' ? [button] : []) });
  assert.equal(button.hidden, false);
  button.handlers.click();
  assert.deepEqual([button.attrs['aria-pressed'], button.textContent, label.textContent, shape.classes.has('is-halved')], ['true', 'Back to as reported', 'half', true]);
  button.handlers.click();
  assert.deepEqual([button.attrs['aria-pressed'], button.textContent, label.textContent, shape.classes.has('is-halved')], ['false', 'Halve', 'as reported', false]);
});

test('the US map: the two modes switch what the map shows; a click on a state, or Enter on the active one, opens the path the page gives', () => {
  const assigned = [];
  const original = globalThis.window;
  globalThis.window = { location: { assign: (url) => assigned.push(url) } };
  try {
    const share = el({ dataset: { mode: 'share' } });
    const dots = el({ dataset: { mode: 'dots' } });
    const modes = el({ hidden: true, querySelectorAll: () => [share, dots] });
    const usmap = el({ dataset: { mode: 'share' } });
    const active = el({ dataset: { state: 'MD' } });
    const svg = el({ querySelector: (s) => (s === '.chart-mark.is-active[data-state]' ? active : null) });
    const fig = el({
      querySelector: (s) => (s === '.usmap__modes' ? modes : s === '.usmap' ? usmap : null),
      querySelectorAll: (s) => (s === 'svg.chart--us-map' ? [svg] : []),
    });
    mountUsMap(fig, (code) => `/s/${code.toLowerCase()}/`);
    assert.equal(modes.hidden, false);
    modes.handlers.click({ target: { closest: () => dots } });
    assert.equal(usmap.dataset.mode, 'dots');
    assert.deepEqual([share.attrs['aria-pressed'], dots.attrs['aria-pressed']], ['false', 'true']);
    modes.handlers.click({ target: { closest: () => null } });
    assert.equal(usmap.dataset.mode, 'dots', 'a click off the buttons changes nothing');
    svg.handlers.click({ target: { closest: () => el({ dataset: { state: 'AL' } }) } });
    svg.handlers.keydown({ key: 'Enter' });
    svg.handlers.keydown({ key: 'Tab' });
    svg.handlers.click({ target: { closest: () => null } });
    svg.handlers.click({ target: { closest: () => el() } });
    assert.deepEqual(assigned, ['/s/al/', '/s/md/']);
  } finally {
    if (original === undefined) delete globalThis.window;
    else globalThis.window = original;
  }
});

test('a place map\'s dots open their hospitals\' pages: a click on a dot, or Enter on the active one', () => {
  const assigned = [];
  const original = globalThis.window;
  globalThis.window = { location: { assign: (url) => assigned.push(url) } };
  try {
    const active = el({ dataset: { href: '/hacrp/hospital/990002/' } });
    const svg = el({ querySelector: (s) => (s === '.chart-mark.is-active[data-href]' ? active : null) });
    mountPlaceMaps({ querySelectorAll: (s) => (s === 'svg.chart--place-map' ? [svg] : []) });
    svg.handlers.click({ target: { closest: (s) => (s === '[data-href]' ? el({ dataset: { href: '/hacrp/hospital/990001/' } }) : null) } });
    svg.handlers.keydown({ key: 'Enter' });
    svg.handlers.keydown({ key: 'ArrowLeft' });
    svg.handlers.click({ target: { closest: () => null } });
    assert.deepEqual(assigned, ['/hacrp/hospital/990001/', '/hacrp/hospital/990002/']);
  } finally {
    if (original === undefined) delete globalThis.window;
    else globalThis.window = original;
  }
});
