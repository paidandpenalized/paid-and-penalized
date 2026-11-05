// columns(): the optional bands shade the axis's groups behind the columns; without them the chart is as it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { columns } from '../charts/columns.js';

const args = { bins: [{ x0: 0, x1: 1, n: 3, cls: 'chart-col', tip: 'a' }, { x0: 1, x1: 2, n: 5, cls: 'chart-col', tip: 'b' }], domain: [0, 4], ticks: [0, 2, 4], format: String, width: 300, height: 150 };

test('columns: no bands, no band marks; bands add one rect and label each, every other one tinted', () => {
  const plain = columns(args).text;
  assert.ok(!plain.includes('chart-band'));
  assert.equal(columns({ ...args, bands: null }).text, plain);
  const banded = columns({ ...args, bands: [{ x0: 0, x1: 1, label: 'A' }, { x0: 1, x1: 3, label: 'B' }, { x0: 3, x1: 4, label: 'C' }] }).text;
  assert.equal(banded.match(/<rect class="chart-band( chart-band--tint)?"/g).length, 3);
  assert.equal(banded.match(/chart-band--tint/g).length, 2);
  assert.deepEqual([...banded.matchAll(/class="chart-band__label"[^>]*>([^<]+)</g)].map((m) => m[1]), ['A', 'B', 'C']);
  assert.ok(banded.indexOf('chart-band') < banded.indexOf('chart-col'), 'behind the columns');
});
