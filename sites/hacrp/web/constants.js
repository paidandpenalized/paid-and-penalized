// HACRP method constants and measure short names: the only numbers the site's words may use that don't come from
// CMS's file. Copy files hold no digits, so these arrive through placeholders. Each constant cites a claim in
// sites/hacrp/CLAIMS.md.
import { MEASURES } from '../../../engine/js/hacrp/measures.js';
import { decimal, pct } from '../../../web/render/format.js';

// CMS reduces a flagged hospital's Medicare inpatient payments by this percentage.
export const REDUCTION_PCT = 1;
// REDUCTION_PCT as the pages say it ("1%").
export const REDUCTION_TEXT = pct(REDUCTION_PCT / 100, 0);
// Hospitals with a Total HAC Score above this percentile of scores get the reduction.
export const CUTOFF_PERCENTILE = 75;
// CMS winsorizes each measure's results at these percentiles before standardizing them.
export const WINSOR_LOW = 5;
export const WINSOR_HIGH = 95;
// An SIR of this value means as many infections as NHSN's model predicted; the what-if's helper text says so.
export const SIR_EXPECTED = 1;
export const SIR_EXPECTED_TEXT = decimal(SIR_EXPECTED, 1);

// Display constants, not CMS's method. The what-if's ramp spans these percentiles of published Total HAC Scores.
export const RAMP_LOW_PCT = 5;
export const RAMP_HIGH_PCT = 95;
// The display step from the what-if standard: each measure's leverage is stated per this change in its value.
export const LEVERAGE_STEP = 0.1;

export const CLAIMS = {
  REDUCTION_PCT: 'HACRP-01',
  CUTOFF_PERCENTILE: 'HACRP-02',
  WINSOR_LOW: 'HACRP-03',
  WINSOR_HIGH: 'HACRP-03',
  SIR_EXPECTED: 'HACRP-14',
};

// CMS's short names for the measures, read from its column names ("PSI 90 W Z Score" -> "PSI 90"). PSI 90 has a
// digit, so these can't live in copy.js.
export const SHORT_NAMES = Object.freeze(Object.fromEntries(MEASURES.map((m) => [m.id, m.z.replace(/ W Z Score$/, '')])));
