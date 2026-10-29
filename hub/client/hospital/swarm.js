// A hospital page's peer swarm: one canvas with two dot piles on the share axis (scale.js), the hospital's peer group
// above (mirrored about its middle line) and all the hospitals with an estimate below, each hospital one dot placed by its
// net as a share of its pay (pile.js; painted as the home story's dots are, paint.js paintDots, so a pile never turns into a
// solid bar). This hospital is ringed in both, joined by a dashed line; the group's median is a tick under
// its pile. Switching the group moves the same dots: a hospital that joins rises out of the pile below into the group, one
// that leaves sinks back into it, and those that stay restack (instant under reduced motion). A change of axis (a
// what-if's net past it) moves every dot at once, and the ticks, the gutter, the median and the marks with them.
//
// Every dot answers a pointer (its name, city and net in a tooltip, with a hit target larger than the dot) and a click
// opens its hospital's page; on a touch screen the first tap shows the tooltip and a second opens. The canvas takes focus:
// ← and → step through the group from left to right (Home and End to its ends), each step said in a polite live region,
// Enter opens, Escape lets go. Colors come from the tokens (colors.js) and repaint when the theme changes.
import { median } from '../../../engine/js/peers.js';
import { clamp } from '../../../engine/js/stats.js';
import { count } from '../../../web/client/format.js';
import { placeText } from '../../../web/render/format.js';
import { hospitalPathOf } from '../../../web/site.js';
import { signedShareText } from '../../hospital/text.js';
import { inkColor, onThemeChange, readColors, readFonts, signCode } from '../colors.js';
import { GLIDE_MS, TAU, clamp01, deviceRatio, ease, fontOf, paintDots } from '../paint.js';
import { NARROW_BELOW, drawnDot, hashOf, peerPitch, pileExtent, pileLayout, pileSpacing } from '../pile.js';
import { mixScale, shareScale, tickText, ticksBetween } from '../scale.js';
import { node } from './dom.js';
// How much of a move between two groups (paint.js GLIDE_MS long) the dots' start times spread over.
const SPREAD = 0.2;
// The two piles' opacity: the group, and everyone (quieter, so the group reads first).
const PEER_A = 1;
const ALL_A = 0.62;
const ALL_A_SMALL = 0.8;
// The actual's rings during a what-if: a ghost.
const GHOST_A = 0.4;
// The frame, in CSS pixels, wide and narrow (under pile.js NARROW_BELOW): the margins, the $0 gutter, where each pile and
// the axis sit, and everyone's pile's largest pitch (the group's: pile.js peerPitch).
const WIDE = { x: 6, gutter: 20, H: 452, pTop: 34, pBot: 206, aTop: 284, aBot: 396, allMax: 4.2 };
const NARROW = { x: 4, gutter: 12, H: 376, pTop: 30, pBot: 166, aTop: 228, aBot: 316, allMax: 2.6 };

// mountSwarm(el, options): el is the page's empty [data-swarm]. Options:
//   hospitals  every decoded hospital (web/client/hub-asset.js); those with an estimate are drawn
//   h          this hospital (one with an estimate); peers: its group (h among them); domain: the share axis's [lo, hi]
//              for the actual figures, the data's own
//   fill       the page's copy filler; fy: the fiscal year (a string); group: the group's name; still: reduced motion
// Returns { setPeers(peers, group), setHypothetical(pct | null), setAxis(axis, animate) }: the what-if (whatif.js) widens
// the axis just enough to hold a hypothetical net past it, and back (scale.js holdingAxis and stripAxis).
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

  const canvas = node('canvas', { class: 'hh__cv', tabindex: 0, role: 'img' });
  const tip = node('div', { class: 'hh__tip', hidden: '' });
  const live = node('p', { class: 'vh', 'aria-live': 'polite' });
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
  // The axis (domain, or one a what-if widened: setAxis), and during a move to it the scale the move began from and how
  // far along it is (eased): the axis is drawn part way between, as the dots are (view).
  let axisOf = domain;
  let from = null;
  let qa = 1;
  const view = () => (from ? mixScale(from, scale, qa) : scale);
  let order = [];
  let colors = readColors();
  let fonts = readFonts();

  const font = (size, weight, mono) => fontOf(fonts, size, weight, mono);
  const ink = (code) => inkColor(colors, code);

  function label() {
    canvas.setAttribute('aria-label', fill('swarmLabel', { n: count(members.size), group: groupName, all: count(N), fy }));
  }

  // ---------- layout ----------

  // The targets for the group now: everyone in the pile below; the group's copies in the pile above, and the others'
  // copies hidden on their own dots below (where a joining hospital rises from and a leaving one sinks to).
  function layout() {
    const px = 1 / dpr;
    const { gap, dMin } = pileSpacing(px);
    const all = rows.map((x, i) => ({ id: i, v: V[i], key: KEY[i] }));
    // byValue: a widened bin's sub-columns are value slices, so the ringed dot stands at its own value; ranked: each column
    // stacks in one order on any axis, so a glide between two axes keeps every pile a pile (pile.js).
    const opts = { dMin, gap, mirror: true, px, byValue: true, ranked: true };
    const allPile = pileLayout(all, scale, { base: m.aBot, top: m.aTop, dMax: m.allMax, ...opts });
    const mine = rows.flatMap((x, i) => (members.has(x) ? [{ id: N + i, v: V[i], key: KEY[i] }] : []));
    const peerPile = pileLayout(mine, scale, { base: m.pBot, top: m.pTop, dMax: peerPitch(mine.length, m === NARROW), ...opts });
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
    let cut = 0;
    let bonus = 0;
    for (const it of mine) if (it.v < 0) cut += 1; else if (it.v > 0) bonus += 1;
    info = { peer: pileExtent(peerPile), all: pileExtent(allPile), median: median(mine.map((it) => it.v)), cut, bonus };
    // The arrow keys' order: the group from left to right as drawn (then by name, for hospitals at one place).
    order = mine.map((it) => it.id).sort((a, b) => TX[a] - TX[b] || TY[a] - TY[b] || rows[a - N].name.localeCompare(rows[b - N].name));
  }

  function measure() {
    // A new size lays every dot out again where it ends: any move is over.
    cancelAnimationFrame(raf);
    moving = false;
    W = el.clientWidth;
    m = W < NARROW_BELOW ? NARROW : WIDE;
    dpr = deviceRatio();
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(m.H * dpr);
    canvas.style.height = `${m.H}px`;
    rescale();
  }
  const rescale = () => {
    scale = shareScale({ x0: m.x, x1: W - m.x, gutter: m.gutter, domain: axisOf, px: 1 / dpr });
    from = null;
  };

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
      from = null;
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
    const raw = Math.min(1, (now - t0) / GLIDE_MS);
    // A change of axis moves every dot at once, with the axis; a change of group spreads their starts.
    const spread = from ? 0 : SPREAD;
    if (from) qa = ease(raw);
    for (let s = 0; s < S; s++) {
      const q = ease(clamp01((raw - KEY[s % N] * spread) / (1 - spread)));
      CX[s] = X0[s] + (TX[s] - X0[s]) * q;
      CY[s] = Y0[s] + (TY[s] - Y0[s]) * q;
      CR[s] = R0[s] + (TR[s] - R0[s]) * q;
      CA[s] = A0[s] + (TA[s] - A0[s]) * q;
    }
    draw();
    if (raw < 1) raf = requestAnimationFrame(tick);
    else {
      moving = false;
      from = null;
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

  // The share axis under both piles (sc: as drawn now): the $0 gutter shaded, a faint line at each whole percent, the
  // baseline, the ticks' values (an end one held inside the canvas: on an axis a what-if widened the last tick can sit
  // closer to the edge than half its label) and which side is a cut and which a bonus (each word underlined in its ink).
  // Mid-move, a tick only one end of it shows fades (ticksBetween).
  function axis(sc) {
    const { zL, zR } = sc;
    const base = m.aBot + 8;
    ctx.fillStyle = colors.paper2;
    ctx.fillRect(zL, m.pTop - 6, zR - zL, base - m.pTop + 6);
    const tick = font(W < NARROW_BELOW ? 10 : 11, 400, true);
    for (const { v, x, alpha } of ticksBetween(from ?? scale, scale, from ? qa : 1)) {
      if (v !== 0) {
        ctx.globalAlpha = 0.45 * alpha;
        vline(x, m.pTop - 6, base + 4, colors.line);
      }
      ctx.globalAlpha = alpha;
      const label = tickText(v);
      ctx.font = tick;
      const half = ctx.measureText(label).width / 2 + 1;
      text(label, clamp(x, half, W - half), base + 17, tick, colors.ink3, 'center');
      ctx.globalAlpha = 1;
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

  // The dots, batched by ink and opacity (paint.js paintDots); a copy takes its hospital's ink.
  const dots = () => paintDots(ctx, { count: S, x: CX, y: CY, r: CR, a: CA, code: (s) => C[s % N], ink, dpr });

  // The piles' words: the group's name and count over it, its median as a tick under it with its cuts and bonuses either
  // side of $0, and everyone's name over the pile below (sc: the axis as drawn now).
  function words(sc) {
    const narrow = W < NARROW_BELOW;
    const n = count(members.size);
    text(`${n} ${groupName}`, m.x, m.pTop - 14, font(narrow ? 12.5 : 13.5, 700), colors.ink);
    text(fill('swarmAll', { n: count(N) }), m.x, m.aTop - 12, font(narrow ? 11 : 11.5, 400, true), colors.ink2, 'left', true);
    const y = Math.max(info.peer[1], m.pTop) + 6;
    const x = sc.xs(info.median);
    // Dimmed while a change of group moves it to the new group's median; a change of axis carries the same one along.
    ctx.globalAlpha = moving && !from ? 0.35 : 1;
    vline(x, y, y + 11, colors.ink, 2);
    const f = font(narrow ? 10.5 : 11, 400, true);
    const med = fill('swarmMedian', { share: signedShareText(info.median / 100) });
    ctx.font = f;
    const right = x + 5 + ctx.measureText(med).width > W - m.x;
    text(med, right ? x - 5 : x + 5, y + 11, f, colors.ink2, right ? 'right' : 'left', true);
    const cy = y + 28;
    if (info.cut) text(fill('swarmCut', { n: count(info.cut) }), sc.zL - 6, cy, f, colors.ink2, 'right', true);
    if (info.bonus) text(fill('swarmBonus', { n: count(info.bonus) }), sc.zR + 6, cy, f, colors.ink2, 'left', true);
    ctx.globalAlpha = 1;
  }

  // A ring around dot s: paper inside so the dot stands clear, then the ink line. alpha: a ghost's fainter ink.
  function ring(s, width = 2, dash = null, alpha = 1) {
    const rr = Math.max(CR[s], 1.4) + 4.5;
    ctx.globalAlpha = 0.75 * alpha;
    ctx.fillStyle = colors.paper;
    circle(CX[s], CY[s], rr);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ink(C[s % N]);
    circle(CX[s], CY[s], Math.max(2.2, CR[s] + 0.6));
    ctx.fill();
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = width;
    ctx.setLineDash(dash ?? []);
    circle(CX[s], CY[s], rr);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    return rr;
  }

  // This hospital: ringed in both piles, joined by a dashed line, named beside the upper ring. During a what-if its rings
  // are the actual's ghost.
  function self_() {
    if (self < 0) return;
    const up = N + self;
    const alpha = hypo === null ? 1 : GHOST_A;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(CX[up], CY[up]);
    ctx.lineTo(CX[self], CY[self]);
    ctx.stroke();
    ctx.setLineDash([]);
    ring(self, 2, null, alpha);
    const rr = ring(up, 2, null, alpha);
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
        x = clamp(CX[up], m.x + w / 2, W - m.x - w / 2);
        align = 'center';
      }
    }
    text(name, x, Math.max(m.pTop + 2, CY[up] - rr - 3), f, colors.ink, align, true);
  }

  // A what-if's net: a hollow mark (a paper core in an ink line, then a dashed ring) where the hospital would stand on the
  // axis as drawn (sc), at its rings' heights in the group and in everyone, labeled "What if" under the group's (the name
  // is over its ring).
  function hypothetical(sc) {
    if (hypo === null || self < 0) return;
    const x = sc.xs(hypo);
    const r = Math.max(CR[N + self], 1.4);
    for (const y of [CY[N + self], CY[self]]) {
      ctx.fillStyle = colors.paper;
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 1.5;
      circle(x, y, Math.max(2.5, r + 0.5));
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      circle(x, y, r + 6);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // The label under it, held inside the canvas at the axis's ends (the deepest what-if sits near one).
    const f = font(12, 700);
    ctx.font = f;
    const label = fill('wiMark');
    const half = ctx.measureText(label).width / 2;
    text(label, clamp(x, m.x + half, W - m.x - half), CY[N + self] + r + 20, f, colors.ink, 'center', true);
  }

  function draw() {
    if (!W || !info) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, m.H);
    const sc = view();
    axis(sc);
    dots();
    words(sc);
    self_();
    hypothetical(sc);
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
      const rank = d + (s >= N ? 0 : 0.5);
      if (d <= reach && rank < bestD) {
        best = s;
        bestD = rank;
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
    const x = rows[s % N];
    tip.replaceChildren(node('b', {}, [x.name]), node('span', {}, [`${placeText(x)} · ${signedShareText(x.est.share)}`]));
    if (touch && s % N !== self) tip.append(node('span', { class: 'hh__tip-open' }, [fill('dotOpen')]));
    tip.hidden = false;
    const tw = tip.offsetWidth;
    const left = clamp(CX[s] - tw / 2, 0, W - tw);
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
    const was = hover;
    hover = -1;
    tip.hidden = true;
    if (was >= 0 && !moving) draw();
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
      at = clamp(at + (e.key === 'ArrowRight' ? 1 : -1), 0, order.length - 1);
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

  // Lets go of the dot shown or ringed under the pointer, a tap or the keys.
  function letGo() {
    tapped = hover = picked = -1;
    tip.hidden = true;
  }

  // A tap anywhere outside the swarm puts its tooltip away: a touch screen has no pointer that leaves, and a tap on the
  // page's words moves no focus in every browser (Safari's does not), so the canvas's blur alone would leave it showing.
  function onOutside(e) {
    if (tip.hidden || el.contains(e.target)) return;
    letGo();
    if (!moving) draw();
  }

  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('blur', onBlur);
  document.addEventListener('pointerdown', onOutside);

  function resize() {
    if (el.clientWidth === W) return;
    measure();
    layout();
    settle();
    draw();
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(el);
  onThemeChange(() => {
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
      letGo();
      label();
      layout();
      // Mid-way through a change of axis, the axis carries on from where it is drawn.
      if (from) {
        from = view();
        qa = 0;
      }
      move();
    },
    // A what-if's net share in percent (or null for none): a dashed ring where the hospital would stand.
    setHypothetical(pct) {
      const next = Number.isFinite(pct) ? pct : null;
      if (next === hypo) return;
      hypo = next;
      if (!moving) draw();
    },
    // The axis to draw ([lo, hi]): everything glides there together (the dots, the ticks, the gutter, the median, the
    // marks), or moves at once (animate false, or reduced motion). A dot shown or ringed under the pointer or the keys
    // lets go.
    setAxis(next, animate = true) {
      if (next[0] === axisOf[0] && next[1] === axisOf[1]) return;
      const was = view();
      axisOf = next;
      letGo();
      rescale();
      layout();
      if (!animate) {
        cancelAnimationFrame(raf);
        moving = false;
        settle();
        draw();
        return;
      }
      from = was;
      qa = 0;
      move();
    },
  };
}
