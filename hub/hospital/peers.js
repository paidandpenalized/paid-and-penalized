// A hospital page's comparison: its peers in a way of grouping, and what each program row and the net say about them.
// Pure and browser-safe (no file, network or DOM access), so the page's script can redo it for another peer group.
// Hospitals are the hub's (hub/model.js hubHospitals, or the browser asset's rows, which carry the same `est`); only
// hospitals with an estimate are anyone's peers.
import { median, peerKey } from '../../engine/js/peers.js';

// The program rows, in the page's order: each program's id (web/site.js SITE.programs) and its dollars in an estimate.
export const ROWS = Object.freeze([
  Object.freeze({ id: 'hrrp', key: 'hrrp' }),
  Object.freeze({ id: 'hacrp', key: 'hac' }),
  Object.freeze({ id: 'hvbp', key: 'hvbp' }),
]);

// Whether a hospital with this estimate is in a program's file: Readmissions and value-based purchasing list their
// hospitals (an unlisted one has no dollars there, which is "not in this program", never $0); every hospital in the
// dollar file is in the hospital-acquired conditions file, and the net covers all three.
export const inProgram = (est, id) => (id === 'hrrp' ? est.hrrpListed : id === 'hvbp' ? est.vbpListed : true);

// The dollars of a row ('hrrp', 'hacrp', 'hvbp' or 'net') in an estimate.
const dollarsOf = (est, id) => (id === 'net' ? est.net : est[ROWS.find((r) => r.id === id).key]);

// The hospitals with an estimate in h's group under mode (engine/js/peers.js PEER_MODES), h among them, in the order
// given; null when h has no group in that mode (no state, bed count or teaching status).
export function peersOf(hospitals, h, mode) {
  const key = peerKey(h, mode);
  return key === null ? null : hospitals.filter((x) => x.est && peerKey(x, mode) === key);
}

// What the peers show for one row: `n` peers, `in` of them in the program, and of those `cut` with money taken, `bonus`
// with money paid, `none` with neither; `out` not in it; `median`, the median share of pay (dollars / estimated pay)
// among those in the program, or null when none is.
export function rowFigures(peers, id) {
  const shares = [];
  let cut = 0;
  let bonus = 0;
  for (const { est } of peers) {
    if (!inProgram(est, id)) continue;
    const dollars = dollarsOf(est, id);
    if (dollars < 0) cut += 1;
    else if (dollars > 0) bonus += 1;
    shares.push(dollars / est.total);
  }
  return { n: peers.length, in: shares.length, cut, bonus, none: shares.length - cut - bonus, out: peers.length - shares.length, median: median(shares) };
}

// Every row's figures and the net's: { hrrp, hacrp, hvbp, net }, each as rowFigures has it.
export const peerFigures = (peers) => Object.fromEntries([...ROWS.map((r) => r.id), 'net'].map((id) => [id, rowFigures(peers, id)]));

// The dollars a row shows for the hospital: its own, and its peers' median share scaled to its pay (null when the
// hospital is not in the program, or no peer is).
export function rowDollars(est, id, figures) {
  const own = inProgram(est, id) ? dollarsOf(est, id) : null;
  const med = figures[id].median;
  return { own, median: own === null || med === null ? null : med * est.total };
}
