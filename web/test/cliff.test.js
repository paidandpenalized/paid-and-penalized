// The cliff chart (web/charts/cliff.js): the money a flat cut takes at any score, on synthetic numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE } from '../charts/figure.js';
import { cliff } from '../charts/cliff.js';

const LABELS = { zero: '$0', zeroWords: 'at any score up to 0.30', cut: '$500K', cutWords: 'at any score from 0.31', line: 'Line', actual: 'This', actualValue: '0.50', highest: 'Highest', highestValue: '2.00' };
const draw = (over) => String(cliff({ domain: [-1, 2], band: [0.3, 0.31], actual: over ? 0.5 : 0.1, labels: LABELS, cut: -500_000 }));

test('the ledge at $0 up to the line, the floor at the cut past it; the dot on the floor only over the line', () => {
  const over = draw(true);
  const under = draw(false);
  for (const svg of [over, under]) {
    assert.match(svg, /class="chart-cliff__ledge"/);
    assert.match(svg, /class="chart-cliff__drop"/);
    assert.match(svg, /class="chart-cliff__floor"/);
    assert.ok(svg.includes('data-value="0"') && svg.includes('data-value="-500000"'), 'both levels plot their dollars');
    assert.ok(svg.includes('$500K') && svg.includes('$0'));
  }
  assert.match(over, /chart-cliff__dot chart-cliff__dot--over/);
  assert.doesNotMatch(under, /chart-cliff__dot--over/);
  // The ledge ends where the drop stands, and the floor starts there.
  const x = (svg, cls, attr) => Number(new RegExp(`class="${cls}" x1="([\\d.]+)" x2="([\\d.]+)"`).exec(svg)[attr]);
  assert.equal(x(over, 'chart-cliff__ledge', 2), x(over, 'chart-cliff__floor', 1));
});

test('a wide drawing is taller with larger dollars; bad inputs throw', () => {
  const wide = String(cliff({ domain: [-1, 2], band: [0.3, 0.31], actual: 0.5, labels: LABELS, cut: -1, width: PAGE }));
  const narrow = draw(true);
  const height = (svg) => Number(/viewBox="0 0 \d+ (\d+)"/.exec(svg)[1]);
  assert.ok(height(wide) > height(narrow));
  assert.throws(() => cliff({ domain: [2, -1], band: [0.3, 0.31], actual: 0, labels: LABELS, cut: -1 }), RangeError);
  assert.throws(() => cliff({ domain: [-1, 2], band: [0.3, 0.31], actual: 0, labels: LABELS, cut: 1 }), RangeError);
});

test('the highest score\'s label sits just above its ring, or is left off where this hospital\'s label would run into it', () => {
  // The page's own lengths of words.
  const long = { ...LABELS, actual: 'This hospital', actualValue: '0.3200', highest: 'Highest score', highestValue: '2.0000' };
  const near = String(cliff({ domain: [-1, 2], band: [0.3, 0.31], actual: 0.32, labels: long, cut: -1 }));
  assert.ok(!near.includes('Highest score 2.0000</text>'), 'a phone: the hospital near the line, its label in the way');
  assert.match(near, /class="chart-cliff__ring"/, 'the ring stays');
  const wide = String(cliff({ domain: [-1, 2], band: [0.3, 0.31], actual: 0.32, labels: LABELS, cut: -1, width: 1040 }));
  const at = /<text class="chart-note" x="([\d.]+)" y="([\d.]+)" text-anchor="end">Highest 2\.00<\/text>/.exec(wide);
  const ring = /<circle class="chart-cliff__ring" cx="([\d.]+)" cy="([\d.]+)"/.exec(wide);
  assert.ok(at && ring, 'wide: the label is drawn');
  assert.equal(Number(at[1]), Number(ring[1]), 'it ends at the ring');
  assert.equal(Number(ring[2]) - Number(at[2]), 12, 'just above it');
});

test('the strip of every score is two paths in the distribution\'s inks, one per side of the line, the same on every call (remembered)', () => {
  const edges = [-1, -0.5, 0, 0.3, 0.31, 1, 2];
  const strip = { edges, counts: [4, 9, 6, 0, 3, 1] };
  const svg = String(cliff({ domain: [-1, 2], band: [0.3, 0.31], actual: 0.1, labels: LABELS, cut: -500_000, strip }));
  assert.equal([...svg.matchAll(/<path class="chart-dist"/g)].length, 1, 'the bins short of the line');
  assert.equal([...svg.matchAll(/<path class="chart-col--pen"/g)].length, 1, 'the bins at or past it');
  assert.doesNotMatch(svg, /chart-cliff__bin/);
  // Each non-empty bin is one box in its path.
  const boxes = (cls) => (new RegExp(`<path class="${cls}" aria-hidden="true" d="([^"]*)"`).exec(svg)[1].match(/M/g) ?? []).length;
  assert.deepEqual([boxes('chart-dist'), boxes('chart-col--pen')], [3, 2]);
  assert.equal(String(cliff({ domain: [-1, 2], band: [0.3, 0.31], actual: 0.1, labels: LABELS, cut: -500_000, strip })), svg);
  // Without a strip, no path.
  assert.doesNotMatch(draw(true), /chart-dist/);
});

test('on a phone\'s drawing this hospital\'s label never lands on the cut level\'s label, at any score under the line', () => {
  const long = { ...LABELS, actual: 'This hospital', actualValue: '0.3200', cut: '$1.2M', cutWords: 'at any score from 0.31' };
  // Each text's box in the drawing's units: its start, its baseline and the line's height; widths are the drawing's own
  // estimates (a dollar amount about 0.62 em a character at 18 units, words about 6.4 units a character).
  const boxes = (svg) => [...svg.matchAll(/<text class="([^"]*)" x="([\d.]+)" y="([\d.]+)" text-anchor="(\w+)">(.*?)<\/text>/g)]
    .filter(([, cls]) => cls.includes('chart-label')).map(([, cls, x, y, anchor, body]) => {
      const plain = body.replace(/<[^>]+>/g, '');
      const w = cls.includes('--pen') ? 0.62 * 18 * long.cut.length + 6 + 6.4 * long.cutWords.length : 6.4 * plain.length;
      return { cls, y: Number(y), x0: anchor === 'end' ? Number(x) - w : Number(x), x1: anchor === 'end' ? Number(x) : Number(x) + w };
    });
  for (let actual = -1; actual < 0.3; actual += 0.05) {
    const svg = String(cliff({ domain: [-1, 2], band: [0.3, 0.31], actual, labels: long, cut: -500_000 }));
    const [mine, cut] = [boxes(svg).find((b) => b.cls.includes('halo')), boxes(svg).find((b) => b.cls.includes('--pen'))];
    const across = Math.min(mine.x1, cut.x1) - Math.max(mine.x0, cut.x0) > 0;
    assert.ok(!across || Math.abs(mine.y - cut.y) > 18, `score ${actual.toFixed(2)}: the labels share ${Math.abs(mine.y - cut.y)} units of height across`);
  }
});
