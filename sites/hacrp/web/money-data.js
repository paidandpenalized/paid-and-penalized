// What the program page's money and the place pages' money draw, computed once per build from CMS's file (programData's
// rows), the hospital master and this site's dollar estimates (data.js dollarsData). The population is the site's
// headline set: hospitals CMS scored and marked Yes or No, those with an estimate; the cut ones among them are the
// dollars' "709 of the 718" (CMS's other cut hospitals have no usable impact-file row). The headline is the emitted
// file's own; what the file doesn't hold (the breakdowns) is summed here, over the rounded figures, so a reader adding a
// table gets its total. Every dollar is this site's estimate, in whole dollars. Pure: data in, result out.
import { lineScore } from '../../../web/whatif/marks.js';
import { cutDollars } from './money.js';
import { TYPE_KINDS } from './program-data.js';

export const sum = (rows, key) => rows.reduce((s, r) => s + r[key], 0);

// The aggregates over a set of rows: how many (n), how many of them CMS cut (cut) and those hospitals' dollars (money),
// the Medicare stays of all of them (stays) and the cut per stay (perStay: the dollars over all the stays, so a set of
// many small cuts and one of few large ones compare; null with no stays).
export function rollup(rows) {
  const cut = rows.filter((r) => r.yes);
  const money = sum(cut, 'cut');
  const stays = sum(rows, 'bills');
  return { n: rows.length, cut: cut.length, money, stays, perStay: stays ? money / stays : null };
}

// pd: programData(); dollars: dollarsData(); model: { boundary }. The headline is the file's (a test's slice of the
// hospitals sums over itself in the breakdowns, not in the headline).
export function moneyData({ pd, dollars, model }) {
  const rows = pd.decidedRows.flatMap((r) => {
    const d = dollars.byCcn.get(r.ccn);
    if (d.status !== 'estimated') return [];
    return [{
      ccn: r.ccn, name: r.name, city: r.city, state: r.state, master: r.master, total: r.total, yes: r.yes,
      atStake: d.atStake, cut: cutDollars(d), hvbp: d.hvbp, bills: d.bills,
      hrrpFactor: d.hrrpFactor, vbpFactor: d.vbpFactor, hrrpListed: d.hrrpListed, vbpListed: d.vbpListed,
    }];
  });
  const cutRows = rows.filter((r) => r.yes);
  const all = rollup(rows);

  // The largest tenth of the cuts (rounded up) and their share of the money.
  const sorted = cutRows.map((r) => r.cut).sort((a, b) => b - a);
  const tenth = Math.ceil(sorted.length / 10);

  // By kind of hospital (the share-cut figure's kinds): each group's cut hospitals and their dollars, as shares of all.
  const byKind = TYPE_KINDS.map(([kind, groups]) => ({
    kind,
    groups: groups.map(([key, test]) => {
      const g = rollup(rows.filter((r) => test(r.master)));
      return { key, n: g.cut, money: g.money, shareHospitals: g.cut / all.cut, shareMoney: g.money / all.money };
    }).filter((g) => g.n > 0),
  }));

  // By state: the cut hospitals and their dollars, and the cut per Medicare stay over the stays of every estimated
  // hospital with a decision there.
  const byState = new Map([...Map.groupBy(rows, (r) => r.state)].map(([state, g]) => [state, { state, ...rollup(g) }]));

  return {
    rows,
    cutRows,
    // The file's headline: CMS's cut count (yes), the ones this site estimates (cut) and the rest (yesUnestimated); the
    // dollars over the estimated ones (money, the HAC cut's size) and the other two programs' (hrrp, hvbp).
    headline: { ...dollars.headline, money: -dollars.headline.hac },
    tenth: { n: tenth, money: sorted.slice(0, tenth).reduce((a, b) => a + b, 0) },
    byKind,
    byState,
    perStay: all.perStay,
    line: lineScore(model.boundary),
  };
}

// A place's money: its estimated hospitals' rollup, and its cut dollars as a share of the nation's. ccns: the place's
// hospitals.
export function placeMoney(md, ccns) {
  const set = new Set(ccns);
  const rows = md.rows.filter((r) => set.has(r.ccn));
  const place = rollup(rows);
  return { rows, ...place, share: place.money / md.headline.money };
}

// The two sides of CMS's line among some rows near it: the hospitals CMS cut (over) and those it didn't (under), with
// the dollars at stake on each side (the cut taken, or the cut that would have been).
export function sides(rows) {
  const over = rows.filter((r) => r.yes);
  const under = rows.filter((r) => !r.yes);
  return { over, under, overMoney: sum(over, 'atStake'), underMoney: sum(under, 'atStake') };
}

// The hospitals within `window` of CMS's line, on either side, for the across-the-line figure: each with its score,
// whether CMS cut it, and its dollars at stake; { rows, ...sides(rows) }, lowest score first. Worked out once per md and
// window (the program page and every place page draw the same ones); read, never changed.
const NEAR = new WeakMap();
export function nearLine(md, window) {
  if (!NEAR.has(md)) NEAR.set(md, new Map());
  const made = NEAR.get(md);
  if (!made.has(window)) {
    const rows = md.rows.filter((r) => Math.abs(r.total - md.line) <= window).sort((a, b) => a.total - b.total || (a.ccn < b.ccn ? -1 : 1));
    made.set(window, { rows, ...sides(rows) });
  }
  return made.get(window);
}
