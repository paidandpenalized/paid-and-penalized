// The cliff chart (web/charts/cliff.js): the money a flat cut takes at any score, on synthetic numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIFF_WIDE, cliff } from '../charts/cliff.js';

const LABELS = { zero: '$0', zeroWords: 'at any score up to 0.30', cut: '$500K', cutWords: 'at any score from 0.31', line: 'Line', actual: 'This', actualValue: '0.50', highest: 'Highest', highestValue: '2.00' };
const draw = (over) => String(cliff({ domain: [-1, 2], band: [0.3, 0.31], actual: over ? 0.5 : 0.1, labels: LABELS, values: { zero: 0, cut: -500_000 } }));

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
  const wide = String(cliff({ domain: [-1, 2], band: [0.3, 0.31], actual: 0.5, labels: LABELS, values: { zero: 0, cut: -1 }, width: CLIFF_WIDE }));
  const narrow = draw(true);
  const height = (svg) => Number(/viewBox="0 0 \d+ (\d+)"/.exec(svg)[1]);
  assert.ok(height(wide) > height(narrow));
  assert.throws(() => cliff({ domain: [2, -1], band: [0.3, 0.31], actual: 0, labels: LABELS, values: { zero: 0, cut: -1 } }), RangeError);
  assert.throws(() => cliff({ domain: [-1, 2], band: [0.3, 0.31], actual: 0, labels: LABELS, values: { zero: 0, cut: 1 } }), RangeError);
});

test('the highest score\'s label sits just above its ring, or is left off where this hospital\'s label would run into it', () => {
  // The page's own lengths of words.
  const long = { ...LABELS, actual: 'This hospital', actualValue: '0.3200', highest: 'Highest score', highestValue: '2.0000' };
  const near = String(cliff({ domain: [-1, 2], band: [0.3, 0.31], actual: 0.32, labels: long, values: { zero: 0, cut: -1 } }));
  assert.ok(!near.includes('Highest score 2.0000</text>'), 'a phone: the hospital near the line, its label in the way');
  assert.match(near, /class="chart-cliff__ring"/, 'the ring stays');
  const wide = String(cliff({ domain: [-1, 2], band: [0.3, 0.31], actual: 0.32, labels: LABELS, values: { zero: 0, cut: -1 }, width: 1040 }));
  const at = /<text class="chart-note" x="([\d.]+)" y="([\d.]+)" text-anchor="end">Highest 2\.00<\/text>/.exec(wide);
  const ring = /<circle class="chart-cliff__ring" cx="([\d.]+)" cy="([\d.]+)"/.exec(wide);
  assert.ok(at && ring, 'wide: the label is drawn');
  assert.equal(Number(at[1]), Number(ring[1]), 'it ends at the ring');
  assert.equal(Number(ring[2]) - Number(at[2]), 12, 'just above it');
});
