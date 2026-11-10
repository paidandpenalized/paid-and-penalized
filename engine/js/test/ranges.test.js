// The likely ranges' bar and the band check (engine/js/dollars/ranges.js rangeBar, checkNetBands), on invented bands;
// the ranges themselves are tested with the HACRP site's money (sites/hacrp/test/money.test.js), which re-exports them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkNetBands, rangeBar } from '../dollars/ranges.js';

test('rangeBar: the range\'s ends and the estimate as places along a span stretched to hold the estimate', () => {
  assert.deepEqual(rangeBar([-400, -200], -300), { lo: '0.000', hi: '1.000', at: '0.500' });
  // An estimate outside its range (a range is a multiple of it, so only by rounding) widens the span to hold it.
  assert.deepEqual(rangeBar([10, 20], 30), { lo: '0.000', hi: '0.500', at: '1.000' });
  // No width, nothing to draw.
  assert.equal(rangeBar([5, 5], 5), null);
});

test('checkNetBands: every band a net\'s likely range can take, or a message naming the missing one and the site', () => {
  const band = { strata: [], overall: { low: 1, high: 1 } };
  const measures = { net: band, hrrp: band, hvbp: band, hac: band };
  assert.doesNotThrow(() => checkNetBands({ measures }, 'Site'));
  for (const m of Object.keys(measures)) {
    const { [m]: _, ...rest } = measures;
    assert.throws(() => checkNetBands({ measures: rest }, 'Site'), new RegExp(`^RangeError: Site: .*no back-test ${m} band \\(bands\\.measures\\.${m}\\)`), m);
  }
  assert.throws(() => checkNetBands(null, 'Site'), /no back-test net band/);
});
