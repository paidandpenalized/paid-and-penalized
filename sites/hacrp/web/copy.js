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
