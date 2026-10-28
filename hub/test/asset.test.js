import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOWN_STATUSES } from '../../engine/js/dollars/status.js';
import { programDollars } from '../../engine/js/dollars/whatif.js';
import { STATUS_CODES, decodeRows } from '../../web/client/hub-asset.js';
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
    assert.equal(row[COLS.indexOf('status')], STATUS_CODES[h.status]);
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

test('every status a page has words for has one code, and no code is shared', () => {
  assert.deepEqual(Object.keys(STATUS_CODES), [...SHOWN_STATUSES]);
  const codes = Object.values(STATUS_CODES);
  assert.ok(codes.every((c) => typeof c === 'string' && c.length === 1));
  assert.equal(new Set(codes).size, codes.length);
});

// The real file has every kind of hospital the browser must carry, so the sweep below is not an easy one.
const KINDS = {
  'an estimated hospital with a HAC cut': (h) => h.est?.cut,
  'an estimated hospital with a bonus and no cut': (h) => h.est && !h.est.cut && h.est.hvbp > 0 && h.est.hrrp < 0,
  'an estimated hospital outside HVBP': (h) => h.est && !h.est.vbpListed,
  'an estimated hospital with no HRRP dollars': (h) => h.est && h.est.hrrp === 0,
  'a Maryland hospital': (h) => h.status === 'maryland',
  'a hospital with no estimate': (h) => h.status === 'no-inputs',
  'a hospital with no teaching status': (h) => h.teach === null,
  'a hospital outside the Thirty Day Readmissions file': (h) => !h.inTdr,
  'a hospital in it': (h) => h.inTdr && h.est,
};

test('every hospital decodes to what the build holds, and a decoded hospital can be re-run through the what-if arithmetic', () => {
  for (const [what, has] of Object.entries(KINDS)) assert.ok(hospitals.some(has), `the file has ${what}`);
  const decoded = decodeRows(JSON.parse(JSON.stringify(asset)));
  assert.deepEqual([decoded.fy, decoded.mapW, decoded.mapH], [asset.fy, asset.mapW, asset.mapH]);
  assert.equal(decoded.hospitals.length, hospitals.length);
  assert.equal(decoded.byCcn.size, hospitals.length);
  hospitals.forEach((h, i) => {
    const d = decoded.hospitals[i];
    const row = asset.rows[i];
    assert.equal(decoded.byCcn.get(h.ccn), d, h.ccn);
    assert.deepEqual([d.ccn, d.name, d.city, d.state, d.status, d.band, d.teach, d.inTdr, d.x, d.y],
      [h.ccn, h.name, h.city, h.state, h.status, h.band, h.teach, h.inTdr, row[COLS.indexOf('x')], row[COLS.indexOf('y')]], h.ccn);
    if (!h.est) {
      assert.equal(d.est, null, h.ccn);
      return;
    }
    const { pct, ...est } = d.est;
    assert.deepEqual(est, h.est, h.ccn);
    assert.deepEqual(pct, {
      hrrp: h.est.hrrp * 100 / h.est.total, hac: h.est.hac * 100 / h.est.total,
      hvbp: h.est.hvbp * 100 / h.est.total, net: h.est.net * 100 / h.est.total,
    }, h.ccn);
    assert.equal(programDollars(est).net, est.net, h.ccn);
  });
});
