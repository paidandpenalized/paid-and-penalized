// The hub's facts, computed from the dollar estimates joined to the hospital master and the pinned Thirty Day
// Readmissions file. Pure: data in, facts out (hub/data.js reads the files). Every figure on the home page, the shell and
// the hospital pages comes from here, so one place defines each count and each total.
import { builtOn } from '../engine/js/dates.js';
import { SHOWN_STATUSES } from '../engine/js/dollars/status.js';
import { netShare } from '../engine/js/dollars/whatif.js';
import { bedBand, median } from '../engine/js/peers.js';

// The example hospital a page that opens on one uses, never another default. Chosen once by the rule in exampleRule
// (100 to 299 beds, not a teaching hospital, moved by both Readmissions and value-based purchasing, FY2026 net share
// nearest the median of all hospitals' shares), then fixed here so a data refresh never changes what a link or a page
// default opens. The model test says when the rule would pick another hospital today; re-choose then, and check the
// new one with the owner before changing this.
export const EXAMPLE_CCN = '360174';

// An estimated row's dollars and factors, as the dollar file has them, with the hospital's net as a share of its pay.
function estimate(row) {
  const { base, total, hrrp, hvbp, hac, net, after, atStake, hrrpFactor, vbpFactor, cut, hrrpListed, vbpListed } = row;
  return { base, total, hrrp, hvbp, hac, net, after, atStake, hrrpFactor, vbpFactor, cut, hrrpListed, vbpListed, share: netShare(net, total) };
}

// Every hospital in the dollar file, in its order, joined to its master record and to whether Thirty Day Readmissions has
// it. `est` holds the dollars of a hospital with an estimate and is null for the rest (Maryland's all-payer model, and
// hospitals with no inputs to estimate from). A missing bed count, teaching status or location stays null, and a null
// bed count has no size band.
export function hubHospitals({ dollars, master, tdr }) {
  return dollars.hospitals.map((row) => {
    const m = master.get(row.ccn);
    if (!m) throw new RangeError(`hub: CCN ${row.ccn} has a dollar row but no hospital master record`);
    if (!SHOWN_STATUSES.includes(row.status)) throw new RangeError(`hub: ${row.ccn} has the dollar status "${row.status}", which no page has words for`);
    const beds = m.beds ?? null;
    return {
      ccn: row.ccn, name: m.name, city: m.city, state: m.state, beds, band: bedBand(beds), teach: m.teach ?? null,
      lat: m.lat ?? null, lon: m.lon ?? null, status: row.status, inTdr: tdr.hospitals.has(row.ccn),
      est: row.status === 'estimated' ? estimate(row) : null,
    };
  });
}

// The story's facts, over the hospitals with an estimate (`n`). Dollars are whole dollars, negative when money is taken.
//   pay       estimated Medicare inpatient pay, all of them added
//   net       the three programs' dollars added; notPaid is its opposite (what hospitals are not paid)
//   vbpBonus  the value-based purchasing bonuses (the positive HVBP dollars); gross = notPaid + vbpBonus is all the
//             money the programs move, and share = gross / pay
//   hrrp*     Readmissions: hospitals with a cut (hrrpCut) and with none (hrrpZero), and the dollars (hrrpSum)
//   hac*      hospital-acquired conditions: hospitals with a cut (hacCut), those cut by it alone (hacOnly: no Readmissions
//             cut), and the dollars (hacSum)
//   vbp*      value-based purchasing: hospitals with a bonus, a cut or $0 (which includes hospitals outside the program),
//             the net dollars (vbpNet), and the highest payment factor of a hospital in the program (vbpMax)
//   net*      hospitals whose three programs add to a cut, a bonus or $0
export function storyFacts(hospitals) {
  const est = hospitals.filter((h) => h.est).map((h) => h.est);
  if (!est.length) throw new RangeError('hub: no hospital has an estimate');
  const sum = (key) => est.reduce((total, e) => total + e[key], 0);
  const count = (test) => est.filter(test).length;
  const pay = sum('total');
  const net = sum('net');
  const notPaid = -net;
  const vbpBonus = est.reduce((total, e) => total + Math.max(e.hvbp, 0), 0);
  const gross = notPaid + vbpBonus;
  const listed = est.filter((e) => e.vbpListed);
  return {
    n: est.length, pay, net, notPaid, vbpBonus, gross, share: gross / pay,
    hrrpCut: count((e) => e.hrrp < 0), hrrpZero: count((e) => e.hrrp === 0), hrrpSum: sum('hrrp'),
    hacCut: count((e) => e.hac < 0), hacOnly: count((e) => e.hrrp === 0 && e.hac < 0), hacSum: sum('hac'),
    vbpBonusN: count((e) => e.hvbp > 0), vbpCutN: count((e) => e.hvbp < 0), vbpZero: count((e) => e.hvbp === 0), vbpNet: sum('hvbp'),
    netCut: count((e) => e.net < 0), netBonus: count((e) => e.net > 0), netZero: count((e) => e.net === 0),
    vbpMax: listed.length ? Math.max(...listed.map((e) => e.vbpFactor)) : null,
  };
}

// Each state's totals over its hospitals with an estimate, by postal code in order: `n` hospitals, their pay (`total`),
// their `net` dollars, `share` = net / total, and `cutN` the hospitals whose net is a cut. Maryland (all-payer model,
// no estimates) is `{ state: 'MD', notInPrograms: true, n }` with the count of its hospitals.
export function stateTotals(hospitals) {
  const states = new Map();
  let maryland = 0;
  for (const h of hospitals) {
    if (h.state === 'MD') {
      if (h.est) throw new RangeError(`hub: ${h.ccn} is in Maryland (not in these programs) but has an estimate`);
      maryland += 1;
    } else if (h.est) {
      const s = states.get(h.state) ?? { state: h.state, n: 0, total: 0, net: 0, cutN: 0 };
      s.n += 1;
      s.total += h.est.total;
      s.net += h.est.net;
      if (h.est.net < 0) s.cutN += 1;
      states.set(h.state, s);
    }
  }
  const out = new Map([...states.values()].map(({ state, n, total, net, cutN }) => [state, { state, n, total, net, share: netShare(net, total), cutN }]));
  if (maryland) out.set('MD', { state: 'MD', notInPrograms: true, n: maryland });
  return new Map([...out].sort(([a], [b]) => (a < b ? -1 : 1)));
}

// The CCN the example rule picks from these hospitals, or null when none qualifies. Among hospitals with an estimate that
// have 100 to 299 beds (the second size band), are not teaching hospitals, and have dollars from both Readmissions and
// value-based purchasing, the one whose net share is nearest the median share of all hospitals with an estimate; the
// lower CCN on a tie. Used by the test that guards EXAMPLE_CCN, not by any page.
export function exampleRule(hospitals) {
  const withEstimate = hospitals.filter((h) => h.est);
  if (!withEstimate.length) return null;
  const target = median(withEstimate.map((h) => h.est.share));
  const picks = withEstimate
    .filter((h) => h.band === 1 && h.teach === 'none' && h.est.hrrp !== 0 && h.est.hvbp !== 0)
    .map((h) => ({ ccn: h.ccn, away: Math.abs(h.est.share - target) }))
    .sort((a, b) => a.away - b.away || (a.ccn < b.ccn ? -1 : 1));
  return picks.length ? picks[0].ccn : null;
}

// What the shell shows on every page, as numbers (the shell formats them): the fiscal year, how many hospitals have an
// estimate, the day the estimates were built (YYYY-MM-DD, from `builtAt`), and each program's figure for the tabs and
// the footer: Readmissions' and hospital-acquired conditions' dollars and cut hospitals, and the value-based purchasing
// bonuses moved and the program's net.
export function shellFacts({ facts, builtAt, fy }) {
  const changed = builtOn(builtAt);
  if (!changed) throw new RangeError(`hub: built_at is not a UTC timestamp in whole seconds: ${JSON.stringify(builtAt)}`);
  return {
    fy,
    hospitals: facts.n,
    changed,
    programs: {
      hrrp: { dollars: facts.hrrpSum, cutN: facts.hrrpCut },
      hacrp: { dollars: facts.hacSum, cutN: facts.hacCut },
      hvbp: { moved: facts.vbpBonus, net: facts.vbpNet },
    },
  };
}
