// The nine census divisions on the US map (TEAM's Figure 4): each division's states shaded by one value, the division's
// (its price for one episode type), in five even steps from the lowest value to the highest (evenSteps.js), each division
// labeled with its value and its name, the divisions' borders drawn heavier than the states', the reader's division
// outlined, and a legend of the steps from the lowest value to the highest. Regions only: nothing here is a hospital. Built
// at build time from the pinned us-atlas topology (geo.js projects it, as the family's other US maps); a page script
// redraws a new value set by changing each division's step class, value and label text, never the geometry. Pure: an SVG
// string; colors come from classes in the site's stylesheet.
//   topo    the pinned us-atlas topology (its states object)
//   values  { 1..9: number }, every division's value, keyed by its number (engine/js/divisions.js order)
//   reader  the division to outline (1 to 9), or null
//   words   { price(v) (a value's label), name(div) (a division's name), tip(div, v) (a division's tooltip),
//             legend: { title, low, high } (the legend's title, and the words after the lowest and the highest value) }
//   width   the viewBox's width: the kit's WIDTH on a phone, or a wide one beside the words
// Each division is a mark (data-div, its value as data-value) whose path holds its states' outlines; its labels carry
// data-div too, so a script finds the text it rewrites. Drawn in layers: the shapes and borders, the labels' chips, the
// reader's outline (so a chip never hides it), then the labels' words over all.
import { geoPath } from 'd3-geo';
import { DIVISIONS, divisionOf } from '../../engine/js/divisions.js';
import { html } from '../render/html.js';
import { evenSteps, STEPS } from './evenSteps.js';
import { WIDE } from './figure.js';
import { stateShapes, usMesh, usPaths } from './geo.js';
import { frame, isNarrow, mark, monoWidth, r2, text } from './svg.js';

// A label's chip (the paper under its lines, so it reads on any step in either theme): this far past its words, and wide
// enough for a price of CHIP_PRICE characters, so a page script that writes a longer price than the build's (another
// episode type's) keeps it on the chip.
const CHIP_PAD = 2;
const CHIP_PRICE = 8;
// The labels' type sizes, in viewBox units, set on each label (the site's sheet sets the face): the value in bold over the
// name, a size smaller. The face is monospaced (svg.js monoWidth).
const TYPE = Object.freeze({ narrow: { price: 11, name: 9, gap: 2 }, wide: { price: 12, name: 10, gap: 2 } });
// A name longer than this many characters takes two lines on a phone (split at its last space: "East North" / "Central").
const NARROW_NAME = 12;
// Labels moved off their division's middle, in viewBox units, where the middle is crowded: New England's set against the
// frame's right edge (edge: its last character there) over Maine, and a few others nudged clear of their neighbors (dx, dy).
// A division not listed sits on its middle, centered. split: its name on two lines on the wide drawing too, so its label
// keeps inside the division (East South Central's, which the reader's outline would cross). A test holds the labels'
// chips 6 units apart at the widest price.
const EDGE = 2;
const NUDGE = Object.freeze({
  narrow: { 1: { edge: true, dy: -25 }, 2: { dx: 7 }, 3: { dx: -6 }, 4: { dx: -21 }, 5: { dx: 20, dy: 38 }, 6: { dy: -7 }, 7: { dy: 22 }, 8: { dy: 26 }, 9: { dx: -4 } },
  wide: { 1: { edge: true, dy: -30 }, 2: { dx: 18, dy: -6 }, 3: { dx: 3 }, 4: { dx: -24 }, 5: { dx: 6, dy: 46 }, 6: { dx: -2, dy: 4, split: true } },
});
// The legend under the map: its title, then the steps as one bar of swatches, the lowest and highest values under its two
// ends.
const LEGEND = Object.freeze({ narrow: { swatch: 56, top: 14, bar: 8 }, wide: { swatch: 48, top: 16, bar: 10 } });
// The outlines are always projected at the wide drawing's width (the width the family's other US maps on a page draw
// at) and a narrower drawing scales them: a page that carries both drawings, and another US map, then carries one set of
// outlines that its compression shares, not a second set at the phone's width. The labels are placed at each drawing's
// own width, sized for it.
const GEOMETRY = WIDE;
// Alaska and Hawaii sit in insets: a label is placed by the rest of its division (the Pacific's by its three western
// states).
const INSETS = new Set(['AK', 'HI']);

const nameLines = (name, split) => (split && name.length > NARROW_NAME ? [name.slice(0, name.lastIndexOf(' ')), name.slice(name.lastIndexOf(' ') + 1)] : [name]);

function checked(values, reader) {
  const keys = Object.keys(values).map(Number).sort((a, b) => a - b);
  if (keys.length !== DIVISIONS.length || keys.some((k, i) => k !== i + 1)) throw new RangeError('divisionMap: values must have divisions 1 to 9, and only those');
  if (!keys.every((k) => Number.isFinite(values[k]))) throw new RangeError('divisionMap: every division needs a finite value');
  if (reader !== null && !(Number.isInteger(reader) && reader >= 1 && reader <= DIVISIONS.length)) throw new RangeError(`divisionMap: reader must be a division (1 to 9) or null, got ${reader}`);
}

// Each division's middle on the map drawn at GEOMETRY: the centroid of its states' outlines, the inset states left out.
// Kept per topology.
const MIDDLES = new WeakMap();
function middles(topo) {
  if (!MIDDLES.has(topo)) {
    const shapes = stateShapes(topo);
    const path = geoPath(usPaths(shapes, GEOMETRY).projection);
    MIDDLES.set(topo, DIVISIONS.map(([, codes]) => path.centroid({ type: 'FeatureCollection', features: codes.filter((c) => !INSETS.has(c)).map((c) => shapes.get(c)) })));
  }
  return MIDDLES.get(topo);
}

// Every division's label at a width: { div, x, anchor, lines: [{ text, cls, y, size }], and its box x0, x1, y0, y1 }
// (estimated from the type's advance). priceText(div): the value's label; name(div): the division's name. Exported so a
// test holds the labels apart at any value.
export function divisionLabels({ topo, width, name, priceText }) {
  const narrow = isNarrow(width);
  const type = TYPE[narrow ? 'narrow' : 'wide'];
  const nudge = NUDGE[narrow ? 'narrow' : 'wide'];
  const k = width / GEOMETRY;
  return middles(topo).map(([gx, gy], i) => {
    const [mx, my] = [gx * k, gy * k];
    const div = i + 1;
    const { dx = 0, dy = 0, edge = false, split = false } = nudge[div] ?? {};
    const anchor = edge ? 'end' : 'middle';
    const x = edge ? width - EDGE : mx + dx;
    const names = nameLines(name(div), narrow || split);
    const price = priceText(div);
    // The block's lines, centered on its middle: the price, then the name's one or two lines.
    const heights = [type.price, ...names.map(() => type.name)];
    const tall = heights.reduce((a, b) => a + b, 0) + type.gap * (heights.length - 1);
    let y = my + dy - tall / 2;
    const lines = [{ text: price, cls: 'chart-div__price', size: type.price }, ...names.map((n) => ({ text: n, cls: 'chart-div__name', size: type.name }))].map((line) => {
      y += line.size;
      const out = { ...line, y: y - line.size * 0.18 };
      y += type.gap;
      return out;
    });
    const wide = Math.max(...lines.map((l) => monoWidth(l.text, l.size)));
    const x0 = edge ? x - wide : x - wide / 2;
    const [y0, y1] = [my + dy - tall / 2, my + dy + tall / 2];
    // The chip under the block: CHIP_PAD past its words, and at least a CHIP_PRICE-character price wide.
    const chipWide = Math.max(wide, monoWidth('0'.repeat(CHIP_PRICE), type.price));
    const cx0 = (edge ? x0 + wide - chipWide : x0 + wide / 2 - chipWide / 2) - CHIP_PAD;
    const chip = { x0: cx0, x1: cx0 + chipWide + 2 * CHIP_PAD, y0: y0 - CHIP_PAD, y1: y1 + CHIP_PAD };
    return { div, x, anchor, lines, x0, x1: x0 + wide, y0, y1, chip };
  });
}

function legendOf({ steps, words, top, narrow }) {
  const { swatch, top: gap, bar } = LEGEND[narrow ? 'narrow' : 'wide'];
  const size = TYPE[narrow ? 'narrow' : 'wide'].name;
  const titleY = top + gap;
  const barY = titleY + 6;
  const endsY = barY + bar + size + 3;
  const right = STEPS * swatch;
  const swatches = Array.from({ length: STEPS }, (_, i) => html`<rect class="chart-div chart-div--s${i + 1}" x="${i * swatch}" y="${barY}" width="${swatch}" height="${bar}"/>`);
  const body = html`<g class="chart-div__legend">${text({ x: 0, y: titleY, anchor: 'start', cls: 'chart-legend__title', body: words.legend.title })}${swatches}${text({ x: 0, y: endsY, anchor: 'start', cls: 'chart-legend__label', body: html`<tspan data-legend="low">${words.price(steps.lo)}</tspan> ${words.legend.low}` })}${text({ x: right, y: endsY, anchor: 'end', cls: 'chart-legend__label', body: html`<tspan data-legend="high">${words.price(steps.hi)}</tspan> ${words.legend.high}` })}</g>`;
  return { body, bottom: endsY + 4 };
}

// The reader's division's outline: its edges with other divisions and its coast and borders (an edge no other state of
// the map shares).
const outlineOf = (topo, width, reader) => usMesh(topo, width, (a, b) => (a === b ? divisionOf(a) === reader : (divisionOf(a) === reader) !== (divisionOf(b) === reader)));

export function divisionMap({ topo, values, reader = null, words, width }) {
  checked(values, reader);
  const narrow = isNarrow(width);
  const { height, paths } = usPaths(stateShapes(topo), GEOMETRY);
  const k = width / GEOMETRY;
  // The outlines' group, scaled to this drawing (none at GEOMETRY itself).
  const scaled = k === 1 ? '' : html` transform="scale(${String(Math.round(k * 1e6) / 1e6)})"`;
  const steps = evenSteps(DIVISIONS.map((_, i) => values[i + 1]));
  const marks = DIVISIONS.map(([, codes], i) => {
    const div = i + 1;
    const cls = `chart-div chart-div--s${steps.stepOf(values[div])}${div === reader ? ' chart-div--reader' : ''}`;
    return mark({ tip: words.tip(div, values[div]), value: values[div], data: { div }, hit: null, body: html`<path class="${cls}" d="${codes.map((code) => paths.get(code)).join('')}"/>` });
  });
  const borders = usMesh(topo, GEOMETRY, (a, b) => a !== b && divisionOf(a) !== divisionOf(b));
  const outline = reader === null ? '' : html`<path class="chart-div__reader" d="${outlineOf(topo, GEOMETRY, reader)}"/>`;
  const placed = divisionLabels({ topo, width, name: words.name, priceText: (div) => words.price(values[div]) });
  const chips = placed.map(({ chip: c }) => html`<rect class="chart-div__chip" x="${r2(c.x0)}" y="${r2(c.y0)}" width="${r2(c.x1 - c.x0)}" height="${r2(c.y1 - c.y0)}" rx="2"/>`);
  const texts = placed.map((l) => l.lines.map((line) => html`<text class="${line.cls}" data-div="${l.div}" x="${r2(l.x)}" y="${r2(line.y)}" font-size="${line.size}" text-anchor="${l.anchor}">${line.text}</text>`));
  const legend = legendOf({ steps, words, top: r2(height * k), narrow });
  return frame({
    kind: 'division-map', width, height: legend.bottom, body: html`<g${scaled}><g class="chart-div__shapes">${marks}</g>
<path class="chart-div__borders" d="${borders}"/></g>
<g class="chart-div__chips" aria-hidden="true">${chips}</g>${outline ? html`
<g${scaled}>${outline}</g>` : ''}
<g class="chart-div__labels" aria-hidden="true">${texts}</g>
${legend.body}`,
  });
}
