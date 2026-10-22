// A punch card of which measures each hospital was scored on: one row per measure, one column per set of measures
// (largest first), a hole punched where the set includes the row's measure, over a column of how many hospitals
// share the set (its cut part in the penalty ink). The card's right margin counts each row's hospitals. Each column is
// a mark with its tooltip; a column with no holes is printed with its own words (hospitals with no score, or the
// rarer sets pooled).
//   rows     [{ label, total, totalText }] (total: hospitals scored on that measure)
//   columns  [{ holes: [row indexes] | null (null: the pooled column), n, yes, nText, tip, empty }]
//            shareText: the share of its decided hospitals CMS cut, printed under the card (hot: above the nation's)
//   labels   { other, none, totals, share } (text): the pooled column's and the no-score column's captions, the
//            margin's head and the share row's name
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { frame, mark, r2, text } from './svg.js';

export function punchCard({ rows, columns, labels, width }) {
  const wide = width >= 480;
  const labelW = wide ? 66 : 46;
  const totalsW = wide ? 116 : 0;
  const colW = Math.min(wide ? 34 : 19, (width - labelW - totalsW - 10) / columns.length);
  const barsH = wide ? 92 : 70;
  const rowH = wide ? 24 : 18;
  const top = 18;
  const cardTop = top + barsH + 8;
  const cardL = labelW - 4;
  const cardR = labelW + columns.length * colW + 6;
  const cardB = cardTop + 10 + rows.length * rowH + 8;
  const hole = { w: Math.min(colW * 0.42, 12), h: rowH * 0.58 };
  const most = Math.max(...columns.map((c) => c.n));
  const bar = scaleLinear().domain([0, most]).range([0, barsH - 14]);
  const colX = (i) => labelW + 3 + i * colW + colW / 2;
  const rowY = (j) => cardTop + 10 + j * rowH + rowH / 2;
  // The card: a clipped corner at the top left, as on a real card.
  const clip = 12;
  const card = `M${r2(cardL + clip)} ${cardTop}H${r2(cardR)}V${r2(cardB)}H${r2(cardL)}V${r2(cardTop + clip)}Z`;
  const base = cardTop - 4;
  const drawn = columns.map((c, i) => {
    const x = colX(i);
    const bw = Math.max(colW * 0.62, 3);
    const hAll = bar(c.n);
    const hYes = bar(c.yes);
    const holes = c.holes
      ? c.holes.map((j) => html`<rect class="chart-punch__hole" x="${r2(x - hole.w / 2)}" y="${r2(rowY(j) - hole.h / 2)}" width="${r2(hole.w)}" height="${r2(hole.h)}" rx="1.5"/>`)
      : html`<text class="chart-punch__word" x="${r2(x)}" y="${r2((cardTop + cardB) / 2)}" transform="rotate(-90 ${r2(x)} ${r2((cardTop + cardB) / 2)})" text-anchor="middle" dy="0.35em">${c.empty ? labels.none : labels.other}</text>`;
    return mark({
      tip: c.tip, value: c.holes || c.empty ? c.n : null, hit: { x: x - colW / 2, y: top, width: colW, height: cardB - top },
      body: html`<rect class="chart-punch__bar" x="${r2(x - bw / 2)}" y="${r2(base - hAll)}" width="${r2(bw)}" height="${r2(hAll)}"/>${hYes > 0 ? html`<rect class="chart-punch__yes" x="${r2(x - bw / 2)}" y="${r2(base - hYes)}" width="${r2(bw)}" height="${r2(hYes)}"/>` : ''}${wide || i === 0 ? text({ x, y: base - hAll - 4, cls: 'chart-value chart-punch__n', body: c.nText }) : ''}${holes}`,
    });
  });
  const marks = rows.map((r, j) => text({ x: labelW - 10, y: rowY(j) + 4, anchor: 'end', cls: 'chart-punch__row', body: r.label }));
  const tx = cardR + 12;
  const totals = wide ? html`${text({ x: tx, y: cardTop + 2, anchor: 'start', cls: 'chart-cap', body: labels.totals })}${rows.map((r, j) => {
    const w = ((width - tx - 46) * r.total) / Math.max(...rows.map((x) => x.total));
    return html`<rect class="chart-bar" x="${r2(tx)}" y="${r2(rowY(j) - 3)}" width="${r2(w)}" height="6"/>${text({ x: tx + w + 4, y: rowY(j) + 4, anchor: 'start', cls: 'chart-value chart-value--mark', body: r.totalText })}`;
  })}` : '';
  const shareY = cardB + 16;
  const shares = !wide ? '' : html`${text({ x: labelW - 10, y: shareY, anchor: 'end', cls: 'chart-punch__row', body: labels.share })}${columns.map((c, i) => (c.shareText ? text({ x: colX(i), y: shareY, cls: `chart-punch__share${c.hot ? ' chart-punch__share--hot' : ''}`, body: c.shareText }) : ''))}`;
  return frame({
    kind: 'punch', width, height: wide ? shareY + 8 : cardB + 6, body: html`<path class="chart-punch__card" d="${card}"/>
<line class="chart-baseline" x1="${cardL}" x2="${r2(cardR)}" y1="${base}" y2="${base}"/>
${marks}
${drawn}
${shares}
${totals}`,
  });
}
