// HACRP method constants and measure short names: the only numbers the site's words may use that don't come from
// CMS's file. Copy files hold no digits, so these arrive through placeholders. Each constant cites a claim in
// sites/hacrp/CLAIMS.md.

// CMS reduces a flagged hospital's Medicare inpatient payments by this percentage.
export const REDUCTION_PCT = 1;
// Hospitals with a Total HAC Score above this percentile of scores get the reduction.
export const CUTOFF_PERCENTILE = 75;
// CMS winsorizes each measure's results at these percentiles before standardizing them.
export const WINSOR_LOW = 5;
export const WINSOR_HIGH = 95;

export const CLAIMS = {
  REDUCTION_PCT: 'HACRP-01',
  CUTOFF_PERCENTILE: 'HACRP-02',
  WINSOR_LOW: 'HACRP-03',
  WINSOR_HIGH: 'HACRP-03',
};

// CMS's short names for the measures (PSI 90 has a digit, so these live here, not in copy.js).
export const SHORT_NAMES = Object.freeze({
  PSI90: 'PSI 90',
  CLABSI: 'CLABSI',
  CAUTI: 'CAUTI',
  SSI: 'SSI',
  CDI: 'CDI',
  MRSA: 'MRSA',
});
