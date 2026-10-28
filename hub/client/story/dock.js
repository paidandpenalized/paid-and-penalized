// The front page's masthead docks into the header: over the first stretch of scroll (110 to 260px, ending before the
// tagline strip under the masthead reaches the header) the hero's two words shrink, sweep left and rise into the bar,
// where the header's own wordmark takes over. The hero's own spans move (CSS transforms); no copy of the wordmark is
// added. The header's wordmark waits hidden while the trip is under way and shows once it ends; scrolling back reverses
// it. The classes are the script's, so without it both wordmarks simply show. Reduced motion: no trip, the header's
// wordmark shows at once. dockPath is pure; mountDock wires it to the page.

import { clamp } from '../../../engine/js/stats.js';
import { ease, smooth } from '../paint.js';

// The share of the trip spent shrinking and sweeping under the header; the rest rises into the bar.
const SWEEP = 0.78;
// The compact case: the height each word ends at, as a share of the P&P mark's; its inset from the mark's left
// edge (px); and the part of the trip over which the words hand over to the mark.
const MARK_WORD = 0.46;
const MARK_INSET = 3;
const HANDOVER_FROM = 0.7;
// The trip's length in scroll pixels, at least and at most, and how far short of the header's edge the strip under the
// masthead is when it ends.
const TRIP_MIN = 110;
const TRIP_MAX = 260;
const TRIP_CLEAR = 30;
// How far under the header's edge the words wait (px).
const PARK_GAP = 8;

// Where the hero's two words are at trip progress p (0 to 1). big and small: the hero's and the header wordmark's font
// sizes; from.m1, from.m2: the hero's words, untransformed, in window pixels at this scroll ({ left, top, width, right });
// to.w1, to.w2: the header wordmark's words (to.mark: the compact P&P mark's box, when compact); park: the line under
// the header where the words wait before rising into it; stacked: the hero sets its words on two lines; compact: the
// header shows the P&P mark instead of the words. Returns each word's top-left (x1, y1; x2, y2) in window pixels, the
// scale s, each word's horizontal scale (sx1, sx2: it brings the hero's tighter letter-spacing to the header's width
// by the trip's end) and fade, how far the words have handed over to the compact mark (0 to 1).
export function dockPath(p, { big, small, from: { m1, m2 }, to, park, stacked, compact }) {
  p = clamp(p, 0, 1);
  const sp = Math.min(1, p / SWEEP);
  const rise = ease(clamp((p - SWEEP) / (1 - SWEEP), 0, 1));
  // Shrinking fast at first and easing as it nears its end, geometrically, so the steps read as even.
  const shrinkTo = (end) => Math.exp(Math.log(end) * (1 - (1 - sp) ** 2));

  if (compact) {
    // The words shrink, in their own arrangement (stacked or one line), onto the P&P mark, centred in its height, then
    // hand over to it.
    const { mark } = to;
    const tall = m2.top - m1.top + big;
    const end = (mark.height * MARK_WORD) / big;
    const s = shrinkTo(end);
    const x1 = m1.left + (mark.left + MARK_INSET - m1.left) * smooth(sp);
    const y1 = p < SWEEP ? Math.max(m1.top, park) : park + (mark.top + (mark.height - tall * end) / 2 - park) * rise;
    return {
      x1, y1, x2: x1 + (m2.left - m1.left) * s, y2: y1 + (m2.top - m1.top) * s,
      s, sx1: s, sx2: s, fade: clamp((p - HANDOVER_FROM) / (1 - HANDOVER_FROM), 0, 1),
    };
  }

  const s = shrinkTo(small / big);
  // Each word's width comes to the header's by the trip's end (the two set the same words with different spacing).
  const sx1 = s * (1 + ((to.w1.width * big) / (m1.width * small) - 1) * sp);
  const sx2 = s * (1 + ((to.w2.width * big) / (m2.width * small) - 1) * sp);
  // The second word's start from the first's, in ems: the hero's, then the header's.
  const gapHero = (m2.left - m1.left) / big;
  const gapHead = (to.w2.left - to.w1.left) / small;
  let x1;
  let y1;
  let x2;
  let y2;
  if (!stacked) {
    // One line: it shrinks toward its own middle while that middle sweeps to the header wordmark's; then it rises in.
    const wide = m2.right - m1.left;
    const mid0 = m1.left + wide / 2;
    const midTo = (to.w1.left + to.w2.right) / 2;
    x1 = mid0 + (midTo - mid0) * smooth(sp) - (wide * s) / 2;
    x2 = x1 + (gapHero + (gapHead - gapHero) * sp) * big * s;
    y1 = Math.max(m1.top + (big * (1 - s)) / 2, park);
    if (p > SWEEP) {
      x1 += (to.w1.left - x1) * rise;
      x2 += (to.w2.left - x2) * rise;
      y1 = park + (to.w1.top - park) * rise;
    }
    y2 = y1;
  } else {
    // Stacked: the first word rises; the second slides out beside it; then both rise into the bar.
    x1 = m1.left + (to.w1.left - m1.left) * smooth(sp);
    y1 = p < SWEEP ? Math.max(m1.top, park) : park + (to.w1.top - park) * rise;
    x2 = x1 + (gapHero + (gapHead - gapHero) * (1 - (1 - sp) ** 3)) * big * s;
    y2 = y1 + (m2.top - m1.top) * s * (1 - smooth(sp));
  }
  return { x1, y1, x2, y2, s, sx1, sx2, fade: 0 };
}

// A box's place in window pixels, at the given top.
const place = (r, top = r.top) => ({ left: r.left, top, width: r.width, right: r.right, height: r.height });
// A word's place in window pixels, from its offset in the h1 (at) and the h1's box (h).
const fromHero = (h, at) => ({ left: h.left + at.dx, top: h.top + at.dy, width: at.width, right: h.left + at.dx + at.width, height: at.height });

// Wires the trip to the front page: its masthead (.hero__mark's two spans) and the header's wordmark. html carries
// dock-trip while the trip is not done (the header's wordmark hidden) and dock-moving while the words are away from
// home (they draw over the header). The header's wordmark is never hidden while it has focus. Returns nothing; does
// nothing on a page without both wordmarks.
export function mountDock() {
  const hero = document.querySelector('.hero__mark');
  const head = document.querySelector('.fam a.wordmark');
  const strip = document.querySelector('.hero__strip');
  const bar = head?.closest('.fam');
  const words = hero ? [hero.querySelector('.hero__m1'), hero.querySelector('.hero__m2')] : [];
  const lead = head?.querySelector('.wordmark__lead');
  const pen = head?.querySelector(':scope > .wordmark__pen');
  const mark = head?.querySelector('.wordmark__short');
  if (!bar || !strip || !lead || !pen || !mark || !words.every(Boolean)) return;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;

  // Measured at rest: each word's offset in the h1 (the h1 itself never moves, so its box is read on every frame and the
  // words follow it when the header above changes height), the font sizes, the trip's length.
  let rest = null;
  function measure() {
    for (const w of words) w.style.transform = '';
    const h = hero.getBoundingClientRect();
    const [m1, m2] = words.map((w) => {
      const r = w.getBoundingClientRect();
      return { dx: r.left - h.left, dy: r.top - h.top, width: r.width, height: r.height };
    });
    const big = parseFloat(getComputedStyle(hero).fontSize);
    rest = {
      m1, m2, stacked: m2.dy - m1.dy > big / 2, big, small: parseFloat(getComputedStyle(head).fontSize),
      trip: clamp(strip.getBoundingClientRect().top + window.scrollY - bar.getBoundingClientRect().bottom - TRIP_CLEAR,
        TRIP_MIN, TRIP_MAX),
    };
  }

  function dock() {
    const p = clamp(window.scrollY / rest.trip, 0, 1);
    const motion = !still.matches && !head.contains(document.activeElement);
    const moving = motion && p > 0 && p < 1;
    root.classList.toggle('dock-trip', motion && p < 1);
    root.classList.toggle('dock-moving', moving);
    if (!moving) {
      // At home (the top of the page) or docked: the words rest in the hero. Docked, the trip ends with the hero's foot
      // still a few pixels under the header, so the words rest unseen (still read: opacity, not visibility).
      const docked = !still.matches && p >= 1;
      head.style.visibility = head.style.opacity = '';
      for (const w of words) {
        w.style.transform = '';
        w.style.opacity = docked ? '0' : '';
      }
      return;
    }
    const compact = getComputedStyle(mark).display !== 'none';
    // The header's words: their left and right edges, at the top of the wordmark's line (its box is one line, 1em).
    const top = head.getBoundingClientRect().top;
    const to = compact ? { mark: place(mark.getBoundingClientRect()) }
      : { w1: place(lead.getBoundingClientRect(), top), w2: place(pen.getBoundingClientRect(), top) };
    const h = hero.getBoundingClientRect();
    const from = { m1: fromHero(h, rest.m1), m2: fromHero(h, rest.m2) };
    const park = bar.getBoundingClientRect().bottom + PARK_GAP;
    const d = dockPath(p, { big: rest.big, small: rest.small, from, to, park, stacked: rest.stacked, compact });
    words[0].style.transform = `translate(${d.x1 - from.m1.left}px,${d.y1 - from.m1.top}px) scale(${d.sx1},${d.s})`;
    words[1].style.transform = `translate(${d.x2 - from.m2.left}px,${d.y2 - from.m2.top}px) scale(${d.sx2},${d.s})`;
    // The compact mark: the words fade as it shows.
    const handing = compact && d.fade > 0;
    for (const w of words) w.style.opacity = handing ? String(1 - d.fade) : '';
    head.style.visibility = handing ? 'visible' : '';
    head.style.opacity = handing ? String(d.fade) : '';
  }

  let queued = false;
  const frame = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      dock();
    });
  };
  const again = () => {
    measure();
    dock();
  };
  window.addEventListener('scroll', frame, { passive: true });
  window.addEventListener('resize', again);
  still.addEventListener('change', again);
  // The header changes height without a resize (the phone's search row, the bar's search sizing itself at load).
  if ('ResizeObserver' in window) new ResizeObserver(again).observe(bar);
  head.addEventListener('focusin', frame);
  head.addEventListener('focusout', frame);
  if (document.fonts) document.fonts.ready.then(again);
  again();
}
