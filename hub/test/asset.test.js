import { test } from 'node:test';
import assert from 'node:assert/strict';
import { programDollars } from '../../engine/js/dollars/whatif.js';
import { decodeRows } from '../../web/client/hub-asset.js';
import { loadHub } from '../data.js';
import { MAP_WIDTH, hubAsset } from '../asset.js';
import { hubHospitals } from '../model.js';

const hub = loadHub();
const hospitals = hubHospitals(hub);
const asset = hubAsset(hospitals, { shapes: hub.shapes, fy: hub.fy });
const COLS = ['ccn', 'name', 'city', 'state', 'status', 'band', 'teach', 'x', 'y', 'base', 'total', 'hrrp', 'hvbp', 'hac', 'net',
  'hrrpF', 'vbpF', 'cut', 'hrrpL', 'vbpL', 'tdr'];

test('the asset is one row per hospital in the column order the browser reads', () => {
  assert.equal(MAP_WIDTH, 975);
  assert.deepEqual(asset.cols, COLS);
  assert.equal(asset.fy, hub.fy);
  assert.equal(asset.mapW, MAP_WIDTH);
  assert.ok(Number.isInteger(asset.mapH) && asset.mapH > 0 && asset.mapH < asset.mapW);
  assert.equal(asset.rows.length, hospitals.length);
  hospitals.forEach((h, i) => {
    const row = asset.rows[i];
    assert.equal(row.length, COLS.length, h.ccn);
    assert.equal(row[0], h.ccn);
    assert.ok(row.every((v) => v !== undefined), `${h.ccn} has an undefined value`);
    assert.equal(row[COLS.indexOf('status')], { estimated: 'e', maryland: 'm', 'no-inputs': 'n' }[h.status]);
    assert.equal(row[COLS.indexOf('tdr')], h.inTdr ? 1 : 0);
    assert.equal(row[COLS.indexOf('band')], h.band);
    assert.equal(row[COLS.indexOf('teach')], h.teach);
  });
});

test('an estimated hospital has a place on the map inside its frame; the others have no dollars', () => {
  const at = (row, col) => row[COLS.indexOf(col)];
  let estimated = 0;
  asset.rows.forEach((row, i) => {
    const h = hospitals[i];
    if (h.est) {
      estimated += 1;
      const [x, y] = [at(row, 'x'), at(row, 'y')];
      assert.ok(Number.isFinite(x) && x >= 0 && x <= asset.mapW, `${h.ccn} x ${x}`);
      assert.ok(Number.isFinite(y) && y >= 0 && y <= asset.mapH, `${h.ccn} y ${y}`);
      for (const v of [x, y]) assert.ok(Math.abs(v * 10 - Math.round(v * 10)) < 1e-6, `${h.ccn} ${v} is not to a tenth`);
      for (const col of ['base', 'total', 'hrrp', 'hvbp', 'hac', 'net', 'hrrpF', 'vbpF']) assert.ok(Number.isFinite(at(row, col)), `${h.ccn} ${col}`);
      for (const col of ['cut', 'hrrpL', 'vbpL']) assert.ok([0, 1].includes(at(row, col)), `${h.ccn} ${col}`);
    } else {
      for (const col of ['base', 'total', 'hrrp', 'hvbp', 'hac', 'net', 'hrrpF', 'vbpF', 'cut', 'hrrpL', 'vbpL']) assert.equal(at(row, col), null, `${h.ccn} ${col}`);
    }
  });
  assert.equal(estimated, hospitals.filter((h) => h.est).length);
});

test('the asset stays small enough to ship to every page that draws the hospitals', () => {
  const size = JSON.stringify(asset).length;
  assert.ok(size < 700_000, `asset is ${size} bytes`);
});

test('hubAsset refuses a row whose after-pay or dollars at stake the browser could not derive', () => {
  const h = hospitals.find((x) => x.est);
  const broken = { ...h, est: { ...h.est, atStake: h.est.atStake + 1 } };
  assert.throws(() => hubAsset([broken], { shapes: hub.shapes, fy: hub.fy }), RangeError);
  const off = { ...h, est: { ...h.est, after: h.est.after + 1 } };
  assert.throws(() => hubAsset([off], { shapes: hub.shapes, fy: hub.fy }), RangeError);
});

test('a hospital with no location gets no place on the map', () => {
  const h = hospitals.find((x) => x.est);
  const [out] = hubAsset([{ ...h, lat: null, lon: null }], { shapes: hub.shapes, fy: hub.fy }).rows;
  assert.deepEqual([out[COLS.indexOf('x')], out[COLS.indexOf('y')]], [null, null]);
});

// Picked by property, never by name.
function picks() {
  const by = (pred) => hospitals.find(pred);
  return {
    'an estimated hospital with a HAC cut': by((h) => h.est?.cut),
    'an estimated hospital with a bonus and no cut': by((h) => h.est && !h.est.cut && h.est.hvbp > 0 && h.est.hrrp < 0),
    'an estimated hospital outside HVBP': by((h) => h.est && !h.est.vbpListed),
    'an estimated hospital with no HRRP dollars': by((h) => h.est && h.est.hrrp === 0),
    'a Maryland hospital': by((h) => h.status === 'maryland'),
    'a hospital with no estimate': by((h) => h.status === 'no-inputs'),
    'a hospital with no teaching status': by((h) => h.teach === null),
    'a hospital outside the Thirty Day Readmissions file': by((h) => !h.inTdr),
    'a hospital in it': by((h) => h.inTdr && h.est),
    'the first hospital': hospitals[0],
  };
}

test('decodeRows gives back every field of a hospital, picked by property', () => {
  const decoded = decodeRows(JSON.parse(JSON.stringify(asset)));
  assert.deepEqual([decoded.fy, decoded.mapW, decoded.mapH], [asset.fy, asset.mapW, asset.mapH]);
  assert.equal(decoded.hospitals.length, hospitals.length);
  assert.equal(decoded.byCcn.size, hospitals.length);
  const cases = Object.entries(picks());
  assert.equal(cases.length, 10);
  for (const [what, h] of cases) {
    assert.ok(h, `a fixture for ${what}`);
    const d = decoded.byCcn.get(h.ccn);
    assert.equal(d, decoded.hospitals[hospitals.indexOf(h)], what);
    assert.deepEqual([d.ccn, d.name, d.city, d.state, d.status, d.band, d.teach, d.inTdr], [h.ccn, h.name, h.city, h.state, h.status, h.band, h.teach, h.inTdr], what);
    const row = asset.rows[hospitals.indexOf(h)];
    assert.deepEqual([d.x, d.y], [row[COLS.indexOf('x')], row[COLS.indexOf('y')]], what);
    if (!h.est) {
      assert.equal(d.est, null, what);
      continue;
    }
    const { pct, ...est } = d.est;
    assert.deepEqual(est, h.est, what);
    assert.deepEqual(pct, {
      hrrp: h.est.hrrp * 100 / h.est.total, hac: h.est.hac * 100 / h.est.total,
      hvbp: h.est.hvbp * 100 / h.est.total, net: h.est.net * 100 / h.est.total,
    }, what);
  }
});

test('every hospital decodes to what the build holds, and a decoded hospital can be re-run through the what-if arithmetic', () => {
  const decoded = decodeRows(JSON.parse(JSON.stringify(asset)));
  hospitals.forEach((h, i) => {
    const d = decoded.hospitals[i];
    assert.equal(d.ccn, h.ccn);
    assert.deepEqual(d.est && { ...d.est, pct: undefined }, h.est && { ...h.est, pct: undefined }, h.ccn);
    if (d.est) assert.equal(programDollars(d.est).net, d.est.net, h.ccn);
  });
});
