// What the program page's money and the place pages' money draw, computed once per build from CMS's file, the
// hospital master and this site's dollar estimates (data.js dollarsData). The population is the site's headline set:
// hospitals CMS scored and marked Yes or No, those with an estimate; the cut ones among them are the dollars' "709 of
// the 718" (CMS's other cut hospitals have no usable impact-file row). Every dollar is this site's estimate, in whole
// dollars; every sum is a sum of the rounded figures, so a reader adding a table gets its total. Pure: data in, result
// out.
import { decidedHospitals } from '../../../engine/js/hacrp/hospital.js';
import { lineScore } from '../../../web/whatif/marks.js';
import { TYPE_KINDS } from './program-data.js';

const sum = (rows, key) => rows.reduce((s, r) => s + r[key], 0);

// hospitals: CMS's rows; master: Map ccn -> master record; dollars: dollarsData(); model: { boundary }. Every sum is
// over these rows (a test holds them to the emitted file's own headline for the whole file).
export function moneyData({ hospitals, master, dollars, model }) {
  const decided = decidedHospitals(hospitals);
  const rows = decided.map((h) => ({ h, d: dollars.byCcn.get(h.ccn) })).filter(({ d }) => d.status === 'estimated').map(({ h, d }) => {
    const m = master.get(h.ccn);
    return {
      ccn: h.ccn, name: m.name, city: m.city, state: m.state, master: m, total: h.total, yes: h.paymentReduction === 'Yes',
      atStake: d.atStake, cut: h.paymentReduction === 'Yes' ? d.atStake : 0, hrrp: d.hrrp, hvbp: d.hvbp, bills: d.bills,
      hrrpFactor: d.hrrpFactor, vbpFactor: d.vbpFactor, hrrpListed: d.hrrpListed, vbpListed: d.vbpListed,
    };
  });
  const cutRows = rows.filter((r) => r.yes);
  const totalCut = sum(cutRows, 'cut');
  // CMS's cut hospitals among those it scored and decided, estimated or not: the site's headline count.
  const yes = decided.filter((h) => h.paymentReduction === 'Yes').length;

  // The largest tenth of the cuts (rounded up) and their share of the money.
  const sorted = cutRows.map((r) => r.cut).sort((a, b) => b - a);
  const tenth = Math.ceil(sorted.length / 10);

  // By kind of hospital (the share-cut figure's kinds): each group's cut hospitals and their dollars, as shares of all.
  const byKind = TYPE_KINDS.map(([kind, groups]) => ({
    kind,
    groups: groups.map(([key, test]) => {
      const g = cutRows.filter((r) => test(r.master));
      const money = sum(g, 'cut');
      return { key, n: g.length, money, shareHospitals: g.length / cutRows.length, shareMoney: money / totalCut };
    }).filter((g) => g.n > 0),
  }));

  // By state: the cut dollars, and the Medicare stays of every estimated hospital with a decision there (the cut per
  // stay is the state's dollars over all of them, so a state of many small cuts and one of few large ones compare).
  const states = new Map();
  for (const r of rows) {
    if (!states.has(r.state)) states.set(r.state, { state: r.state, hospitals: 0, cutHospitals: 0, money: 0, stays: 0 });
    const s = states.get(r.state);
    s.hospitals++;
    s.stays += r.bills;
    if (r.yes) { s.cutHospitals++; s.money += r.cut; }
  }
  const stays = sum(rows, 'bills');

  return {
    rows,
    cutRows,
    // The headline: CMS's cut count (yes), the ones this site estimates (cut) and the rest (yesUnestimated); the
    // dollars over the estimated ones.
    headline: { yes, cut: cutRows.length, yesUnestimated: yes - cutRows.length, money: totalCut, hrrp: sum(rows, 'hrrp'), hvbp: sum(rows, 'hvbp'), net: sum(rows, 'hrrp') + sum(rows, 'hvbp') - totalCut, hospitals: rows.length },
    tenth: { n: tenth, money: sorted.slice(0, tenth).reduce((a, b) => a + b, 0) },
    byKind,
    byState: states,
    stays,
    perStay: totalCut / stays,
    line: lineScore(model.boundary),
  };
}

// A place's money: its cut hospitals' dollars, its share of the nation's, and its cut per Medicare stay against the
// nation's. ccns: the place's hospitals.
export function placeMoney(md, ccns) {
  const set = new Set(ccns);
  const rows = md.rows.filter((r) => set.has(r.ccn));
  const cut = rows.filter((r) => r.yes);
  const money = sum(cut, 'cut');
  const stays = sum(rows, 'bills');
  return { rows, cut: cut.length, money, share: money / md.headline.money, stays, perStay: stays ? money / stays : null };
}

// The hospitals within `window` of CMS's line, on either side, for the across-the-line figure: each with its score,
// whether CMS cut it, and its dollars at stake (the cut it took, or the cut it would have taken).
export function nearLine(md, window) {
  return md.rows.filter((r) => Math.abs(r.total - md.line) <= window).sort((a, b) => a.total - b.total || (a.ccn < b.ccn ? -1 : 1));
}
