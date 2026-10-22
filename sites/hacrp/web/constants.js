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
// The state map's shading steps: the share of a state's hospitals with a payment decision that CMS cut, in
// percent (a share at a step takes the darker shade). Round breaks around the national share.
export const MAP_STEPS_PCT = Object.freeze([10, 20, 30, 40]);
// The state map marks a state with fewer hospitals with a payment decision than this, and prints its counts
// (its tooltip and table say "4 of 6"): a percentage of a handful reads as more precise than it is.
export const FEW_DECIDED = 10;
// Care Compare's overall rating runs from one star to this many (a display constant: the record card draws the
// empty stars after the filled ones).
export const CARE_COMPARE_STARS = 5;
// The program page's hospital table shows this many rows until the reader asks for all (or picks a state).
export const TABLE_FIRST_ROWS = 50;
// Hospital page comparisons (display constants). The size groups' bed-count edges (under the first, between each
// pair, the last and up); a group drawn only with at least this many hospitals with a payment decision; the number
// of nearest hospitals listed; about how many columns each group's distribution of scores takes; and about how many
// a measure's distribution takes on its ruler.
export const BED_BANDS = Object.freeze([100, 300, 500]);
export const FEW_IN_GROUP = 5;
export const NEAREST = 8;
export const RIDGE_BINS = 36;
export const RULER_BINS = 28;
// The nearest-hospitals map's distance rings, in miles: those inside the farthest hospital shown, at most RINGS_MAX.
export const RING_MILES = Object.freeze([5, 10, 25, 50, 100, 250]);
export const RINGS_MAX = 3;
// The ledger's ruler axes: room below a floor above zero, and past the cap, as shares of the floor-to-cap span, so the
// hatched ends show; and the nearest-hospitals map's drawn width.
export const RULER_ROOM_LOW = 0.15;
export const RULER_ROOM_HIGH = 0.18;
export const NEAR_MAP_WIDTH = 460;

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
