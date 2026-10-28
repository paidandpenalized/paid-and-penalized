import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HUB_COLS, decodeRows, loadHubAsset } from '../client/hub-asset.js';

// An invented asset: one row of each status, a column order that is not the build's (the decoder reads by name).
const row = (over) => {
  const base = {
    ccn: '990001', name: 'Hospital A', city: 'Town', state: 'ZZ', status: 'e', band: 1, teach: 'none', x: 100.5, y: 200.1,
    base: 800, total: 1000, hrrp: -30, hvbp: 20, hac: 0, net: -10, hrrpF: 0.99, vbpF: 1.002, cut: 0, hrrpL: 1, vbpL: 1, tdr: 1,
  };
  return { ...base, ...over };
};
const asset = (rows, order = HUB_COLS) => ({ fy: 2026, mapW: 975, mapH: 605, cols: [...order], rows: rows.map((r) => order.map((c) => r[c])) });

test('decodeRows reads columns by name, so the order of the build\'s columns does not matter', () => {
  const rows = [row({}), row({ ccn: '990002', status: 'm', band: null, teach: null, x: null, y: null, tdr: 0, base: null, total: null, hrrp: null, hvbp: null, hac: null, net: null, hrrpF: null, vbpF: null, cut: null, hrrpL: null, vbpL: null })];
  const a = decodeRows(asset(rows));
  const b = decodeRows(asset(rows, [...HUB_COLS].reverse()));
  assert.deepEqual(b.hospitals, a.hospitals);
  assert.equal(a.hospitals.length, 2);
  assert.equal(a.byCcn.get('990002'), a.hospitals[1]);
  assert.deepEqual([a.fy, a.mapW, a.mapH], [2026, 975, 605]);
});

test('an estimated row decodes to its dollars, the derived after-pay and dollars at stake, the share and the percents of pay', () => {
  const [h] = decodeRows(asset([row({})])).hospitals;
  assert.deepEqual(h, {
    ccn: '990001', name: 'Hospital A', city: 'Town', state: 'ZZ', status: 'estimated', band: 1, teach: 'none', x: 100.5, y: 200.1, inTdr: true,
    est: {
      base: 800, total: 1000, hrrp: -30, hvbp: 20, hac: 0, net: -10, after: 990, atStake: 10, hrrpFactor: 0.99, vbpFactor: 1.002,
      cut: false, hrrpListed: true, vbpListed: true, share: -0.01,
      pct: { hrrp: -3, hac: 0, hvbp: 2, net: -1 },
    },
  });
});

test('a cut hospital\'s dollars at stake are its HAC dollars; an unlisted program decodes to false, not to zero dollars', () => {
  const [h] = decodeRows(asset([row({ cut: 1, hac: -10, net: -20, vbpL: 0, hvbp: 0, vbpF: 1 })])).hospitals;
  assert.equal(h.est.cut, true);
  assert.equal(h.est.hac, -h.est.atStake);
  assert.equal(h.est.vbpListed, false);
});

test('the other statuses decode to their words with no estimate', () => {
  const none = { base: null, total: null, hrrp: null, hvbp: null, hac: null, net: null, hrrpF: null, vbpF: null, cut: null, hrrpL: null, vbpL: null };
  const [m, n] = decodeRows(asset([row({ status: 'm', ...none, tdr: 0 }), row({ ccn: '990003', status: 'n', ...none })])).hospitals;
  assert.deepEqual([m.status, m.est, m.inTdr, n.status, n.est, n.inTdr], ['maryland', null, false, 'no-inputs', null, true]);
});

test('decodeRows stops on an asset it cannot read: a missing column, a short row, an unknown status, a missing number', () => {
  assert.throws(() => decodeRows({ ...asset([row({})]), cols: HUB_COLS.filter((c) => c !== 'net') }), RangeError);
  const short = asset([row({})]);
  short.rows[0].pop();
  assert.throws(() => decodeRows(short), RangeError);
  assert.throws(() => decodeRows(asset([row({ status: 'x' })])), RangeError);
  assert.throws(() => decodeRows(asset([row({ net: null })])), RangeError);
  assert.throws(() => decodeRows({}), TypeError);
  assert.throws(() => decodeRows(null), TypeError);
});

test('a flag that is not exactly 0 or 1 stops the decode: null, NaN, 2, true and "1" are not guessed into false', () => {
  for (const flag of ['cut', 'hrrpL', 'vbpL']) {
    for (const bad of [null, undefined, NaN, 2, -1, true, '1', 0.5]) {
      assert.throws(() => decodeRows(asset([row({ [flag]: bad })])), (e) => e instanceof RangeError && /^hub asset: /.test(e.message) && e.message.includes(flag), `${flag} ${String(bad)}`);
    }
  }
  // tdr is on every row, so a bad one stops even a row with no estimate.
  const none = { status: 'm', base: null, total: null, hrrp: null, hvbp: null, hac: null, net: null, hrrpF: null, vbpF: null, cut: null, hrrpL: null, vbpL: null };
  for (const bad of [null, undefined, NaN, 2, true, '0']) {
    assert.throws(() => decodeRows(asset([row({ tdr: bad })])), /^RangeError: hub asset: .*tdr/, `tdr ${String(bad)}`);
    assert.throws(() => decodeRows(asset([row({ ...none, tdr: bad })])), RangeError, `tdr ${String(bad)} on a row with no estimate`);
  }
  // 0 and 1 are the flags, and a row with no estimate still has null flags.
  const [h] = decodeRows(asset([row({ cut: 1, hac: -10, net: -20, hrrpL: 0, vbpL: 1, tdr: 0 })])).hospitals;
  assert.deepEqual([h.est.cut, h.est.hrrpListed, h.est.vbpListed, h.inTdr], [true, false, true, false]);
  assert.equal(decodeRows(asset([row({ ...none, tdr: 1 })])).hospitals[0].est, null);
});

test('loadHubAsset fetches and decodes once per url, and tries again after a failure', async () => {
  const real = globalThis.fetch;
  const calls = [];
  let fail = true;
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (fail) return { ok: false, status: 503 };
    return { ok: true, json: async () => JSON.parse(JSON.stringify(asset([row({})]))) };
  };
  try {
    await assert.rejects(loadHubAsset('/hub.json'), /503/);
    fail = false;
    const first = await loadHubAsset('/hub.json');
    assert.equal(first.hospitals.length, 1);
    assert.equal(await loadHubAsset('/hub.json'), first, 'same decoded asset');
    assert.deepEqual(calls, ['/hub.json', '/hub.json'], 'one failed fetch, one good one, none after');
    await loadHubAsset('/other.json');
    assert.equal(calls.length, 3);
  } finally {
    globalThis.fetch = real;
  }
});
