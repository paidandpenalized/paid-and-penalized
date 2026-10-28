// A hospital page's peer swarm: one canvas with two dot piles on the share axis (scale.js), the hospital's peer group
// above (mirrored about its middle line) and all the hospitals with an estimate below, each hospital one dot placed by its
// net as a share of its pay (pile.js; drawn by the home story's dot rule, story/geometry.js drawnDot, so a pile never
// turns into a solid bar). This hospital is ringed in both, joined by a dashed line; the group's median is a tick under
// its pile. Switching the group moves the same dots: a hospital that joins rises out of the pile below into the group, one
// that leaves sinks back into it, and those that stay restack (instant under reduced motion).
//
// Every dot answers a pointer (its name, city and net in a tooltip, with a hit target larger than the dot) and a click
// opens its hospital's page; on a touch screen the first tap shows the tooltip and a second opens. The canvas takes focus:
// ← and → step through the group from left to right (Home and End to its ends), each step said in a polite live region,
// Enter opens, Escape lets go. Colors come from the tokens (colors.js) and repaint when the theme changes.
import { count, pct } from '../../../web/client/format.js';
import { hospitalPathOf } from '../../../web/site.js';
import { signedShareText } from '../../hospital/text.js';
import { onThemeChange, readColors } from '../colors.js';
import { pileLayout } from '../pile.js';
import { shareScale } from '../scale.js';
import { drawnDot } from '../story/geometry.js';

const TAU = Math.PI * 2;
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
// The move between two groups: its length (ms) and how much of it the dots' start times spread over.
const MOVE = 700;
const SPREAD = 0.2;
// The two piles' opacity: the group, and everyone (quieter, so the group reads first).
const PEER_A = 1;
const ALL_A = 0.62;
const ALL_A_SMALL = 0.8;
// A stage narrower than this lays out as a phone's.
const NARROW_BELOW = 520;
// The frame, in CSS pixels, wide and narrow: the margins, the $0 gutter, and where each pile and the axis sit.
const WIDE = { x: 6, gutter: 20, H: 452, pTop: 34, pBot: 206, aTop: 284, aBot: 396, peerMax: [8.5, 5.6, 4.2], allMax: 4.2 };
const NARROW = { x: 4, gutter: 12, H: 376, pTop: 30, pBot: 166, aTop: 228, aBot: 316, peerMax: [5, 3.4, 2.6], allMax: 2.6 };
// A group's largest pitch by its size: a small group's dots can be larger.
const peerMax = (m, n) => m.peerMax[n < 160 ? 0 : n < 700 ? 1 : 2];
// The cut, bonus or no-change ink of a value.
const PEN = 1;
const REW = 2;
const signCode = (v) => (v < 0 ? PEN : v > 0 ? REW : 0);

// A stable spread in [0, 1) for a CCN, so a pile's stacking order never depends on the asset's order.
function hashOf(text) {
  let s = 2166136261;
  for (let i = 0; i < text.length; i++) s = Math.imul(s ^ text.charCodeAt(i), 16777619);
  return ((s >>> 0) % 100003) / 100003;
}

// mountSwarm(el, options): el is the page's empty [data-swarm]. Options:
//   hospitals  every decoded hospital (web/client/hub-asset.js); those with an estimate are drawn
//   h          this hospital (one with an estimate); peers: its group (h among them); domain: the share axis's [lo, hi]
//   fill       the page's copy filler; fy: the fiscal year (a string); group: the group's name; still: reduced motion
// Returns { setPeers(peers, group), setHypothetical(pct | null), destroy() }.
export function mountSwarm(el, { hospitals, h, peers, domain, fill, fy, group, still }) {
  const rows = hospitals.filter((x) => x.est);
  const N = rows.length;
  const S = 2 * N;
  const self = rows.indexOf(h);
  const V = Float32Array.from(rows, (x) => x.est.pct.net);
  const KEY = Float32Array.from(rows, (x) => hashOf(x.ccn));
  const C = Uint8Array.from(rows, (x) => signCode(x.est.net));
  // Where each dot is now, where it was when the move began, and where it is going.
  const [CX, CY, CR, CA, X0, Y0, R0, A0, TX, TY, TR, TA] = Array.from({ length: 12 }, () => new Float32Array(S));

  const canvas = document.createElement('canvas');
  canvas.className = 'hh__cv';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  const tip = document.createElement('div');
  tip.className = 'hh__tip';
  tip.hidden = true;
  const live = document.createElement('p');
  live.className = 'vh';
  live.setAttribute('aria-live', 'polite');
  el.append(canvas, tip, live);
  const ctx = canvas.getContext('2d');

  let members = new Set(peers);
  let groupName = group;
  let W = 0;
  let m = WIDE;
  let dpr = 1;
  let scale = null;
  let info = null;
  let raf = 0;
  let t0 = 0;
  let moving = false;
  let hover = -1;
  let picked = -1;
  let tapped = -1;
  let hypo = null;
  let order = [];
  let colors = readColors();
  let fonts = readFonts();

  function readFonts() {
    const style = getComputedStyle(document.documentElement);
    return { body: style.getPropertyValue('--font-body').trim(), type: style.getPropertyValue('--font-type').trim() };
  }
  const font = (size, weight = 400, mono = false) => `${weight} ${size}px ${mono ? fonts.type : fonts.body}`;
  const ink = (code) => (code === PEN ? colors.pen : code === REW ? colors.rew : colors.neutral);

  function label() {
    canvas.setAttribute('aria-label', fill('swarmLabel', { n: count(members.size), group: groupName, all: count(N), fy }));
  }

  // ---------- layout ----------

  // The targets for the group now: everyone in the pile below; the group's copies in the pile above, and the others'
  // copies hidden on their own dots below (where a joining hospital rises from and a leaving one sinks to).
  function layout() {
    const px = 1 / dpr;
    const gap = (d) => Math.max(px, d * 0.24);
    const dMin = Math.max(1, 2 * px);
    const all = rows.map((x, i) => ({ id: i, v: V[i], key: KEY[i] }));
    // byValue: a widened bin's sub-columns are value slices, so the ringed dot stands at its own value (pile.js).
    const allPile = pileLayout(all, scale, { base: m.aBot, top: m.aTop, dMax: m.allMax, dMin, gap, mirror: true, px, byValue: true });
    const mine = rows.flatMap((x, i) => (members.has(x) ? [{ id: N + i, v: V[i], key: KEY[i] }] : []));
    const peerPile = pileLayout(mine, scale, { base: m.pBot, top: m.pTop, dMax: peerMax(m, mine.length), dMin, gap, mirror: true, px, byValue: true });
    // Everyone's pile is quieter than the group's, but a dot of a single device pixel at that quiet washes out: those keep
    // more ink.
    const allA = drawnDot(allPile.r, dpr).side <= 1 ? ALL_A_SMALL : ALL_A;
    for (let i = 0; i < N; i++) {
      const p = allPile.pos.get(i);
      TX[i] = p.x;
      TY[i] = p.y;
      TR[i] = allPile.r;
      TA[i] = allA;
      const q = peerPile.pos.get(N + i);
      TX[N + i] = q ? q.x : p.x;
      TY[N + i] = q ? q.y : p.y;
      TR[N + i] = q ? peerPile.r : allPile.r;
      TA[N + i] = q ? PEER_A : 0;
    }
    const extent = (pile) => pile.cols.reduce((e, c) => [Math.min(e[0], c.top), Math.max(e[1], c.bottom)], [Infinity, -Infinity]);
    const values = mine.map((it) => it.v).sort((a, b) => a - b);
    const mid = values.length >> 1;
    const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
    let cut = 0;
    let bonus = 0;
    for (const it of mine) if (it.v < 0) cut += 1; else if (it.v > 0) bonus += 1;
    info = { peer: extent(peerPile), all: extent(allPile), median, cut, bonus, none: mine.length - cut - bonus };
    // The arrow keys' order: the group from left to right as drawn (then by name, for hospitals at one place).
    order = mine.map((it) => it.id).sort((a, b) => TX[a] - TX[b] || TY[a] - TY[b] || rows[a - N].name.localeCompare(rows[b - N].name));
  }

  function measure() {
    W = el.clientWidth;
    m = W < NARROW_BELOW ? NARROW : WIDE;
    // Device pixels to a CSS pixel, held between 1 and 3 (as the home story's stage does).
    dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(m.H * dpr);
    canvas.style.height = `${m.H}px`;
    scale = shareScale({ x0: m.x, x1: W - m.x, gutter: m.gutter, domain, px: 1 / dpr });
  }

  function settle() {
    CX.set(TX);
    CY.set(TY);
    CR.set(TR);
    CA.set(TA);
  }

  // ---------- motion ----------

  function move() {
    cancelAnimationFrame(raf);
    if (still.matches || !W) {
      moving = false;
      settle();
      draw();
      return;
    }
    X0.set(CX);
    Y0.set(CY);
    R0.set(CR);
    A0.set(CA);
    moving = true;
    t0 = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function tick(now) {
    const raw = Math.min(1, (now - t0) / MOVE);
    for (let s = 0; s < S; s++) {
      const q = ease(clamp01((raw - KEY[s % N] * SPREAD) / (1 - SPREAD)));
      CX[s] = X0[s] + (TX[s] - X0[s]) * q;
      CY[s] = Y0[s] + (TY[s] - Y0[s]) * q;
      CR[s] = R0[s] + (TR[s] - R0[s]) * q;
      CA[s] = A0[s] + (TA[s] - A0[s]) * q;
    }
    draw();
    if (raw < 1) raf = requestAnimationFrame(tick);
    else {
      moving = false;
      settle();
      draw();
    }
  }

  // ---------- painting ----------

  function text(s, x, y, f, color, align = 'left', halo = false) {
    ctx.font = f;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    if (halo) {
      const w = ctx.measureText(s).width;
      const left = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
      ctx.fillStyle = colors.paper;
      ctx.globalAlpha = 0.88;
      ctx.fillRect(left - 3, y - 12, w + 6, 16);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }
  function vline(x, ya, yb, color, w = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    const xx = w % 2 ? Math.round(x) + 0.5 : Math.round(x);
    ctx.moveTo(xx, ya);
    ctx.lineTo(xx, yb);
    ctx.stroke();
  }
  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
  }

  // The share axis under both piles: the $0 gutter shaded, a faint line at each whole percent, the baseline, the ticks'
  // values and which side is a cut and which a bonus (each word underlined in its ink).
  function axis() {
    const { zL, zR } = scale;
    const base = m.aBot + 8;
    ctx.fillStyle = colors.paper2;
    ctx.fillRect(zL, m.pTop - 6, zR - zL, base - m.pTop + 6);
    const [lo, hi] = domain;
    const tick = font(W < NARROW_BELOW ? 10 : 11, 400, true);
    for (let v = Math.ceil(lo); v <= Math.floor(hi); v++) {
      const x = scale.xs(v);
      if (v !== 0) {
        ctx.globalAlpha = 0.45;
        vline(x, m.pTop - 6, base + 4, colors.line);
        ctx.globalAlpha = 1;
      }
      text(pct(v / 100, 0, { sign: true }), x, base + 17, tick, colors.ink3, 'center');
    }
    ctx.fillStyle = colors.ink2;
    ctx.fillRect(m.x, Math.round(base), W - 2 * m.x, 1);
    const f = font(W < NARROW_BELOW ? 11 : 12, 600);
    const y = base + 34;
    ctx.font = f;
    const cut = `← ${fill('swarmAxisCut')}`;
    const bonus = `${fill('swarmAxisBonus')} →`;
    const wc = ctx.measureText(cut).width;
    const wb = ctx.measureText(bonus).width;
    text(cut, zL - 6, y, f, colors.ink2, 'right');
    text(bonus, zR + 6, y, f, colors.ink2);
    ctx.fillStyle = colors.pen;
    ctx.fillRect(zL - 6 - wc, y + 3, wc, 2);
    ctx.fillStyle = colors.rew;
    ctx.fillRect(zR + 6, y + 3, wb, 2);
  }

  // The dots, batched by ink and opacity (tenths); a small dot is a square on the device's grid (drawnDot).
  function dots() {
    const buckets = new Map();
    for (let s = 0; s < S; s++) {
      const a = CA[s];
      if (a < 0.02) continue;
      const k = C[s % N] * 16 + Math.round(a * 10);
      let list = buckets.get(k);
      if (!list) buckets.set(k, (list = []));
      list.push(s);
    }
    for (const [k, list] of buckets) {
      ctx.fillStyle = ink(k >> 4);
      ctx.globalAlpha = (k & 15) / 10;
      ctx.beginPath();
      for (const s of list) {
        const r = CR[s];
        const { square, side } = drawnDot(r, dpr);
        if (square) ctx.rect(Math.round(CX[s] * dpr - side / 2) / dpr, Math.round(CY[s] * dpr - side / 2) / dpr, side / dpr, side / dpr);
        else {
          ctx.moveTo(CX[s] + r, CY[s]);
          ctx.arc(CX[s], CY[s], r, 0, TAU);
        }
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // The piles' words: the group's name and count over it, its median as a tick under it with its cuts and bonuses either
  // side of $0, and everyone's name over the pile below.
  function words() {
    const narrow = W < NARROW_BELOW;
    const n = count(members.size);
    text(`${n} ${groupName}`, m.x, m.pTop - 14, font(narrow ? 12.5 : 13.5, 700), colors.ink);
    text(fill('swarmAll', { n: count(N) }), m.x, m.aTop - 12, font(narrow ? 11 : 11.5, 400, true), colors.ink2, 'left', true);
    const y = Math.max(info.peer[1], m.pTop) + 6;
    const x = scale.xs(info.median);
    ctx.globalAlpha = moving ? 0.35 : 1;
    vline(x, y, y + 11, colors.ink, 2);
    const f = font(narrow ? 10.5 : 11, 400, true);
    const med = fill('swarmMedian', { share: signedShareText(info.median / 100) });
    ctx.font = f;
    const right = x + 5 + ctx.measureText(med).width > W - m.x;
    text(med, right ? x - 5 : x + 5, y + 11, f, colors.ink2, right ? 'right' : 'left', true);
    const cy = y + 28;
    if (info.cut) text(fill('swarmCut', { n: count(info.cut) }), scale.zL - 6, cy, f, colors.ink2, 'right', true);
    if (info.bonus) text(fill('swarmBonus', { n: count(info.bonus) }), scale.zR + 6, cy, f, colors.ink2, 'left', true);
    ctx.globalAlpha = 1;
  }

  // A ring around dot s: paper inside so the dot stands clear, then the ink line.
  function ring(s, width = 2, dash = null) {
    const rr = Math.max(CR[s], 1.4) + 4.5;
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = colors.paper;
    circle(CX[s], CY[s], rr);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = ink(C[s % N]);
    circle(CX[s], CY[s], Math.max(2.2, CR[s] + 0.6));
    ctx.fill();
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = width;
    ctx.setLineDash(dash ?? []);
    circle(CX[s], CY[s], rr);
    ctx.stroke();
    ctx.setLineDash([]);
    return rr;
  }

  // This hospital: ringed in both piles, joined by a dashed line, named beside the upper ring.
  function self_() {
    if (self < 0) return;
    const up = N + self;
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(CX[up], CY[up]);
    ctx.lineTo(CX[self], CY[self]);
    ctx.stroke();
    ctx.setLineDash([]);
    ring(self);
    const rr = ring(up);
    // The name beside the upper ring, above its right (or its left, near the right edge), on a paper halo over the dots.
    const f = font(W < NARROW_BELOW ? 12 : 13, 700);
    ctx.font = f;
    const name = rows[self].name;
    const w = ctx.measureText(name).width;
    let x = CX[up] + rr + 4;
    let align = 'left';
    if (x + w > W - m.x) {
      x = CX[up] - rr - 4;
      align = 'right';
      if (x - w < m.x) {
        x = Math.min(Math.max(CX[up], m.x + w / 2), W - m.x - w / 2);
        align = 'center';
      }
    }
    text(name, x, Math.max(m.pTop + 2, CY[up] - rr - 3), f, colors.ink, align, true);
  }

  // A what-if's net: a dashed ring on the group's middle line and on everyone's, where the hospital would stand.
  function hypothetical() {
    if (hypo === null || self < 0) return;
    const x = scale.xs(hypo);
    for (const y of [CY[N + self], CY[self]]) {
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      circle(x, y, Math.max(CR[N + self], 1.4) + 4.5);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function draw() {
    if (!W || !info) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, m.H);
    axis();
    dots();
    words();
    self_();
    hypothetical();
    for (const s of [hover, picked]) if (s >= 0 && s % N !== self && CA[s] > 0.05) ring(s, 1.5);
  }

  // ---------- reading a dot ----------

  // The dot under a point (CSS pixels on the canvas): the nearest shown dot within a target larger than the dot (the
  // group's first), or -1.
  function hit(x, y) {
    let best = -1;
    let bestD = Infinity;
    for (let s = S - 1; s >= 0; s--) {
      if (CA[s] < 0.3) continue;
      const d = Math.hypot(CX[s] - x, CY[s] - y);
      const reach = Math.max(9, CR[s] + 5);
      // The group's copies (s >= N) win a tie with everyone's dots.
      if (d <= reach && d + (s >= N ? 0 : 0.5) < bestD) {
        best = s;
        bestD = d + (s >= N ? 0 : 0.5);
      }
    }
    return best;
  }

  const sayDot = (s) => {
    const x = rows[s % N];
    const line = fill('dotText', { name: x.name, city: x.city ?? '', state: x.state ?? '', share: signedShareText(x.est.share), fy });
    return s % N === self ? `${line}. ${fill('dotThis')}` : line;
  };

  function showTip(s, touch = false) {
    if (s < 0) {
      tip.hidden = true;
      return;
    }
    tip.textContent = '';
    const name = document.createElement('b');
    name.textContent = rows[s % N].name;
    const rest = document.createElement('span');
    const x = rows[s % N];
    rest.textContent = `${[x.city, x.state].filter(Boolean).join(', ')} · ${signedShareText(x.est.share)}`;
    tip.append(name, rest);
    if (touch && s % N !== self) {
      const open = document.createElement('span');
      open.className = 'hh__tip-open';
      open.textContent = fill('dotOpen');
      tip.append(open);
    }
    tip.hidden = false;
    const tw = tip.offsetWidth;
    const left = Math.min(Math.max(0, CX[s] - tw / 2), W - tw);
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(0, CY[s] - tip.offsetHeight - Math.max(CR[s], 2) - 10)}px`;
  }

  const open = (s) => {
    if (s >= 0 && s % N !== self) window.location.assign(hospitalPathOf('hub', rows[s % N].ccn));
  };
  const point = (e) => {
    const b = canvas.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  };

  function onMove(e) {
    if (e.pointerType === 'touch') return;
    const s = hit(...point(e));
    if (s === hover) return;
    hover = s;
    canvas.style.cursor = s >= 0 && s % N !== self ? 'pointer' : '';
    showTip(s);
    if (!moving) draw();
  }
  function onLeave() {
    hover = -1;
    tip.hidden = true;
    if (!moving) draw();
  }
  function onClick(e) {
    const s = hit(...point(e));
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      // A first tap shows the dot; a second on the same dot opens it.
      if (s >= 0 && s === tapped) open(s);
      tapped = s;
      hover = s;
      showTip(s, true);
      draw();
      return;
    }
    open(s);
  }

  function onKey(e) {
    if (!order.length) return;
    let at = order.indexOf(picked);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (at < 0) at = order.indexOf(N + self);
      at = Math.min(order.length - 1, Math.max(0, at + (e.key === 'ArrowRight' ? 1 : -1)));
    } else if (e.key === 'Home') at = 0;
    else if (e.key === 'End') at = order.length - 1;
    else if (e.key === 'Enter') {
      if (picked >= 0) open(picked);
      return;
    } else if (e.key === 'Escape') {
      if (picked < 0) return;
      picked = -1;
      tip.hidden = true;
      draw();
      return;
    } else return;
    e.preventDefault();
    picked = order[at];
    live.textContent = sayDot(picked);
    showTip(picked);
    draw();
  }

  function onBlur() {
    picked = -1;
    tip.hidden = true;
    draw();
  }

  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('click', (e) => onClick(e));
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('blur', onBlur);

  function resize() {
    if (el.clientWidth === W) return;
    measure();
    layout();
    settle();
    draw();
  }
  const watch = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  watch?.observe(el);
  const stopTheme = onThemeChange(() => {
    colors = readColors();
    fonts = readFonts();
    draw();
  });

  measure();
  layout();
  settle();
  label();
  draw();
  if (document.fonts) document.fonts.ready.then(() => {
    fonts = readFonts();
    draw();
  });

  return {
    // Show another group (h among it), named group: the same dots move.
    setPeers(next, name) {
      members = new Set(next);
      groupName = name;
      picked = -1;
      hover = -1;
      tapped = -1;
      tip.hidden = true;
      label();
      layout();
      move();
    },
    // A what-if's net share in percent (or null for none): a dashed ring where the hospital would stand.
    setHypothetical(pct) {
      hypo = Number.isFinite(pct) ? pct : null;
      if (!moving) draw();
    },
    destroy() {
      cancelAnimationFrame(raf);
      watch?.disconnect();
      stopTheme();
      el.textContent = '';
    },
  };
}
