// The field: the scroll story's canvas (client/stage.js flies it only from 900px wide, with the script, and only when
// the reader's system allows motion; the canvas is made at the first flight). It never stands in for a figure. Each
// step's figure is the build's SVG, redrawn by its own step's code; the field draws only the move between two of the
// steps whose figure is a field of hospital dots (step 1's strips, step 3's states, step 5's corner): every hospital's
// dot flies from where the figure it leaves put it to where the figure it enters puts it, and the stage then fades the
// new figure in over it. The places come from the same layout functions the SVGs are drawn with (strips.js, states.js,
// both.js), at the page's case, use rate, selected state and group, and are mapped onto the screen through each SVG's
// own box. The colors are the figures' tokens (FIELD_TONES; test/stage.test.js holds each mark's to 3:1 against the paper
// in both themes; FIELD_CONTEXT is the one context tone, step 5's dots outside the corner).
import { SCENARIOS } from '../web/constants.js';
import { bothLayout, isBoth, xOf } from '../web/program/both.js';
import { statesLayout } from '../web/program/states.js';
import { dotSize, stripsLayout } from '../web/program/strips.js';

// The steps the field draws, by section id, and the figure each one's dots are read from.
export const FIELD_STEPS = Object.freeze({ finding: 'figure-1', states: 'figure-3', both: 'figure-5' });
// The tokens a dot may take: the selected case's and the corner's (pen), step 5's strip of hospitals with no penalty
// estimate (ink-3), the page's hospital (ink), and the rest of step 5's plot, context in the pen ramp's palest step
// (FIELD_CONTEXT, as Figure 5 draws them: styles.css .wr-bdots).
export const FIELD_CONTEXT = 'pen-seq-1';
export const FIELD_TONES = Object.freeze(['pen', 'ink-3', 'ink', FIELD_CONTEXT]);
// The drawing the field maps through: from 900px every figure shows its wide one.
const DRAWING = 'wide';
// The flight: each dot's own run, and how much later the dots bound for the right edge leave than those for the left.
export const FLIGHT_MS = 850;
export const STAGGER_MS = 260;
// The page's hospital's dot, drawn last in ink (viewBox units).
const PAGE_R = 4;
// A state's hospitals settle inside its bubble on a sunflower's spiral, the golden angle apart.
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

// Each hospital's dot in a step's figure, in its wide drawing's viewBox units: a Map from CCN to { x, y, r, tone }. step:
// a FIELD_STEPS key; view: { scenario, use, stateCode } (the page's state); items: the hospitals step 1 draws; top: its
// axis's top; only: the chips' group's test (null: none); states, both: the states' and the corner's models.
export function fieldPoints(step, { view, items, top, only = null, states, both }) {
  const k = SCENARIOS.indexOf(view.scenario);
  const out = new Map();
  if (step === 'finding') {
    const layout = stripsLayout({ items, drawing: DRAWING, top, selected: view.scenario, use: view.use, only });
    const st = layout.strips[k];
    const r = dotSize(st.d) / 2;
    items.forEach((row, i) => {
      const at = st.at[i];
      if (at) out.set(row.ccn, { x: at[0], y: at[1], r, tone: 'pen' });
    });
  } else if (step === 'states') {
    const layout = statesLayout({ model: states, drawing: DRAWING, k, use: view.use, selected: view.stateCode });
    const at = new Map(layout.points.map((p) => [p.code, { p, n: items.filter((row) => row.state === p.code).length, i: 0 }]));
    for (const row of items) {
      const s = at.get(row.state);
      if (!s) continue;
      // Spread over the bubble, densest at its middle, so the dots read as filling it before the figure takes over.
      const f = Math.sqrt((s.i + 0.5) / s.n) * s.p.r * 0.85;
      const a = s.i * GOLDEN;
      s.i += 1;
      out.set(row.ccn, { x: s.p.x + Math.cos(a) * f, y: s.p.y + Math.sin(a) * f, r: 1.1, tone: 'pen' });
    }
  } else if (step === 'both') {
    const layout = bothLayout({ model: both, drawing: DRAWING, k, use: view.use });
    const { geo, sx, sy } = layout;
    for (const p of both.pts) out.set(p.ccn, { x: sx(xOf(p, k, view.use)), y: sy(p.y), r: geo.dot / 2, tone: isBoth(both, p, k, view.use) ? 'pen' : FIELD_CONTEXT });
    both.strip.forEach((s, i) => out.set(s.ccn, { x: layout.stripDots[i][0], y: layout.stripDots[i][1], r: geo.stripDot / 2, tone: 'ink-3' }));
  } else {
    throw new RangeError(`field: no dots for step "${step}"`);
  }
  return out;
}

// Points in a drawing's viewBox ({ width, height }) onto the screen box its SVG takes ({ left, top, width, height }).
export function onScreen(points, viewBox, box) {
  const sx = box.width / viewBox.width;
  const sy = box.height / viewBox.height;
  const out = new Map();
  for (const [ccn, p] of points) out.set(ccn, { x: box.left + p.x * sx, y: box.top + p.y * sy, r: p.r * Math.min(sx, sy), tone: p.tone });
  return out;
}

// The flight between two sets of screen points: one entry per hospital in either. A hospital in both moves; one only in
// the first fades where it was; one only in the second fades in where it lands. from: the leaving figure's points;
// shown: whether that figure was on screen (else its dots start unseen and appear as they fly); page: the page's
// hospital's CCN (or null), drawn last, in ink. Sorted so the page's hospital comes last.
export function flightOf(from, to, { shown, page = null }) {
  const a0 = shown ? 1 : 0;
  const out = [];
  for (const [ccn, b] of to) {
    const a = from.get(ccn);
    out.push(a
      ? { ccn, x0: a.x, y0: a.y, r0: a.r, a0, x1: b.x, y1: b.y, r1: b.r, a1: 1, tone: b.tone }
      : { ccn, x0: b.x, y0: b.y, r0: b.r, a0: 0, x1: b.x, y1: b.y, r1: b.r, a1: 1, tone: b.tone });
  }
  for (const [ccn, a] of from) {
    if (!to.has(ccn)) out.push({ ccn, x0: a.x, y0: a.y, r0: a.r, a0, x1: a.x, y1: a.y, r1: a.r, a1: 0, tone: a.tone });
  }
  const mine = out.findIndex((d) => d.ccn === page);
  if (mine >= 0) {
    const [d] = out.splice(mine, 1);
    const r = Math.max(d.r1, PAGE_R);
    out.push({ ...d, r0: Math.max(d.r0, r), r1: r, tone: 'ink' });
  }
  return out;
}

// Cubic ease in and out.
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// A dot's place at time ms into the flight: its run starts later the further right it lands (span: the field's width).
export function dotAt(d, ms, span) {
  const delay = (Math.max(0, d.x1) / Math.max(1, span)) * STAGGER_MS;
  const t = ease(Math.min(1, Math.max(0, (ms - delay) / FLIGHT_MS)));
  return { x: d.x0 + (d.x1 - d.x0) * t, y: d.y0 + (d.y1 - d.y0) * t, r: d.r0 + (d.r1 - d.r0) * t, a: d.a0 + (d.a1 - d.a0) * t };
}

// The field in a page: a canvas over the window (unseen by a screen reader and by the pointer), clipped to the stage.
// scrolly: the steps' container; store: the page's state; items, top, states, both: as fieldPoints; only(): the chips'
// group's test now; clip(): the stage's box on screen ({ left, top, right, bottom }). Returns { fly(from, to, { shown })
// (a promise that settles true when the flight lands, false when cut short), fade(), cancel() }.
export function mountField(scrolly, { store, items, top, states, both, only = () => null, clip }) {
  // The canvas is made at the first flight, so a page that never flies (reduced motion, a phone) has none.
  let canvas = null;
  let ctx = null;
  const make = () => {
    canvas = document.createElement('canvas');
    canvas.className = 'wr-field';
    canvas.setAttribute('aria-hidden', 'true');
    scrolly.append(canvas);
    ctx = canvas.getContext('2d');
  };
  let frame = 0;
  let settle = null;

  const figureOf = (step) => document.getElementById(FIELD_STEPS[step])?.querySelector(`svg[data-fit="${DRAWING}"]`) ?? null;
  // A step's dots on screen now, through its SVG's box (laid out even while the stage hides it).
  const screenPoints = (step) => {
    const svg = figureOf(step);
    if (!svg) return null;
    const vb = svg.viewBox.baseVal;
    const box = svg.getBoundingClientRect();
    if (!vb || !vb.width || !box.width) return null;
    const state = store.get();
    return onScreen(fieldPoints(step, { view: state, items, top, only: only(), states, both }), vb, box);
  };
  const tones = () => {
    const css = getComputedStyle(document.documentElement);
    return Object.fromEntries(FIELD_TONES.map((name) => [name, css.getPropertyValue(`--${name}`).trim()]));
  };
  const stop = (landed) => {
    cancelAnimationFrame(frame);
    frame = 0;
    settle?.(landed);
    settle = null;
  };
  const clear = () => ctx?.clearRect(0, 0, canvas.width, canvas.height);

  return {
    fly(fromStep, toStep, { shown }) {
      stop(false);
      const from = screenPoints(fromStep);
      const to = screenPoints(toStep);
      if (!from || !to) return Promise.resolve(false);
      const dots = flightOf(from, to, { shown, page: store.get().hospital?.ccn ?? null });
      if (!canvas) make();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ink = tones();
      const box = clip();
      canvas.classList.remove('wr-field--out');
      canvas.classList.add('wr-field--on');
      const t0 = performance.now();
      const span = box.right;
      const draw = (now) => {
        const ms = now - t0;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.beginPath();
        ctx.rect(box.left, box.top, box.right - box.left, box.bottom - box.top);
        ctx.clip();
        for (const d of dots) {
          const p = dotAt(d, ms, span);
          if (p.a < 0.02) continue;
          ctx.globalAlpha = p.a;
          ctx.fillStyle = ink[d.tone];
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.6, p.r), 0, 2 * Math.PI);
          ctx.fill();
        }
        ctx.restore();
        if (ms < FLIGHT_MS + STAGGER_MS) frame = requestAnimationFrame(draw);
        else stop(true);
      };
      return new Promise((resolve) => {
        settle = resolve;
        frame = requestAnimationFrame(draw);
      });
    },
    // The figure has faded in over the landed dots: the canvas fades out (styles.css), then is cleared.
    fade() {
      if (!canvas) return;
      canvas.classList.add('wr-field--out');
      setTimeout(() => {
        if (!frame && canvas.classList.contains('wr-field--out')) {
          canvas.classList.remove('wr-field--on', 'wr-field--out');
          clear();
        }
      }, 400);
    },
    cancel() {
      stop(false);
      canvas?.classList.remove('wr-field--on', 'wr-field--out');
      clear();
    },
  };
}
