// Synthetic hospitals for the Readmissions page tests: invented names, CCNs 990001-990099 (no real hospital), a
// made-up fiscal year and peer medians of 1 (so an excess readmission ratio of 1.1 is 0.1 over its median).
import { testAssets } from '../../../pipeline/test/helpers.js';
import { loadHrrp } from '../web/data.js';
import { buildPlaces } from '../web/places.js';
import { areaContext, hospitalContext } from '../web/view.js';

// The default data (the emitted file), read once for the test files that only read it. Tests of the loader itself call
// loadHrrp() for each path they exercise.
let loaded;
export const loadHrrpOnce = () => (loaded ??= loadHrrp());

export const NAME = 'EXAMPLE GENERAL HOSPITAL';
export const ASSETS = testAssets();
export const META = {
  fy: 2027,
  fileDate: '2026-10-07',
  perf: ['2023-07-01', '2025-06-30'],
  nm: 1,
  peerCutoffs: [[0, 0.14], [0.14, 0.18], [0.18, 0.23], [0.23, 0.31], [0.31, 1]],
  peerMedians: Object.fromEntries([1, 2, 3, 4, 5].map((p) => [p, { AMI: 1, COPD: 1, HF: 1, PN: 1, CABG: 1, THA_TKA: 1 }])),
  states: { ZZ: 'Zedland', ZY: 'Zyland' },
  totals: { modelPen: 341000000, cmsEst: 361000000 },
  replication: { exact: 9, total: 9 },
  sources: [{ id: 'a', name: 'Example source file', url: 'https://example.org/file.zip' }, { name: 'Example source without an address', url: 'http://insecure.example/' }],
};
export const HISTORY = { years: [2025, 2026], paf: {}, national: [{ fy: 2025, cap: 3 }, { fy: 2026, cap: 3 }] };
export const CONDITIONS = [
  { key: 'AMI', short: 'Heart attack' }, { key: 'COPD', short: 'COPD' }, { key: 'HF', short: 'Heart failure' },
  { key: 'PN', short: 'Pneumonia' }, { key: 'CABG', short: 'Bypass surgery' }, { key: 'THA_TKA', short: 'Hip/knee replacement' },
];

// A hospital row as the data file holds it (a penalized one by default: heart failure 0.1 over its median at a payment
// weight of 0.1, so a cut of 1%). extra overrides any field.
export const hospital = (extra = {}) => ({
  id: '990001', name: NAME, city: 'Exampleton', st: 'ZZ', county: 'Sample County', zip: '99001', lat: 40, lon: -100, geo: 'address',
  cbsa: '99901', cbsaName: 'Exampleton, ZZ', urban: true, region: 'Westland', division: 'Pacific Coast', beds: 220, teach: 'minor', own: 'Voluntary',
  types: ['RRC'], star: 4, paf: 0.99, red: 1, dual: 0.2351, peer: 2, base: 10000000, pen: 100000, alias: null, inactive: null,
  c: { HF: { n: 40, err: 1.1, flag: 1, ratio: 0.1 }, AMI: { n: 30, err: 0.9, flag: 0, ratio: 0.1 } },
  ...extra,
});

// Each verdict variant (engine/js/hrrp/formula.js verdict): the row, and the status it should have.
export const CUT = hospital();
export const NONE_MEASURED = hospital({ id: '990002', paf: 1, red: 0, pen: 0, c: { HF: { n: 10, err: 1.2, flag: 0, ratio: 0.1 } } });
export const NONE_BELOW = hospital({ id: '990003', paf: 1, red: 0, pen: 0, c: { HF: { n: 40, err: 0.9, flag: 0, ratio: 0.1 }, AMI: { n: 30, err: 0.8, flag: 0, ratio: 0.1 } } });
export const NONE_ROUNDED = hospital({ id: '990004', paf: 1, red: 0, pen: 0, c: { HF: { n: 40, err: 1.1, flag: 1, ratio: 0.0000001 } } });
export const INACTIVE = hospital({ id: '990005', inactive: { date: '2026-03-30', reason: 'change in provider status' } });
export const OTHERS = [
  hospital({ id: '990006', red: 0.5, paf: 0.995 }), hospital({ id: '990007', red: 2, paf: 0.98, st: 'ZY', peer: 3 }),
  hospital({ id: '990008', red: 0, paf: 1, st: 'ZY' }), hospital({ id: '990009', red: 0, paf: 1 }),
];
export const ALL = [CUT, NONE_MEASURED, NONE_BELOW, NONE_ROUNDED, INACTIVE, ...OTHERS];

export const ctxOf = (hospitals = ALL) => hospitalContext({ hospitals, meta: META, history: HISTORY, conditions: CONDITIONS });

export const areaOf = (hospitals = ALL) => areaContext({ hospitals, meta: META, history: HISTORY, conditions: CONDITIONS, places: buildPlaces(hospitals, META) });
