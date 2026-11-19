// A TEAM participant's numbers as the calculator opens on them (sites/team: the build's first render and the browser's),
// shared with the hub's TEAM section on the participant's page (hub/hospital/team.js), so the two agree to the cent:
// the calculator's state (initialState), the engine's inputs from a hospital and a state (inputsOf, engineInput), and
// the opening view in numbers (openingOf). Pure: a hospital as calc-data.js hospOf gives it in, plain data out.
import { BAND_DEFAULT, CATEGORIES, DEFAULT_TRACK, MEASURES } from '../../engine/js/team/params.js';
import { compositeQuality } from '../../engine/js/team/quality.js';
import { bandOf, reconcile } from '../../engine/js/team/reconcile.js';

const MEASURE_KEYS = Object.keys(MEASURES);

// The state a hospital opens with: Track 3 (CMS's default from performance year 2), on target, the ±5% band, nothing typed.
export const initialState = (hosp) => ({
  ccn: hosp.ccn, track: DEFAULT_TRACK, s: 0, sk: {}, band: BAND_DEFAULT * 100, ov: { n: {}, p: {} }, lv: {}, q: {}, mine: new Set(), moved: false, earn: null, owe: null,
});

// The numbers the engine takes, the reader's over the hospital's: per category the episodes, price, spending (a share)
// and low-volume flag; the quality percentiles (null: CMS's missing-data score) and the composite score with its weights.
export function inputsOf(hosp, state) {
  const cats = CATEGORIES.map((key) => {
    const pub = hosp.cats[key];
    const n = state.ov.n[key] ?? pub.n;
    const price = state.ov.p[key] ?? pub.price;
    return { key, n, price, target: n * price, spend: (state.sk[key] ?? state.s) / 100, lowVolume: state.lv[key] ?? pub.lowVolume };
  });
  const pcts = Object.fromEntries(MEASURE_KEYS.map((m) => [m, state.q[m] ?? hosp.quality[m]?.pct ?? null]));
  const episodes = cats.reduce((sum, c) => sum + c.n, 0);
  const { cqs, weights } = compositeQuality(pcts, { inpatient: episodes, lejr: cats.find((c) => c.key === 'LEJR').n });
  return { cats, pcts, cqs, weights, episodes, track: state.track };
}

// The engine's input from inputsOf's: what reconcile and bandOf take.
export const engineInput = ({ cats, cqs, track }) => ({ cats: cats.map(({ key, target, spend, lowVolume }) => ({ key, target, spend, lowVolume })), cqs, track });

// The calculator's opening view of a hospital, in numbers: its track, the band's half-width (a share), the episodes, the
// reconciliation on target (its target amount and the track's limits) and the band (bandOf's low and high).
export function openingOf(hosp) {
  const state = initialState(hosp);
  const inputs = inputsOf(hosp, state);
  const input = engineInput(inputs);
  const width = state.band / 100;
  return { track: state.track, width, episodes: inputs.episodes, r: reconcile(input), band: bandOf({ ...input, width }) };
}
