// The canvases' colors (hub/client/colors.js): read from the tokens as the page has them, and one repaint per theme
// change however it arrives. Stand-ins for the browser's style, events, media query and mutation observer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onThemeChange, readColors } from '../client/colors.js';

test('readColors reads each token from the root\'s computed style, trimmed', () => {
  const seen = [];
  const root = {};
  globalThis.getComputedStyle = (el) => {
    assert.equal(el, root);
    return { getPropertyValue: (prop) => { seen.push(prop); return ` value${prop} `; } };
  };
  try {
    const c = readColors(root);
    assert.deepEqual(Object.keys(c).sort(), ['ink', 'ink2', 'ink3', 'line', 'neutral', 'paper', 'paper2', 'pen', 'penInk', 'rew']);
    assert.equal(c.ink2, 'value--ink-2');
    assert.equal(c.paper2, 'value--paper-2');
    assert.ok(seen.every((p) => p.startsWith('--')));
  } finally {
    delete globalThis.getComputedStyle;
  }
});

test('onThemeChange: the shell\'s event, the device\'s scheme and a flipped data-theme each repaint, once per frame, until stopped', () => {
  const listeners = new Map();
  const doc = {
    documentElement: {},
    addEventListener: (type, fn) => listeners.set(`doc:${type}`, fn),
    removeEventListener: (type) => listeners.delete(`doc:${type}`),
  };
  const query = { addEventListener: (type, fn) => listeners.set(`mq:${type}`, fn), removeEventListener: (type) => listeners.delete(`mq:${type}`) };
  let observed = null;
  let frames = [];
  const win = {
    matchMedia: (q) => { assert.equal(q, '(prefers-color-scheme: dark)'); return query; },
    requestAnimationFrame: (fn) => frames.push(fn),
    MutationObserver: class {
      constructor(fn) { this.fn = fn; }
      observe(target, options) { observed = { target, options, fn: this.fn }; }
      disconnect() { observed = null; }
    },
  };
  let calls = 0;
  const stop = onThemeChange(() => { calls += 1; }, { doc, win });
  assert.deepEqual(observed.options, { attributes: true, attributeFilter: ['data-theme'] });
  assert.equal(observed.target, doc.documentElement);
  // One toggle can say so twice (its event, and the attribute it flips): one repaint.
  listeners.get('doc:pp-theme')();
  observed.fn();
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(calls, 1);
  listeners.get('mq:change')();
  frames.shift()();
  assert.equal(calls, 2);
  stop();
  assert.equal(observed, null);
  assert.equal(listeners.size, 0);
});
