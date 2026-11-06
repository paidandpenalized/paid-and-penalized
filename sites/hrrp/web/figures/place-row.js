// One row of a hospital table: the hospital with its place, the cut with a bar behind it, modeled dollars, peer group and the
// six-condition glyph (with the counted conditions in words for a screen reader). The place page's hospitals table adds beds, the
// hospital page's area table a rank and a mark on this hospital. The place page writes the first page of rows with it and the
// page's script writes the rest, so the two are one definition (as Worksheet R's rows are).
import { CAP_PCT } from '../../../../engine/js/hrrp/formula.js';
import { copyOf } from '../../../../web/render/components.js';
import { placeText } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { hospitalPath } from '../links.js';
import { fmtInt, fmtMoney, fmtPct } from '../numbers.js';
import { glyph, glyphSpoken } from './glyph.js';

// The row's few own words (the script draws rows too, so they live here and not in a whole page's copy table).
const { fill, t } = copyOf({
  rowInactive: { text: 'inactive', claim: null },
  rowInactiveTitle: { text: 'CMS lists this hospital’s Medicare agreement as ended', claim: null },
  rowCcn: { text: ' · CCN {id}', claim: null },
  rowCostRpt: { text: 'cost rpt', claim: null },
  rowCostRptTitle: { text: 'From the Medicare cost report; CMS lists no certified beds', claim: null },
});

// r: { h (id, name, city, st, red, pen, peer, beds; inactive, bedsSrc when set), states (each condition's state in program order), rank (1-based, unique on the page) };
// conditions: the edition's [{ key, short }]. options: prefix (the glyph's id prefix, unique per table on a page); rank (a rank column
// first); current (the words that mark this row's hospital as the page's own, or null); beds (a beds column last).
export function hospitalRow(r, conditions, { prefix = 'ph', rank = false, current = null, beds = true } = {}) {
  const { h } = r;
  const tag = h.inactive ? html` <span class="ph__tag" title="${t('rowInactiveTitle')}">${t('rowInactive')}</span>` : '';
  const mark = current === null ? '' : html`<span class="nb__here">${current}</span>`;
  return html`<tr${current === null ? '' : html` class="is-current" aria-current="true"`}>${rank ? html`<td class="num nb__rank">${String(r.rank)}</td>` : ''}<th scope="row"><a href="${hospitalPath(h.id)}">${h.name}</a>${tag}${current === null ? '' : ' '}${mark}<span class="nb__place">${placeText({ city: h.city, state: h.st })}${fill('rowCcn', { id: h.id })}</span></th><td class="num nb__cut"><span class="nb__bar" style="--w: ${Math.min(100, (h.red / CAP_PCT) * 100).toFixed(1)}" aria-hidden="true"></span><span>${fmtPct(h.red)}</span></td><td class="num">${fmtMoney(h.pen)}</td><td class="num">${String(h.peer)}</td><td><span class="pen__glyph">${glyph(r, r.rank, conditions, prefix)}</span><span class="vh">${glyphSpoken(r, conditions)}</span></td>${beds ? html`<td class="num">${h.beds == null ? '—' : fmtInt(h.beds)}${h.beds != null && h.bedsSrc === 'cr' ? html` <small class="ph__src" title="${t('rowCostRptTitle')}">${t('rowCostRpt')}</small>` : ''}</td>` : ''}</tr>`;
}
