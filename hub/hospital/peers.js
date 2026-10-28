// A hospital page's comparison: its peers in a way of grouping, and what each program row and the net say about them.
// Pure and browser-safe (no file, network or DOM access), so the page's script can redo it for another peer group.
// Hospitals are the hub's (hub/model.js hubHospitals, or the browser asset's rows, which carry the same `est`); only
// hospitals with an estimate are anyone's peers.
import { BED_BAND_EDGES, PEER_MODES, median, peerKey } from '../../engine/js/peers.js';
import { STATE_NAMES } from '../../engine/js/states.js';
import { count } from '../../web/render/format.js';

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

// The name of h's group under mode, as the page's sentences use it after a count ("Alabama hospitals", "hospitals with
// 100 to 299 beds", "major teaching hospitals"), or null when h has no group in that mode. The bands' edges come from
// engine/js/peers.js. fill: the page's copy filler (hub/hospital/copy.js).
const TEACH_GROUP = { major: 'groupTeachMajor', minor: 'groupTeachMinor', none: 'groupTeachNone' };
export function groupName(fill, h, mode) {
  const key = peerKey(h, mode);
  if (key === null) return null;
  if (mode === 'state') return fill('groupState', { state: STATE_NAMES[key] ?? key });
  if (mode === 'teach') return fill(TEACH_GROUP[key]);
  const band = Number(key.slice(1));
  if (band === 0) return fill('groupSizeLow', { beds: count(BED_BAND_EDGES[0]) });
  if (band === BED_BAND_EDGES.length) return fill('groupSizeHigh', { beds: count(BED_BAND_EDGES[band - 1]) });
  return fill('groupSizeMid', { lo: count(BED_BAND_EDGES[band - 1]), hi: count(BED_BAND_EDGES[band] - 1) });
}

// Every way h can be grouped (PEER_MODES order), each { mode, peers, figures, group }, or null where h has no group.
export const peerGroups = (fill, hospitals, h) => PEER_MODES.map((mode) => {
  const peers = peersOf(hospitals, h, mode);
  return peers && peers.length ? { mode, peers, figures: peerFigures(peers), group: groupName(fill, h, mode) } : null;
});

// The dollar rows' one scale (the hospital's dollars and its peers' medians against a zero line): every value given and
// zero, a little room at each end, as a fraction of the track. All zero is a scale too (one dollar wide).
export function sumScale(values) {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const pad = span * 0.04;
  return (v) => (v - lo + pad) / (span + 2 * pad);
}

// The values the dollar rows' scale must hold for a hospital's estimate: its own dollars in each row and the net, and the
// peers' median in every one of figureSets (peerFigures of each way it can be grouped), so switching the peer group moves
// only the median ticks, never the hospital's own bars.
export function sumValues(est, figureSets) {
  const ids = [...ROWS.map((r) => r.id), 'net'];
  return figureSets.flatMap((f) => ids.flatMap((id) => {
    const { own, median: med } = rowDollars(est, id, f);
    return [own, med];
  })).filter((v) => v !== null);
}
