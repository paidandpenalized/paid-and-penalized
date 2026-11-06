// One row of a hospital table: the hospital with its place, the cut with a bar behind it, modeled dollars, peer group and the
// six-condition glyph (with the counted conditions in words for a screen reader). The place page's hospitals table adds beds, the
// hospital page's area table a rank and a mark on this hospital. The place page writes the first page of rows with it and the
// page's script writes the rest, so the two are one definition (as Worksheet R's rows are).
import { CAP_PCT } from '../../../../engine/js/hrrp/formula.js';
import { placeText } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { hospitalPath } from '../links.js';
import { fmtInt, fmtMoney, fmtPct } from '../numbers.js';
import { glyph, glyphSpoken } from './glyph.js';

// r: { h (id, name, city, st, red, pen, peer, beds), states (each condition's state in program order), rank (1-based, unique on the page) };
// conditions: the edition's [{ key, short }]. options: prefix (the glyph's id prefix, unique per table on a page); rank (a rank column
// first); current (the words that mark this row's hospital as the page's own, or null); beds (a beds column last).
export function hospitalRow(r, conditions, { prefix = 'ph', rank = false, current = null, beds = true } = {}) {
  const { h } = r;
  const mark = current === null ? '' : html`<span class="nb__here">${current}</span>`;
  return html`<tr${current === null ? '' : html` class="is-current" aria-current="true"`}>${rank ? html`<td class="num nb__rank">${String(r.rank)}</td>` : ''}<th scope="row"><a href="${hospitalPath(h.id)}">${h.name}</a>${current === null ? '' : ' '}${mark}<span class="nb__place">${placeText({ city: h.city, state: h.st })}</span></th><td class="num nb__cut"><span class="nb__bar" style="--w: ${Math.min(100, (h.red / CAP_PCT) * 100).toFixed(1)}" aria-hidden="true"></span><span>${fmtPct(h.red)}</span></td><td class="num">${fmtMoney(h.pen)}</td><td class="num">${String(h.peer)}</td><td><span class="pen__glyph">${glyph(r, r.rank, conditions, prefix)}</span><span class="vh">${glyphSpoken(r, conditions)}</span></td>${beds ? html`<td class="num">${h.beds == null ? '—' : fmtInt(h.beds)}</td>` : ''}</tr>`;
}
