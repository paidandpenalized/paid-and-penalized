// Step 4, one hospital: in the words column, the page's hospital's record card (who it is, the stamp, the scenario's three
// cases or the reason it has none, its own FY cost report, and its Medicare penalties beside the scenario, never added);
// beside it, Figure 4: one nested bar on one dollar scale (the hospital's total patient revenue, the Medicaid revenue
// inside it, the expansion adults' part of that, and the part the case takes), the expansion part enlarged under it with
// the other two cases' ends dashed, then the four factor rows the loss multiplies, each beside the state's other hospitals
// with a loss to draw (a rug, and a mark for this one). A hospital with no loss to draw (outside a scenario state, no
// Medicaid or patient revenue, a cost report screened out, no cost report, or not in the file at all) gets its reason and
// no figure: never a bar, "$0" or an empty table. Shared by the build (the server draws the hospital with the median loss
// in the middle case, outside DEFAULT_SKIP_STATE, at the default use rate) and the browser (client/hospital.js redraws
// it for the page's hospital, case and use rate). Pure: no DOM, file or clock.
//
// Data: one asset per state or territory (hospChunks), fetched when the page's hospital is there: its hospitals' cost
// report fields the engine reads, their penalties, whether each has a hub page and whether step 1 draws it, with the
// state's own numbers. A hospital's dollars come from the engine (engine/js/medicaid/scenario.js) at the reader's use
// rate, so the default rate prints what the file's arithmetic gives, the same in the build and the browser.
import { scenario } from '../../../../engine/js/medicaid/scenario.js';
import { figure, imagePair, num } from '../../../../web/charts/figure.js';
import { frame, r2 } from '../../../../web/charts/svg.js';
import { textWidth } from '../../../../web/charts/text.js';
import { COPY as SHARED } from '../../../../web/copy.js';
import { estTag, fillCopy, formField, formTitle, stamp } from '../../../../web/render/components.js';
import { count, dotList, money, pct, placeText, shortIsoDate } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { scenarioTag } from '../../../../web/render/shell.js';
import { SITE, hospitalPathOf } from '../../../../web/site.js';
import { DEFAULT_SCENARIO, DEFAULT_SKIP_STATE, SCENARIOS } from '../constants.js';
import { fill, t } from '../copy.js';
import { scenWord } from './ranges.js';
import { placeAt } from './strips.js';

const MIDDLE = SCENARIOS.indexOf(DEFAULT_SCENARIO);
const caseWord = (k) => scenWord(SCENARIOS[k]).toLowerCase();

// ---------- the data ----------

// What step 4 reads of each hospital in the file: the engine's fields (scenario.js), who it is beyond the strips' row, its
// cost report's status and period, its flags (the reason it has no loss to draw) and its FY Medicare penalties. Each row
// adds hub (1 when /hospital/<ccn>/ exists) and drawn (1 when step 1 draws it: a loss to draw).
export const HOSP_COLS = Object.freeze(['ccn', 'kind', 'beds', 'own', 'status', 'period_begin', 'period_end', 'flags', 'medicaid_net_revenue',
  'net_patient_revenue', 'share', 'cost_ratio', 'has_margin', 'net_income_patients', 'other_operating_income', 'net_income', 'other_income',
  'uncompensated_cost', 'scored', 'hrrp', 'hac']);
const CHUNK_COLS = Object.freeze([...HOSP_COLS, 'hub', 'drawn']);

// One asset per state or territory with a hospital in the file, by code (sorted): { code, name, cls, viii (CMS-64's
// expansion share; null without), declines (by case; null without a scenario), fy (the cost reports' year), penaltyFy,
// cols, rows }. data: loadMedicaid()'s result; rows: hospitalRows(data); hubCcns: the CCNs with a hub page.
export function hospChunks(data, rows, hubCcns = new Set()) {
  const col = Object.fromEntries(data.columns.map((name, i) => [name, i]));
  const drawnCcns = new Set(rows.filter((r) => r.share).map((r) => r.ccn));
  const out = new Map();
  for (const row of data.hospitals.values()) {
    const code = row[col.state];
    if (!out.has(code)) {
      const st = data.states[code];
      if (!st) throw new RangeError(`work requirement: a hospital's state, ${code}, is not in the file's states`);
      out.set(code, { code, name: st.name, cls: st.cls, viii: st.viii_share, declines: st.declines, fy: data.meta.fy, penaltyFy: data.meta.penaltyFy, cols: CHUNK_COLS, rows: [] });
    }
    const ccn = row[col.ccn];
    out.get(code).rows.push([...HOSP_COLS.map((name) => row[col[name]]), hubCcns.has(ccn) ? 1 : 0, drawnCcns.has(ccn) ? 1 : 0]);
  }
  return new Map([...out].sort(([a], [b]) => (a < b ? -1 : 1)));
}

// An asset back as { code, name, cls, viii, declines, fy, penaltyFy, recs: Map(ccn → { ...CHUNK_COLS, hub, drawn as
// booleans }) }. Throws on anything the build did not write.
export function decodeChunk(asset) {
  if (!asset || asset.cols?.join() !== CHUNK_COLS.join() || !Array.isArray(asset.rows) || typeof asset.code !== 'string') {
    throw new TypeError('hospital asset: not what the build wrote');
  }
  const recs = new Map(asset.rows.map((row) => {
    const rec = Object.fromEntries(CHUNK_COLS.map((name, i) => [name, row[i]]));
    rec.hub = rec.hub === 1;
    rec.drawn = rec.drawn === 1;
    return [rec.ccn, rec];
  }));
  const { code, name, cls, viii, declines, fy, penaltyFy } = asset;
  return { code, name, cls, viii, declines, fy, penaltyFy, recs };
}

// The hub's hospitals the file leaves out (data.js loadAway's [ccn, name, city, state, why]) as rows the page's state can
// hold: no class, no groups, no dot, and why they are away.
export const awayRows = (away) => away.map(([ccn, name, city, state, why]) => ({ ccn, name, city, state, cls: null, groups: 0, share: null, away: why }));

// ---------- the hospital ----------

// What step 4 draws for the page's hospital. row: the page's state's hospital (a strips row, or an awayRows row); chunk:
// its state's decoded asset (null for an away row).
export function subjectOf(row, chunk) {
  if (row.away) return { ccn: row.ccn, name: row.name, city: row.city, stateName: null, state: row.state, cls: null, away: row.away, rec: null, chunk: null, hub: true };
  const rec = chunk?.recs.get(row.ccn);
  if (!rec) throw new RangeError(`hospital ${row.ccn}: not in its state's asset`);
  return { ccn: row.ccn, name: row.name, city: row.city, stateName: chunk.name, state: row.state, cls: row.cls, away: null, rec, chunk, hub: rec.hub };
}

// Why a hospital has no figure, or null when it has a loss to draw: away_<why> (not in the file), its class (outside a
// scenario state, or no cost report), or, in a scenario state, what its cost report shows: a filing error screened out
// (negative, exceeds), no Medicaid revenue, no patient revenue, or a loss too small to draw (tiny).
export function reasonOf(s) {
  if (s.away) return `away_${s.away}`;
  if (s.cls !== 'scenario') return s.cls;
  const r = s.rec;
  if (r.drawn) return null;
  if (!r.scored) return r.flags.includes('negative_medicaid_revenue') ? 'negative' : 'exceeds';
  if (!(r.medicaid_net_revenue > 0)) return 'no_medicaid';
  if (!(r.net_patient_revenue > 0)) return 'no_npr';
  return 'tiny';
}
// The stamp a reason gets (copy hStamp_<group>).
const STAMP = {
  away_inactive: 'away', away_kind: 'away', not_expansion: 'none', no_viii_group: 'none', all_payer: 'notModeled', territory: 'notModeled',
  no_cost_report: 'noReport', negative: 'screened', exceeds: 'screened', no_medicaid: 'noLoss', no_npr: 'noLoss', tiny: 'noLoss',
};
export const REASONS = Object.freeze(Object.keys(STAMP));
// The reason's sentence.
const WHY_VALUES = {
  away_inactive: () => ({}), away_kind: () => ({}), all_payer: () => ({}), territory: () => ({}),
  not_expansion: (s) => ({ state: s.stateName }), no_viii_group: (s) => ({ state: s.stateName }),
};
export const whyOf = (s, reason) => fill(`hWhy_${reason}`, (WHY_VALUES[reason] ?? ((x) => ({ fy: String(x.chunk.fy) })))(s));

// A drawn hospital's numbers at a use rate: patient revenue (npr), Medicaid revenue (m2), Medicaid's share of patient
// revenue (ms), the expansion share (es), the expansion adults' part (exp, the engine's revenue at risk), the state's
// declines and the engine's result for each case, its loss and its share of patient revenue lost by case.
export function numbersOf(s, use) {
  const r = s.rec;
  const declines = SCENARIOS.map((sc) => s.chunk.declines[sc]);
  const results = declines.map((d) => scenario(r, r.share, d, { use }));
  const npr = r.net_patient_revenue;
  return {
    npr, m2: r.medicaid_net_revenue, ms: r.medicaid_net_revenue / npr, es: r.share, exp: results[0].atRisk, declines, use, results,
    lost: results.map((x) => x.lost), share: results.map((x) => x.lost / npr),
  };
}

// The state's other hospitals with a loss to draw, each on the same four factors: ms, es and its share lost by case.
export function peersOf(s, use) {
  const out = [];
  for (const r of s.chunk.recs.values()) {
    if (!r.drawn || r.ccn === s.ccn) continue;
    const ms = r.medicaid_net_revenue / r.net_patient_revenue;
    out.push({ ms, es: r.share, lp: SCENARIOS.map((sc) => ms * r.share * s.chunk.declines[sc] * use) });
  }
  return out;
}

// ---------- picking a hospital ----------

// The hospitals a page may open on, and that "show another at random" draws from: drawn in step 1, in a scenario state,
// outside DEFAULT_SKIP_STATE. rows: the strips' rows.
export const defaultPool = (rows) => rows.filter((r) => r.share && r.cls === 'scenario' && r.state !== DEFAULT_SKIP_STATE);

// One of the pool at random (rng: a function giving [0, 1)), never the hospital not names (the one shown) when another
// is there; null from an empty pool.
export function randomPick(pool, rng = Math.random, not = null) {
  const from = not && pool.length > 1 ? pool.filter((r) => r.ccn !== not) : pool;
  return from.length ? from[Math.floor(rng() * from.length)] : null;
}

// The hospital the server draws: the pool's median by its share of patient revenue lost in the middle case (the lower of
// the middle two; ties by CCN). rows: the strips' rows.
export function serverPick(rows) {
  const pool = defaultPool(rows).sort((a, b) => a.share[MIDDLE] - b.share[MIDDLE] || (a.ccn < b.ccn ? -1 : 1));
  return pool[Math.floor((pool.length - 1) / 2)] ?? null;
}

// ---------- Figure 4: the nested bar ----------

// The labels' faces (styles.css .wr-hb__*): each <text> one class, one size, so the fit test measures it as drawn.
export const HB_FONTS = Object.freeze({
  'wr-hb__main': { size: 12, mono: false },
  'wr-hb__note': { size: 11, mono: false },
  'wr-hb__loss': { size: 12, mono: false },
  'wr-hb__zoom': { size: 10.5, mono: true },
});
const widthOf = (cls, text) => textWidth(text, HB_FONTS[cls].size, { mono: HB_FONTS[cls].mono });

// The two drawings: the phone's (the kit's 300 across) and the wide one (the stage's width at 1280 and 1440). L, R: the
// margins; bar: the nested bar's top and height, inset: each bar's inset in the one before it; the zoom: the enlarged
// expansion part's box top and height, the room its ×z label leaves at least (zx) and the widest it is drawn (zwMax);
// rows: each label's baseline (two lines where the phone needs them).
export const HB_DRAWINGS = Object.freeze({
  narrow: {
    width: 300, height: 252, L: 1, R: 1, bar: [66, 50], inset: 6, box: [152, 44], zx: 31, zwMax: 264,
    rows: { total: [13, 27], med: [45, 59], exp: [132, 146], lost: [216, 230, 244] },
  },
  wide: {
    width: 680, height: 208, L: 1, R: 1, bar: [40, 54], inset: 6, box: [120, 46], zx: 35, zwMax: 420,
    rows: { total: [14], med: [32], exp: [114], lost: [184, 200] },
  },
});

// A decline at the fewest places that show it (17%, 21.3%).
const shortPct = (v) => pct(v, [0, 1, 2].find((dp) => Math.abs(Math.round(v * 10 ** (dp + 2)) - v * 10 ** (dp + 2)) < 1e-9) ?? 2);
const statusWord = (status) => t(`hStatus_${status === 'settled' ? 'settled' : 'as_filed'}`);

// The drawing's layout for a drawn hospital's numbers (numbersOf), in case k at the numbers' use rate: { geo, rects,
// lines, labels: [{ cls, x, y, anchor, text }] }. Every label is placed by strips.js's rule (placeAt: right of its mark,
// else left, else against the nearer margin), a block of lines by its widest, so each stays inside the drawing; the fit
// test holds every hospital, case, use rate and drawing to it.
export function barLayout(n, { k, use, drawing, status }) {
  const g = HB_DRAWINGS[drawing];
  const { width: W, L, R, inset: i } = g;
  const span = [L, W - R];
  const U = W - L - R;
  const [barTop, barH] = g.bar;
  const [boxTop, boxH] = g.box;
  const panelTop = boxTop + 4;
  const panelH = boxH - 8;
  const narrow = drawing === 'narrow';
  const d = n.declines[k];
  const w2 = U * n.ms;
  const w3 = w2 * n.es;
  const w4 = w3 * d * use;
  // The zoom: a whole multiple of the expansion part, as wide as the room allows once its label has its place.
  const zoomOf = (zx) => Math.max(1, Math.floor(Math.min(g.zwMax, W - R - 4 - zx) / w3));
  let zx = g.zx;
  let z = zoomOf(zx);
  const zoomText = () => fill('hBarZoom', { z: count(z) });
  zx = Math.max(g.zx, L + widthOf('wr-hb__zoom', zoomText()) + 8);
  z = zoomOf(zx);
  const zw = w3 * z;
  const lw = zw * d * use;
  const lx = zx + lw / 2;

  const labels = [];
  const block = (x, ys, lines, gap) => {
    const p = placeAt(x, Math.max(...lines.map(([cls, text]) => widthOf(cls, text))), { gap, span });
    lines.forEach(([cls, text], j) => labels.push({ cls, x: p.x, y: ys[j], anchor: p.anchor, text }));
  };
  const total = fill('hBarTotal', { v: money(n.npr) });
  const measured = fill('hBarMeasured', { status: statusWord(status) });
  if (narrow) block(L, g.rows.total, [['wr-hb__main', total], ['wr-hb__note', measured]], 0);
  else {
    block(L, g.rows.total, [['wr-hb__main', total]], 0);
    labels.push({ cls: 'wr-hb__note', x: W - R, y: g.rows.total[0], anchor: 'end', text: measured });
  }
  const ms = pct(n.ms, 1);
  const es = pct(n.es, 1);
  block(L + w2, g.rows.med, narrow
    ? [['wr-hb__main', fill('hBarMedicaidShort', { v: money(n.m2), share: ms })], ['wr-hb__note', t('hBarMedicaidOf')]]
    : [['wr-hb__main', fill('hBarMedicaid', { v: money(n.m2), share: ms })]], 6);
  block(zx, g.rows.exp, narrow
    ? [['wr-hb__main', fill('hBarExpShort', { v: money(n.exp) })], ['wr-hb__note', fill('hBarExpOf', { share: es })]]
    : [['wr-hb__main', fill('hBarExp', { v: money(n.exp), share: es })]], 0);
  const lost = { v: money(-n.lost[k]), scenario: caseWord(k), dc: shortPct(d) };
  const share = use === 1 ? fill('hBarShare', { share: pct(n.share[k], 2) }) : fill('hBarShareUse', { share: pct(n.share[k], 2), use: pct(use, 0) });
  const range = fill('hBarRange', { low: money(-n.lost[0]), high: money(-n.lost[SCENARIOS.length - 1]) });
  block(lx, g.rows.lost, narrow
    ? [['wr-hb__loss', fill('hBarLostShort', lost)], ['wr-hb__note', share], ['wr-hb__note', range]]
    : [['wr-hb__loss', fill('hBarLost', lost)], ['wr-hb__note', `${share} · ${range}`]], 0);
  labels.push({ cls: 'wr-hb__zoom', x: L, y: panelTop + panelH / 2 + 4, anchor: 'start', text: zoomText() });

  const rects = [
    { cls: 'wr-hb__npr', x: L, y: barTop, w: U, h: barH },
    { cls: 'wr-hb__m2', x: L, y: barTop + i, w: w2, h: barH - 2 * i },
    { cls: 'wr-hb__exp', x: L, y: barTop + 2 * i, w: w3, h: barH - 4 * i },
    { cls: 'wr-hb__lost', x: L, y: barTop + 3 * i, w: w4, h: barH - 6 * i },
    { cls: 'wr-hb__box', x: zx - 4, y: boxTop, w: zw + 8, h: boxH },
    { cls: 'wr-hb__exp', x: zx, y: panelTop, w: zw, h: panelH },
    { cls: 'wr-hb__lost', x: zx, y: panelTop + 6, w: lw, h: panelH - 12 },
  ];
  const expBottom = barTop + barH - 2 * i;
  const medTop = barTop + i;
  const lines = [
    { cls: 'wr-hb__leader', x1: L + w2, y1: g.rows.med[0] + 4, x2: L + w2, y2: medTop },
    { cls: 'wr-hb__link', x1: L, y1: expBottom, x2: zx - 4, y2: boxTop },
    { cls: 'wr-hb__link', x1: L + w3, y1: expBottom, x2: zx + zw + 4, y2: boxTop },
    ...SCENARIOS.map((_, j) => j).filter((j) => j !== k).map((j) => {
      const x = zx + zw * n.declines[j] * use;
      return { cls: 'wr-hb__tick', x1: x, y1: panelTop + 2, x2: x, y2: panelTop + panelH - 2 };
    }),
    { cls: 'wr-hb__leader', x1: lx, y1: panelTop + panelH - 6, x2: lx, y2: g.rows.lost[0] - 12 },
  ];
  return { geo: g, rects, lines, labels };
}

export function barBody({ rects, lines, labels }) {
  return html`${rects.map((r) => html`<rect class="${r.cls}" x="${r2(r.x)}" y="${r2(r.y)}" width="${r2(Math.max(0, r.w))}" height="${r2(r.h)}"/>`)}
${lines.map((l) => html`<line class="${l.cls}" x1="${r2(l.x1)}" y1="${r2(l.y1)}" x2="${r2(l.x2)}" y2="${r2(l.y2)}"/>`)}
${labels.map((l) => html`<text class="${l.cls} chart-label--halo" x="${r2(l.x)}" y="${r2(l.y)}"${l.anchor === 'start' ? '' : html` text-anchor="${l.anchor}"`}>${l.text}</text>`)}`;
}

// ---------- Figure 4: the factor rows ----------

// A rug: each other hospital's value a tick on a line from the lowest to the highest (this one's included), this one's a
// heavier mark. Stretched to the row's width, so its strokes don't scale.
const RUG_W = 200;
function rug(values, v) {
  const lo = Math.min(v, ...values);
  const hi = Math.max(v, ...values);
  const x = (q) => r2(4 + ((q - lo) / (hi - lo)) * (RUG_W - 8));
  const ticks = [...new Set(values.map(x))].map((at) => `M${at} 6V18`).join('');
  return html`<svg class="wr-rug" viewBox="0 0 ${RUG_W} 24" preserveAspectRatio="none" aria-hidden="true" focusable="false"><line class="wr-rug__line" x1="4" x2="${RUG_W - 4}" y1="12" y2="12"/><path class="wr-rug__ticks" d="${ticks}"/><line class="wr-rug__me" x1="${x(v)}" x2="${x(v)}" y1="1" y2="23"/></svg>`;
}

// The four factors: { label, value, note, values (the state's other hospitals' on the same factor; null where every
// hospital has the same), rank (the copy for "higher than k of them") }.
export function factorsOf(s, n, { k, use }) {
  const peers = peersOf(s, use);
  const d = n.declines[k];
  return [
    { label: t('hFac1'), v: n.ms, text: pct(n.ms, 1), note: t('hFac1Note'), values: peers.map((p) => p.ms), fmt: (q) => pct(q, 1), rank: 'hHigher' },
    { label: t('hFac2'), v: n.es, text: pct(n.es, 1), note: fill('hFac2Note', { viii: pct(s.chunk.viii, 1) }), values: peers.map((p) => p.es), fmt: (q) => pct(q, 1), rank: 'hHigher' },
    {
      label: fill(use === 1 ? 'hFac3' : 'hFac3Use', { scenario: caseWord(k) }),
      v: d * use,
      text: shortPct(d * use),
      note: use === 1 ? t('hFac3Note') : fill('hFac3NoteUse', { dc: shortPct(d), use: pct(use, 0) }),
      values: null,
    },
    { label: t('hFac4'), v: n.share[k], text: pct(n.share[k], 2), note: t('hFac4Note'), values: peers.map((p) => p.lp[k]), fmt: (q) => pct(q, 2), rank: 'hLarger' },
  ];
}

export function factorsHtml(s, n, view) {
  return html`${factorsOf(s, n, view).map((f) => {
    const spread = f.values && f.values.length && Math.max(f.v, ...f.values) - Math.min(f.v, ...f.values) > 1e-12;
    const rank = f.values && f.values.length ? fill(f.rank, { k: count(f.values.filter((q) => q < f.v).length), n: count(f.values.length) }) : '';
    const lo = spread ? Math.min(f.v, ...f.values) : 0;
    const hi = spread ? Math.max(f.v, ...f.values) : 0;
    return html`<div class="wr-fac"><p class="wr-fac__h"><span>${f.label}</span> <b>${f.text}</b></p>
<p class="wr-fac__n">${f.note}${rank ? ` ${rank}` : ''}</p>${spread ? html`
<div class="wr-fac__rug" aria-hidden="true"><span>${f.fmt(lo)}</span>${rug(f.values, f.v)}<span>${f.fmt(hi)}</span></div>` : ''}</div>`;
  })}`;
}

// ---------- the figure's parts ----------

// What Figure 4 shows for a hospital in a view ({ k, use }): its caption's words (cap), its text alternative (alt), the
// two drawings' insides (narrow, wide: null without a figure), the factor rows (facs), the reason panel (none: null with
// a figure), the note under it, and the table's cells by row and case (cells: [row id, k, { text, value }]).
const TABLE_ROWS = ['npr', 'm2', 'exp', 'lost', 'share'];
export function figureParts(s, { k, use }) {
  const reason = reasonOf(s);
  const none = { text: t('stNoNumber'), value: null };
  if (reason) {
    return {
      reason,
      cap: fill('hTakeawayNone', { name: s.name }),
      alt: fill('hTakeawayNone', { name: s.name }),
      narrow: null,
      wide: null,
      facs: null,
      none: html`${stamp({ label: t(`hStamp_${STAMP[reason]}`), ink: true })}<p class="wr-hnone__why">${whyOf(s, reason)}</p>`,
      note: '',
      cells: TABLE_ROWS.flatMap((row) => SCENARIOS.map((_, j) => [row, j, none])),
    };
  }
  const n = numbersOf(s, use);
  const status = s.rec.status;
  const peers = [...s.chunk.recs.values()].filter((r) => r.drawn && r.ccn !== s.ccn).length;
  const noteWords = { n: count(peers), state: s.stateName };
  const value = { npr: () => n.npr, m2: () => n.m2, exp: () => n.exp, lost: (j) => -n.lost[j], share: (j) => -n.share[j] };
  const text = { npr: money, m2: money, exp: money, lost: money, share: (v) => pct(v, 2) };
  return {
    reason: null,
    cap: fill('hTakeaway', { name: s.name }),
    alt: fill('hAlt', {
      npr: money(n.npr), medicaid: money(n.m2), ms: pct(n.ms, 1), exp: money(n.exp), es: pct(n.es, 1), lost: money(-n.lost[k]), scenario: caseWord(k), share: pct(n.share[k], 2),
    }),
    narrow: barBody(barLayout(n, { k, use, drawing: 'narrow', status })),
    wide: barBody(barLayout(n, { k, use, drawing: 'wide', status })),
    facs: factorsHtml(s, n, { k, use }),
    none: null,
    note: fill(peers === 0 ? 'hNoteAlone' : peers === 1 ? 'hNoteOne' : 'hNote', noteWords),
    cells: TABLE_ROWS.flatMap((row) => SCENARIOS.map((_, j) => {
      const v = value[row](j);
      return [row, j, num(text[row](v), v)];
    })),
  };
}

// ---------- the record card ----------

const ownWord = (own) => ({ Government: 'hOwn_Government', Nonprofit: 'hOwn_Nonprofit', 'For-profit': 'hOwn_Forprofit' })[own];
const kindWord = (kind) => t(`stKind_${kind === 'critical_access' ? 'critical_access' : 'acute'}`);
const scenTagText = (fy) => fillCopy(SHARED, 'scenarioTag', { year: String(fy) });
const measuredTag = (status) => html`<span class="wr-tag">${fill('hMeasured', { status: statusWord(status) })}</span>`;
// A measured amount: none reported (blank or zero) in words, never "$0".
const measuredMoney = (v) => (v === null || v === 0 ? t('hNoneReported') : money(v));
const marginText = (v) => (v === null || v === undefined ? t('stNoNumber') : pct(v, 1));

// The card's lines: who it is and where, and what it is.
function whereOf(s) {
  const r = s.rec;
  const parts = [placeText({ city: s.city, state: s.stateName ?? s.state })];
  if (r) {
    parts.push(kindWord(r.kind));
    if (r.beds !== null) parts.push(r.beds === 1 ? t('hBedsOne') : fill('hBeds', { n: count(r.beds) }));
    if (ownWord(r.own)) parts.push(t(ownWord(r.own)));
  }
  return dotList(parts.filter(Boolean));
}

// The stamp: the case's loss a year, in the penalty ink, with its case and the scenario tag; or, in ink, why there is none.
function stampOf(s, n, k, reason) {
  if (reason) return stamp({ label: t(`hStamp_${STAMP[reason]}`), ink: true });
  return stamp({ label: html`${fill('hStampLost', { lost: money(-n.lost[k]) })}<small>${fill('hStampCase', { scenario: scenWord(SCENARIOS[k]) })} · ${scenTagText(s.chunk.fy)}</small>` });
}

// The scenario's three cases for a drawn hospital: revenue lost, its share of patient revenue, the care still given and
// now uncompensated (none where the cost report gives no Medicaid cost to price it), and the margins after (none without
// a usable margin).
function scenarioTable(s, n, k) {
  const cell = (j, text) => html`<td class="${j === k ? 'on' : ''}">${text}</td>`;
  const row = (key, f) => html`<tr><th scope="row">${t(key)}</th>${n.results.map((x, j) => cell(j, f(x, j)))}</tr>`;
  return html`<div class="field field--wide wr-rec__sec">
<p class="field__label">${t('hScenHead')} ${scenarioTag(s.chunk.fy)}</p>
<table class="wr-rec__t"><thead><tr><td></td>${SCENARIOS.map((sc, j) => html`<th scope="col" class="${j === k ? 'on' : ''}">${scenWord(sc)}</th>`)}</tr></thead>
<tbody>${row('hRowLost', (x) => money(-x.lost))}
${row('hRowShare', (x) => pct(-x.lost / n.npr, 2))}
${row('hRowAdded', (x) => (x.addedUncompensated > 0 ? money(x.addedUncompensated, { sign: true }) : t('stNoNumber')))}
${row('hRowOm', (x) => marginText(x.operatingMarginAfter))}
${row('hRowTm', (x) => marginText(x.totalMarginAfter))}</tbody></table>
</div>`;
}

// The hospital's own cost report, measured: its Medicaid and patient revenue, its operating margin and its period.
function costReport(s) {
  const r = s.rec;
  const om = r.has_margin === null ? null : scenario(r, null, 0).operatingMargin;
  return html`<div class="field field--wide wr-rec__sec">
<p class="field__label">${fill('hCostHead', { fy: String(s.chunk.fy) })} ${measuredTag(r.status)}</p>
<dl class="wr-rec__dl"><dt>${t('hM2')}</dt><dd>${measuredMoney(r.medicaid_net_revenue)}</dd>
<dt>${t('hNpr')}</dt><dd>${measuredMoney(r.net_patient_revenue)}</dd>
<dt>${t('hOm')}</dt><dd>${marginText(om)}</dd>
<dt>${t('hPeriod')}</dt><dd>${r.period_begin && r.period_end ? fill('hPeriodText', { from: shortIsoDate(r.period_begin), to: shortIsoDate(r.period_end) }) : t('stNoNumber')}</dd></dl>
</div>`;
}

// A penalty: its cut in dollars, the words for none (key), or a dash with no estimate.
const penalty = (v, key) => (v === null ? t('stNoNumber') : v < 0 ? money(v) : t(key));

// The hospital's FY Medicare penalties (this site's estimates), beside the scenario and never added to it.
function penalties(s) {
  const r = s.rec;
  const fy = String(s.chunk.penaltyFy);
  const tag = estTag({ href: `${SITE.pages.methods}#estimate`, label: t('hEstimateLabel'), text: t('hEstimate') });
  const body = r.hrrp === null && r.hac === null
    ? html`<p class="wr-rec__p">${fill('hPenNone', { fy })}</p>`
    : html`<dl class="wr-rec__dl"><dt>${t('hHrrp')}</dt><dd>${penalty(r.hrrp, 'hNoPenalty')}</dd>
<dt>${t('hHac')}</dt><dd>${penalty(r.hac, 'hNoCut')}</dd></dl>`;
  return html`<div class="field field--wide wr-rec__sec">
<p class="field__label">${fill('hPenHead', { fy })} ${tag}</p>
${body}
<p class="wr-rec__p wr-rec__note">${t('hPenNote')}</p>
</div>`;
}

// The record card for a hospital in a view ({ k, use }).
export function cardHtml(s, { k, use }) {
  const reason = reasonOf(s);
  const n = reason ? null : numbersOf(s, use);
  const link = s.hub ? html`<a class="wr-rec__link" href="${hospitalPathOf('hub', s.ccn)}">${t('hLink')}</a>` : null;
  return html`<div class="form wr-rec" data-ccn="${s.ccn}">
${formTitle(t('hRecord'), fill('hCcn', { ccn: s.ccn }))}
${formField({ no: 1, label: t('hName'), value: s.name, cls: 'wr-rec__name', wide: true, note: link })}
${formField({ no: 2, label: t('hWhere'), value: whereOf(s), size: 'text', wide: true })}
<div class="field field--wide wr-rec__verdict">${stampOf(s, n, k, reason)}${reason ? html`
<p class="wr-rec__why">${whyOf(s, reason)}</p>` : ''}</div>
${n ? scenarioTable(s, n, k) : ''}${s.rec && s.rec.status !== null ? costReport(s) : ''}${s.rec ? penalties(s) : ''}
</div>`;
}

// What the page's live line says when the hospital changes: its name and its stamp's words.
export function sayOf(s, { k, use }) {
  const reason = reasonOf(s);
  const verdict = reason ? t(`hStamp_${STAMP[reason]}`) : `${fill('hStampLost', { lost: money(-numbersOf(s, use).lost[k]) })}, ${fill('hStampCase', { scenario: caseWord(k) })}`;
  return `${s.name}: ${verdict}`;
}

// ---------- the step ----------

// The figure's inside (figure()'s chart): the two drawings and the factor rows, or the reason panel, each hidden by turn.
function chartOf(parts) {
  const draw = (drawing) => frame({ kind: 'hosp', width: HB_DRAWINGS[drawing].width, height: HB_DRAWINGS[drawing].height, body: parts[drawing] ?? '' });
  return html`<div class="wr-hfig" data-h-fig${parts.reason ? html` hidden` : ''}>
${imagePair({ svg: draw('narrow'), svgWide: draw('wide') }, parts.alt)}
<div class="wr-facs" data-h-facs>${parts.facs ?? ''}</div>
</div>
<div class="wr-hnone" data-h-none${parts.reason ? '' : html` hidden`}>${parts.none ?? ''}</div>`;
}

const tableOf = (parts) => ({
  columns: [{ name: t('hColPart') }, ...SCENARIOS.map((s) => ({ name: scenWord(s), numeric: true }))],
  rows: TABLE_ROWS.map((row) => [
    t({ npr: 'hRowNpr', m2: 'hRowM2', exp: 'hRowExp', lost: 'hRowLost', share: 'hRowLostShare' }[row]),
    ...SCENARIOS.map((_, j) => {
      const cell = parts.cells.find(([r, k]) => r === row && k === j)[2];
      return { ...cell, data: { h: `${row} ${j}` } };
    }),
  ]),
});

// The step. data: loadMedicaid()'s result; rows: hospitalRows(data); label: its heading; hubCcns: the CCNs with a hub
// page; chunks: hospChunks's (the generator has them; built here when not given).
export function hospitalStep({ data, rows, label, hubCcns = new Set(), chunks = hospChunks(data, rows, hubCcns) }) {
  const fy = data.meta.fy;
  const view = { k: MIDDLE, use: data.params.use_default };
  const row = serverPick(rows);
  const s = subjectOf(row, decodeChunk(chunks.get(row.state)));
  const parts = figureParts(s, view);
  return html`<section class="step wr-step wr-hosp" id="hospital" aria-labelledby="hospital-h">
<div class="wr-step__words">
<h2 class="wr-sec" id="hospital-h">${label} ${scenarioTag(fy)}</h2>
<p class="wr-how__big">${t('hBig')}</p>
<p class="small wr-hpick" data-h-pick hidden>${t('hPickLead')} <button type="button" class="wr-hrand">${t('hRandom')}</button>.</p>
<p class="small muted" data-h-noscript>${t('hNoScript')}</p>
<div class="wr-hcard" data-h-card data-h-default="${s.ccn}">${cardHtml(s, view)}</div>
</div>
<div class="wr-step__stage">
${figure({
    n: 4,
    takeaway: parts.cap,
    chart: chartOf(parts),
    note: html`<span data-h-note>${parts.note}</span>`,
    source: html`${fill('figSource', { fy: String(fy) })} ${scenarioTag(fy)}`,
    claimLevel: 'hypothetical',
    table: tableOf(parts),
    csvName: 'work-requirement-hospital',
  })}
</div>
</section>`;
}
