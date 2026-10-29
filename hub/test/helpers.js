// What the hub's tests share: a rendered page's <main>, one element's markup (nesting-aware), the noindex tag, the hub's
// hospitals as the browser decodes them, and a synthetic hospital whose dollars follow from its factors and cut.
import assert from 'node:assert/strict';
import { pctOf, programDollars } from '../../engine/js/dollars/whatif.js';
import { extent, initial, outcome } from '../client/hospital/whatif-state.js';
import { decodeRows } from '../../web/client/hub-asset.js';
import { hubAsset } from '../asset.js';
import { hubHospitals } from '../model.js';

export const NOINDEX = '<meta name="robots" content="noindex">';

// A page's <main>: the shell's header and footer carry their own figures (the chip's net, the footer's totals).
export const mainOf = (page) => page.slice(page.indexOf('<main'), page.indexOf('</main>'));

// The markup of the first element that opens with `open` (a regex source for its start tag) and is a `name`, to its
// matching close; and every such element, in order.
export function element(html, open, name) {
  const start = html.search(new RegExp(open));
  assert.ok(start >= 0, `no element ${open}`);
  const re = new RegExp(`<(/?)${name}[\\s>]`, 'g');
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, html.indexOf('>', m.index) + 1);
  }
  throw new Error(`unclosed ${open}`);
}
export function elements(html, open, name) {
  const found = [];
  let rest = html;
  for (let at = rest.search(new RegExp(open)); at >= 0; at = rest.search(new RegExp(open))) {
    const el = element(rest, open, name);
    found.push(el);
    rest = rest.slice(rest.indexOf(el) + el.length);
  }
  return found;
}

// The hub's hospitals (loadHub's) as the browser decodes its asset: { fy, mapW, mapH, hospitals, byCcn }.
export const decodedHub = (hub) => decodeRows(JSON.parse(JSON.stringify(hubAsset(hubHospitals(hub), hub))));

// A synthetic hospital (an invented CCN) whose dollars follow from its factors and cut, as the dollar file's would, on a
// base of BASE and pay of TOTAL.
export const BASE = 48_000_000;
export const TOTAL = 70_000_000;
export function makeHospital(ccn, { hrrpFactor = 1, vbpFactor = 1, cut = false, hrrpListed = true, vbpListed = true } = {}) {
  const row = { base: BASE, total: TOTAL, hrrpFactor: 1, vbpFactor: 1, cut: false, hrrp: 0, hvbp: 0, hac: 0, net: 0, after: TOTAL, atStake: TOTAL / 100 };
  const out = programDollars(row, { hrrpFactor, vbpFactor, cut });
  return { ccn, est: { ...row, hrrpFactor, vbpFactor, cut, ...out, hrrpListed, vbpListed, share: out.net / TOTAL } };
}

// Every percent of pay a hospital page's what-if can show for h (each program's and the net's), at each corner of what a
// reader may set: each factor at either end (whatif-state.js extent; its own where h is not in the program), the cut on
// and off. Each program's dollars and the net only grow with a factor and the cut only takes, so the corners hold the
// lowest and highest of each: the farthest the page's axis (hub/client/scale.js holdingAxis) can ever widen to.
export function whatIfCorners(h, ctx) {
  const own = initial(h);
  const ends = (id) => extent(h, ctx, id) ?? [own[id]];
  const out = [];
  for (const hrrp of ends('hrrp')) {
    for (const hvbp of ends('hvbp')) {
      for (const hac of [true, false]) out.push(...Object.values(pctOf({ total: h.est.total, ...outcome({ hrrp, hvbp, hac }, h) })));
    }
  }
  return out;
}
