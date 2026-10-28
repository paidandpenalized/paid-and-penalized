import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BED_BAND_EDGES, PEER_MODES, bedBand, median, peerKey } from '../peers.js';

test('the bed band edges are frozen at under 100, 100 to 299, 300 to 499, 500 and more', () => {
  assert.deepEqual([...BED_BAND_EDGES], [100, 300, 500]);
  assert.ok(Object.isFrozen(BED_BAND_EDGES));
  assert.throws(() => BED_BAND_EDGES.push(900), TypeError);
});

test('bedBand: the index of the first edge above the count, null with no count', () => {
  assert.equal(bedBand(99), 0);
  assert.equal(bedBand(100), 1);
  assert.equal(bedBand(299), 1);
  assert.equal(bedBand(300), 2);
  assert.equal(bedBand(499), 2);
  assert.equal(bedBand(500), 3);
  assert.equal(bedBand(5000), 3);
  assert.equal(bedBand(null), null);
  assert.equal(bedBand(undefined), null);
  assert.equal(bedBand(NaN), null);
  assert.equal(bedBand(120.5), null);
});

test('the peer modes are state, size and teaching, in that order', () => {
  assert.deepEqual([...PEER_MODES], ['state', 'size', 'teach']);
  assert.ok(Object.isFrozen(PEER_MODES));
});

test('peerKey: a hospital\'s group in each mode', () => {
  const h = { state: 'ZZ', beds: 250, teach: 'minor' };
  assert.equal(peerKey(h, 'state'), 'ZZ');
  assert.equal(peerKey(h, 'size'), 'b1');
  assert.equal(peerKey(h, 'teach'), 'minor');
  assert.equal(peerKey({ ...h, beds: 40 }, 'size'), 'b0');
  assert.equal(peerKey({ ...h, beds: 820 }, 'size'), 'b3');
  for (const teach of ['major', 'minor', 'none']) assert.equal(peerKey({ ...h, teach }, 'teach'), teach);
});

test('peerKey is null where the attribute is missing, and the groups never merge', () => {
  assert.equal(peerKey({}, 'state'), null);
  assert.equal(peerKey({ state: '' }, 'state'), null);
  assert.equal(peerKey({ state: null }, 'state'), null);
  assert.equal(peerKey({ beds: null }, 'size'), null);
  assert.equal(peerKey({}, 'size'), null);
  assert.equal(peerKey({ teach: null }, 'teach'), null);
  assert.equal(peerKey({}, 'teach'), null);
  assert.equal(peerKey({ teach: 'unknown' }, 'teach'), null);
});

test('peerKey groups by a size band a hospital carries instead of its bed count', () => {
  assert.equal(peerKey({ band: 2 }, 'size'), 'b2');
  assert.equal(peerKey({ band: 0, beds: 820 }, 'size'), 'b0', 'the band wins');
  assert.equal(peerKey({ band: null, beds: 250 }, 'size'), null, 'a null band is no group');
  assert.equal(peerKey({ band: 9 }, 'size'), null, 'a band past the edges is no group');
  assert.equal(peerKey({ band: '1' }, 'size'), null);
});

test('peerKey refuses a mode it does not know', () => {
  assert.throws(() => peerKey({ state: 'ZZ' }, 'owner'), RangeError);
});

test('median: the middle value, the mean of the middle two, null for none', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([7]), 7);
  assert.equal(median([]), null);
  const input = [5, 1, 4];
  median(input);
  assert.deepEqual(input, [5, 1, 4]);
});
