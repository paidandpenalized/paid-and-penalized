// Where every dot stands at each step of the home page's story: one target per hospital with an estimate (and a second
// set, the copies, that only the last step shows: the hospitals of one peer group, drawn again above everyone). Pure:
// the stage (stage.js) moves the dots between these and paints them.
//
// A layout is { scene, X, Y, R, A, C, info }: typed arrays of length 2N (N hospitals, then their copies) for each dot's
// center, radius, opacity and color code, plus what the scene's painter needs (lines, piles, label anchors).
import { R_MIN, pileLayout } from '../pile.js';
import { barDot, barHash, barOrder } from './bar-frame.js';
import { barGeometry, gateLines, gateTop, mapGeometry } from './geometry.js';

// The color codes: no change, a cut, a bonus, the scale bar's ink.
export const NEUTRAL = 0;
export const PEN = 1;
export const REW = 2;
export const INK = 3;
export const signCode = (v) => (v < 0 ? PEN : v > 0 ? REW : NEUTRAL);

// The story's hospitals: each one with an estimate, in the hub asset's order, as { h, row, mid, hash, c }: h the decoded
// hospital, row its index in the asset (the scale bar's dot height hashes it, as the build's does), mid the middle of its
// slice of all pay (its place along the bar), hash a stable spread in [0, 1), and c its change as a percent of its pay
// after no gate, after Readmissions, after hospital-acquired conditions too, and after all three (its net).
export function storyRows(hospitals) {
  const mids = new Map(barOrder(hospitals).map(({ i, mid }) => [i, mid]));
  const rows = [];
  hospitals.forEach((h, row) => {
    if (!h.est) return;
    const { hrrp, hac, total, pct } = h.est;
    rows.push({ h, row, mid: mids.get(row), hash: barHash(row), c: [0, pct.hrrp, ((hrrp + hac) * 100) / total, pct.net] });
  });
  return rows;
}

// The piles' sizes per scene, narrow and wide: the largest pitch, and the space between dots (at least a device pixel, so
// even the smallest dots stay apart on the screen). The smallest pitch is a CSS pixel and two device pixels (a dot and a
// gap); pileLayout also never goes below a dot of R_MIN, and widens a pile's bins rather than shrink past that.
const PILE = {
  gate: { narrow: 2.6, wide: 3.8 },
  net: { narrow: 3.2, wide: 5.6 },
  all: { narrow: 2.6, wide: 4.2 },
};
// A peer group's largest pitch by its size: a small group's dots can be larger.
const peerMax = (n, narrow) => (n < 160 ? (narrow ? 5 : 8.5) : n < 700 ? (narrow ? 3.4 : 5.6) : (narrow ? 2.6 : 4.2));
const gapFor = (g) => (d) => Math.max(g.px || 0.25, d * 0.24);
const dMinFor = (g) => Math.max(1, 2 * (g.px || 0));

// The layouts over rows (storyRows) on a stage (geometry.js stageGeometry), with the map's projected size (mapW by mapH):
// { N, layBar, layStart, layGate, layNet, layMap, layYou }.
export function createLayouts({ rows, g, mapW, mapH }) {
  const N = rows.length;
  const S = 2 * N;
  const index = new Map(rows.map((r, i) => [r.h, i]));
  const gap = gapFor(g);
  const pileOpts = (base, top, dMax, extra = {}) => ({ base, top, dMax, dMin: dMinFor(g), gap, px: g.px, ...extra });
  const size = (kind) => PILE[kind][g.narrow ? 'narrow' : 'wide'];

  function blank(scene, info = {}) {
    return { scene, X: new Float32Array(S), Y: new Float32Array(S), R: new Float32Array(S), A: new Float32Array(S), C: new Uint8Array(S), info };
  }
  // The copies sit on their hospitals, unseen.
  function hideCopies(L) {
    L.X.copyWithin(N, 0, N);
    L.Y.copyWithin(N, 0, N);
    L.R.copyWithin(N, 0, N);
    L.C.copyWithin(N, 0, N);
    L.A.fill(0, N);
    return L;
  }
  // Writes a pile (pileLayout over ids offset..offset+N) into L with opacity a, colored by each item's value.
  function place(L, pile, items, a) {
    for (const it of items) {
      const p = pile.pos.get(it.id);
      L.X[it.id] = p.x;
      L.Y[it.id] = p.y;
      L.R[it.id] = pile.r;
      L.A[it.id] = a;
      L.C[it.id] = signCode(it.v);
    }
  }
  // The highest top among a pile's columns between xa and xb (Infinity when none).
  const skyline = (pile, xa, xb) => pile.cols.reduce((t, c) => (c.x >= xa && c.x <= xb ? Math.min(t, c.top) : t), Infinity);
  // Where the "n at $0" label goes: just right of the gutter, above whatever stands there.
  function zeroLabel(pile) {
    const { zM, zR } = g.scale;
    const zeroTop = pile.cols.reduce((t, c) => (c.zero ? Math.min(t, c.top) : t), Infinity);
    return { n: pile.zeroCount, x: zR + 4, y: Math.min(zeroTop, skyline(pile, zM, zR + 70)) - 7 };
  }

  // Step 0: each hospital at its dot in the scale bar, in the bar's ink.
  function layBar() {
    const L = blank('bar');
    const b = barGeometry(g);
    rows.forEach((r, i) => {
      const [x, y] = b.point(...barDot(r.mid, r.hash));
      L.X[i] = x;
      L.Y[i] = y;
      L.R[i] = b.r;
      L.A[i] = 1;
      L.C[i] = INK;
    });
    return hideCopies(L);
  }

  // Step 1: everyone at $0, one block resting on the first gate, filled a column at a time in the bar's order (the left of
  // the bar pours into the left of the block).
  function layStart() {
    const lines = gateLines(g, 0);
    const base = lines[0] - 1;
    const cols = Math.ceil(Math.sqrt(N * 2.6));
    const per = Math.ceil(N / cols);
    let d = Math.min(g.narrow ? 3.4 : 6.2, ((g.x1 - g.x0) * 0.6) / cols, (base - g.top - 60) / per);
    if (g.px) d = Math.floor(d / g.px + 1e-9) * g.px;
    // Never smaller than the piles' smallest separate dot.
    const unit = g.px || 0.1;
    d = Math.max(d, dMinFor(g));
    while ((d - gap(d)) / 2 < R_MIN - 1e-9) d += unit;
    const r = (d - gap(d)) / 2;
    const left = g.scale.zM - (cols * d) / 2;
    const L = blank('machine');
    rows.map((row, i) => ({ i, mid: row.mid })).sort((a, b) => a.mid - b.mid).forEach(({ i }, k) => {
      L.X[i] = left + (Math.floor(k / per) + 0.5) * d;
      L.Y[i] = base - d / 2 - (k % per) * d;
      L.R[i] = r;
      L.A[i] = 1;
      L.C[i] = NEUTRAL;
    });
    L.info = { s: 0, lines, block: { left, right: left + cols * d, top: base - per * d, base }, n: N };
    return hideCopies(L);
  }

  // Steps 2 to 4: after gate s (1 Readmissions, 2 hospital-acquired conditions, 3 value-based purchasing), each hospital at
  // its change so far, the pile resting on the next gate. Within a column the dots keep the order they had in prev, the
  // layout before, so the crowd does not shuffle as a gate passes.
  function layGate(s, prev) {
    const lines = gateLines(g, s);
    const items = rows.map((r, i) => ({ id: i, v: r.c[s], key: -prev.Y[i] }));
    const pile = pileLayout(items, g.scale, pileOpts(lines[s] - 1, gateTop(g, s) + g.label, size('gate')));
    const L = blank('machine');
    place(L, pile, items, 1);
    const info = { s, lines, pile, zero: zeroLabel(pile) };
    // After hospital-acquired conditions: the column of hospitals whose only cut is that one (no Readmissions cut).
    if (s === 2) {
      const only = rows.map((r, i) => i).filter((i) => rows[i].c[1] === 0 && rows[i].c[2] < 0);
      const at = new Map();
      for (const i of only) at.set(L.X[i], (at.get(L.X[i]) ?? 0) + 1);
      const x = [...at].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (x !== undefined) info.only = { n: only.length, x, y: skyline(pile, x - 0.01, x + 0.01) - 7 };
    }
    L.info = info;
    return hideCopies(L);
  }

  // Step 5: the net, the gates gone and the pile the stage's full height.
  function layNet(prev) {
    const items = rows.map((r, i) => ({ id: i, v: r.c[3], key: -prev.Y[i] }));
    const top = g.top + (g.narrow ? 30 : 44);
    const pile = pileLayout(items, g.scale, pileOpts(g.bottom - 1, top, size('net')));
    const L = blank('net');
    place(L, pile, items, 1);
    let cut = 0;
    let bonus = 0;
    for (const r of rows) {
      if (r.c[3] < 0) cut += 1;
      else if (r.c[3] > 0) bonus += 1;
    }
    L.info = { pile, top, zero: zeroLabel(pile), cut, bonus };
    return hideCopies(L);
  }

  // Steps 6 and 7: each hospital at its place on the map, colored by its net; dimmed over the shaded states (fill). A
  // hospital without a place (none today) waits unseen at the map's middle.
  function layMap(fill) {
    const m = mapGeometry(g, mapW, mapH);
    const r = g.narrow ? 1.05 : Math.max(1.4, Math.min(2, m.k * 1.9));
    const L = blank(fill ? 'mapfill' : 'map', { m });
    rows.forEach((row, i) => {
      const { x, y } = row.h;
      const placed = Number.isFinite(x) && Number.isFinite(y);
      L.X[i] = m.ox + (placed ? x : mapW / 2) * m.k;
      L.Y[i] = m.oy + (placed ? y : mapH / 2) * m.k;
      L.R[i] = r;
      L.A[i] = placed ? (fill ? 0.3 : 0.9) : 0;
      L.C[i] = signCode(row.c[3]);
    });
    return hideCopies(L);
  }

  // Step 8: one hospital (h) among its peers (peers: hospitals, h among them) and among all: every hospital in a swarm
  // along the bottom, and the peers again (the copies) in a swarm above it. The rest of the copies wait unseen on their
  // hospitals, so a new peer group rises out of the swarm below.
  function layYou(h, peers) {
    const aH = Math.min((g.bottom - g.top) * 0.46, g.narrow ? 170 : 330);
    const aBot = g.bottom - 4;
    const aTop = aBot - aH;
    const all = rows.map((r, i) => ({ id: i, v: r.c[3], key: r.hash }));
    const allPile = pileLayout(all, g.scale, pileOpts(aBot, aTop, size('all'), { mirror: true }));
    const L = blank('you');
    place(L, allPile, all, 0.85);
    hideCopies(L);
    const mine = peers.map((p) => index.get(p)).filter((i) => i !== undefined).map((i) => ({ id: N + i, v: rows[i].c[3], key: rows[i].hash }));
    const pTop = g.top + (g.narrow ? 44 : 70);
    const pBot = aTop - (g.narrow ? 34 : 54);
    const peerPile = pileLayout(mine, g.scale, pileOpts(pBot, pTop, peerMax(mine.length, g.narrow), { mirror: true }));
    place(L, peerPile, mine, 1);
    const values = mine.map((it) => it.v).sort((a, b) => a - b);
    const mid = values.length >> 1;
    const median = values.length ? (values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2) : null;
    const extent = (pile) => pile.cols.reduce((e, c) => [Math.min(e[0], c.top), Math.max(e[1], c.bottom)], [Infinity, -Infinity]);
    L.info = { h: index.get(h) ?? -1, n: mine.length, median, peers: extent(peerPile), all: extent(allPile), peerPile, allPile };
    return L;
  }

  return { N, layBar, layStart, layGate, layNet, layMap, layYou };
}
