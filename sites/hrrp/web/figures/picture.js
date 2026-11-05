// The program page's "The FY2027 picture" Part, so far: its lede (the median cut, how many lose 1% or more, how many are at the
// cap) and the table of the largest cuts, each row ending in the kit's six-cell glyph (web/charts/miniCards.js) with a CSV of
// the same hospitals (csv.js, written by the build as largest-penalties.csv). The Part's five figures are not drawn yet;
// figures/picture-data.js holds their numbers.
import { CONDS } from '../../../../engine/js/hrrp/formula.js';
import { figure, num } from '../../../../web/charts/figure.js';
import { miniCards } from '../../../../web/charts/miniCards.js';
import { listText, noun, placeText, spelled } from '../../../../web/render/format.js';
import { printout } from '../../../../web/render/components.js';
import { html } from '../../../../web/render/html.js';
import { hospitalPath } from '../links.js';
import { fmtInt, fmtMoney, fmtPct } from '../numbers.js';
import { fill, t } from '../program/copy.js';

// The glyph's drawing width in units: six boxes and their padding.
const GLYPH_WIDTH = 96;
// A condition's state in the glyph: counted fills the box, below hatches it, few and none leave it empty.
const CELL = { counted: 'm', below: 'a', few: '', none: '' };
const TIP = { counted: 'penTipCounted', below: 'penTipBelow', few: 'penTipNone', none: 'penTipNone' };

const shortOf = (conditions, key) => conditions.find((c) => c.key === key).short;

// The Part's lede paragraph.
export function ledeText({ lede }) {
  if (!lede.nCut) return t('pictureLedeNone');
  const some = (n, many, one, extra) => fill(n === 1 ? one : many, { hospitals: noun(n, 'hospital'), ...extra });
  return [
    lede.nCut === 1 ? fill('pictureLedeOne', { median: fmtPct(lede.medianCut) }) : fill('pictureLede', { hospitals: noun(lede.nCut, 'hospital'), median: fmtPct(lede.medianCut) }),
    some(lede.nOnePlus, 'pictureOnePlus', 'pictureOnePlusOne', { one: String(lede.onePlus) }),
    some(lede.nCap, 'pictureCap', 'pictureCapOne', { cap: String(lede.cap) }),
  ].join(' ');
}

// One row's glyph: the six boxes in program order, a tooltip on the card naming each condition's state.
function glyph(row, rank, conditions) {
  const tip = CONDS.map((k, i) => fill(TIP[row.states[i]], { c: shortOf(conditions, k) })).join('; ');
  return miniCards({ id: `pen-${rank}`, width: GLYPH_WIDTH, cols: 1, cards: [{ cells: row.states.map((s) => CELL[s]), yes: row.h.red > 0, tip }] });
}

const countedNames = (row, conditions) => CONDS.filter((_, i) => row.states[i] === 'counted').map((k) => shortOf(conditions, k));

// The largest-penalties table as the figure's chart: a row for each hospital, its name linking to its page, then its cut, its
// modeled dollars and the glyph (with the conditions in words for a screen reader).
function penTable(rows, conditions) {
  return html`<div class="pen">${printout(html`<table class="gb pen__table">
<thead><tr><th scope="col">${t('penColHospital')}</th><th scope="col">${t('penColPlace')}</th><th scope="col" class="num">${t('penColCut')}</th><th scope="col" class="num">${t('penColDollars')}</th><th scope="col">${t('penColConds')}</th></tr></thead>
<tbody>${rows.map((r, i) => {
    const names = countedNames(r, conditions);
    return html`<tr><th scope="row"><a href="${hospitalPath(r.h.id)}">${r.h.name}</a></th><td>${placeText({ city: r.h.city, state: r.h.st })}</td><td class="num">${fmtPct(r.h.red)}</td><td class="num">${fmtMoney(r.h.pen)}</td><td><span class="pen__glyph">${glyph(r, i + 1, conditions)}</span><span class="vh">${names.length ? fill('penCondsSpoken', { list: listText(names) }) : t('penCondsNone')}</span></td></tr>`;
  })}</tbody>
</table>`)}</div>`;
}

function penFigure({ rows, conditions, edition, n }) {
  const cuts = rows.map((r) => r.h.red);
  const [hi, lo] = [Math.max(...cuts), Math.min(...cuts)];
  const words = spelled(rows.length);
  const takeaway = rows.length === 1 ? fill('penTakeawayOne', { cut: fmtPct(hi) })
    : hi === lo
    ? fill('penTakeawayTie', { words, cut: fmtPct(hi) })
    : fill('penTakeaway', { words, hi: fmtPct(hi), lo: fmtPct(lo) });
  return figure({
    n, takeaway, source: fill('penSource', { edition }), claimLevel: 'estimate', csvName: 'hrrp-largest-penalties',
    chart: penTable(rows, conditions),
    note: fill('penKey', { names: listText(CONDS.map((k) => shortOf(conditions, k))) }),
    table: {
      columns: [{ name: t('penColHospital') }, { name: t('penColPlace') }, { name: t('penColCut'), numeric: true }, { name: t('penColDollars'), numeric: true }, { name: t('penColConds') }],
      rows: rows.map((r) => [
        r.h.name, placeText({ city: r.h.city, state: r.h.st }), num(fmtPct(r.h.red), r.h.red), num(fmtMoney(r.h.pen), r.h.pen),
        listText(countedNames(r, conditions)),
      ]),
    },
  });
}

// picture: view.picture (picture-data.js pictureData); figure: the page's figure counter; edition: the edition's label.
export function picturePart(picture, { figure: nextFigure, edition }) {
  const { largest, conditions } = picture;
  return html`<p class="part__intro">${ledeText(picture)}</p>
${largest.length ? html`${penFigure({ rows: largest, conditions, edition, n: nextFigure() })}
<p class="small pen__csv"><a href="${picture.csvHref}" download>${t('penDownload')}</a></p>` : ''}`;
}
