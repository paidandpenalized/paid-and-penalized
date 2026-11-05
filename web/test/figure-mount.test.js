// web/client/figure.js: a page script that redraws a figure wires the new one with mountFigure; wiring twice does nothing more.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standIn } from './dom.js';
import { mountFigure } from '../client/figure.js';

test('mountFigure wires a figure once: a second call (or a second copy of the module) leaves it alone', (t) => {
  standIn(t, { document: { createElement: () => ({ setAttribute() {}, className: '' }) } });
  const attrs = new Set();
  const appended = [];
  const fig = {
    hasAttribute: (k) => attrs.has(k), setAttribute: (k) => attrs.add(k), append: (x) => appended.push(x),
    querySelector: () => null, querySelectorAll: () => [],
  };
  mountFigure(fig);
  mountFigure(fig);
  assert.equal(appended.length, 1, 'one live paragraph, not two');
  assert.ok(attrs.has('data-wired'));
});
