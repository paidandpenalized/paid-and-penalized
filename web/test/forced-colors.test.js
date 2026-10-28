// Forced colors (Windows contrast themes) repaint backgrounds and drop CSS gradients, so a mark drawn as a
// background or a hatch vanishes unless the stylesheet's forced-colors blocks give it a system color. This test
// lists every mark class and checks that some forced-colors block names it. A new mark class belongs in MARKS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FILES = ['web/styles/charts.css', 'web/styles/whatif.css', 'web/styles/components.css', 'web/styles/shell.css', 'sites/hacrp/web/styles.css', 'hub/styles.css'];
const MARKS = [
  // the chart kit's marks and the figure key's swatches
  '.chart-bar', '.chart-bar-na', '.chart-col', '.chart-col--pen', '.chart-this', '.chart-hyp', '.chart-median', '.chart-line',
  '.chart-boundary', '.chart-zone', '.chart-hatch', '.chart-dead__end', '.chart-tile', '.chart-tile-na', '.chart-tile-empty',
  '.chart-tile-zero', '.chart-tile-few', '.chart-geo-state', '.chart-geo-few', '.chart-geo-dot', '.chart-geo-halo', '.fig__swatch--this', '.fig__swatch--median', '.fig__swatch--same',
  // the money's charts (treemap, acrossLine, pairBars, geo usBubbles, columns)
  '.chart-tree__group', '.chart-tree__tile', '.chart-across__dot', '.chart-across__dot--over', '.chart-across__dot--faint', '.chart-pair__a',
  '.chart-pair__b', '.chart-land', '.chart-bubble', '.chart-col--rew',
  // the cliff (web/charts/cliff.js; its strip of every score is two paths in .chart-dist and .chart-col--pen)
  '.chart-cliff__ledge', '.chart-cliff__drop', '.chart-cliff__floor', '.chart-cliff__dot', '.chart-cliff__dot--over', '.chart-cliff__ring',
  '.chart-dist',
  // the dollars on the hospital page (sites/hacrp/web/styles.css): the statement's bars and key, the hatched boxes
  '.stmt__part', '.stmt__scope', '.stmt__cut', '.stmt__add', '.stmt__sw--part', '.stmt__sw--scope', '.stmt__sw--cut',
  '.money__range-bar',
  // the back-test's strips (bandStrips.js)
  '.chart-bt__ruler', '.chart-bt__band', '.chart-bt__band--borrowed', '.chart-bt__dot', '.chart-bt__exact',
  // the what-if's cliff
  '.wi-cliff__pit', '.wi-cliff__ledge', '.wi-cliff__drop', '.wi-cliff__floor', '.wi-cliff__dot', '.wi-cliff__dot.is-over', '.wi-cliff__start',
  // the what-if's bars and ramp
  '.wi-bar', '.wi-bars__row--assigned .wi-bar', '.wi-tri--cms', '.wi-tri--hyp', '.wi-ramp__line', '.wi-ramp__zone',
  // hatched page parts
  '.pill--na', '.hosp__none',
  // the program and place pages' marks (sites/hacrp/web/styles.css)
  '.chart-dots--pen', '.chart-dots--hl', '.chart-dots--ink', '.chart-dots--faint', '.chart-dots--pen-faint', '.chart-dots--ring', '.chart-dots--scatter',
  '.chart-rule__ink', '.chart-rule__pen', '.chart-rule__bar', '.chart-rule__hl', '.chart-rule__line', '.chart-punch__card', '.chart-punch__hole',
  '.chart-punch__bar', '.chart-punch__yes', '.chart-ref', '.chart-same', '.chart-sil', '.chart-pull__line', '.chart-slide__stock', '.chart-slide__hair',
  '.chart-slide__glass', '.chart-slide__mean', '.chart-loupe__glass', '.chart-loupe__beam', '.chart-loupe__gap', '.chart-share__track', '.chart-share__stem',
  '.chart-share__dot', '.chart-agree__cell', '.chart-agree__sq', '.chart-scatter__bg', '.chart-card', '.chart-card__m', '.chart-card__a', '.chart-card__none',
  '.chart-place__dot--pen', '.chart-place__dot--ring', '.chart-place__dot--faint', '.chart-geo-near', '.chart-geo-mine', '.chart-outline', '.chart-swarm__ring',
  // the hub's hospital page (hub/styles.css): the dollar rows' bars, median ticks and key, the hatched rows
  '.hh__bar', '.hh__tick', '.hh__key-tick', '.hh__out', '.hh__nextbox',
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
  for (const mark of ['.fig__swatch--same', '.pill--na', '.hosp__none', '.wi-bar']) {
    const rule = new RegExp(`${escape(mark)}[^{]*\\{[^}]*forced-color-adjust: none`);
    assert.match(forced, rule, `${mark} opts out of the adjustment`);
  }
});
