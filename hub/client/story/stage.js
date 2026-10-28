// The home story's chart: one canvas over the sticky stage, drawing the same 2,971 dots at every step and moving them
// between the steps' layouts (layouts.js). Its scenery is the page's own where the page has it: the scale bar and the
// states map are the server's drawings (the bar's figure, the map's SVG), faded in and out under the canvas, and the
// canvas registers to their boxes so its dots land on them; the share axis, the programs' gates and the piles' counts it
// paints itself. The motion, step to step:
//   0 -> 1    the dots pour out of the bar into one crowd at $0: across early, down late, the bar's left end first;
//   1 -> 4    a gate rises through the crowd, and each dot moves the moment the gate passes it;
//   5 -> 6    the dots fly to their hospitals' places on the map, each leaving a beat apart;
//   6 -> 7    the states fill under the dots as the dots dim;
//   else      every dot glides to its next place, a little staggered.
// Old scenery leaves early and new scenery arrives late, so the moving dots are never drawn over two charts at once; a
// pile's count arrives once its dots have settled. Reduced motion: every change is instant.
import { count, money, pct } from '../../../web/client/format.js';
import { HAC_CUT_PCT, HRRP_CAP_PCT, rulePercent } from '../../../web/programs.js';
import { inkColor, onThemeChange, readColors, readFonts } from '../colors.js';
import { TAU, clamp01, deviceRatio, ease, fontOf, outCubic, paintDots, smooth } from '../paint.js';
import { COPY } from './copy.js';
import { wholePercents } from '../scale.js';
import { fitBox, stageGeometry } from './geometry.js';
import { createLayouts } from './layouts.js';

// The words with their {placeholders} filled (a function replacement: a value holding "$&" or "$0" prints as itself).
const say = (key, values = {}) => COPY[key].replace(/\{(\w+)\}/g, (_, name) => values[name]);
const percent = (v) => pct(v / 100, 0, { sign: true });
// The gate sweep: it starts at SW0 of the transition and takes SW1 of it. It rises through the crowd at a steady pace
// over the first CROSS of its time, so each hospital is seen to move as the gate reaches it, then speeds to the top.
const SW0 = 0.04;
const SW1 = 0.6;
const CROSS = 0.55;
// The share of the gate's travel done at u (0 to 1) of its time, when the crowd fills the first fc of the travel; and
// the time at which it has done f of it.
const sweepAt = (u, fc) => (u <= CROSS ? (fc * u) / CROSS : fc + (1 - fc) * (1 - (1 - (u - CROSS) / (1 - CROSS)) ** 2));
const sweepTime = (f, fc) => (f <= fc ? (CROSS * f) / fc : CROSS + (1 - CROSS) * (1 - Math.sqrt(Math.max(0, 1 - (f - fc) / (1 - fc)))));
// Scenes that stand on the share axis, and the two the map's drawing serves.
const AXIS = new Set(['machine', 'net', 'you']);
// The moves whose dots go across and down on curves of their own ([across, down]): out of the bar, across early and down
// late; back into it, up early and across late. Every other move eases both ways at once.
const CURVES = { pour: [outCubic, smooth], gather: [smooth, outCubic] };
const isMap = (L) => L.scene === 'map' || L.scene === 'mapfill';

// The stage over `canvas` (inside the stage element, `stage`):
//   rows       the story's hospitals (layouts.js storyRows); facts: storyFacts of the hospitals; fy: the fiscal year;
//   domain     the share axis's [lo, hi]; mapW, mapH: the map's projected size;
//   panels     the server's drawings: { bar (its panel), barSvg, map (its panel), mapSvg, mapFoot } (elements);
//   example    the hospital the last step opens on; peersOf(h): its group as { peers (hospitals, h among them), label
//              (the group named: "Ohio hospitals") }, in the peer mode the reader has chosen (find.js);
//   railHidden () -> whether the step's name sits in the stage (no rail beside it); still: the reduced-motion query.
// Returns { show(i, { instant }), select(h), regroup(), resize() }.
export function createStage(canvas, { stage, rows, facts, fy, domain, mapW, mapH, panels, example, peersOf, railHidden, still }) {
  const ctx = canvas.getContext('2d');
  const N = rows.length;
  const S = 2 * N;
  const indexOf = new Map(rows.map((r, i) => [r.h, i]));
  const TICKS = wholePercents(domain);
  const CX = new Float32Array(S);
  const CY = new Float32Array(S);
  const CR = new Float32Array(S);
  const CA = new Float32Array(S);
  const CC = new Uint8Array(S);
  const X0 = new Float32Array(S);
  const Y0 = new Float32Array(S);
  const R0 = new Float32Array(S);
  const A0 = new Float32Array(S);
  const C0 = new Uint8Array(S);
  const DL = new Float32Array(S);
  let W = 0;
  let H = 0;
  let dpr = 1;
  let g = null;
  let make = null;
  let cache = [];
  let step = 0;
  let cur = null;
  let prev = null;
  let raw = 1;
  let t0 = 0;
  let dur = 1;
  let span = 1;
  let mode = 'straight';
  let raf = 0;
  let lines0 = null;
  let linesNow = null;
  let sweepK = -1;
  let crowd = 1;
  let selected = null;
  let colors = readColors();
  let fonts = readFonts();
  let panelState = '';

  const ink = (code) => inkColor(colors, code);

  // ---------- the layouts, built on demand for the stage's size ----------

  function lay(i) {
    if (cache[i]) return cache[i];
    if (i <= 5) {
      // The bar and the gates are one chain: each pile keeps the order of the one before.
      if (!cache[0]) cache[0] = make.layBar();
      if (!cache[1]) cache[1] = make.layStart();
      for (let k = 2; k <= 4; k++) if (!cache[k]) cache[k] = make.layGate(k - 1, cache[k - 1]);
      if (!cache[5]) cache[5] = make.layNet(cache[4]);
      return cache[i];
    }
    if (i === 8) {
      const h = selected ?? example;
      const { peers, label } = peersOf(h);
      cache[8] = make.layYou(h, peers);
      cache[8].info.label = label;
    } else cache[i] = make.layMap(i === 7);
    return cache[i];
  }

  // The stage's size, the device pixel and the drawings' boxes, measured; the layouts rebuilt for them.
  function measure() {
    const r = stage.getBoundingClientRect();
    W = r.width;
    H = r.height;
    dpr = deviceRatio();
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const rel = (el) => {
      const b = el.getBoundingClientRect();
      const vb = el.viewBox.baseVal;
      return fitBox({ x: b.left - r.left, y: b.top - r.top, w: b.width, h: b.height }, vb.width, vb.height);
    };
    g = stageGeometry({ W, H, railHidden: railHidden(), px: 1 / dpr, domain, boxes: { bar: rel(panels.barSvg), map: rel(panels.mapSvg) } });
    make = createLayouts({ rows, g, mapW, mapH });
    cache = [];
  }

  // ---------- motion ----------

  function settle(L) {
    CX.set(L.X);
    CY.set(L.Y);
    CR.set(L.R);
    CA.set(L.A);
    CC.set(L.C);
    prev = null;
    raw = 1;
    linesNow = L.info.lines ? L.info.lines.slice() : null;
  }

  function run(L, opts = {}) {
    cancelAnimationFrame(raf);
    raf = 0;
    if (opts.instant || still.matches || !cur) {
      cur = L;
      settle(L);
      draw();
      return;
    }
    X0.set(CX);
    Y0.set(CY);
    R0.set(CR);
    A0.set(CA);
    C0.set(CC);
    prev = cur;
    cur = L;
    lines0 = linesNow ? linesNow.slice() : L.info.lines ?? null;
    mode = opts.mode ?? 'straight';
    dur = opts.dur ?? 1000;
    span = opts.span ?? 1;
    sweepK = -1;
    if (mode === 'gate') {
      // Each dot waits for the rising gate to reach it.
      sweepK = L.info.s - 1;
      const from = lines0 ? lines0[sweepK] : L.info.lines[sweepK];
      const travel = Math.max(1, from - L.info.lines[sweepK]);
      let top = from;
      for (let s = 0; s < N; s++) if (A0[s] > 0.01 && Y0[s] < top) top = Y0[s];
      crowd = Math.min(0.95, Math.max(0.05, (from - top) / travel));
      for (let s = 0; s < S; s++) DL[s] = SW0 + SW1 * sweepTime(clamp01((from - Y0[s]) / travel), crowd);
    } else if (opts.delay) {
      for (let s = 0; s < S; s++) DL[s] = opts.delay(s);
    } else DL.fill(0);
    raw = 0;
    t0 = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function tick(now) {
    raw = Math.min(1, (now - t0) / dur);
    const L = cur;
    const curves = CURVES[mode];
    for (let s = 0; s < S; s++) {
      if (A0[s] < 0.01 && L.A[s] < 0.01) continue;
      const p = clamp01((raw - DL[s]) / span);
      const q = ease(p);
      CX[s] = X0[s] + (L.X[s] - X0[s]) * (curves ? curves[0](p) : q);
      CY[s] = Y0[s] + (L.Y[s] - Y0[s]) * (curves ? curves[1](p) : q);
      CR[s] = R0[s] + (L.R[s] - R0[s]) * q;
      CA[s] = A0[s] + (L.A[s] - A0[s]) * q;
      // A gate recolors a dot as it passes; otherwise the color turns halfway.
      CC[s] = mode === 'gate' ? (p > 0 ? L.C[s] : C0[s]) : q > 0.5 ? L.C[s] : C0[s];
    }
    if (L.info.lines && lines0) {
      linesNow = L.info.lines.map((y, k) => lines0[k] + (y - lines0[k]) * (k === sweepK ? sweepAt(clamp01((raw - SW0) / SW1), crowd) : ease(raw)));
    }
    draw();
    if (raw < 1) {
      raf = requestAnimationFrame(tick);
      return;
    }
    raf = 0;
    settle(L);
    draw();
  }

  // ---------- painting ----------

  const font = (size, weight, mono) => fontOf(fonts, size, weight, mono);
  // Text at (x, y) on its baseline; halo: a paper backing, so a label stays legible over dots and lines.
  function text(s, x, y, f, color, align = 'left', halo = false) {
    ctx.font = f;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    if (halo) {
      const w = ctx.measureText(s).width;
      const left = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
      const a = ctx.globalAlpha;
      ctx.fillStyle = colors.paper;
      ctx.globalAlpha = a * 0.88;
      ctx.fillRect(left - 3, y - 12, w + 6, 16);
      ctx.globalAlpha = a;
    }
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }
  // A pile's count: mono, haloed, kept inside the plot.
  function note(s, x, y, align = 'left') {
    const f = font(g.narrow ? 10.5 : 11.5, 400, true);
    ctx.font = f;
    const w = ctx.measureText(s).width;
    let at = x;
    let al = align;
    if (al === 'left' && at + w > g.x1) {
      al = 'right';
      at = g.x1;
    }
    if (al === 'right' && at - w < g.x0) at = g.x0 + w;
    text(s, at, Math.max(g.top + 12, y), f, colors.ink2, al, true);
  }
  function dot(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  // A crisp line a device pixel wide (or w CSS pixels), dashed when asked.
  function hline(x0, x1, y, color, w = 1, dash = null) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.setLineDash(dash ?? []);
    ctx.beginPath();
    const yy = Math.round(y) + 0.5;
    ctx.moveTo(x0, yy);
    ctx.lineTo(x1, yy);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function vline(x, ya, yb, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const xx = Math.round(x) + 0.5;
    ctx.moveTo(xx, ya);
    ctx.lineTo(xx, yb);
    ctx.stroke();
  }

  // The share axis: the $0 gutter shaded, a faint line at each whole percent, the baseline, the ticks' values and the
  // axis's words, cut to the left and bonus to the right (each word underlined in its ink).
  function axis(a) {
    const { scale } = g;
    const top = g.top + 6;
    ctx.globalAlpha = a;
    ctx.fillStyle = colors.paper2;
    ctx.fillRect(scale.zL, top, scale.zR - scale.zL, g.bottom - top);
    for (const v of TICKS) {
      if (v === 0) continue;
      ctx.globalAlpha = a * 0.3;
      vline(scale.xs(v), top, g.bottom + 4, colors.line);
    }
    ctx.globalAlpha = a;
    hline(g.x0, g.x1, g.bottom, colors.ink2);
    const tick = font(g.narrow ? 10 : 11, 400, true);
    for (const v of TICKS) text(percent(v), scale.xs(v), g.bottom + 16, tick, colors.ink3, 'center');
    // The two sides' words under the ticks, either side of $0; a wide stage's axis words on a line of their own.
    const y = g.bottom + (g.narrow ? 30 : 34);
    if (!g.narrow) text(say('axis', { fy: String(fy) }), g.x0, g.bottom + 54, font(12), colors.ink3);
    const f = font(g.narrow ? 11 : 12.5, 600);
    ctx.font = f;
    const cut = say('axisCut');
    const bonus = say('axisBonus');
    const wc = ctx.measureText(cut).width;
    const wb = ctx.measureText(bonus).width;
    text(cut, scale.zL - 6, y, f, colors.ink2, 'right');
    text(bonus, scale.zR + 6, y, f, colors.ink2);
    ctx.fillStyle = colors.pen;
    ctx.fillRect(scale.zL - 6 - wc, y + 3, wc, 2);
    ctx.fillStyle = colors.rew;
    ctx.fillRect(scale.zR + 6, y + 3, wb, 2);
    ctx.globalAlpha = 1;
  }

  // The programs as gates: a passed gate stacked at the top with what it moved, the next one dark with its ticks, the
  // ones still waiting dashed; each labeled with its name and its rule.
  const GATE_WORDS = [
    { name: 'gateHrrp', short: 'gateHrrpShort', rule: 'ruleHrrp', ruleShort: 'ruleHrrpShort', past: () => say('pastCut', { amount: money(facts.hrrpSum) }) },
    { name: 'gateHac', short: 'gateHacShort', rule: 'ruleHac', ruleShort: 'ruleHacShort', past: () => say('pastCut', { amount: money(facts.hacSum) }) },
    { name: 'gateVbp', short: 'gateVbpShort', rule: 'ruleVbp', ruleShort: 'ruleVbpShort', past: () => say('pastMoved', { amount: money(facts.vbpBonus) }) },
  ];
  const rules = { cap: rulePercent(HRRP_CAP_PCT), cut: rulePercent(HAC_CUT_PCT) };
  function gates(L, lines, a) {
    const { s } = L.info;
    ctx.globalAlpha = a;
    for (let k = 1; k <= 3; k++) {
      const y = lines[k - 1];
      const words = GATE_WORDS[k - 1];
      const state = k <= s ? 'past' : k === s + 1 ? 'next' : 'waiting';
      const color = state === 'next' ? colors.ink : state === 'past' ? colors.ink2 : colors.ink3;
      hline(g.x0, g.x1, y, color, state === 'next' ? 1.5 : 1, state === 'waiting' ? [2, 4] : null);
      if (state === 'next') {
        for (const v of TICKS) vline(g.scale.xs(v), y - 3, y + 4, color);
      }
      // A passed gate's words sit above its line; a waiting gate's below it.
      const ly = state === 'past' ? y - 6 : y + (g.narrow ? 13 : 19);
      text(say(g.narrow ? words.short : words.name), g.x0, ly, font(g.narrow ? 11 : 13, 600), state === 'waiting' ? colors.ink3 : colors.ink);
      const right = state === 'past' ? words.past() : say(g.narrow ? words.ruleShort : words.rule, rules);
      text(right, g.x1, ly, font(g.narrow ? 10.5 : 11.5, 400, true), state === 'past' ? colors.ink2 : colors.ink3, 'right');
    }
    ctx.globalAlpha = 1;
  }

  // A two-entry key: a dot in each ink with its words.
  function key(entries, x, y, f, color, align = 'left') {
    ctx.font = f;
    const widths = entries.map(([words]) => ctx.measureText(words).width);
    const total = widths.reduce((sum, w) => sum + w + 13, 0) + (entries.length - 1) * 16;
    let at = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    entries.forEach(([words, ink], k) => {
      dot(at + 4, y - 4.5, 4, ink);
      text(words, at + 13, y, f, color);
      at += widths[k] + 13 + 16;
    });
  }

  // The last step's words: the group over its swarm, everyone over theirs, the group's median as a tick under it.
  function youWords(L, a) {
    const { info } = L;
    if (!rows[info.h]) return;
    ctx.globalAlpha = a;
    const f = font(g.narrow ? 12 : 13.5, 600);
    text(say('groupOf', { group: info.label, n: count(info.n) }), g.x0, info.peers[0] - 10, f, colors.ink);
    text(say('everyone', { n: count(N) }), g.x0, info.all[0] - 10, f, colors.ink);
    if (info.median !== null) {
      const x = g.scale.xs(info.median);
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, info.peers[1] + 4);
      ctx.lineTo(x, info.peers[1] + 14);
      ctx.stroke();
      text(say('median', { value: pct(info.median / 100, 2, { sign: true }) }), x + 5, info.peers[1] + 14, font(11, 400, true), colors.ink2);
    }
    ctx.globalAlpha = 1;
  }

  // What a scene paints besides the axis (lines: the gates' heights now).
  function scenery(L, a, lines) {
    if (a <= 0) return;
    if (L.scene === 'machine') gates(L, lines ?? L.info.lines, a);
    else if (L.scene === 'map') {
      // The key sits over the map's top left corner.
      const { m } = L.info;
      ctx.globalAlpha = a;
      key([[say('mapCut'), colors.pen], [say('mapBonus'), colors.rew]], Math.max(g.x0, m.ox), Math.max(g.top + 8, m.oy - 14), font(g.narrow ? 12 : 13.5, 600), colors.ink);
      ctx.globalAlpha = 1;
    } else if (L.scene === 'you') youWords(L, a);
  }

  // The counts a scene's piles carry, once its dots have settled.
  function counts(L, a) {
    if (a <= 0) return;
    const { info } = L;
    const zero = money(0);
    ctx.globalAlpha = a;
    if (info.block) {
      const { left, top, base } = info.block;
      const mid = top + (base - top) / 2;
      if (left - 14 > 130) {
        text(say('startN', { n: count(info.n) }), left - 12, mid - 2, font(13, 600), colors.ink, 'right');
        text(say('startZero', { zero }), left - 12, mid + 15, font(12, 400, true), colors.ink3, 'right');
      } else text(say('startOne', { n: count(info.n), zero }), g.scale.zM, top - 8, font(12, 600), colors.ink, 'center', true);
    }
    if (info.zero) note(say('atZero', { n: count(info.zero.n), zero }), info.zero.x, info.zero.y);
    if (info.only) note(say('hacOnly', { n: count(info.only.n), cut: rules.cut }), info.only.x - 5, info.only.y, 'right');
    // After a gate: what each ink means, under the passed gates at the right (where no pile reaches that high).
    if (L.scene === 'machine' && info.s > 0) {
      const entries = [[say('keyCut'), colors.pen], [say('keyNone'), colors.neutral]];
      if (info.s === 3) entries.push([say('keyBonus'), colors.rew]);
      key(entries, g.x1, info.lines[info.s - 1] + (g.narrow ? 13 : 17), font(g.narrow ? 10.5 : 11.5, 400, true), colors.ink2, 'right');
    }
    if (L.scene === 'net') {
      const f = font(g.narrow ? 11.5 : 13, 400, true);
      key([[say('netCut', { n: count(info.cut) }), colors.pen], [say('netBonus', { n: count(info.bonus) }), colors.rew]], g.scale.zM, info.top - (g.narrow ? 12 : 16), f, colors.ink, 'center');
    }
    ctx.globalAlpha = 1;
  }

  // The dots, batched by ink and opacity (paint.js paintDots).
  const dots = () => paintDots(ctx, { count: S, x: CX, y: CY, r: CR, a: CA, code: (s) => CC[s], ink, dpr });

  // The followed hospital (selected), or on the last step the example: ringed wherever it is drawn (in its group and in
  // everyone, joined by a dashed line), with its name.
  function ring(i) {
    const pts = [i, N + i].filter((s) => CA[s] > 0.05);
    if (!pts.length) return;
    if (pts.length > 1) {
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(CX[pts[0]], CY[pts[0]]);
      ctx.lineTo(CX[pts[1]], CY[pts[1]]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const s of pts) {
      const rr = Math.max(CR[s], 1.4) + 4.5;
      ctx.globalAlpha = 0.75;
      dot(CX[s], CY[s], rr, colors.paper);
      ctx.globalAlpha = 1;
      dot(CX[s], CY[s], Math.max(2.2, CR[s] + 0.6), ink(CC[s]));
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(CX[s], CY[s], rr, 0, TAU);
      ctx.stroke();
    }
    const s = pts.reduce((a, b) => (CY[b] < CY[a] ? b : a));
    const name = rows[i].h.name;
    const f = font(g.narrow ? 11.5 : 13, 700);
    ctx.font = f;
    const w = ctx.measureText(name).width;
    const rr = Math.max(CR[s], 1.4) + 4.5;
    let x = CX[s] + rr + 5;
    let align = 'left';
    if (x + w > W - 8) {
      x = CX[s] - rr - 5;
      align = 'right';
      if (x - w < 8) {
        x = Math.min(Math.max(CX[s], w / 2 + 8), W - w / 2 - 8);
        align = 'center';
      }
    }
    text(name, x, align === 'center' ? CY[s] - rr - 6 : Math.max(16, CY[s] - rr - 2), f, colors.ink, align, true);
  }

  // The server's drawings under the canvas: each panel's opacity, the states' fill, the map's key; written only when
  // they change.
  function setPanels(bar, map, fill) {
    const state = `${bar.toFixed(3)}|${map.toFixed(3)}|${fill.toFixed(3)}`;
    if (state === panelState) return;
    panelState = state;
    const show = (el, a) => {
      el.style.opacity = a.toFixed(3);
      el.classList.toggle('is-off', a < 0.5);
    };
    show(panels.bar, bar);
    show(panels.map, map);
    panels.mapSvg.style.setProperty('--fill', fill.toFixed(3));
    show(panels.mapFoot, fill);
  }

  function draw() {
    if (!cur || !W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const moving = Boolean(prev) && raw < 1;
    const out = moving ? 1 - smooth(clamp01(raw / 0.4)) : 0;
    const into = moving ? smooth(clamp01((raw - 0.3) / 0.7)) : 1;
    // The server's drawings. The bar's and the map's panels cross like any scenery; between the two map steps the map
    // stays and only its fill (and its key) turns.
    const sceneA = (scene) => (cur.scene === scene ? into : 0) + (moving && prev.scene === scene ? out : 0);
    if (moving && isMap(prev) && isMap(cur)) {
      const f0 = prev.scene === 'mapfill' ? 1 : 0;
      const f1 = cur.scene === 'mapfill' ? 1 : 0;
      setPanels(0, 1, f0 + (f1 - f0) * ease(raw));
    } else {
      setPanels(sceneA('bar'), sceneA('map') + sceneA('mapfill'), sceneA('mapfill'));
    }
    // The axis, steady when both scenes stand on it; the scenes' own scenery crossing.
    const both = moving && AXIS.has(prev.scene) && AXIS.has(cur.scene);
    if (AXIS.has(cur.scene)) axis(both || !moving ? 1 : into);
    if (moving && AXIS.has(prev.scene) && !both) axis(out);
    if (moving && prev.scene === 'machine' && cur.scene === 'machine') scenery(cur, 1, linesNow);
    else {
      if (moving) scenery(prev, out, prev.info.lines);
      scenery(cur, into, linesNow);
    }
    dots();
    // Counts: the old ones leave first, the new ones arrive once the dots have settled.
    if (moving && raw < 0.15) counts(prev, 1 - raw / 0.15);
    counts(cur, moving ? clamp01((raw - 0.8) / 0.2) : 1);
    const followed = selected ?? (step === 8 ? example : null);
    if (followed && indexOf.has(followed)) ring(indexOf.get(followed));
  }

  // ---------- steps ----------

  function show(i, { instant = false } = {}) {
    const from = step;
    step = i;
    const L = lay(i);
    const hash = (s) => rows[s % N].hash;
    if (instant || !cur) run(L, { instant: true });
    else if (from === 0 && i === 1) run(L, { mode: 'pour', dur: 1900, span: 0.55, delay: (s) => (s < N ? rows[s].mid * 0.4 + hash(s) * 0.05 : 0) });
    else if (from === 1 && i === 0) run(L, { mode: 'gather', dur: 1500, span: 0.55, delay: (s) => (s < N ? (1 - rows[s].mid) * 0.3 + hash(s) * 0.05 : 0) });
    else if (i === from + 1 && i >= 2 && i <= 4) run(L, { mode: 'gate', dur: 2600, span: 0.3 });
    else if (i === from + 1 && i === 6) run(L, { dur: 1500, span: 0.7, delay: (s) => hash(s) * 0.3 });
    else if (Math.abs(i - from) === 1 && isMap(cur) && isMap(L)) run(L, { dur: 700 });
    else run(L, { dur: 1050, span: 0.85, delay: (s) => hash(s) * 0.15 });
  }

  function regroup() {
    cache[8] = null;
    if (step === 8) run(lay(8), { dur: 800 });
    else if (!raf) draw();
  }

  function resize() {
    measure();
    if (!W || !H) return;
    cur = lay(step);
    settle(cur);
    cancelAnimationFrame(raf);
    raf = 0;
    panelState = '';
    draw();
  }

  onThemeChange(() => {
    colors = readColors();
    fonts = readFonts();
    draw();
  });

  measure();
  return {
    show,
    // Follow a hospital (a decoded asset row with an estimate), or stop (null): it is ringed with its name at every step,
    // and the last step shows it among its group.
    select(h) {
      selected = h;
      regroup();
    },
    // The group changed (another peer mode): the last step's peers rise anew out of everyone.
    regroup,
    resize,
  };
}
