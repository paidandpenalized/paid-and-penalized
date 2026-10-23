// What the program page's money and the place pages' money draw, computed once per build from CMS's file (programData's
// rows), the hospital master and this site's dollar estimates (data.js dollarsData). The population is the site's
// headline set: hospitals CMS scored and marked Yes or No, those with an estimate; the cut ones among them are the
// dollars' "n of m" (CMS's other cut hospitals have no usable impact-file row). The headline is the emitted
// file's own; what the file doesn't hold (the breakdowns) is summed here, over the rounded figures, so a reader adding a
// table gets its total. Every dollar is this site's estimate, in whole dollars. Pure: data in, result out.
import { ruleCompare } from '../../../web/charts/scoreRule.js';
import { lineScore } from '../../../web/whatif/marks.js';
import { cutDollars, nationalRange, sumRanges } from './money.js';
import { TYPE_KINDS } from './program-data.js';

export const sum = (rows, key) => rows.reduce((s, r) => s + r[key], 0);

// The aggregates over a group of hospitals: rows, the ones with an estimate; decided, all the group's hospitals CMS
// scored and decided, estimated or not (the rows when not given). How many rows (n), how many of them CMS cut (cut) and
// those hospitals' dollars (money), how many hospitals of the group CMS cut in all (cmsCut), the Medicare stays of all
// the rows (stays) and the cut per stay (perStay: the dollars over all the stays, so a set of many small cuts and one of
// few large ones compare; null with no stays).
function rollup(rows, decided = rows) {
  const cut = rows.filter((r) => r.yes);
  const money = sum(cut, 'cut');
  const stays = sum(rows, 'bills');
  return { n: rows.length, cut: cut.length, cmsCut: decided.filter((r) => r.yes).length, money, stays, perStay: stays ? money / stays : null };
}

// pd: programData(); dollars: dollarsData(); model: { boundary }. The headline is the file's (a test's slice of the
// hospitals sums over itself in the breakdowns, not in the headline).
export function moneyData({ pd, dollars, model }) {
  const rows = pd.decidedRows.flatMap((r) => {
    const d = dollars.byCcn.get(r.ccn);
    if (d.status !== 'estimated') return [];
    return [{
      ccn: r.ccn, name: r.name, city: r.city, state: r.state, master: r.master, total: r.total, yes: r.yes,
      atStake: d.atStake, cut: cutDollars(d), hvbp: d.hvbp, bills: d.bills, range: d.ranges.hac,
      hrrpFactor: d.hrrpFactor, vbpFactor: d.vbpFactor, hrrpListed: d.hrrpListed, vbpListed: d.vbpListed,
    }];
  });
  const cutRows = rows.filter((r) => r.yes);
  const all = rollup(rows, pd.decidedRows);
  // The scored hospitals the money leaves out, by where each stands (its total) and why: no estimate (no usable
  // impact-file row), or Maryland's, which are exempt. For the notes that say which hospitals near CMS's line the
  // figures leave out.
  const drawn = new Set(rows.map((r) => r.ccn));
  const left = pd.rows.filter((r) => !drawn.has(r.ccn)).map((r) => ({ total: r.total, status: dollars.byCcn.get(r.ccn).status }));
  const leftOf = (test) => left.filter((r) => test(r.status)).map((r) => r.total);

  // The largest tenth of the cuts (rounded up) and their share of the money.
  const sorted = cutRows.map((r) => r.cut).sort((a, b) => b - a);
  const tenth = Math.ceil(sorted.length / 10);

  // By kind of hospital (the share-cut figure's kinds): each group's cut hospitals (cut) and their dollars, as shares of
  // all, and the hospitals CMS cut in the group (cmsCut, estimated or not).
  const byKind = TYPE_KINDS.map(([kind, groups]) => ({
    kind,
    groups: groups.map(([key, test]) => {
      const g = rollup(rows.filter((r) => test(r.master)), pd.decidedRows.filter((r) => test(r.master)));
      return { key, cut: g.cut, cmsCut: g.cmsCut, money: g.money, shareHospitals: g.cut / all.cut, shareMoney: g.money / all.money };
    }).filter((g) => g.cut > 0),
  }));

  // By state: the cut hospitals this site estimates and their dollars, the hospitals CMS cut there (cmsCut, estimated
  // or not), and the cut per Medicare stay over the stays of every estimated hospital with a decision there.
  const decidedIn = Map.groupBy(pd.decidedRows, (r) => r.state);
  const byState = new Map([...Map.groupBy(rows, (r) => r.state)].map(([state, g]) => [state, { state, ...rollup(g, decidedIn.get(state)) }]));

  return {
    rows,
    decided: pd.decidedRows, // every hospital CMS scored and decided, estimated or not (a place's cmsCut counts its own)
    cutRows,
    // The file's headline: CMS's cut count (yes), the ones this site estimates (cut) and the rest (yesUnestimated); the
    // dollars over the estimated ones (money, the HAC cut's size) and the other two programs' (hrrp, hvbp); the
    // money's likely range (range: the back-test's national ratio, money.js nationalRange).
    headline: { ...dollars.headline, money: -dollars.headline.hac, range: nationalRange(dollars.bands, -dollars.headline.hac) },
    tenth: { n: tenth, money: sorted.slice(0, tenth).reduce((a, b) => a + b, 0) },
    byKind,
    byState,
    noEstimate: leftOf((status) => status === 'no-inputs'),
    exempt: leftOf((status) => status === 'maryland'),
    perStay: all.perStay,
    line: lineScore(model.boundary),
  };
}

// A place's money: its estimated hospitals' rollup, its cut dollars as a share of the nation's, and their likely range
// (range: its cut hospitals' ranges added up, money.js sumRanges; null with none cut). ccns: the place's hospitals.
export function placeMoney(md, ccns) {
  const set = new Set(ccns);
  const rows = md.rows.filter((r) => set.has(r.ccn));
  const place = rollup(rows, md.decided.filter((r) => set.has(r.ccn)));
  return { rows, ...place, share: place.money / md.headline.money, range: sumRanges(rows.filter((r) => r.yes).map((r) => r.range)) };
}

// The two sides of CMS's line among some rows near it: the hospitals CMS cut (over) and those it didn't (under), with
// the dollars at stake on each side (the cut taken, or the cut that would have been).
export function sides(rows) {
  const over = rows.filter((r) => r.yes);
  const under = rows.filter((r) => !r.yes);
  return { over, under, overMoney: sum(over, 'atStake'), underMoney: sum(under, 'atStake') };
}

// The hospitals within `window` of CMS's line, on either side, for the across-the-line figure: each with its score,
// whether CMS cut it, and its dollars at stake; { rows, ...sides(rows) }, lowest score first. Also how many scored
// hospitals within the window the figure leaves out: those with no estimate (noEstimate) and Maryland's (exempt).
// Worked out once per md and window (the program page and every place page draw the same ones); read, never changed.
const NEAR = new WeakMap();
export function nearLine(md, window) {
  if (!NEAR.has(md)) NEAR.set(md, new Map());
  const made = NEAR.get(md);
  if (!made.has(window)) {
    const inWindow = (total) => Math.abs(total - md.line) <= window;
    const rows = md.rows.filter((r) => inWindow(r.total)).sort(ruleCompare);
    made.set(window, { rows, ...sides(rows), noEstimate: md.noEstimate.filter(inWindow).length, exempt: md.exempt.filter(inWindow).length });
  }
  return made.get(window);
}
