// A hospital page's program strips (#whatif): in each program's row and the net's, one SVG strip of the peers as dots on
// the shared share axis (scale.js; piled by pile.js and drawn by the home story's dot rule, so a pile stays dots), this
// hospital's mark ringed, the group's median as a ▲ on the axis, and one dashed thread down the rows through the
// hospital's mark in each. A peer a program does not list is not in its strip (never a dot at $0); nor is the hospital,
// whose strip then says so. Switching the group moves the same dots (CSS transitions on each dot's transform, off under
// reduced motion): a hospital that stays glides to its new place, one that joins fades in, one that leaves fades out.
// The strips are pictures of what each row's sentences say, so their marks are hidden from assistive technology; the one
// exception is the what-if's handle (handles), a capsule with arrows on each adjustable program's strip that sits on the
// hospital's dot and, once the row is hypothetical, on the hypothetical value, with the actual's ring left as a ghost
// (hub/client/hospital/whatif.js binds its keys and drag). The net's hypothetical is a hollow "What if" mark. The thread
// shows where the rows stand in two columns (hub/styles.css); on one column it would cross every row's words.
import { count, pct } from '../../../web/client/format.js';
import { inProgram, rowFigures } from '../../hospital/peers.js';
import { pileLayout } from '../pile.js';
import { shareScale } from '../scale.js';
import { drawnDot } from '../story/geometry.js';

const NS = 'http://www.w3.org/2000/svg';
const IDS = ['hrrp', 'hacrp', 'hvbp', 'net'];
// Each row's value in a hospital's percents (decoded asset est.pct).
const PCT = { hrrp: 'hrrp', hacrp: 'hac', hvbp: 'hvbp', net: 'net' };
// A strip narrower than this lays out as a phone's.
const NARROW_BELOW = 520;
// The strip's plot height in CSS pixels by its group's size, wide and narrow: a large group's spikes (most of a state's or
// a size band's hospitals within a few hundredths of a percent of $0 in Readmissions) need the height to stay narrow
// blocks of dots, so each dot stands near its own value.
const PLOT = [[160, 90, 76], [700, 150, 130], [Infinity, 240, 200]];
// The strip's frame for a group of n: { H, top, bot, base }, the plot's top and bottom, and the axis's baseline.
export function stripFrame(n, narrow) {
  const [, wide, slim] = PLOT.find(([below]) => n < below);
  const top = narrow ? 6 : 8;
  const bot = top + (narrow ? slim : wide);
  return { H: bot + 30, top, bot, base: bot + 6 };
}
// A group's largest pitch by its size, wide and narrow; and the smallest it shrinks to before its bins widen instead (a
// strip has room across, so a spike such as the hospital-acquired conditions cut stands as a block of readable dots
// rather than a thread of tiny ones).
const dMaxOf = (n, narrow) => (n < 160 ? (narrow ? 5 : 7) : n < 700 ? (narrow ? 3.4 : 4.6) : narrow ? 2.4 : 3.4);
const dMinOf = (n, narrow) => (n < 160 ? (narrow ? 3.4 : 4.4) : n < 700 ? (narrow ? 2.4 : 3) : 0);
// The usual $0 gutter, wide and narrow; and the most times the strips widen it for a $0 pile before they stop.
const GUTTER = { wide: 20, narrow: 12 };
const WIDEN = 8;
// The most sub-columns a bin widens to by choice (for readable dots); past it the dots shrink instead.
const MAX_M = 3;

// A hospital's stable spread in [0, 1), by CCN: its place in a pile's stacking order.
export function hashOf(text) {
  let s = 2166136261;
  for (let i = 0; i < text.length; i++) s = Math.imul(s ^ text.charCodeAt(i), 16777619);
  return ((s >>> 0) % 100003) / 100003;
}

// Every strip's layout for a group at a strip width W (CSS pixels) on a screen of dpr device pixels to a CSS pixel, on the
// share axis's domain: { f (stripFrame), narrow, gutter, scale, rows: { hrrp, hacrp, hvbp, net: { items, pile } } }. Only
// the hospitals a program lists are in its row. The piles keep each dot within its value's slice of a bin (pileLayout's
// byValue). The $0 gutter is one width for all four rows (so they share one scale), widened from the usual until every
// row's $0 pile stands in it as separate dots at the pitch its row uses. Pure.
export function stripLayout(group, { W, dpr, domain }) {
  const narrow = W < NARROW_BELOW;
  const px = 1 / dpr;
  const f = stripFrame(group.length, narrow);
  const items = Object.fromEntries(IDS.map((id) => [id, group.filter((x) => inProgram(x.est, id)).map((x) => ({ id: x.ccn, v: x.est.pct[PCT[id]], key: hashOf(x.ccn) }))]));
  const opts = (n, floor) => ({
    base: f.bot, top: f.top, dMax: dMaxOf(n, narrow), dMin: Math.max(1, 2 * px, floor), gap: (d) => Math.max(px, d * 0.24),
    mirror: true, px, byValue: true,
  });
  // A row's pile: at the readable floor (dMinOf) when that widens its bins to at most MAX_M sub-columns, else at the
  // device's floor, so a dot stays near its own value.
  const pileOf = (list, scale) => {
    const readable = pileLayout(list, scale, opts(list.length, dMinOf(list.length, narrow)));
    return readable.m <= MAX_M ? readable : pileLayout(list, scale, opts(list.length, 0));
  };
  let gutter = GUTTER[narrow ? 'narrow' : 'wide'];
  let out = null;
  for (let tries = 0; tries <= WIDEN; tries++) {
    const scale = shareScale({ x0: 4, x1: W - 4, gutter, domain, px });
    const rows = {};
    let need = gutter;
    for (const id of IDS) {
      const pile = pileOf(items[id], scale);
      rows[id] = { items: items[id], pile };
      if (pile.fits) continue;
      // The $0 pile's columns at this pitch: as many mirrored rows as the plot holds (an odd count), and so the columns.
      const fit = Math.floor((f.bot - f.top) / pile.d + 1e-9);
      const usable = Math.max(1, fit % 2 ? fit : fit - 1);
      need = Math.max(need, (Math.ceil(pile.zeroCount / usable) + 1) * pile.d);
    }
    out = { f, narrow, gutter, scale, rows };
    if (need <= gutter) break;
    gutter = need;
  }
  return out;
}

const FADE = 450;
// The handle's half height (a 24 px target at the least) and how far its capsule reaches past that each side.
const HANDLE_R = 12;
const HANDLE_REACH = 14;
// The handle's one wiggle (hub/styles.css st-nudge), and a little after it, before its class comes off.
const NUDGE_MS = 1300;

function el(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (parent) parent.append(node);
  return node;
}
const signClass = (v) => (v < 0 ? 'st__d st__d--pen' : v > 0 ? 'st__d st__d--rew' : 'st__d st__d--neu');
const round = (v) => Math.round(v * 100) / 100;

// The what-if's handle: a capsule (with a dashed focus ring) around a dot in the row's ink, an arrow each side, and, on
// the first handle, the hint over it. Its slider attributes are whatif.js's.
function handleOf(svg, fill, hint) {
  const g = el('g', { class: 'st__h', role: 'slider', tabindex: 0 }, svg);
  const inner = el('g', { class: 'st__hin' }, g);
  const R = HANDLE_R;
  const w = R + HANDLE_REACH;
  el('rect', { class: 'st__hf', x: -(w + 5), y: -(R + 5), width: 2 * (w + 5), height: 2 * (R + 5), rx: R + 5 }, inner);
  el('rect', { class: 'st__hb', x: -w, y: -R, width: 2 * w, height: 2 * R, rx: R }, inner);
  const dot = el('circle', { class: 'st__hd', r: 4 }, inner);
  el('path', { class: 'st__hc', d: `M${-R - 2} -4 l-5 4 l5 4 M${R + 2} -4 l5 4 l-5 4` }, inner);
  if (hint) {
    const t = el('text', { class: 'st__hint', x: 0, y: -R - 9, 'text-anchor': 'middle', 'aria-hidden': 'true' }, inner);
    t.textContent = fill('wiHint');
  }
  return { g, dot };
}

// mountStrips(root, options): root is the #whatif section. Options: h (this hospital), peers (its group), domain (the
// share axis's [lo, hi]), fill (the page's copy filler), still (reduced motion), handles (the rows that get a what-if
// handle: 'hrrp', 'hacrp', 'hvbp'). Returns:
//   update(peers)        another group: the same dots move
//   setScenario(s)       a what-if: s is { hrrp, hacrp, hvbp, net } in percent of pay, a value only for each row that
//                        differs from the actual (or null for none). A row's handle moves to its value, the net gets a
//                        hollow mark, and the actual's ring stays as a ghost.
//   handle(id)           the row's handle (an SVG <g role="slider">), or null
//   shareAt(id, clientX) the share of pay (percent) under a point on the row's strip, or null before it is laid out
//   nudge()              wiggles the first handle once (not under reduced motion)
export function mountStrips(root, { h, peers, domain, fill, still, handles = [] }) {
  const list = root.querySelector('.hh__rows');
  const hidden = { 'aria-hidden': 'true' };
  // The first handle carries the hint.
  let hinted = false;
  const strips = IDS.map((id) => {
    const box = root.querySelector(`[data-row="${id}"] [data-strip]`);
    if (!box) return null;
    const adjustable = handles.includes(id) && inProgram(h.est, id);
    // A strip with a handle keeps the handle reachable: its other marks are hidden from assistive technology one by one.
    const svg = el('svg', adjustable ? { class: 'st', focusable: 'false' } : { class: 'st', 'aria-hidden': 'true', focusable: 'false' }, box);
    const bg = el('g', hidden, svg);
    const dots = el('g', hidden, svg);
    const med = el('g', { class: 'st__med', ...hidden }, svg);
    el('path', { d: 'M0 -1 L-5 7 L5 7 Z' }, med);
    const medText = el('text', { x: 8, y: 7 }, med);
    medText.textContent = fill('stripMedian');
    const me = el('circle', { class: 'st__me', cx: 0, cy: 0, ...hidden }, svg);
    const ghost = el('text', { class: 'st__ghost', 'text-anchor': 'middle', ...hidden }, svg);
    ghost.textContent = fill('wiActual');
    const hyp = el('g', { class: 'st__hyp', ...hidden }, svg);
    el('circle', { class: 'st__hyp-core', r: 3 }, hyp);
    el('circle', { class: 'st__hyp-ring', r: 8 }, hyp);
    const hypText = el('text', { class: 'st__hyp-t', x: 0, y: -14, 'text-anchor': 'middle' }, hyp);
    hypText.textContent = fill('wiMark');
    const out = el('text', { class: 'st__out', x: 4, y: 14, ...hidden }, svg);
    const handle = adjustable ? handleOf(svg, fill, !hinted) : null;
    if (handle) hinted = true;
    return { id, box, svg, bg, dots, med, me, ghost, hyp, out, handle, marks: new Map(), at: null, W: 0, gutter: 0, H: 0, scale: null, f: null };
  }).filter(Boolean);
  const thread = el('svg', { class: 'hh__thread', 'aria-hidden': 'true', focusable: 'false' });
  const path = el('path', {}, thread);
  list?.prepend(thread);

  let group = peers;
  let scenario = null;

  // The strip's scenery for its width: the $0 gutter, a faint line and a label at each whole percent, the baseline.
  function scenery(st, scale, f, W) {
    st.bg.textContent = '';
    el('rect', { class: 'st__gut', x: round(scale.zL), y: f.top - 4, width: round(scale.zR - scale.zL), height: f.base - f.top + 4 }, st.bg);
    const [lo, hi] = domain;
    for (let v = Math.ceil(lo); v <= Math.floor(hi); v++) {
      const x = round(scale.xs(v));
      if (v !== 0) el('line', { class: 'st__grid', x1: x, x2: x, y1: f.top - 4, y2: f.base + 3 }, st.bg);
      const t = el('text', { class: 'st__tl', x, y: f.H - 4, 'text-anchor': 'middle' }, st.bg);
      t.textContent = pct(v / 100, 0, { sign: true });
    }
    el('line', { class: 'st__base', x1: 0, x2: W, y1: f.base + 0.5, y2: f.base + 0.5 }, st.bg);
  }

  // The layout for the strips' width now (one width: they share a column), worked out once per group and width.
  let layout = null;
  function lay(W, dpr) {
    if (!layout || layout.W !== W || layout.dpr !== dpr || layout.group !== group) layout = { W, dpr, group, ...stripLayout(group, { W, dpr, domain }) };
    return layout;
  }

  function render(st, animate) {
    const W = st.box.clientWidth;
    if (!W) return;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const { f, gutter, scale, rows } = lay(W, dpr);
    const resized = W !== st.W || gutter !== st.gutter || f.H !== st.H;
    if (resized) {
      st.W = W;
      st.gutter = gutter;
      st.H = f.H;
      st.svg.setAttribute('viewBox', `0 0 ${W} ${f.H}`);
      st.svg.setAttribute('width', String(W));
      st.svg.setAttribute('height', String(f.H));
      scenery(st, scale, f, W);
    }
    // Moves glide only on a group change, not on a resize, nor before the first paint.
    st.svg.classList.toggle('st--live', animate && !still.matches);
    const { items, pile } = rows[st.id];
    const { square, side } = drawnDot(pile.r, dpr);
    const s = side / dpr;
    const seen = new Set();
    for (const it of items) {
      const p = pile.pos.get(it.id);
      seen.add(it.id);
      // The dot's top left, on the device's grid when it is drawn as a square.
      const x = square ? Math.round((p.x - s / 2) * dpr) / dpr : p.x - s / 2;
      const y = square ? Math.round((p.y - s / 2) * dpr) / dpr : p.y - s / 2;
      let mark = st.marks.get(it.id);
      const fresh = !mark;
      if (fresh) {
        mark = el('rect', { class: signClass(it.v) }, st.dots);
        st.marks.set(it.id, mark);
        if (animate && !still.matches) mark.style.opacity = '0';
      }
      mark.setAttribute('width', String(s));
      mark.setAttribute('height', String(s));
      mark.setAttribute('rx', square ? '0' : String(s / 2));
      mark.style.transform = `translate(${round(x)}px, ${round(y)}px)`;
      if (fresh && animate && !still.matches) requestAnimationFrame(() => requestAnimationFrame(() => { mark.style.opacity = ''; }));
      if (it.id === h.ccn) st.at = { x: p.x, y: p.y, r: s / 2 };
    }
    for (const [ccn, mark] of st.marks) {
      if (seen.has(ccn)) continue;
      st.marks.delete(ccn);
      if (animate && !still.matches) {
        mark.style.opacity = '0';
        setTimeout(() => mark.remove(), FADE);
      } else mark.remove();
    }
    // This hospital: ringed where it stands, or a line saying it is not in the program.
    const listed = inProgram(h.est, st.id);
    if (!listed) st.at = null;
    st.me.style.display = listed ? '' : 'none';
    if (listed && st.at) {
      st.me.setAttribute('r', String(round(Math.max(st.at.r, 1.5) + 3.5)));
      st.me.style.transform = `translate(${round(st.at.x)}px, ${round(st.at.y)}px)`;
    }
    st.out.textContent = listed ? '' : fill('stripOut');
    // The group's median, among those the program lists (the net's and HAC's: among all of them).
    const median = rowFigures(group, st.id).median;
    st.med.style.display = median === null ? 'none' : '';
    if (median !== null) st.med.style.transform = `translate(${round(scale.xs(median * 100))}px, ${f.base}px)`;
    st.svg.dataset.n = count(items.length);
    st.scale = scale;
    st.f = f;
    whatIf(st);
  }

  // The what-if's marks on a strip: the handle on the hospital's dot, or on the row's hypothetical value on the plot's
  // middle line with the actual's ring a ghost; the net's hypothetical a hollow "What if" mark.
  function whatIf(st) {
    if (!st.scale || !st.at) {
      st.hyp.style.display = 'none';
      st.ghost.style.display = 'none';
      if (st.handle) st.handle.g.style.display = 'none';
      return;
    }
    const v = scenario?.[st.id];
    const moved = Number.isFinite(v);
    const x = moved ? st.scale.xs(v) : st.at.x;
    const y = moved ? (st.f.top + st.f.bot) / 2 : st.at.y;
    st.me.classList.toggle('st__me--ghost', moved);
    st.ghost.style.display = moved ? '' : 'none';
    if (moved) {
      st.ghost.setAttribute('x', String(round(st.at.x)));
      st.ghost.setAttribute('y', String(round(st.at.y - st.at.r - 8)));
    }
    if (st.handle) {
      st.handle.g.style.display = '';
      st.handle.g.style.transform = `translate(${round(x)}px, ${round(y)}px)`;
      st.handle.dot.setAttribute('class', `st__hd ${signClass(moved ? v : h.est.pct[PCT[st.id]])}`);
      st.hyp.style.display = 'none';
      return;
    }
    st.hyp.style.display = moved ? '' : 'none';
    if (moved) st.hyp.style.transform = `translate(${round(x)}px, ${round(y)}px)`;
  }

  // The thread: one dashed line down the rows through the hospital's mark in each strip that has one.
  function drawThread() {
    if (!list) return;
    const box = list.getBoundingClientRect();
    thread.setAttribute('width', String(Math.round(box.width)));
    thread.setAttribute('height', String(Math.round(box.height)));
    const pts = strips.filter((st) => st.at && st.W).map((st) => {
      const b = st.svg.getBoundingClientRect();
      return [round(b.left - box.left + st.at.x), round(b.top - box.top + st.at.y)];
    });
    if (pts.length < 2) {
      path.setAttribute('d', '');
      return;
    }
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const ym = round((y0 + y1) / 2);
      d += ` C${x0} ${ym} ${x1} ${ym} ${x1} ${y1}`;
    }
    path.setAttribute('d', d);
  }

  function all(animate) {
    for (const st of strips) render(st, animate);
    drawThread();
  }

  all(false);
  // A strip whose width changed lays out again at once; any change in the rows' size moves the thread.
  if ('ResizeObserver' in window && list) {
    new ResizeObserver(() => {
      for (const st of strips) if (st.box.clientWidth !== st.W) render(st, false);
      drawThread();
    }).observe(list);
  }
  if (document.fonts) document.fonts.ready.then(drawThread);

  // The share under a client x on a strip: the scale's inverse ($0 across the gutter), held to the axis's domain.
  function shareAt(id, clientX) {
    const st = strips.find((s) => s.id === id);
    if (!st?.scale) return null;
    const { zL, zR, k, domain: [lo, hi] } = st.scale;
    const x = clientX - st.svg.getBoundingClientRect().left;
    const v = x <= zL ? (x - zL) / k : x >= zR ? (x - zR) / k : 0;
    return Math.min(hi, Math.max(lo, v));
  }

  const first = strips.find((st) => st.handle);
  return {
    update(next) {
      group = next;
      all(true);
    },
    setScenario(next) {
      scenario = next;
      for (const st of strips) whatIf(st);
    },
    handle: (id) => strips.find((st) => st.id === id)?.handle?.g ?? null,
    shareAt,
    nudge() {
      if (!first || still.matches) return;
      const g = first.handle.g;
      g.classList.remove('st__h--nudge');
      void g.getBBox();
      g.classList.add('st__h--nudge');
      setTimeout(() => g.classList.remove('st__h--nudge'), NUDGE_MS);
    },
  };
}
