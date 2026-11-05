// Ported from Thirty Day Readmissions (web/src/js/views/explainer.js at 33d1959).
// Worksheet R: CMS's calculation of one hospital's payment adjustment factor, line by line, kept as the old site had it:
// fields A to C, lines 1 to 6 for each condition (with the reason a row does not count), lines 7 to 9, CMS's own factor and
// whether the two agree, and the dollars line. worksheetRows is pure; worksheetHtml draws it on the server. waterfallData
// is the numbers for the figure that shows the parts adding up to the cap (not drawn yet).
import { CAP, CAP_PCT, CONDS, MIN_DISCHARGES, PEERS, WEIGHT_MISSING, condState, contrib, peerMedian, round4, weightPublished } from '../../../engine/js/hrrp/formula.js';
import { formField, formTitle, printout } from '../../../web/render/components.js';
import { placeText } from '../../../web/render/format.js';
import { html } from '../../../web/render/html.js';
import { conditionShort } from './derive.js';
import { hospitalPath } from './links.js';
import { fmtInt, fmtMoney, fmtPct, points, ratio } from './numbers.js';
import { fill, t } from './program/copy.js';

// The last digit can differ from a hand calculation (the note under the table); the note's words are in the copy.
export const WORKSHEET_NOTE = fill('wsNote', { a: '4', b: '6' });

// The class on Worksheet R's lettered fields (A to C), which tells them from a record card's numbered ones.
export const SHEET_FIELD = 'field--sheet';

// Line 4 for a counted condition: the stored excess (line 2 minus line 3) to four decimals, or "< 0.0001" when it is above
// zero but prints as 0.0000.
export const excessText = (err, med) => {
  const s = (err - med).toFixed(4);
  return s === '0.0000' ? `< ${ratio(0.0001)}` : `+${s}`;
};

// The worksheet's last check: does line 9 match CMS's factor. cms: worksheetRows().cms.
export const factorCheck = ({ matches, diff }) => (matches ? t('wsMatches') : fill('wsDiffers', { gap: diff.toFixed(4) }));


// h: a hospital row with withDerived's place.
// -> { fields: [A, B, C], lines, totals: { sum, capped, reduction, factor }, cms: { factor, matches, diff }, dollars }
export function worksheetRows(h, meta) {
  const r = contrib(h, meta);
  const lines = CONDS.map((cond) => {
    const c = h.c[cond];
    const med = peerMedian(meta, h.peer, cond);
    const state = condState(h, cond, meta, r.byCond);
    const counted = state === 'counted' && r.byCond[cond] > 0;
    const reasons = {
      none: t('wsNone'),
      few: fill('wsFew', { n: String(MIN_DISCHARGES) }),
      below: t('wsBelow'),
      counted: weightPublished(c) ? t('wsRounds') : WEIGHT_MISSING,
    };
    return {
      cond, n: c?.n ?? 0, err: c?.err ?? null, med, excess: counted ? c.err - med : null,
      weight: c?.ratio ?? null, part: counted ? r.byCond[cond] : 0, reason: counted ? null : reasons[state],
    };
  });
  const diff = Math.abs(r.paf - h.paf);
  return {
    fields: [
      { no: 'A', label: t('wsFieldHospital'), value: h.name, id: h.id, note: fill('wsFieldHospitalNote', { place: h.place ?? placeText({ city: h.city, state: h.st }), ccn: h.id }) },
      { no: 'B', label: t('wsFieldPeer'), value: fill('wsFieldPeerValue', { peer: String(h.peer), of: String(PEERS.length) }), note: fill('wsFieldPeerNote', { dual: fmtPct(h.dual * 100, 1) }) },
      { no: 'C', label: t('wsFieldNm'), value: ratio(meta.nm), note: t('wsFieldNmNote') },
    ],
    lines,
    totals: { sum: r.sum, capped: r.sum > CAP, reduction: round4(r.reduction), factor: r.paf },
    cms: { factor: h.paf, matches: diff < 1e-9, diff },
    dollars: h.pen ?? null,
  };
}

// rows: worksheetRows(). compact: no dollars line (the hospital page). dollars: { payShort, tag } for the dollars line;
// edition: the title bar's right side; conditions: { key, short } for the row labels.
export function worksheetHtml(rows, { compact = false, dollars = null, edition = null, conditions = [] } = {}) {
  const { lines, totals, cms } = rows;
  const [fa, fb, fc] = rows.fields;
  const head = (n, label) => html`<th scope="col" class="num">${fill('wsLine', { n: String(n) })}<br>${label}</th>`;
  const body = lines.map((l) => html`<tr class="${l.reason === null ? 'is-on' : 'is-off'}">
<th scope="row">${conditionShort(conditions, l.cond)}</th>
<td class="num">${l.n ? fmtInt(l.n) : '—'}</td>
<td class="num">${ratio(l.err)}</td>
<td class="num">${ratio(l.med)}</td>
<td class="num">${l.reason === null ? excessText(l.err, l.med) : l.reason}</td>
<td class="num">${ratio(l.weight)}</td>
<td class="num strong">${l.reason === null ? `${points(l.part)}%` : '0'}</td>
</tr>`);
  const pay = dollars && !compact
    ? html`<li><span>${fill('wsDollars', { pay: dollars.payShort })}</span><b>${rows.dollars != null ? html`${fill('wsDollarsValue', { money: fmtMoney(rows.dollars) })}${dollars.tag}` : t('wsDollarsNone')}</b></li>`
    : '';
  return html`<div class="wsr">
<div class="form wsr__id">
${formTitle(t('wsTitle'), edition)}
${formField({ no: fa.no, label: fa.label, value: html`<a href="${hospitalPath(fa.id)}">${fa.value}</a>`, note: fa.note, size: 'sm', fieldCls: SHEET_FIELD })}
${formField({ no: fb.no, label: fb.label, value: fb.value, note: fb.note, size: 'sm', fieldCls: SHEET_FIELD })}
${formField({ no: fc.no, label: fc.label, value: fc.value, note: fc.note, size: 'sm', fieldCls: SHEET_FIELD })}
</div>
${printout(html`<table class="gb wsr__table">
<thead><tr><th scope="col">${t('wsColCondition')}</th>${head(1, t('wsColCases'))}${head(2, t('wsColRatio'))}${head(3, t('wsColMedian'))}${head(4, fill('wsColExcess', { a: '2', b: '3' }))}${head(5, t('wsColWeight'))}${head(6, fill('wsColPart', { c: 'C', a: '4', b: '5' }))}</tr></thead>
<tbody>
${body}
</tbody>
</table>`)}
<p class="wsr__note">${WORKSHEET_NOTE}</p>
<ol class="wsr__totals">
<li><span>${fill('wsLineSum', { n: '7', m: '6' })}</span><b>${points(totals.sum)}%</b></li>
<li><span>${fill('wsLineCap', { n: '8', m: '7', cap: String(CAP_PCT) })}</span><b>${fmtPct(totals.reduction * 100)}</b></li>
<li><span>${fill('wsLineFactor', { n: '9', m: '8', one: '1' })}</span><b>${ratio(totals.factor)}</b></li>
<li class="wsr__check"><span>${t('wsCms')}</span><b>${ratio(cms.factor)} ${factorCheck(cms)}</b></li>
${pay}
</ol>
</div>`;
}

// The waterfall's numbers: each condition's part in order with the running total, the sum (line 7), the cap and whether it
// binds, the rounded line 8, and the figure's table. conditions (optional): { key, short } for the labels.
export function waterfallData(rows, conditions = []) {
  let running = 0;
  const parts = rows.lines.map((l) => {
    running += l.part;
    return { cond: l.cond, label: conditionShort(conditions, l.cond), part: l.part, why: l.reason, running };
  });
  const { sum, capped, reduction } = rows.totals;
  const table = [
    ...parts.map((p) => [p.label, p.why ?? points(p.part), points(p.running)]),
    [fill('wfSum', { n: '7' }), '', points(sum)],
    [fill('wfCap', { cap: String(CAP_PCT) }), '', points(CAP)],
    [fill('wfCut', { n: '8' }), '', points(reduction)],
  ];
  return { parts, sum, cap: CAP, binds: capped, line8: reduction, rows: table };
}
