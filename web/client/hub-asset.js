// The hub's hospitals in the browser: fetch the build's hub asset (hub/asset.js writes it) and decode its rows into one
// object per hospital. Pure apart from loadHubAsset's fetch. Shared (the shell, the home story and the hospital pages
// read it), so it lives here, not under hub/.
import { derivedDollars, netShare } from '../../engine/js/dollars/whatif.js';
import { once } from './once.js';

// The columns of a row, in the order the build writes them. The decoder reads by name through the asset's own `cols`, so
// it needs only that every one of these is there.
export const HUB_COLS = Object.freeze(['ccn', 'name', 'city', 'state', 'status', 'band', 'teach', 'x', 'y', 'base', 'total',
  'hrrp', 'hvbp', 'hac', 'net', 'hrrpF', 'vbpF', 'cut', 'hrrpL', 'vbpL', 'tdr']);

// The one-letter code the asset holds for each status, and the words it decodes to. The build's encoder (hub/asset.js)
// reads the same map; a test holds its keys to the statuses the pages have words for.
export const STATUS_CODES = Object.freeze({ estimated: 'e', maryland: 'm', 'no-inputs': 'n' });
const STATUS = new Map(Object.entries(STATUS_CODES).map(([word, code]) => [code, word]));
const DOLLAR_COLS = ['base', 'total', 'hrrp', 'hvbp', 'hac', 'net'];
const NUMBER_COLS = [...DOLLAR_COLS, 'hrrpF', 'vbpF'];

// An estimated row's figures, as hubHospitals' `est` has them. The asset leaves out `after` and `atStake`, which follow
// from the rest (the build checks they do): the pay after Readmissions and value-based purchasing, and 1% of it. `pct`
// is each program's dollars as a percent of the hospital's estimated pay.
function decodeEstimate(ccn, v) {
  for (const c of NUMBER_COLS) if (!Number.isFinite(v(c))) throw new RangeError(`hub asset: ${ccn} has no ${c}`);
  const [base, total, hrrp, hvbp, hac, net] = DOLLAR_COLS.map(v);
  return {
    base, total, hrrp, hvbp, hac, net, ...derivedDollars({ total, hrrp, hvbp }),
    hrrpFactor: v('hrrpF'), vbpFactor: v('vbpF'), cut: v('cut') === 1, hrrpListed: v('hrrpL') === 1, vbpListed: v('vbpL') === 1,
    share: netShare(net, total),
    pct: { hrrp: (hrrp * 100) / total, hac: (hac * 100) / total, hvbp: (hvbp * 100) / total, net: (net * 100) / total },
  };
}

// The asset as `{ fy, mapW, mapH, hospitals, byCcn }`: hospitals in the asset's order, each `{ ccn, name, city, state,
// status, band, teach, x, y, inTdr, est }` (status in words; x and y a place on the map at mapW wide, or null; est null
// unless the status is 'estimated'), and byCcn a Map. Throws on an asset it cannot read rather than guess.
export function decodeRows(asset) {
  if (!asset || !Array.isArray(asset.cols) || !Array.isArray(asset.rows)) throw new TypeError('hub asset: expected { cols, rows }');
  const { fy, mapW, mapH, cols, rows } = asset;
  const at = new Map(cols.map((c, i) => [c, i]));
  for (const c of HUB_COLS) if (!at.has(c)) throw new RangeError(`hub asset: no "${c}" column`);
  const hospitals = rows.map((row) => {
    if (!Array.isArray(row) || row.length !== cols.length) throw new RangeError(`hub asset: a row has ${row?.length} values, not ${cols.length}`);
    const v = (c) => row[at.get(c)];
    const status = STATUS.get(v('status'));
    if (!status) throw new RangeError(`hub asset: ${v('ccn')} has the status "${v('status')}"`);
    return {
      ccn: v('ccn'), name: v('name'), city: v('city'), state: v('state'), status, band: v('band'), teach: v('teach'),
      x: v('x'), y: v('y'), inTdr: v('tdr') === 1, est: status === 'estimated' ? decodeEstimate(v('ccn'), v) : null,
    };
  });
  return { fy, mapW, mapH, hospitals, byCcn: new Map(hospitals.map((h) => [h.ccn, h])) };
}

// Each url is fetched and decoded once per page, however many scripts ask; a failed load is forgotten so a retry fetches
// again. Rejects with an Error naming the HTTP status; the caller shows its one quiet "couldn't load" line.
const loaders = new Map();
export function loadHubAsset(url) {
  if (!loaders.has(url)) {
    loaders.set(url, once(() => fetch(url).then((res) => {
      if (!res.ok) throw new Error(`hub asset: ${url} answered ${res.status}`);
      return res.json();
    }).then(decodeRows)));
  }
  return loaders.get(url)();
}
