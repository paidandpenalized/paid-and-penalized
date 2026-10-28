// A hospital page's program strips (#whatif): in each program's row and the net's, one SVG strip of the peers as dots on
// the shared share axis (scale.js; piled and drawn by pile.js's rules, so a pile stays dots), this
// hospital's mark ringed, the group's median as a ▲ on the axis, and one dashed thread down the rows through the
// hospital's mark in each. A peer a program does not list is not in its strip (never a dot at $0); nor is the hospital,
// whose strip then says so. Switching the group moves the same dots (CSS transitions on each dot's transform, off under
// reduced motion): a hospital that stays glides to its new place, one that joins fades in, one that leaves fades out.
// The axis is the tight one (the actual figures, so the data has the full width) until the what-if opens, then the wide
// one (every figure it can show: whatif.js asks for it, scale.js stripAxis). A change of axis glides the same way, and
// every part of a strip (the ticks, the gutter, the dots, the ring, the median, the handle, the marks) rides the one
// transition, so a dot never leaves its tick; the thread follows the rings frame by frame.
// The strips are pictures of what each row's sentences say, so their marks are hidden from assistive technology; the one
// exception is the what-if's handle (handles), a capsule with arrows on each adjustable program's strip that sits on the
// hospital's dot and, once the row is hypothetical, on the hypothetical value, with the actual's ring left as a ghost
// (hub/client/hospital/whatif.js binds its keys and drag). The net's hypothetical is a hollow "What if" mark. The thread
// shows where the rows stand in two columns (hub/styles.css); on one column it would cross every row's words.
import { count, pct } from '../../../web/client/format.js';
import { ROW_IDS, ROW_KEY, inProgram } from '../../hospital/peers.js';
import { deviceRatio } from '../paint.js';
import { NARROW_BELOW, drawnDot, hashOf, pileLayout, pileSpacing } from '../pile.js';
import { shareScale, wholePercents } from '../scale.js';

const NS = 'http://www.w3.org/2000/svg';
// A glide's length (ms) and curve: hub/styles.css .st--live's transitions.
const GLIDE_MS = 700;
const GLIDE = 'cubic-bezier(.65, 0, .35, 1)';
// The time (0 to 1) at which a glide on that curve has come p of the way (bisection on the curve's parameter).
const bez = (a, b, u) => 3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;
function timeAt(p) {
  let [lo, hi] = [0, 1];
  for (let i = 0; i < 24; i++) {
    const u = (lo + hi) / 2;
    if (bez(0, 1, u) < p) lo = u;
    else hi = u;
  }
  return bez(0.65, 0.35, (lo + hi) / 2);
}
// The hint's height over its baseline, halo included (CSS pixels): it stands over the handle where that leaves it inside
// the strip, else under it.
const HINT_UP = 14;
// The strip's plot height in CSS pixels by its group's size, wide and narrow: a large group's spikes (most of a state's or
// a size band's hospitals within a few hundredths of a percent of $0 in Readmissions) need the height to stay narrow
// blocks of dots, so each dot stands near its own value.
const PLOT = [[160, 90, 76], [700, 150, 130], [Infinity, 240, 200]];
// The strip's frame for a group of n: { H, top, bot, base }, the plot's top and bottom, and the axis's baseline.
function stripFrame(n, narrow) {
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

// Every strip's layout for a group at a strip width W (CSS pixels) on a screen of dpr device pixels to a CSS pixel, on the
// share axis's domain: { f (stripFrame), narrow, gutter, scale, rows: { hrrp, hacrp, hvbp, net: { items, pile } } }. Only
// the hospitals a program lists are in its row. The piles keep each dot within its value's slice of a bin (pileLayout's
// byValue), and stack each column in one order on any axis (ranked), so a glide between two axes keeps every pile a
// pile. The $0 gutter is one width for all four rows (so they share one scale), widened from the usual until every row's
// $0 pile stands in it as separate dots at the pitch its row uses. Pure.
export function stripLayout(group, { W, dpr, domain }) {
  const narrow = W < NARROW_BELOW;
  const px = 1 / dpr;
  const f = stripFrame(group.length, narrow);
  const { gap, dMin } = pileSpacing(px);
  const items = Object.fromEntries(ROW_IDS.map((id) => [id, group.filter((x) => inProgram(x.est, id)).map((x) => ({ id: x.ccn, v: x.est.pct[ROW_KEY[id]], key: hashOf(x.ccn) }))]));
  const opts = (n, floor) => ({
    base: f.bot, top: f.top, dMax: dMaxOf(n, narrow), dMin: Math.max(dMin, floor), gap, mirror: true, px, byValue: true, ranked: true,
  });
  // A row's pile: at the readable floor (dMinOf) when that widens its bins to at most MAX_M sub-columns, else at the
  // device's floor, so a dot stays near its own value (a row whose readable floor is already the device's has nothing
  // lower to try).
  const pileOf = (list, scale) => {
    const floor = dMinOf(list.length, narrow);
    const readable = pileLayout(list, scale, opts(list.length, floor));
    return readable.m <= MAX_M || floor === 0 ? readable : pileLayout(list, scale, opts(list.length, 0));
  };
  let gutter = GUTTER[narrow ? 'narrow' : 'wide'];
  let out = null;
  for (let tries = 0; tries <= WIDEN; tries++) {
    const scale = shareScale({ x0: 4, x1: W - 4, gutter, domain, px });
    const rows = {};
    let need = gutter;
    for (const id of ROW_IDS) {
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
  let t = null;
  if (hint) {
    t = el('text', { class: 'st__hint', x: 0, y: -R - 9, 'text-anchor': 'middle', 'aria-hidden': 'true' }, inner);
    t.textContent = fill('wiHint');
  }
  return { g, dot, hint: t };
}

// mountStrips(root, options): root is the #whatif section. Options: h (this hospital), peers (its group) and figures
// (what they show: hub/hospital/peers.js peerFigures), domain (the share axis's [lo, hi] for the actual figures: the
// tight one), wide (the axis that also holds every figure the what-if can show for h), fill (the page's copy filler),
// still (reduced motion), handles (the rows that get a what-if handle: 'hrrp', 'hacrp', 'hvbp'). Returns:
//   update(peers, figures) another group: the same dots move
//   setWide(on, animate)  the wide axis (on) or the tight one: every part glides there together (animate, and not under
//                        reduced motion), or moves at once
//   setScenario(s)       a what-if: s is { hrrp, hacrp, hvbp, net } in percent of pay, a value only for each row that
//                        differs from the actual (or null for none). A row's handle moves to its value, the net gets a
//                        hollow mark, and the actual's ring stays as a ghost.
//   handle(id)           the row's handle (an SVG <g role="slider">), or null
//   shareAt(id, clientX) the share of pay (percent) under a point on the row's strip, or null before it is laid out
//   nudge()              wiggles the first handle once (not under reduced motion), once any glide has ended
// A press on a handle lands a glide at once, so the handle then stays where it is under the pointer.
export function mountStrips(root, { h, peers, figures, domain: tight, wide: wideAxis = tight, fill, still, handles = [] }) {
  // The wide axis, or the tight one itself when the what-if reaches no further.
  const wide = wideAxis[0] === tight[0] && wideAxis[1] === tight[1] ? tight : wideAxis;
  const list = root.querySelector('.hh__rows');
  const hidden = { 'aria-hidden': 'true' };
  // The first handle carries the hint.
  let hinted = false;
  const strips = ROW_IDS.map((id) => {
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
    return { id, box, svg, bg, dots, med, me, ghost, hyp, out, handle, marks: new Map(), ticks: new Map(), leaving: new Map(), gut: null, lines: null, labels: null, at: null, W: 0, H: 0, scale: null, f: null };
  }).filter(Boolean);
  const thread = el('svg', { class: 'hh__thread', 'aria-hidden': 'true', focusable: 'false' });
  const path = el('path', {}, thread);
  list?.prepend(thread);

  let group = peers;
  let shows = figures;
  let scenario = null;
  // The axis drawn: tight until the what-if opens (setWide).
  let domain = tight;

  // The strip's frame for its size: the $0 gutter (a unit rect its transform stretches), the layers for the ticks' lines
  // and labels, and the baseline; the ticks are placed by scenery.
  function frame(st, f, W) {
    st.bg.textContent = '';
    st.ticks.clear();
    for (const { timer } of st.leaving.values()) clearTimeout(timer);
    st.leaving.clear();
    st.gut = el('rect', { class: 'st__gut', x: 0, y: f.top - 4, width: 1, height: f.base - f.top + 4 }, st.bg);
    st.lines = el('g', {}, st.bg);
    st.labels = el('g', {}, st.bg);
    el('line', { class: 'st__base', x1: 0, x2: W, y1: f.base + 0.5, y2: f.base + 0.5 }, st.bg);
  }

  // A tick: its label and a faint line (none at $0), each stood at x by its transform.
  function tickAt(st, v, f, x) {
    const parts = [el('text', { class: 'st__tl', x: 0, y: f.H - 4, 'text-anchor': 'middle' }, st.labels)];
    parts[0].textContent = pct(v / 100, 0, { sign: true });
    if (v !== 0) parts.push(el('line', { class: 'st__grid', x1: 0, x2: 0, y1: f.top - 4, y2: f.base + 3 }, st.lines));
    for (const p of parts) p.style.transform = `translate(${round(x)}px, 0px)`;
    st.ticks.set(v, parts);
    return parts;
  }

  // A tick part's half width (a label's; a line has none).
  const halfOf = (p) => (p.classList.contains('st__tl') ? p.getComputedTextLength() / 2 + 1 : 0);
  const drawnX = (p) => new DOMMatrixReadOnly(getComputedStyle(p).transform).e;

  // A tick part gliding from x0 to x1 that is coming (in) or going: it shows only while all of it is inside the strip, or
  // no further out than it stands at rest (an end label can reach past a side), so a label never shows cut or in the
  // page's margin. Its fade is timed on the glide's curve to the moment it crosses in (or out).
  function crossing(st, p, x0, x1, coming) {
    const half = halfOf(p);
    const rest = coming ? x1 : x0;
    const [lo, hi] = [Math.min(0, rest - half), Math.max(st.W, rest + half)];
    // The way along (0 to 1) at which the part's edge meets the strip's: where it comes in, or goes out. (One that never
    // moves is in from the start, or until the end.)
    const edge = x1 < x0 === coming ? (x0 + half - hi) / (x0 - x1) : (lo + half - x0) / (x1 - x0);
    const at = Number.isNaN(edge) ? Number(!coming) : Math.min(1, Math.max(0, edge));
    const t = Math.round(timeAt(at) * GLIDE_MS);
    p.style.transition = coming ? `transform ${GLIDE_MS}ms ${GLIDE}, opacity ${GLIDE_MS - t}ms linear ${t}ms` : `transform ${GLIDE_MS}ms ${GLIDE}, opacity ${t}ms linear`;
    p.style.transform = `translate(${round(x1)}px, 0px)`;
    p.style.opacity = coming ? '' : '0';
  }

  // The scenery on scale: the gutter and a tick at each whole percent of the axis. In a glide (from: the scale the strip
  // had), a tick the axis adds comes in along the old axis's line from past the strip's side, and one it drops goes out
  // the same way (crossing); the rest move with the dots. In a glide that starts while one runs (freeze has set every part
  // where it is drawn), a tick still coming in carries on from there, one on its way out that the axis takes back turns
  // back, and one still going goes on. (A new tick is made only from an axis at rest: the two axes nest, so one going out
  // is the only kind that can be asked back mid-glide.)
  function scenery(st, scale, f, from) {
    const want = new Set(wholePercents(domain));
    const coming = [];
    for (const v of want) {
      const parts = st.ticks.get(v);
      if (parts) {
        // Mid-way in (its fade held where it was): on in from there.
        if (from && parts.some((p) => p.style.opacity !== '')) coming.push(...parts.map((p) => [p, drawnX(p), v]));
        continue;
      }
      const back = st.leaving.get(v);
      if (back) {
        clearTimeout(back.timer);
        st.leaving.delete(v);
        st.ticks.set(v, back.parts);
        coming.push(...back.parts.map((p) => [p, drawnX(p), v]));
        continue;
      }
      const made = tickAt(st, v, f, from ? from.line(v) : scale.xs(v));
      if (from) {
        for (const p of made) p.style.opacity = '0';
        coming.push(...made.map((p) => [p, from.line(v), v]));
      }
    }
    // The new ticks' start, styled before they move, so they glide from it.
    for (const [p] of coming) void getComputedStyle(p).transform;
    for (const [p, x0, v] of coming) crossing(st, p, x0, scale.xs(v), true);
    st.gut.style.transform = `translate(${round(scale.zL)}px, 0px) scaleX(${round(scale.zR - scale.zL)})`;
    for (const [v, parts] of st.ticks) {
      if (want.has(v)) {
        for (const p of parts) if (!coming.some(([c]) => c === p)) p.style.transform = `translate(${round(scale.xs(v))}px, 0px)`;
        continue;
      }
      st.ticks.delete(v);
      if (!from) {
        for (const p of parts) p.remove();
        continue;
      }
      leave(st, v, parts, scale.line(v));
    }
    // Still going out from a glide this one cut short: on out from where it is.
    if (from) for (const [v, { parts, to }] of st.leaving) if (!want.has(v)) leave(st, v, parts, to);
  }

  // A tick going out to x (past the strip's side), removed once there.
  function leave(st, v, parts, to) {
    clearTimeout(st.leaving.get(v)?.timer);
    for (const p of parts) crossing(st, p, drawnX(p), to, false);
    st.leaving.set(v, { parts, to, timer: setTimeout(() => drop(st, v), GLIDE_MS) });
  }

  // A tick gone out: removed.
  function drop(st, v) {
    const gone = st.leaving.get(v);
    if (!gone) return;
    clearTimeout(gone.timer);
    st.leaving.delete(v);
    for (const p of gone.parts) p.remove();
  }

  // The layout for the strips' width and axis now (one width: they share a column), worked out once per group, width and
  // axis.
  let layout = null;
  function lay(W, dpr) {
    if (!layout || layout.W !== W || layout.dpr !== dpr || layout.group !== group || layout.domain !== domain) layout = { W, dpr, group, domain, ...stripLayout(group, { W, dpr, domain }) };
    return layout;
  }

  function render(st, animate) {
    const W = st.box.clientWidth;
    if (!W) return;
    const dpr = deviceRatio();
    const { f, scale, rows } = lay(W, dpr);
    // Moves glide only on a change of group or axis, not on a resize, nor before the first paint. The class stays on until
    // the glide ends (follow).
    const glide = animate && !still.matches && st.scale !== null;
    if (glide) st.svg.classList.add('st--live');
    else st.svg.classList.remove('st--live');
    if (W !== st.W || f.H !== st.H) {
      st.W = W;
      st.H = f.H;
      st.svg.setAttribute('viewBox', `0 0 ${W} ${f.H}`);
      st.svg.setAttribute('width', String(W));
      st.svg.setAttribute('height', String(f.H));
      frame(st, f, W);
      scenery(st, scale, f, null);
    } else if (scale !== st.scale) scenery(st, scale, f, glide ? st.scale : null);
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
        if (glide) mark.style.opacity = '0';
      }
      mark.setAttribute('width', String(s));
      mark.setAttribute('height', String(s));
      mark.setAttribute('rx', square ? '0' : String(s / 2));
      mark.style.transform = `translate(${round(x)}px, ${round(y)}px)`;
      if (fresh && glide) requestAnimationFrame(() => requestAnimationFrame(() => { mark.style.opacity = ''; }));
      if (it.id === h.ccn) st.at = { x: p.x, y: p.y, r: s / 2 };
    }
    for (const [ccn, mark] of st.marks) {
      if (seen.has(ccn)) continue;
      st.marks.delete(ccn);
      if (glide) {
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
    const { median } = shows[st.id];
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
    if (moved) st.ghost.style.transform = `translate(${round(st.at.x)}px, ${round(st.at.y - st.at.r - 8)}px)`;
    if (st.handle) {
      st.handle.g.style.display = '';
      st.handle.g.style.transform = `translate(${round(x)}px, ${round(y)}px)`;
      if (st.handle.hint) placeHint(st, st.handle.hint, x, y);
      st.handle.dot.setAttribute('class', `st__hd ${signClass(moved ? v : h.est.pct[ROW_KEY[st.id]])}`);
      st.hyp.style.display = 'none';
      return;
    }
    st.hyp.style.display = moved ? '' : 'none';
    if (moved) st.hyp.style.transform = `translate(${round(x)}px, ${round(y)}px)`;
  }

  // The hint inside its strip: over the handle where it fits under the strip's top, else under it; across, held clear of
  // the strip's sides (its half width measured once its face is in).
  let hintHalf = 0;
  function placeHint(st, t, x, y) {
    if (!hintHalf) hintHalf = t.getComputedTextLength() / 2 + 2;
    const over = y - HANDLE_R - 9 - HINT_UP >= 0;
    t.setAttribute('y', String(over ? -HANDLE_R - 9 : HANDLE_R + 9 + HINT_UP));
    t.setAttribute('x', String(round(Math.min(st.W - hintHalf - x, Math.max(hintHalf - x, 0)))));
  }

  // Where the hospital's ring stands now: mid-glide, where its transition has it this frame; else its place.
  function ringAt(st) {
    if (!gliding) return [st.at.x, st.at.y];
    const t = getComputedStyle(st.me).transform;
    if (!t || t === 'none') return [st.at.x, st.at.y];
    const m = new DOMMatrixReadOnly(t);
    return [m.e, m.f];
  }

  // The thread: one dashed line down the rows through the hospital's mark in each strip that has one.
  function drawThread() {
    if (!list) return;
    const box = list.getBoundingClientRect();
    thread.setAttribute('width', String(Math.round(box.width)));
    thread.setAttribute('height', String(Math.round(box.height)));
    const pts = strips.filter((st) => st.at && st.W).map((st) => {
      const b = st.svg.getBoundingClientRect();
      const [x, y] = ringAt(st);
      return [round(b.left - box.left + x), round(b.top - box.top + y)];
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

  // Every part that glides (hub/styles.css .st--live's list).
  const MOVERS = '.st__d, .st__me, .st__med, .st__grid, .st__tl, .st__gut, .st__h, .st__hyp, .st__ghost';
  // A glide asked for while one runs (a reset and a reopening, a change of group mid-glide) starts every part from where
  // it is drawn, on one fresh glide: left to CSS, a part turning straight back would take a shortened time and any other
  // the full one, and they would part. So each part is first set where it stands, its transition held off for that
  // moment; a tick coming or going keeps how far it has faded (scenery sends it on).
  function freeze() {
    const now = strips.flatMap((st) => [...st.svg.querySelectorAll(MOVERS)].map((p) => {
      const cs = getComputedStyle(p);
      return [p, cs.transform, p.style.transition ? cs.opacity : null];
    }));
    for (const [p, t, o] of now) {
      p.style.transition = 'none';
      p.style.transform = t;
      if (o !== null) p.style.opacity = o;
    }
    if (now.length) void getComputedStyle(now[0][0]).transform;
    for (const [p] of now) p.style.transition = '';
  }

  // A glide under way: each frame the thread goes through the rings where they are; once no part of a strip is still
  // moving, the glide's class comes off (a handle then follows a drag at once), and a nudge asked for meanwhile runs.
  let gliding = 0;
  let nudgeAfter = false;
  const busy = () => strips.some((st) => (st.svg.getAnimations?.({ subtree: true }) ?? []).some((a) => a.transitionProperty === 'transform'));
  function rest() {
    cancelAnimationFrame(gliding);
    gliding = 0;
    for (const st of strips) {
      st.svg.classList.remove('st--live');
      for (const v of [...st.leaving.keys()]) drop(st, v);
      for (const parts of st.ticks.values()) for (const p of parts) p.style.transition = '';
    }
    drawThread();
    if (nudgeAfter) {
      nudgeAfter = false;
      nudge();
    }
  }
  function follow() {
    cancelAnimationFrame(gliding);
    const until = performance.now() + GLIDE_MS + 50;
    const step = (now) => {
      drawThread();
      if (now < until || busy()) gliding = requestAnimationFrame(step);
      else rest();
    };
    gliding = requestAnimationFrame(step);
  }

  function all(animate) {
    if (animate && gliding && !still.matches) freeze();
    for (const st of strips) render(st, animate);
    if (strips.some((st) => st.svg.classList.contains('st--live'))) follow();
    else if (gliding) rest();
    else drawThread();
  }

  all(false);
  // A strip whose width changed lays out again at once; any change in the rows' size moves the thread.
  if ('ResizeObserver' in window && list) {
    new ResizeObserver(() => {
      for (const st of strips) if (st.box.clientWidth !== st.W) render(st, false);
      drawThread();
    }).observe(list);
  }
  if (document.fonts) {
    document.fonts.ready.then(() => {
      hintHalf = 0;
      for (const st of strips) whatIf(st);
      drawThread();
    });
  }

  // The share under a client x on a strip (the scale's invert).
  function shareAt(id, clientX) {
    const st = strips.find((s) => s.id === id);
    return st?.scale ? st.scale.invert(clientX - st.svg.getBoundingClientRect().left) : null;
  }

  const first = strips.find((st) => st.handle);
  function nudge() {
    if (!first || still.matches) return;
    if (gliding) {
      nudgeAfter = true;
      return;
    }
    const g = first.handle.g;
    g.classList.remove('st__h--nudge');
    void g.getBBox();
    g.classList.add('st__h--nudge');
    setTimeout(() => g.classList.remove('st__h--nudge'), NUDGE_MS);
  }
  // A press on a handle mid-glide lands the glide first (capture: before whatif.js measures where the handle is), with no
  // nudge: the reader has the handle.
  for (const st of strips) {
    st.handle?.g.addEventListener('pointerdown', () => {
      nudgeAfter = false;
      if (gliding) rest();
    }, true);
  }

  return {
    update(next, nextFigures) {
      group = next;
      shows = nextFigures;
      all(true);
    },
    setWide(on, animate = true) {
      const next = on ? wide : tight;
      if (next === domain) return;
      domain = next;
      all(animate);
    },
    setScenario(next) {
      scenario = next;
      for (const st of strips) whatIf(st);
    },
    handle: (id) => strips.find((st) => st.id === id)?.handle?.g ?? null,
    shareAt,
    nudge,
  };
}
