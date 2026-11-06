// One row of a place page's hospitals table: the hospital with its place, the cut with a bar behind it, modeled dollars, peer group, the
// six-condition glyph (with the counted conditions in words for a screen reader) and beds. The place page writes the first page of rows
// with it and the page's script writes the rest, so the two are one definition (as Worksheet R's rows are).
import { CAP_PCT } from '../../../../engine/js/hrrp/formula.js';
import { listText, placeText } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { hospitalPath } from '../links.js';
import { fmtInt, fmtMoney, fmtPct } from '../numbers.js';
import { fill, t } from '../place/copy.js';
import { countedNames, glyph } from './glyph.js';

// r: { h (id, name, city, st, red, pen, peer, beds), states (each condition's state in program order), rank (1-based, unique on the page) };
// conditions: the edition's [{ key, short }].
export function hospitalRow(r, conditions) {
  const { h } = r;
  const names = countedNames(r, conditions);
  return html`<tr><th scope="row"><a href="${hospitalPath(h.id)}">${h.name}</a><span class="nb__place">${placeText({ city: h.city, state: h.st })}</span></th><td class="num nb__cut"><span class="nb__bar" style="--w: ${Math.min(100, (h.red / CAP_PCT) * 100).toFixed(1)}" aria-hidden="true"></span><span>${fmtPct(h.red)}</span></td><td class="num">${fmtMoney(h.pen)}</td><td class="num">${String(h.peer)}</td><td><span class="pen__glyph">${glyph(r, r.rank, conditions, 'ph')}</span><span class="vh">${names.length ? fill('hosCondsSpoken', { list: listText(names) }) : t('hosCondsNone')}</span></td><td class="num">${h.beds == null ? '—' : fmtInt(h.beds)}</td></tr>`;
}
