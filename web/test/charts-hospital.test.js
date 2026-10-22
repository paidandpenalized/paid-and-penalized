// The hospital page's chart kit pieces on made-up numbers: the line bar, the ruler, the waterfall, the ridges and the
// area map draw what they are given, refuse what can't be drawn, and keep every mark's value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineBar } from '../charts/lineBar.js';
import { ridges } from '../charts/ridges.js';
import { ruler } from '../charts/ruler.js';
import { waterfall } from '../charts/waterfall.js';
import { areaMap } from '../charts/geo.js';

const words = { actual: 'This', actualValue: '0.5', line: 'Line', lineValue: '0.3 and up', middle: 'Middle', middleValue: '0', low: 'lowest −1', high: 'highest 2', zone: 'cut' };

test('lineBar: the score, the middle and the line are marks with their values; the end labels give way to the needle', () => {
  const svg = String(lineBar({ domain: [-1, 2], actual: 0.5, band: [0.29, 0.3], middle: 0, labels: words }));
  assert.ok(svg.includes('data-value="0.5"') && svg.includes('data-value="0"') && svg.includes('data-value="0.29 0.3"'));
  assert.ok(svg.includes('lowest −1') && svg.includes('highest 2'));
  assert.doesNotMatch(String(lineBar({ domain: [-1, 2], actual: 1.95, band: [0.29, 0.3], middle: 0, labels: words })), /highest 2/);
  assert.doesNotMatch(String(lineBar({ domain: [-1, 2], actual: -0.95, band: [0.29, 0.3], middle: 0, labels: words })), /lowest −1/);
  assert.throws(() => lineBar({ domain: [2, -1], actual: 0, band: [0.29, 0.3], middle: 0, labels: words }), /lowest < highest/);
});

test('ruler: a ▲ at a value (in the penalty ink when marked), a note without one, a hollow ▲ for an assigned score', () => {
  const base = { id: 'r', domain: [0, 2], counts: [1, 3, 0, 2], floor: 0, cap: 1.6, median: 0.6, labels: { median: 'median 0.6', value: 'This', same: 'Same', note: 'no value' }, format: String };
  assert.match(String(ruler({ ...base, value: 0.9 })), /<path class="chart-this" d="M/);
  assert.match(String(ruler({ ...base, value: 0.9, pen: true })), /chart-this chart-this--pen/);
  const none = String(ruler({ ...base, value: null }));
  assert.doesNotMatch(none, /chart-this|chart-hyp/);
  assert.ok(none.includes('no value'));
  assert.match(String(ruler({ ...base, value: null, ghost: true })), /<path class="chart-hyp"/);
  const d = /<path class="chart-dist" aria-hidden="true" d="([^"]*)"/.exec(String(ruler({ ...base, value: 0.9 })))[1];
  assert.equal(d.match(/z/g).length, 3, 'one box per column with a count; an empty column draws nothing');
});

test('waterfall: each part starts where the last ended, the sum bar starts at zero, and the line is a mark', () => {
  const svg = String(waterfall({
    id: 'w', band: [0.29, 0.3], labels: { line: 'Line', lineTip: 'Line', zone: 'cut' },
    rows: [{ label: 'A', value: 0.4, valueText: '+0.4', tip: 'A' }, { label: 'B', value: -0.1, valueText: '−0.1', tip: 'B' }],
    total: { label: 'Sum', value: 0.3, valueText: '0.3', tip: 'Sum' },
  }));
  assert.ok(svg.includes('data-value="0.4"') && svg.includes('data-value="-0.1"') && svg.includes('data-value="0.3"') && svg.includes('data-value="0.29 0.3"'));
  assert.match(svg, /chart-step chart-step--down/);
  assert.equal((svg.match(/class="chart-connector"/g) ?? []).length, 2);
});

test('ridges: a row per group with its share, the words beside the plot when wide and over it when narrow', () => {
  const args = { edges: [0, 1, 2, 3], band: [1.4, 1.5], actual: 1.2, labels: { actual: 'This', actualValue: '1.2', line: 'Line', lineTip: 'Line' },
    rows: [{ label: 'All', sub: '9 hospitals', counts: [3, 4, 2], median: 1.1, share: '22% cut', tip: 'All' }, { label: 'State', sub: '5 hospitals', counts: [1, 3, 1], median: 1.3, share: '20% cut', tip: 'State' }] };
  const wide = String(ridges({ ...args, width: 560 }));
  const narrow = String(ridges({ ...args, width: 300 }));
  for (const svg of [wide, narrow]) {
    assert.ok(svg.includes('22% cut') && svg.includes('20% cut'));
    assert.ok(svg.includes('data-value="1.1"') && svg.includes('data-value="1.3"') && svg.includes('data-value="1.2"'));
  }
  assert.match(narrow, /<tspan class="chart-note">9 hospitals<\/tspan>/, 'narrow: the size beside the name');
  assert.equal((wide.match(/chart-col chart-col--pen/g) ?? []).length, 2, 'columns at or past the line take the penalty ink');
});

test('areaMap: null without a center or two places; numbered pins otherwise', () => {
  const shapes = new Map();
  const pts = [{ point: [-86.5, 34.7], n: 1, cls: 'chart-pin--no', tip: 'one' }, { point: [-86.9, 34.8], n: 2, cls: 'chart-pin--yes', tip: 'two' }];
  assert.equal(areaMap({ shapes, center: { point: null, tip: 'x' }, points: pts, label: 'Map' }), null);
  assert.equal(areaMap({ shapes, center: { point: [-86.6, 34.7], tip: 'x' }, points: pts.slice(0, 1), label: 'Map' }), null);
  const svg = String(areaMap({ shapes, center: { point: [-86.6, 34.7], tip: 'x' }, points: pts, rings: [{ miles: 10, label: '10 mi' }], label: 'Map' }));
  assert.equal((svg.match(/class="chart-pin /g) ?? []).length, 2);
  assert.match(svg, /<path class="chart-ring" d="M/);
  assert.throws(() => areaMap({ shapes, center: { point: [0, 0], tip: 'x' }, points: pts, label: '' }), /label/);
});
