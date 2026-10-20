// The HACRP site's words. No digit characters: every number arrives through a {placeholder}, formatted before it
// is filled. `claim` names the row of sites/hacrp/CLAIMS.md that backs a statement about CMS's program (null for
// sentences that only restate CMS's file or this site's arithmetic).
export const COPY = {
  // Summary: what CMS reports, CMS's notes verbatim, then what the decision and the score mean.
  leadScored: {
    text: 'For fiscal year {fy}, CMS reports a Total HAC Score of {total} for {name} and a payment reduction decision of {decision}.',
    claim: null,
  },
  leadNoScore: {
    text: 'For fiscal year {fy}, CMS reports no Total HAC Score for {name} and a payment reduction decision of {decision}.',
    claim: null,
  },
  noteScore: { text: "CMS's note on the score: {notes}", claim: null },
  noteDecision: { text: "CMS's note on the payment reduction: {notes}", claim: null },
  whyYes: {
    text: "CMS cut this hospital's Medicare inpatient payments by {pct} for that fiscal year because its score was above CMS's line.",
    claim: 'HACRP-01',
  },
  whyNo: {
    text: "Its score was at or below CMS's line, so this program did not cut its Medicare inpatient payments for that fiscal year.",
    claim: 'HACRP-01',
  },
  scoreIs: {
    text: 'The Total HAC Score compares hospitals with each other on the infection and patient-safety measures each hospital was scored on.',
    claim: 'HACRP-04',
  },
  // Site framing, not a claim about CMS's program.
  notAGrade: { text: 'It is not a grade of the quality of care.', claim: null },

  // This site's arithmetic.
  distanceYes: {
    text: "This site recomputes the distance to CMS's line: the score is {distance} above {highestNo}, the highest score CMS marked No.",
    claim: null,
  },
  distanceNo: {
    text: "This site recomputes the distance to CMS's line: the score is {distance} below {lowestYes}, the lowest score CMS marked Yes.",
    claim: null,
  },
  largest: {
    text: "Of the measures with a measured result, {label} ({short}) added the most to the score. This site recomputes its part as {contribution} (the measure's z-score divided by the number of measures scored).",
    claim: 'HACRP-04',
  },
  oneMeasure: {
    text: 'CMS scored this hospital on a single measure, so that measure alone set its Total HAC Score.',
    claim: 'HACRP-04',
  },
  assigned: {
    text: "CMS assigned this measure its worst possible score under the program's rules; it is not a measured result. CMS's footnote gives the reason.",
    claim: 'HACRP-05',
  },

  // Shown on every page with a payment decision, verbatim.
  standing: {
    text: "A penalty reflects how CMS's formula scored relative performance; it is not a verdict on the quality of care.",
    claim: null,
  },

  // Measure names, as they read mid-sentence.
  measurePSI90: { text: 'patient safety and adverse events composite', claim: 'HACRP-06' },
  measureCLABSI: { text: 'central line–associated bloodstream infections', claim: 'HACRP-07' },
  measureCAUTI: { text: 'catheter-associated urinary tract infections', claim: 'HACRP-08' },
  measureSSI: { text: 'surgical site infections after colon surgery or abdominal hysterectomy', claim: 'HACRP-09' },
  measureCDI: { text: 'Clostridioides difficile (C. diff) infections', claim: 'HACRP-10' },
  measureMRSA: { text: 'MRSA bloodstream infections', claim: 'HACRP-11' },

  // Hospital page.
  hospitalTitle: { text: '{name}, {city}, {state}: Hospital-Acquired Conditions, FY{fy}', claim: null },
  kicker: { text: '{subtitle} · fiscal year {fy}', claim: null },
  place: { text: '{city}, {state} · CCN {ccn}', claim: null },
  heroScore: { text: 'Total HAC Score, as CMS reports it', claim: null },
  heroDecision: { text: 'Payment reduction', claim: null },
  decisionCms: { text: "CMS's value: {decision}", claim: null },
  pillYes: { text: '{pct} cut', claim: 'HACRP-01' },
  pillNo: { text: 'No cut', claim: null },
  pillNA: { text: 'N/A', claim: null },
  // The row CMS marked Yes with no score: CMS's literal value, nothing inferred.
  pillCms: { text: 'Payment reduction: {decision}', claim: null },
  measuresHeading: { text: 'The measures', claim: null },
  measuresIntro: {
    text: "CMS's published value and z-score for each measure. A higher z-score adds more to the Total HAC Score.",
    claim: 'HACRP-04',
  },
  colMeasure: { text: 'Measure', claim: null },
  colValue: { text: 'CMS value', claim: null },
  colZ: { text: 'Z-score', claim: null },
  colNotes: { text: 'Notes', claim: null },
  noValue: { text: 'no value published', claim: null },
  footnoteLead: { text: 'CMS footnote {code}:', claim: null },
  estimateTag: { text: 'estimate', claim: null },
  estimateTitle: {
    text: "This site's what-if recomputes this measure's z-score from CMS's public data; the result can differ from CMS's by up to {maxError}.",
    claim: null,
  },
  footnotesHeading: { text: "CMS's footnotes on this page", claim: null },
  backToProgram: { text: 'How the program works, and every hospital in it', claim: null },

  // As-of bar and source line (hospital and program pages).
  asofHeading: { text: 'About this data', claim: null },
  asofFy: { text: 'Fiscal year {fy}', claim: null },
  asofPsi: { text: '{short} period: {start} to {end}', claim: null },
  asofHai: { text: 'Infection measures period: {start} to {end}', claim: null },
  asofLatest: { text: 'Latest public hospital results: FY{fy}; FY{next} expected early {next}', claim: 'HACRP-12' },
  asofReleased: { text: 'Provider Data Catalog release: {date}', claim: null },
  source: { text: 'Source: CMS Provider Data Catalog, HACRP FY{fy} ({id}), released {date}.', claim: null },
  datasetLink: { text: "CMS's dataset page", claim: null },

  // Program page.
  programTitle: { text: 'Hospital-Acquired Conditions (HACRP), FY{fy}', claim: null },
  dek: { text: 'Infections and complications patients develop in the hospital.', claim: null },
  whatHeading: { text: 'What the program is', claim: null },
  whatScore: {
    text: "Each year, CMS scores hospitals paid under Medicare's inpatient payment system on measures of infections and complications patients develop in the hospital, and combines them into a Total HAC Score.",
    claim: 'HACRP-04',
  },
  whatCut: {
    text: 'Hospitals whose score is above the {percentile} percentile of Total HAC Scores, as CMS calculates it, have their Medicare inpatient payments cut by {pct} for the fiscal year.',
    claim: 'HACRP-02',
  },
  whatRelative: {
    text: "Each measure compares a hospital with all hospitals scored on that measure, so the score reflects relative performance, not a fixed standard.",
    claim: 'HACRP-04',
  },
  programMeasures: {
    text: "The Total HAC Score is the average of a hospital's z-scores on these measures; each z-score compares the hospital with all hospitals scored on that measure.",
    claim: 'HACRP-04',
  },
  periodsHeading: { text: 'When the data are from', claim: null },
  periodPsi: { text: '{label} ({short}): {start} to {end}', claim: null },
  periodHai: { text: 'Infection measures ({shorts}): {start} to {end}', claim: null },
  lineHeading: { text: "CMS's line", claim: null },
  line: {
    text: 'CMS cut hospitals with a published Total HAC Score of {lowestYes} or higher; none at {highestNo} or lower.',
    claim: null,
  },
  lineRelative: {
    text: "The line is set by every hospital's scores, so a hospital can land above it without its own results getting worse.",
    claim: 'HACRP-02',
  },
  countsHeading: { text: 'Fiscal year {fy} in counts', claim: null },
  countDecided: {
    text: 'CMS cut Medicare inpatient payments to {yes} of the {decided} hospitals with a Total HAC Score and a payment decision of Yes or No.',
    claim: null,
  },
  countScored: { text: 'CMS published a Total HAC Score for {scored} hospitals.', claim: null },
  searchHeading: { text: 'Find a hospital', claim: null },
  searchLabel: { text: 'Hospital name', claim: null },
  searchHint: { text: "Pick a hospital from the list to open its page.", claim: null },
  linksHeading: { text: 'Sources and related sites', claim: null },
  linkCmsProgram: { text: "CMS: Hospital-Acquired Condition Reduction Program", claim: null },
  linkPdc: { text: 'CMS Provider Data Catalog: the hospital file this site uses', claim: null },
  linkCareCompare: { text: 'Medicare Care Compare', claim: null },
  linkCareCompareNote: { text: "CMS's own site for comparing hospitals.", claim: null },
  linkLeapfrog: { text: 'Leapfrog Hospital Safety Grade', claim: null },
  linkLeapfrogNote: { text: 'Related, different: a separate rating with its own method.', claim: null },
};

const PLACEHOLDER = /\{(\w+)\}/g;

// COPY[key].text with each {placeholder} replaced. Values must be strings (format numbers first); a placeholder
// with no value, or a value with no placeholder, throws.
export function fill(key, values = {}) {
  if (!Object.hasOwn(COPY, key)) throw new RangeError(`no copy key "${key}"`);
  const { text } = COPY[key];
  const used = new Set();
  const out = text.replace(PLACEHOLDER, (_, name) => {
    if (!Object.hasOwn(values, name)) throw new RangeError(`copy "${key}": no value for {${name}}`);
    if (typeof values[name] !== 'string') throw new TypeError(`copy "${key}": {${name}} must be a formatted string`);
    used.add(name);
    return values[name];
  });
  const unused = Object.keys(values).filter((name) => !used.has(name));
  if (unused.length) throw new RangeError(`copy "${key}": unused value(s) ${unused.join(', ')}`);
  return out;
}
