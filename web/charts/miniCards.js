// A small card per hospital: a row of boxes, one per measure (filled: a measured result; hatched: CMS assigned its
// worst score; empty: not scored on it), the card's frame in the penalty ink when CMS cut it. Cards wrap in rows.
//   cards [{ cells: ['m' | 'a' | '' per measure], yes, tip }]
import { html } from '../render/html.js';
import { frame, hatchDefs, hatchFill, mark, r2 } from './svg.js';

export function miniCards({ id, cards, width, cols }) {
  const gap = 6;
  const w = (width - gap * (cols - 1)) / cols;
  const box = Math.min(16, (w - 10) / 6 - 2);
  const h = box + 12;
  const rows = Math.ceil(cards.length / cols);
  const body = cards.map((c, i) => {
    const x = (i % cols) * (w + gap);
    const y = Math.floor(i / cols) * (h + gap);
    const cells = c.cells.map((kind, j) => {
      const bx = x + 5 + j * (box + 2);
      const by = y + 6;
      return kind === 'm' ? html`<rect class="chart-card__m" x="${r2(bx)}" y="${r2(by)}" width="${r2(box)}" height="${r2(box)}"/>`
        : kind === 'a' ? html`<rect class="chart-card__a" fill="${hatchFill(id)}" x="${r2(bx)}" y="${r2(by)}" width="${r2(box)}" height="${r2(box)}"/>`
          : html`<rect class="chart-card__none" x="${r2(bx)}" y="${r2(by)}" width="${r2(box)}" height="${r2(box)}"/>`;
    });
    return mark({ tip: c.tip, value: null, hit: null, body: html`<rect class="chart-card${c.yes ? ' chart-card--pen' : ''}" x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="2"/>${cells}` });
  });
  return frame({ kind: 'cards', width, height: rows * (h + gap), body: html`${hatchDefs(id)}${body}` });
}
