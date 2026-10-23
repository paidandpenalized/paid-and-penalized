// A treemap of groups of tiles, each tile's area its value: the groups laid out first (squarified), each under a
// header naming it, then each group's tiles inside it. For "every cut hospital, sized by its dollars": the eye sees how
// few large tiles carry most of the area without a name printed (each tile names itself only in its tooltip).
//   groups   [{ label, sub, value, tiles: [{ value, tip, order }] }]: label and sub print in the header; value is the group's
//            total (plotted on the header's mark, for the figure's table); a tile with no tip is plain. A phone's drawing
//            (isNarrow) draws every tile plain, with no tooltips, for a lighter page. A group whose box is too small to
//            print its label (a sliver: too narrow, or too short to leave tiles room under a header) has no header: its
//            tiles fill the box, and its label goes unprinted; one test decides, so a header is never left blank. The
//            tiles are laid out by value (equal values in the order given); order (text, optional) is the order they
//            are written into the page, so a page's source need not list tiles by size. A tile's place does not depend
//            on it.
//   width    the viewBox's width; height: its height (default: taller across a page than on a phone)
import { html } from '../render/html.js';
import { frame, isNarrow, mark, r2, text } from './svg.js';

const HEAD = 30;
// A group's box has a header, and its label, only if it is wider than LABEL_WIDTH and taller than the header plus
// TILE_ROOM, the least that leaves its tiles anything under the header. Otherwise it is a sliver (see the groups).
const LABEL_WIDTH = 70;
const TILE_ROOM = 8;
// Tile coordinates to a tenth of a unit: hundreds of tiles, each a hair at most off.
const r1 = (x) => Math.round(x * 10) / 10;
const GAP = 4;

// Squarified layout (Bruls, Huizing and van Wijk, 2000): positive values into a rectangle { x, y, w, h }, largest
// first, rows chosen to keep each tile near square. Returns one { x, y, w, h } per value, in the input's order (a zero
// or negative value gets a rectangle of no size).
function squarify(values, rect) {
  const out = values.map(() => ({ x: rect.x, y: rect.y, w: 0, h: 0 }));
  const items = values.map((v, i) => ({ v, i })).filter((d) => d.v > 0).sort((a, b) => b.v - a.v || a.i - b.i);
  const total = items.reduce((s, d) => s + d.v, 0);
  if (!total || rect.w <= 0 || rect.h <= 0) return out;
  const k = (rect.w * rect.h) / total;
  for (const d of items) d.a = d.v * k;
  const r = { ...rect };
  const worst = (row, side) => {
    const s = row.reduce((t, d) => t + d.a, 0);
    const max = Math.max(...row.map((d) => d.a));
    const min = Math.min(...row.map((d) => d.a));
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };
  const lay = (row) => {
    const s = row.reduce((t, d) => t + d.a, 0);
    if (r.w >= r.h) {
      const w = s / r.h;
      let y = r.y;
      for (const d of row) { const h = d.a / w; out[d.i] = { x: r.x, y, w, h }; y += h; }
      r.x += w; r.w -= w;
    } else {
      const h = s / r.w;
      let x = r.x;
      for (const d of row) { const w = d.a / h; out[d.i] = { x, y: r.y, w, h }; x += w; }
      r.y += h; r.h -= h;
    }
  };
  let row = [];
  for (const d of items) {
    const side = Math.min(r.w, r.h);
    if (!row.length || worst([...row, d], side) <= worst(row, side)) row.push(d);
    else { lay(row); row = [d]; }
  }
  if (row.length) lay(row);
  return out;
}

export function treemap({ groups, width, height = isNarrow(width) ? 420 : 520 }) {
  if (!groups.length) throw new RangeError('treemap: no groups');
  const boxes = squarify(groups.map((g) => g.value), { x: 0, y: 0, w: width, h: height });
  const body = groups.map((g, gi) => {
    const b = boxes[gi];
    if (b.w < 1 || b.h < 1) return '';
    // A box too small for its label (a sliver of a group) gets no header, and its tiles take the whole box.
    const sliver = !(b.w > LABEL_WIDTH && b.h > HEAD + TILE_ROOM);
    const box = { x: b.x + GAP / 2, y: b.y + (sliver ? 0 : GAP / 2), w: Math.max(0, b.w - GAP), h: Math.max(0, b.h - (sliver ? 0 : GAP)) };
    const inner = sliver ? box : { x: box.x, y: b.y + HEAD, w: box.w, h: Math.max(0, b.h - HEAD - GAP / 2) };
    const tiles = squarify(g.tiles.map((t) => t.value), inner);
    // The tiles written in the order the caller gives (by `order`), not the order they were laid out in.
    const written = g.tiles.map((_, i) => i);
    if (g.tiles.some((t) => t.order !== undefined)) written.sort((i, j) => (g.tiles[i].order < g.tiles[j].order ? -1 : g.tiles[i].order > g.tiles[j].order ? 1 : i - j));
    // A narrow header holds the label alone; the sub line only where it fits; a sliver of a group neither (its header
    // mark's tooltip still names it).
    const wide = b.w > 210;
    const head = mark({
      tip: `${g.label}: ${g.sub}`, value: g.value, hit: null,
      body: html`<rect class="chart-tree__group" x="${r2(box.x)}" y="${r2(box.y)}" width="${r2(box.w)}" height="${r2(box.h)}"/>`,
    });
    const plain = isNarrow(width) || g.tiles.every((t) => !t.tip);
    const drawn = plain
      ? html`<path class="chart-tree__tile" d="${tiles.map((t) => (t.w > 0 && t.h > 0 ? `M${r1(t.x)} ${r1(t.y)}h${r1(t.w)}v${r1(t.h)}h${r1(-t.w)}z` : '')).join('')}"/>`
      : html`<g class="chart-tree__tiles">${written.map((i) => { const t = tiles[i]; return t.w > 0 && t.h > 0 ? html`<rect data-mark x="${r1(t.x)}" y="${r1(t.y)}" width="${r1(t.w)}" height="${r1(t.h)}"><title>${g.tiles[i].tip}</title></rect>` : ''; })}</g>`;
    return html`<g class="chart-tree__g">${head}${drawn}
${sliver ? '' : text({ x: b.x + 6, y: b.y + 15, anchor: 'start', cls: 'chart-tree__label', body: g.label })}${!sliver && wide ? text({ x: b.x + b.w - 6, y: b.y + 15, anchor: 'end', cls: 'chart-tree__sub', body: g.sub }) : ''}</g>`;
  });
  return frame({ kind: 'treemap', width, height, body: html`${body}` });
}
