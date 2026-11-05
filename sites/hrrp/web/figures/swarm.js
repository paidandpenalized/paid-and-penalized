// Step 2's figure on the program page's "How it works" Part [S2-09]: for one condition, a unit swarm with a dot for each hospital
// measured on it, at its ratio minus its own peer group's median, so the five groups' medians are one line at zero. The line is
// named on the chart as the peer median (not 1.0); the dots over it are in the penalty ink. Under the swarm, a lens magnifies
// the span within BAND of the line, a dot per hospital, with the counts just over and just under in words; the closest gap to
// the line is at four decimals; the example hospital (the one Worksheet R shows) is marked with a ▲ where it is measured.
// The old site's six-condition switch stays: one swarm for each condition, drawn at build time. Heart failure's is in the page; the
// other five are in a content-hashed asset (swarmRest) that client/swarm.js fetches when one is first picked, so the page does not
// carry ten drawings nobody has asked for. Without that script the page reads whole with heart failure's swarm.
// The words are in program/copy.js; the numbers are how-data.js swarmData and swarmDomain.
import { scoreSwarm } from '../../../../web/charts/scoreSwarm.js';
import { WIDE, figure, imagePair, num } from '../../../../web/charts/figure.js';
import { NOTE_PX, WIDTH, isNarrow, r2 } from '../../../../web/charts/svg.js';
import { textWidth } from '../../../../web/charts/text.js';
import { clamp } from '../../../../engine/js/stats.js';
import { html } from '../../../../web/render/html.js';
import { count, listText, signed } from '../../../../web/render/format.js';
import { conditionShort } from '../derive.js';
import { gapText, ratio, roundTo } from '../numbers.js';
import { fill, t } from '../program/copy.js';
import { hospitals, inSentence } from '../wording.js';
import { BAND, SLIVER, SWARM_ORDER, swarmDomain } from './how-data.js';

// How many columns each drawing holds at most (the narrowest bin that fits), and the share of dots a phone folds into each end column.
const MAX_BINS = { wide: 56, narrow: 40 };
const TRIM_NARROW = 0.005;
// The least width a dot's column takes (a dot's pitch times its columns across a bin).
const DOT_PITCH = 2.4;
const DOT_GAP = 0.8;
// The lens: its columns' width, the dots' columns across one and their pitch, for each drawing; the glass's least height, the room
// over its dots (caption and counts), and under them (axis).
const LENS = { wide: { step: 0.0005, cols: 2, pitch: 4.4 }, narrow: { step: 0.001, cols: 3, pitch: 3.6 } };
const LENS_MIN = 100;
const LENS_ABOVE = 46;
const LENS_BELOW = 34;
// The drawing's margin on each side (scoreSwarm's): the lens runs between the margins, its dots inside a padding on each side.
const MARGIN = 8;
const LENS_PAD = 30;
// The least room an axis tick needs from the drawing's end for its label.
const TICK_EDGE = 18;
// The gap axis's tick steps, and the least room between two labeled ticks.
const TICK_STEPS = [0.05, 0.1, 0.2, 0.25, 0.5];
const TICK_GAP = 56;

// A closest-hospital gap the lens can show (within BAND of the line), else null: its label and the gap line are left off.
const inLens = (d) => (d !== null && d !== undefined && Math.abs(d) <= BAND ? d : null);

// A tick on the gap axis: "0", "+0.10", "−0.10".
const tick = (dp) => (v) => (Math.abs(v) < 1e-9 ? '0' : signed(v, dp));

// The dots' layout for a drawing: columns across a bin and the pitch between dots (wanting at least `want` across a column).
// The size-of-the-cuts swarm (picture-draw.js) lays its dots out by the same rule with its own pitch.
export function dotsFor(width, bins, want = DOT_PITCH) {
  const binW = (width - 2 * MARGIN) / bins;
  const cols = Math.max(2, Math.round(binW / want));
  return { cols, pitch: r2((binW - DOT_GAP) / cols) };
}

// The tallest stack of the lens's dots, in rows: bins (a, b] of the lens's step, the end values on the end bins.
function lensRows(items, { step, cols }) {
  const bins = Math.round((2 * BAND) / step);
  const stack = new Array(bins).fill(0);
  for (const { d } of items) {
    if (Math.abs(d) <= BAND) stack[clamp(Math.ceil((d + BAND) / step - 1e-9) - 1, 0, bins - 1)] += 1;
  }
  return Math.ceil(Math.max(...stack) / cols);
}

// A swarm for one condition at one drawing width: sw is how-data.js swarmData(cond); name: the example hospital's name; cond:
// the condition in a sentence. Returns the SVG and the end-column counts (dots past the drawing's ends).
export function drawSwarm({ sw, width, name, cond }) {
  const narrow = isNarrow(width);
  const dom = swarmDomain(sw.items, { maxBins: narrow ? MAX_BINS.narrow : MAX_BINS.wide, trim: narrow ? TRIM_NARROW : 0 });
  const nBins = Math.round((dom.hi - dom.lo) / dom.bin);
  const edges = Array.from({ length: nBins + 1 }, (_, i) => roundTo(dom.lo + i * dom.bin, 6));
  const items = sw.items.map((i) => ({ score: clamp(i.d, dom.lo, dom.hi), yes: i.d > 0 }));
  const { cols, pitch } = dotsFor(width, nBins);
  const lens = LENS[narrow ? 'narrow' : 'wide'];
  const lensH = Math.max(LENS_MIN, LENS_ABOVE + lensRows(sw.items, lens) * lens.pitch + LENS_BELOW);
  const x = (v) => MARGIN + ((v - dom.lo) / (dom.hi - dom.lo)) * (width - 2 * MARGIN);
  const side = (n, full, short) => fill(narrow ? short : full, { n: count(n) });
  const ex = sw.example;
  const mark = ex && (() => {
    const gap = gapText(ex.d);
    const full = fill(ex.d > 0 ? 'swarmMarkOver' : 'swarmMarkUnder', { name, gap });
    const label = narrow ? fill('swarmMarkPhone', { name, gap }) : full;
    // A name too long for either side of the ▲ is dropped for the gap alone.
    const score = clamp(ex.d, dom.lo, dom.hi);
    const room = Math.max(x(score) - MARGIN, width - MARGIN - x(score)) - 12;
    return { score, label: textWidth(label, NOTE_PX) <= room ? label : fill('swarmMarkShort', { gap }) };
  })();
  // Ticks the narrowest step apart that leaves their labels room, left off within an end label's width of either end so none is cut off.
  const tickStep = TICK_STEPS.find((step) => step * ((width - 2 * MARGIN) / (dom.hi - dom.lo)) >= TICK_GAP) ?? TICK_STEPS[TICK_STEPS.length - 1];
  const ticks = Array.from({ length: Math.floor((dom.hi - dom.lo) / tickStep) + 2 }, (_, i) => roundTo((Math.ceil(dom.lo / tickStep) + i) * tickStep, 6))
    .filter((v) => v <= dom.hi && x(v) - MARGIN >= TICK_EDGE && width - MARGIN - x(v) >= TICK_EDGE);
  const svg = scoreSwarm({
    items, edges, band: [inLens(sw.closestUnder), inLens(sw.closestOver)], line: 0, upper: true, width, pitch, cols,
    labels: {
      title: narrow ? t('swarmLinePhone') : fill('swarmLineWide', { one: ratio(1, 1) }),
      below: side(sw.atOrUnder, 'swarmUnderWide', 'swarmUnderPhone'), above: side(sw.over, 'swarmOverWide', 'swarmOverPhone'),
      loupe: narrow ? fill('swarmLensPhone', { band: ratio(BAND, 2) }) : fill('swarmLensWide', { band: ratio(BAND, 4), k: String(Math.round(((dom.hi - dom.lo) / (2 * BAND)) * ((width - 2 * MARGIN - 2 * LENS_PAD) / (width - 2 * MARGIN)))) }),
      highestNo: fill('swarmJustUnder', { n: count(sw.band.atOrUnder) }), lowestYes: fill('swarmJustOver', { n: count(sw.band.over) }),
    },
    loupe: { from: -BAND, to: BAND, step: lens.step, cols: lens.cols, pitch: lens.pitch, height: lensH, pad: LENS_PAD, ticks: narrow ? [-BAND, 0, BAND] : [-BAND, -BAND / 2, 0, BAND / 2, BAND], format: tick(narrow ? 2 : 4) },
    place: 'below', zone: [-BAND, BAND], mark, ticks, format: tick(2),
  });
  return { svg, below: dom.below, above: dom.above, lo: dom.lo, hi: dom.hi };
}

// The words under one condition's swarm: the closest gap and the slivers, the key to the colors, and a note when the example
// hospital is not measured on the condition.
function notesOf({ sw, cond }) {
  const lines = [];
  if (sw.closestOver !== null) {
    lines.push(`${fill('swarmClosest', { gap: gapText(sw.closestOver) })}${sw.sliver ? ` ${fill('swarmSliver', { hospitals: hospitals(sw.sliver), tiny: ratio(SLIVER) })}` : ''}`);
  }
  lines.push(t('swarmKey'));
  if (!sw.example) lines.push(fill('swarmNoExample', { cond }));
  return lines;
}

// The phone's end columns: the dots past the drawing's ends, which the wide drawing (the whole span) has none of. '' when there are none.
function clipNote({ below, above, lo, hi }) {
  const parts = [below && fill('swarmClipLow', { n: count(below), lo: signed(lo, 2) }), above && fill('swarmClipHigh', { n: count(above), hi: signed(hi, 2) })].filter(Boolean);
  return parts.length ? html`<p class="small muted swarm__note swarm__note--phone">${fill('swarmClip', { parts: listText(parts) })}</p>
` : '';
}

// The figure's takeaway for one condition: the hospitals measured, how many are over their own group's median, how many sit within BAND of it.
export function swarmTakeaway({ sw, cond }) {
  const base = { hospitals: hospitals(sw.items.length), cond, over: count(sw.over), band: ratio(BAND, 2) };
  if (sw.band.n === 0) return fill('swarmTakeawayNone', base);
  if (sw.band.n === 1) return fill('swarmTakeawayOne', base);
  return fill('swarmTakeaway', { ...base, near: count(sw.band.n) });
}

// One condition's panel: the takeaway (the browser puts it in the figure's caption), the two drawings and the notes.
function panel({ sw, conditions, name, first }) {
  const cond = inSentence(conditionShort(conditions, sw.cond));
  const narrow = drawSwarm({ sw, width: WIDTH, name, cond });
  const wide = drawSwarm({ sw, width: WIDE, name, cond });
  const takeaway = swarmTakeaway({ sw, cond });
  return {
    takeaway,
    html: html`<div class="swarm__m" data-cond="${sw.cond}" data-takeaway="${takeaway}"${first ? '' : html` hidden`}>
${imagePair({ svg: narrow.svg, svgWide: wide.svg }, fill('swarmAlt', { cond, band: ratio(BAND, 2) }))}
${notesOf({ sw, cond }).map((line) => html`<p class="small muted swarm__note">${line}</p>
`)}${clipNote(narrow)}</div>`,
  };
}

// The figure's table: for each condition, the dots in bins 0.05 wide, how many are over the median and how many at or under.
function tableOf({ swarms, conditions }) {
  const gap = (v) => (Math.abs(v) < 1e-9 ? ratio(0, 2) : signed(v, 2));
  return {
    columns: [{ name: t('swarmColCond') }, { name: t('swarmColGap') }, { name: t('swarmColOver'), numeric: true }, { name: t('swarmColUnder'), numeric: true }],
    rows: swarms.flatMap((sw) => sw.table.map((b) => {
      const over = b.hi > 0;
      return [conditionShort(conditions, sw.cond), fill('swarmGapRange', { from: gap(b.lo), to: gap(b.hi) }), num(over ? count(b.n) : '0', over ? b.n : 0), num(over ? '0' : count(b.n), over ? 0 : b.n)];
    })),
  };
}

// The panels past heart failure's, as a map of condition to markup (each hidden until its button is pressed): the build writes them to
// a content-hashed asset, which client/swarm.js fetches when a condition is first picked and inserts as they are here.
export function swarmRest({ how }) {
  const { conditions } = how;
  const name = how.worksheet.fields[0].value;
  return Object.fromEntries(SWARM_ORDER.slice(1).map((cond) => [cond, panel({ sw: how.swarm(cond), conditions, name, first: false }).html.text]));
}

// The figure: how: view.how (howData); n: its number; edition: the edition's label; restUrl: the asset swarmRest's panels are in
// (null: every condition's panel is in the figure's markup).
export function swarmFigure({ how, n, edition, restUrl = null }) {
  const { conditions } = how;
  const swarms = SWARM_ORDER.map((cond) => how.swarm(cond));
  const name = how.worksheet.fields[0].value;
  const shown = restUrl ? swarms.slice(0, 1) : swarms;
  const panels = shown.map((sw, i) => panel({ sw, conditions, name, first: i === 0 }));
  const chart = html`<div class="swarm" data-cond="${SWARM_ORDER[0]}"${restUrl ? html` data-src="${restUrl}"` : ''}>
<div class="swarm__controls" hidden>
<div class="seg" role="group" aria-label="${t('swarmSwitch')}">${SWARM_ORDER.map((k, i) => html`<button type="button" class="btn" data-cond="${k}" aria-pressed="${i === 0 ? 'true' : 'false'}">${conditionShort(conditions, k)}</button>`)}</div>
</div>
${panels.map((p) => p.html)}</div>`;
  return figure({
    n, chart, takeaway: panels[0].takeaway, source: fill('swarmSource', { edition }), claimLevel: 'recomputed', csvName: 'hrrp-ratio-minus-median',
    table: tableOf({ swarms, conditions }),
  });
}
