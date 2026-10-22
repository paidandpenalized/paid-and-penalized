// A synthetic emitted history for the history tests: invented hospitals (CCNs 990101 and on), five fiscal years in the
// words of CMS's newest files, one of them (2023) a year CMS scored no one. Built through the emitter itself
// (historyYear, buildHistory), so it has the shape of the committed file. Each hospital's record is written out below, so a
// test can say what the counts must be without calling the code it tests.
import { buildHistory } from '../pipeline/history.js';

export const SYNTH_FYS = [2021, 2022, 2023, 2024, 2025];
// The year CMS scored no one: its position in SYNTH_FYS.
export const NO_SCORE_AT = 2;

// state -> [ccn, record]: Y cut, N not cut, . no decision (a '.' in a year CMS scored: the hospital is not in that
// year's file). 99MD01 is a Maryland-style hospital: scored every year, its payment decision N/A, so it is in no record.
export const SYNTH_RECORDS = {
  AL: [
    ['990101', 'YY.YY'], ['990102', 'YN.NY'], ['990103', 'NY.NN'], ['990104', 'NN.NN'], ['990105', 'NN.YN'],
    ['990106', 'YN.NN'], ['990107', 'NN.NN'], ['990108', 'NN.NN'], ['990109', 'NN.NN'], ['990110', 'NN.YY'],
  ],
  GA: [
    ['990201', 'YY.YN'], ['990202', 'NN.NN'], ['990203', 'NY.NN'], ['990204', 'NN.NN'], ['990205', 'NN.NN'],
    ['990206', 'YN.NN'], ['990207', 'NN.NY'], ['990208', 'NN.NN'], ['990209', 'NN.NN'], ['990210', 'NN.NN'],
  ],
  MD: [['990301', '.....'], ['990302', '.N.YN'], ['990303', 'YN.N.']],
};
export const SYNTH_CCNS = Object.values(SYNTH_RECORDS).flat().map(([ccn]) => ccn);
// The records of the hospitals with a decision somewhere (what records() must give back, in this order of first appearance).
export const SYNTH_DECIDED = Object.values(SYNTH_RECORDS).flat().filter(([, rec]) => /[YN]/.test(rec));
// The hospital whose total CMS computed from a PSI 90 score its file withholds (a footnoted miss, FY2022).
export const WITHHELD = { ccn: '990107', at: 1 };

// A hospital's z-score in a year: cut ones high, the rest low, every one different (so CMS's order is unambiguous).
const zOf = (g, cut) => (cut ? 1 : -1) + g * 0.01;
const text = (x) => x.toFixed(4);

function zRow(fy, g, ccn, state, char) {
  const none = fy === SYNTH_FYS[NO_SCORE_AT];
  const z = zOf(g, char === 'Y');
  // Some hospitals are scored on one measure only (the other withheld and footnoted).
  const psi = g % 5 === 0 ? 'N/A' : text(z);
  const clabsi = g % 5 === 3 ? 'N/A' : text(z);
  const row = {
    'Facility Name': 'EXAMPLE', 'Facility ID': ccn, State: state, 'Fiscal Year': String(fy),
    'PSI 90 W Z Score': none ? 'N/A' : psi, 'PSI 90 W Z Footnote': none || psi === 'N/A' ? '5' : '',
    'PSI 90 Start Date': '07/01/2019', 'PSI 90 End Date': '06/30/2021',
    'CLABSI W Z Score': none ? 'N/A' : clabsi, 'CLABSI W Z Footnote': none || clabsi === 'N/A' ? '5' : '',
    'HAI Measures Start Date': '01/01/2020', 'HAI Measures End Date': '12/31/2021',
    'Total HAC Score': none ? '0.0000' : text(z), 'Total HAC Footnote': none ? '5' : '',
    'Payment Reduction': none ? 'N/A' : char === 'Y' ? 'Yes' : char === 'N' ? 'No' : 'N/A', 'Payment Reduction Footnote': none ? '5' : '',
  };
  if (fy === SYNTH_FYS[WITHHELD.at] && ccn === WITHHELD.ccn) {
    // CMS's total used a PSI 90 score the file withholds: the parts alone give a different mean.
    row['PSI 90 W Z Score'] = 'N/A';
    row['PSI 90 W Z Footnote'] = '5';
    row['Total HAC Score'] = text(z + 0.4);
  }
  return row;
}

// The emitted history as a file holds it (parsed JSON).
export function synthHistory() {
  const files = SYNTH_FYS.map((fy, i) => {
    const rows = [];
    let g = 0;
    for (const [state, list] of Object.entries(SYNTH_RECORDS)) {
      for (const [ccn, rec] of list) {
        g++;
        if (i === NO_SCORE_AT) rows.push(zRow(fy, g, ccn, state, '.'));
        else if (rec[i] !== '.' || ccn === '990301') rows.push(zRow(fy, g, ccn, state, rec[i]));
      }
    }
    return { fy, id: `synth-fy${fy}`, rows };
  });
  const infections = [2021, 2022, 2024].map((cy) => ({ cy, id: `synth-hai-${cy}`, rows: infectionRows(cy) }));
  const manifest = [...files.map((f) => f.id), ...infections.map((h) => h.id)].map((id, k) => ({ id, sha256: String(k % 10).repeat(64) }));
  return JSON.parse(JSON.stringify(buildHistory({ files, infections, manifest, builtAt: '2099-01-01T00:00:00Z' })));
}

// Two hospitals' infection results for a calendar year, falling a little each year.
function infectionRows(cy) {
  const k = cy - 2020;
  return ['990101', '990201'].map((ccn, h) => {
    const row = { ccn, start: `${cy}-01-01`, end: `${cy}-12-31` };
    for (let m = 1; m <= 6; m++) {
      const sir = (1.2 - 0.1 * k + 0.05 * h + 0.01 * m);
      Object.assign(row, { [`hai_${m}_sir`]: sir.toFixed(3), [`hai_${m}_observed`]: String(10 - k), [`hai_${m}_predicted`]: (10 / (1.2 - 0.1 * k + 0.05 * h + 0.01 * m)).toFixed(3) });
    }
    return row;
  });
}

// The hospital master for the synthetic hospitals: kinds of hospital and a place on the map. The closed hospital
// (990303) is not in it.
export function synthMaster() {
  const out = new Map();
  let g = 0;
  const place = { AL: [-86.8, 33.0], GA: [-83.5, 32.5], MD: [-76.7, 39.0] };
  for (const [state, list] of Object.entries(SYNTH_RECORDS)) {
    for (const [ccn] of list) {
      g++;
      if (ccn === '990303') continue;
      out.set(ccn, {
        ccn, name: `Example Hospital ${g}`, city: 'Exampleton', state,
        teach: g % 3 === 0 ? 'major' : 'none', beds: 100 + g * 60, own: state === 'GA' ? (g % 2 ? 'For-profit' : 'Government') : 'Nonprofit',
        urban: state === 'AL', types: g % 4 === 0 ? ['SCH'] : [], lon: place[state][0] + g * 0.01, lat: place[state][1] + g * 0.01,
      });
    }
  }
  return out;
}
