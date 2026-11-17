import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { gzipSync } from 'node:zlib';
import { SHOWN_STATUSES } from '../../engine/js/dollars/status.js';
import { programDollars } from '../../engine/js/dollars/whatif.js';
import { STATUS_CODES, decodeRows } from '../../web/client/hub-asset.js';
import { hubModel, loadHub } from '../data.js';
import { MAP_WIDTH, hubAsset } from '../asset.js';
import { countedOnMap, hubHospitals } from '../model.js';
import { US_STATES } from '../../engine/js/states.js';
import { cmsNamed } from '../../pipeline/master.js';
import { decodeSearchAsset } from '../client/search.js';
import { shownName } from '../hospital/record.js';
import { searchAsset } from '../search/asset.js';

const hub = loadHub();
const hospitals = hubHospitals(hub);
const asset = hubAsset(hospitals, { shapes: hub.shapes, fy: hub.fy });
const COLS = ['ccn', 'name', 'city', 'state', 'status', 'beds', 'teach', 'x', 'y', 'base', 'total', 'hrrp', 'hvbp', 'hac', 'net',
  'hrrpF', 'vbpF', 'cut', 'hrrpL', 'vbpL', 'inHrrp', 'decided'];

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
    assert.equal(row[COLS.indexOf('inHrrp')], h.inHrrp ? 1 : 0);
    assert.equal(row[COLS.indexOf('cut')], h.cut ? 1 : 0);
    assert.equal(row[COLS.indexOf('decided')], h.decided ? 1 : 0);
    assert.equal(row[COLS.indexOf('beds')], h.beds);
    assert.equal(row[COLS.indexOf('teach')], h.teach);
  });
});

test('an estimated hospital has a place on the map inside its frame; the others have no dollars (but CMS\'s HAC decision)', () => {
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
      for (const col of ['base', 'total', 'hrrp', 'hvbp', 'hac', 'net', 'hrrpF', 'vbpF', 'hrrpL', 'vbpL']) assert.equal(at(row, col), null, `${h.ccn} ${col}`);
      assert.ok([0, 1].includes(at(row, 'cut')), `${h.ccn} cut`);
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

test('hubAsset refuses a row whose HAC dollars do not follow from the cut flag and the dollars at stake, or whose net is not the three added', () => {
  const build = (est) => hubAsset([{ ...hospitals.find((x) => x.est), est }], { shapes: hub.shapes, fy: hub.fy });
  const cut = hospitals.find((x) => x.est?.cut && x.est.atStake > 0).est;
  const uncut = hospitals.find((x) => x.est && !x.est.cut && x.est.atStake > 0).est;
  assert.doesNotThrow(() => build(cut));
  assert.doesNotThrow(() => build(uncut));
  const refuse = (est, what) => assert.throws(() => build(est), (e) => e instanceof RangeError && /^hub: /.test(e.message), what);
  refuse({ ...cut, hac: cut.hac - 1, net: cut.net - 1 }, 'a cut hospital whose HAC dollars are not minus the dollars at stake');
  refuse({ ...cut, hac: 0, net: cut.hrrp + cut.hvbp }, 'a cut hospital with no HAC dollars');
  refuse({ ...uncut, hac: -uncut.atStake, net: uncut.net - uncut.atStake }, 'an uncut hospital that pays the HAC cut');
  refuse({ ...uncut, hac: 1, net: uncut.net + 1 }, 'an uncut hospital with HAC dollars of any size');
  refuse({ ...cut, net: cut.net + 1 }, 'a net that is not hrrp + hvbp + hac (cut)');
  refuse({ ...uncut, net: uncut.net - 1 }, 'a net that is not hrrp + hvbp + hac (uncut)');
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
  'a hospital outside the Readmissions file': (h) => !h.inHrrp,
  'a hospital in it': (h) => h.inHrrp && h.est,
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
    assert.deepEqual([d.ccn, d.name, d.city, d.state, d.status, d.beds, d.teach, d.inHrrp, d.x, d.y],
      [h.ccn, h.name, h.city, h.state, h.status, h.beds, h.teach, h.inHrrp, row[COLS.indexOf('x')], row[COLS.indexOf('y')]], h.ccn);
    if (!h.est) {
      assert.equal(d.est, null, h.ccn);
      return;
    }
    // The same shape as the build's, percents of pay included.
    assert.deepEqual(d.est, h.est, h.ccn);
    assert.deepEqual(d.est.pct, {
      hrrp: h.est.hrrp * 100 / h.est.total, hac: h.est.hac * 100 / h.est.total,
      hvbp: h.est.hvbp * 100 / h.est.total, net: h.est.net * 100 / h.est.total,
    }, h.ccn);
    assert.equal(programDollars(d.est).net, d.est.net, h.ccn);
  });
});

// ---------- the family search's own index (hub/search/asset.js) ----------
// Every hospital on Medicare's list (the hospital master): the dollar file's (hubHospitals) and the ones outside the
// penalty programs (hubModel's outside), each with the name its page shows, its place and the master's kind. The state
// counts are the map's (countedOnMap over the dollar file's hospitals), as the search showed before it had an index of
// its own. Failure messages name no hospital, CCN or figure.
const searchModel = hubModel();
const search = searchAsset({ hospitals: searchModel.hospitals, outside: searchModel.outside, master: hub.master });

test('searchAsset: one row per master hospital; state counts equal today\'s hubEntries counts', () => {
  assert.deepEqual(search.cols, ['ccn', 'name', 'city', 'state', 'kind']);
  assert.equal(search.rows.length, hub.master.size, 'a row for every hospital in the master');
  const ccns = search.rows.map((r) => r[0]);
  assert.equal(new Set(ccns).size, ccns.length, 'no hospital twice');
  assert.ok(ccns.every((ccn) => hub.master.has(ccn)), 'every row is a master hospital');
  assert.ok(search.rows.every((r) => r.length === 5 && r.every((v) => v !== undefined)), 'every row has its five values');
  assert.ok(search.rows.every((r) => r[4] === hub.master.get(r[0]).kind), 'the kind is the master\'s');
  assert.ok(search.rows.some((r) => r[4] === 'acute'), 'acute hospitals keep their kind');
  // Today's counts, as hubEntries made them from hubHospitals: each state's hospitals the map counts.
  const today = {};
  for (const h of hospitals) if (countedOnMap(h) && US_STATES.some(([code]) => code === h.state)) today[h.state] = (today[h.state] ?? 0) + 1;
  assert.ok(isDeepStrictEqual(search.states, today), 'each state\'s count is the one the search showed before');
});

test('searchAsset: a hospital no CMS file names shows the name its page shows, not the master\'s stand-in', () => {
  const unnamed = searchModel.outside.filter((x) => !cmsNamed(x.name, x.ccn));
  assert.ok(unnamed.length > 0, 'the master has a hospital no CMS file names (if not, this test no longer covers one)');
  const byCcn = new Map(search.rows.map((r) => [r[0], r]));
  for (const x of unnamed) {
    assert.ok(byCcn.get(x.ccn)[1] === shownName(x), 'the page\'s name');
    assert.ok(byCcn.get(x.ccn)[1] !== x.name, 'not the stand-in');
  }
});

test('searchAsset: the hub asset stays the dollar file\'s; no outside hospital enters it (the shell would link a program page it has not)', () => {
  const inHub = new Set(asset.rows.map((r) => r[0]));
  assert.ok(!searchModel.outside.some((x) => inHub.has(x.ccn)));
});

test('searchAsset: gzip size printed; under the old hub asset\'s', () => {
  const text = JSON.stringify(search);
  const old = JSON.stringify(asset);
  const gz = gzipSync(text).length;
  const oldGz = gzipSync(old).length;
  console.log(`search asset: ${Buffer.byteLength(text)} bytes raw, ${gz} gzip; hub asset: ${Buffer.byteLength(old)} raw, ${oldGz} gzip`);
  assert.ok(gz < oldGz, 'the search index is smaller than the hub asset, gzip');
});

test('searchAsset refuses a hospital twice, a kind the search has no word for, and a dollar-file hospital the master lacks', () => {
  const row = { ccn: '990001', name: 'Invented Hospital', city: 'Exampleton', state: 'OH', status: 'estimated', est: { net: -1 } };
  const master = new Map([['990001', { kind: 'acute' }]]);
  assert.throws(() => searchAsset({ hospitals: [row], outside: [{ ...row, kind: 'acute' }], master }), RangeError);
  assert.throws(() => searchAsset({ hospitals: [row], outside: [], master: new Map([['990001', { kind: 'spaceport' }]]) }), RangeError);
  assert.throws(() => searchAsset({ hospitals: [row], outside: [], master: new Map() }), RangeError);
});

test('decodeSearchAsset reads back what searchAsset writes, and throws on anything else', () => {
  const decoded = decodeSearchAsset(search);
  assert.equal(decoded.rows.length, search.rows.length);
  assert.deepEqual(decoded.rows[0], Object.fromEntries(search.cols.map((c, i) => [c, search.rows[0][i]])));
  assert.deepEqual(decoded.states, search.states);
  const good = { cols: ['ccn', 'name', 'city', 'state', 'kind'], rows: [['990001', 'Invented Hospital', null, 'OH', 'critical_access']], states: { OH: 1 } };
  assert.equal(decodeSearchAsset(good).rows[0].city, null, 'a hospital with no city');
  const bad = {
    'not an object': null,
    'an array': [],
    'no rows': { ...good, rows: undefined },
    'other columns': { ...good, cols: ['ccn', 'name', 'city', 'kind', 'state'] },
    'a short row': { ...good, rows: [['990001', 'Invented Hospital', null, 'OH']] },
    'a row that is no list': { ...good, rows: [{ ccn: '990001' }] },
    'a CCN that is no CCN': { ...good, rows: [['99001', 'Invented Hospital', null, 'OH', 'acute']] },
    'a lowercase CCN': { ...good, rows: [['99000a', 'Invented Hospital', null, 'OH', 'acute']] },
    'a CCN twice': { ...good, rows: [good.rows[0], good.rows[0]] },
    'a name that is no text': { ...good, rows: [['990001', 7, null, 'OH', 'acute']] },
    'an empty name': { ...good, rows: [['990001', '', null, 'OH', 'acute']] },
    'a city that is no text': { ...good, rows: [['990001', 'Invented Hospital', 7, 'OH', 'acute']] },
    'a state that is no code': { ...good, rows: [['990001', 'Invented Hospital', null, 'Ohio', 'acute']] },
    'an unknown kind': { ...good, rows: [['990001', 'Invented Hospital', null, 'OH', 'spaceport']] },
    'no states': { ...good, states: undefined },
    'states as a list': { ...good, states: [] },
    'a state that is not one': { ...good, states: { ZZ: 1 } },
    'a count that is no count': { ...good, states: { OH: -1 } },
    'a fractional count': { ...good, states: { OH: 1.5 } },
  };
  for (const [what, value] of Object.entries(bad)) assert.throws(() => decodeSearchAsset(value), Error, what);
});
