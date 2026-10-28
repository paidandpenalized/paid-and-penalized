// A hospital page's program strips (#whatif): in each program's row and the net's, one SVG strip of the peers as dots on
// the shared share axis (scale.js; piled by pile.js and drawn by the home story's dot rule, so a pile stays dots), this
// hospital's mark ringed, the group's median as a ▲ on the axis, and one dashed thread down the rows through the
// hospital's mark in each. A peer a program does not list is not in its strip (never a dot at $0); nor is the hospital,
// whose strip then says so. Switching the group moves the same dots (CSS transitions on each dot's transform, off under
// reduced motion): a hospital that stays glides to its new place, one that joins fades in, one that leaves fades out.
// The strips are pictures of what each row's sentences say, so they are hidden from assistive technology. The thread shows
// where the rows stand in two columns (hub/styles.css); on one column it would cross every row's words.
import { count, pct } from '../../../web/client/format.js';
import { inProgram, rowFigures } from '../../hospital/peers.js';
import { R_MIN, pileLayout } from '../pile.js';
import { shareScale } from '../scale.js';
import { drawnDot } from '../story/geometry.js';

const NS = 'http://www.w3.org/2000/svg';
const IDS = ['hrrp', 'hacrp', 'hvbp', 'net'];
// Each row's value in a hospital's percents (decoded asset est.pct).
const PCT = { hrrp: 'hrrp', hacrp: 'hac', hvbp: 'hvbp', net: 'net' };
// A strip narrower than this lays out as a phone's.
const NARROW_BELOW = 520;
// The strip's height and its parts, in CSS pixels: the plot's top and bottom, and the axis's baseline.
const FRAME = { wide: { H: 128, top: 8, bot: 98, base: 104 }, narrow: { H: 112, top: 6, bot: 82, base: 88 } };
// A group's largest pitch by its size, wide and narrow; and the smallest it shrinks to before its bins widen instead (a
// strip has room across, so a spike such as the hospital-acquired conditions cut stands as a block of readable dots
// rather than a thread of tiny ones).
const dMaxOf = (n, narrow) => (n < 160 ? (narrow ? 5 : 7) : n < 700 ? (narrow ? 3.4 : 4.6) : narrow ? 2.4 : 3.4);
const dMinOf = (n, narrow) => (n < 160 ? (narrow ? 3.4 : 4.4) : n < 700 ? (narrow ? 2.4 : 3) : 0);
const FADE = 450;

function el(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (parent) parent.append(node);
  return node;
}
const signClass = (v) => (v < 0 ? 'st__d st__d--pen' : v > 0 ? 'st__d st__d--rew' : 'st__d st__d--neu');
function hashOf(text) {
  let s = 2166136261;
  for (let i = 0; i < text.length; i++) s = Math.imul(s ^ text.charCodeAt(i), 16777619);
  return ((s >>> 0) % 100003) / 100003;
}
const round = (v) => Math.round(v * 100) / 100;

// mountStrips(root, options): root is the #whatif section. Options: h (this hospital), peers (its group), domain (the
// share axis's [lo, hi]), fill (the page's copy filler), still (reduced motion). Returns { update(peers, scenario) }:
// scenario, when given, is { hrrp, hacrp, hvbp, net } in percent of pay (a what-if), each drawn as a dashed ring.
export function mountStrips(root, { h, peers, domain, fill, still }) {
  const list = root.querySelector('.hh__rows');
  const strips = IDS.map((id) => {
    const box = root.querySelector(`[data-row="${id}"] [data-strip]`);
    if (!box) return null;
    const svg = el('svg', { class: 'st', 'aria-hidden': 'true', focusable: 'false' }, box);
    const bg = el('g', {}, svg);
    const dots = el('g', {}, svg);
    const med = el('g', { class: 'st__med' }, svg);
    el('path', { d: 'M0 -1 L-5 7 L5 7 Z' }, med);
    const medText = el('text', { x: 8, y: 7 }, med);
    medText.textContent = fill('stripMedian');
    const me = el('circle', { class: 'st__me', cx: 0, cy: 0 }, svg);
    const hyp = el('circle', { class: 'st__hyp', cx: 0, cy: 0 }, svg);
    const out = el('text', { class: 'st__out', x: 4, y: 14 }, svg);
    return { id, box, svg, bg, dots, med, me, hyp, out, marks: new Map(), at: null, W: 0, gutter: 0 };
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

  // The $0 gutter's width for a strip's frame: the usual, or wider when a row's hospitals at exactly $0 (the most of any
  // row: often the hospital-acquired conditions row's "no cut") could not stand in it as separate dots of the smallest
  // size. One width for every strip, so the rows keep one scale.
  function gutterFor(f, narrow, px) {
    let d = 2 * px;
    while ((d - Math.max(px, d * 0.24)) / 2 < R_MIN - 1e-9) d += px;
    const rows = Math.max(1, Math.floor((f.bot - f.top) / d) - 1);
    let zeros = 0;
    for (const id of IDS) zeros = Math.max(zeros, group.filter((x) => inProgram(x.est, id) && x.est.pct[PCT[id]] === 0).length);
    return Math.max(narrow ? 12 : 20, Math.ceil(zeros / rows + 1) * d);
  }

  function render(st, animate) {
    const W = st.box.clientWidth;
    if (!W) return;
    const narrow = W < NARROW_BELOW;
    const f = FRAME[narrow ? 'narrow' : 'wide'];
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const px = 1 / dpr;
    const gutter = gutterFor(f, narrow, px);
    const scale = shareScale({ x0: 4, x1: W - 4, gutter, domain, px });
    const resized = W !== st.W || gutter !== st.gutter;
    if (resized) {
      st.W = W;
      st.gutter = gutter;
      st.svg.setAttribute('viewBox', `0 0 ${W} ${f.H}`);
      st.svg.setAttribute('width', String(W));
      st.svg.setAttribute('height', String(f.H));
      scenery(st, scale, f, W);
    }
    // Moves glide only on a group change, not on a resize, nor before the first paint.
    st.svg.classList.toggle('st--live', animate && !still.matches);
    const key = PCT[st.id];
    const items = group.filter((x) => inProgram(x.est, st.id)).map((x) => ({ id: x.ccn, v: x.est.pct[key], key: hashOf(x.ccn) }));
    const pile = pileLayout(items, scale, { base: f.bot, top: f.top, dMax: dMaxOf(items.length, narrow), dMin: Math.max(1, 2 * px, dMinOf(items.length, narrow)), gap: (d) => Math.max(px, d * 0.24), mirror: true, px });
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
    // A what-if's value: a dashed ring on the plot's middle line.
    const v = scenario?.[st.id];
    st.hyp.style.display = Number.isFinite(v) && listed ? '' : 'none';
    if (Number.isFinite(v) && listed) {
      st.hyp.setAttribute('r', String(round(Math.max(st.at?.r ?? 2, 1.5) + 3.5)));
      st.hyp.setAttribute('cx', String(round(scale.xs(v))));
      st.hyp.setAttribute('cy', String(round((f.top + f.bot) / 2)));
    }
    st.svg.dataset.n = count(items.length);
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

  return {
    update(next, nextScenario = null) {
      group = next;
      scenario = nextScenario;
      all(true);
    },
  };
}
