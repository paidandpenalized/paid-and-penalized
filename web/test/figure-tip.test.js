// web/client/figure.js: a chart's tooltip can be hovered (WCAG 1.4.13). The pointer leaving a mark for the chart's empty
// space, or leaving the chart, hides it only HIDE_MS later, so it can cross onto the tooltip, which keeps it; leaving
// the tooltip hides it; Escape hides it wherever the pointer is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standIn } from './dom.js';
import { mountFigure } from '../client/figure.js';
import { HIDE_MS } from '../client/tooltip.js';

// An element that keeps its attributes, classes and listeners (several per event type).
function node(extra = {}) {
  const listeners = {};
  const attrs = {};
  const classes = new Set();
  const self = {
    hidden: false, textContent: '', className: '', dataset: {}, style: {}, offsetWidth: 80, isConnected: true,
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
    setAttribute: (k, v) => { attrs[k] = String(v); },
    getAttribute: (k) => attrs[k] ?? null,
    hasAttribute: (k) => k in attrs,
    removeAttribute: (k) => { delete attrs[k]; },
    addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); },
    fire: (type, e = {}) => { for (const fn of listeners[type] ?? []) fn({ type, pointerType: 'mouse', ...e }); },
    contains: (x) => x === self,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 200 }),
    closest: () => null,
    ...extra,
  };
  return self;
}

// A figure holding one chart with two marks, wired by mountFigure; its tooltip, its document and the timers mocked.
function chart(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const doc = node({ createElement: () => node(), getElementById: () => null });
  standIn(t, { document: doc, window: node() });
  const marks = [0, 1].map(() => node({ querySelector: () => ({ textContent: 'A mark', remove() {} }) }));
  for (const m of marks) m.closest = (sel) => (sel === '[data-mark]' ? m : null);
  const svg = node({ querySelectorAll: () => marks });
  svg.contains = (x) => x === svg || marks.includes(x);
  const kids = [];
  const fig = node({ id: 'f', append: (x) => kids.push(x), querySelector: () => null, querySelectorAll: (s) => (s === 'svg.chart' ? [svg] : []) });
  mountFigure(fig);
  const tip = kids.find((k) => k.getAttribute('role') === 'tooltip');
  assert.ok(tip, 'a tooltip');
  const empty = node();
  return { doc, svg, marks, tip, empty, tick: (ms) => t.mock.timers.tick(ms) };
}

test('the tooltip waits for the pointer to cross onto it, and stays while the pointer is on it', (t) => {
  const { svg, marks, tip, empty, tick } = chart(t);
  svg.fire('pointerover', { target: marks[0] });
  assert.equal(tip.hidden, false, 'shown on a mark');
  svg.fire('pointerover', { target: empty });
  tick(HIDE_MS - 1);
  assert.equal(tip.hidden, false, 'still shown while the pointer crosses the gap');
  svg.fire('pointerleave');
  tip.fire('pointerenter');
  tick(HIDE_MS * 4);
  assert.equal(tip.hidden, false, 'kept while the pointer is on it');
  tip.fire('pointerleave');
  tick(HIDE_MS);
  assert.equal(tip.hidden, true, 'hidden once the pointer leaves it');
});

test('the pointer on the chart\'s empty space hides the tooltip a moment later; back on a mark, it stays', (t) => {
  const { svg, marks, tip, empty, tick } = chart(t);
  svg.fire('pointerover', { target: marks[0] });
  svg.fire('pointerover', { target: empty });
  svg.fire('pointerover', { target: marks[1] });
  tick(HIDE_MS * 2);
  assert.equal(tip.hidden, false, 'a mark reached in time keeps it');
  svg.fire('pointerover', { target: empty });
  tick(HIDE_MS);
  assert.equal(tip.hidden, true);
});

test('Escape hides a tooltip the pointer shows, and a press on the tooltip keeps it', (t) => {
  const { doc, svg, marks, tip } = chart(t);
  svg.fire('pointerover', { target: marks[0] });
  doc.fire('pointerdown', { target: tip });
  assert.equal(tip.hidden, false, 'a press on the tooltip');
  doc.fire('keydown', { key: 'Escape' });
  assert.equal(tip.hidden, true, 'Escape');
});

test('a press on the tooltip keeps it up though it takes the focus from the chart; any other blur hides it', async (t) => {
  const { svg, marks, tip } = chart(t);
  svg.fire('pointerover', { target: marks[0] });
  tip.fire('pointerdown');
  svg.fire('blur');
  assert.equal(tip.hidden, false, 'the press\'s blur');
  t.mock.timers.tick(0);
  svg.fire('blur');
  assert.equal(tip.hidden, true, 'a later blur');
});
