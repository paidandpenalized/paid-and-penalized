// Forced colors (Windows contrast themes) repaint backgrounds and drop CSS gradients, so a mark drawn as a
// background or a hatch vanishes unless the stylesheet's forced-colors blocks give it a system color. This test
// lists every mark class and checks that some forced-colors block names it. A new mark class belongs in MARKS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FILES = ['web/styles/charts.css', 'web/styles/whatif.css', 'web/styles/components.css', 'sites/hacrp/web/styles.css'];
const MARKS = [
  // the chart kit's marks and the figure key's swatches
  '.chart-bar', '.chart-bar-na', '.chart-col', '.chart-col--pen', '.chart-this', '.chart-hyp', '.chart-median', '.chart-line',
  '.chart-boundary', '.chart-zone', '.chart-hatch', '.chart-dead__end', '.chart-tile', '.chart-tile-na', '.chart-tile-empty',
  '.chart-tile-zero', '.chart-tile-few', '.fig__swatch--this', '.fig__swatch--median', '.fig__swatch--same',
  // the what-if's bars and ramp
  '.wi-bar', '.wi-bars__row--assigned .wi-bar', '.wi-tri--cms', '.wi-tri--hyp', '.wi-ramp__line', '.wi-ramp__zone',
  // hatched page parts
  '.pill--na', '.hero__none',
];

// The text of every @media (forced-colors: active) block, braces balanced.
function forcedBlocks(css) {
  const out = [];
  let at = css.indexOf('@media (forced-colors: active)');
  while (at >= 0) {
    let i = css.indexOf('{', at) + 1;
    let depth = 1;
    const start = i;
    for (; depth > 0; i++) depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0;
    out.push(css.slice(start, i - 1));
    at = css.indexOf('@media (forced-colors: active)', i);
  }
  return out;
}

const forced = FILES.flatMap((f) => forcedBlocks(readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8'))).join('\n');
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('every mark class has a forced-colors rule, so no bar, mark or hatch vanishes in a contrast theme', () => {
  for (const mark of MARKS) {
    // The class as a whole selector or the last part of one (not a longer class that starts the same way).
    assert.match(forced, new RegExp(`${escape(mark)}(?![\\w-])`), `${mark} has no forced-colors rule`);
  }
});

test('a state shown only by fill or shadow keeps a system-color cue under forced colors', () => {
  for (const state of ['.wi-btn[aria-expanded="true"]', '.theme-toggle[aria-pressed="true"]', '.wi-btn[aria-disabled="true"]', '.wi-number[aria-invalid="true"]', '.gb thead th']) {
    assert.match(forced, new RegExp(`${escape(state)}\\s*\\{[^}]*(Highlight|GrayText|CanvasText)`), `${state} has no forced-colors cue`);
  }
});

test('a hatch drawn with a CSS gradient is redrawn under forced colors with its own system colors', () => {
  for (const mark of ['.fig__swatch--same', '.pill--na', '.hero__none', '.wi-bar']) {
    const rule = new RegExp(`${escape(mark)}[^{]*\\{[^}]*forced-color-adjust: none`);
    assert.match(forced, rule, `${mark} opts out of the adjustment`);
  }
});
