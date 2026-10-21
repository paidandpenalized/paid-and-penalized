// The HACRP site's words. No digit characters: every number arrives through a {placeholder}, formatted before it
// is filled. `claim` names the row of sites/hacrp/CLAIMS.md that backs a statement about CMS's program (null for
// sentences that only restate CMS's file or this site's arithmetic).
import { fillCopy } from '../../../web/render/components.js';

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
    claim: 'HACRP-15',
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

  // The what-if: this site's arithmetic on CMS's values, always in the conditional.
  whatifNone: { text: 'CMS reports a Total HAC Score of {score} and a payment reduction decision of {decision}.', claim: null },
  // The median hospital is this site's own synthetic record: nothing about it is CMS's.
  whatifNoneMedian: {
    text: 'This site recomputes a Total HAC Score of {score} and a payment reduction decision of {decision} for its hypothetical hospital at the national median on every measure.',
    claim: null,
  },
  whatifRise: { text: 'With {changes}, the Total HAC Score would rise from {before} to {after}.', claim: null },
  whatifFall: { text: 'With {changes}, the Total HAC Score would fall from {before} to {after}.', claim: null },
  whatifStay: { text: 'With {changes}, the Total HAC Score would stay at {score}.', claim: null },
  whatifItem: { text: '{short} at {after} instead of {before}', claim: null },
  whatifItemAssigned: { text: '{short} at {after} (had it been submitted)', claim: null },
  // One change that doesn't move the score: past CMS's cap, or at or below its floor.
  whatifCapLower: { text: 'Lowering {short} to {after} would not change the score: CMS caps {short} at {cap}.', claim: 'HACRP-03' },
  whatifCapRaise: { text: 'Raising {short} to {after} would not change the score: CMS caps {short} at {cap}.', claim: 'HACRP-03' },
  whatifCapAssigned: {
    text: '{short} at {after} (had it been submitted) would not change the score: CMS caps {short} at {cap}.',
    claim: 'HACRP-03',
  },
  whatifFloorLower: {
    text: 'Lowering {short} to {after} would not change the score: CMS gives every {short} value at or below {floor} the same score.',
    claim: 'HACRP-03',
  },
  whatifFloorRaise: {
    text: 'Raising {short} to {after} would not change the score: CMS gives every {short} value at or below {floor} the same score.',
    claim: 'HACRP-03',
  },
  // The same, for one change among several.
  whatifCapNote: { text: 'CMS caps {short} at {cap}, so the change to {short} does not move the score.', claim: 'HACRP-03' },
  // A change that moves the score and ends in the dead zone: past it, the value no longer matters.
  whatifCapReached: { text: 'CMS caps {short} at {cap}, so any value above it scores the same.', claim: 'HACRP-03' },
  whatifFloorReached: { text: 'CMS gives every {short} value at or below {floor} the same score.', claim: 'HACRP-03' },
  whatifFloorNote: {
    text: 'CMS gives every {short} value at or below {floor} the same score, so the change to {short} does not move the score.',
    claim: 'HACRP-03',
  },
  whatifYes: {
    text: "That would be above CMS's line, so the payment reduction decision would be Yes: a {pct} cut.",
    claim: 'HACRP-01',
  },
  whatifNo: { text: "That would be at or below CMS's line, so the payment reduction decision would be No: no cut.", claim: 'HACRP-01' },
  whatifClose: {
    text: "That would be too close to call: this site's recompute cannot place it on either side of CMS's line, so the cut would be {cuts}.",
    claim: 'HACRP-01',
  },
  whatifCmsWas: { text: 'CMS reports a payment reduction decision of {decision}.', claim: null },
  whatifMedianWas: { text: 'Before these changes, this site recomputes its decision as {decision}.', claim: null },
  whatifNA: { text: 'The payment reduction decision would stay {decision}.', claim: 'HACRP-13' },
  flagYes: { text: 'Yes', claim: null },
  flagNo: { text: 'No', claim: null },
  flagClose: { text: 'too close to call', claim: null },
  flagNA: { text: 'N/A (not subject to the reduction)', claim: 'HACRP-13' },
  cutEither: { text: '{none} or {pct}', claim: 'HACRP-01' },
  // The solver, one measure on its own, from CMS's values.
  solverNeeded: { text: '{value} or lower', claim: null },
  solverNotPossible: { text: 'not possible with this measure alone', claim: null },
  solverCushion: { text: 'up to {value}', claim: null },
  solverUnlimited: { text: 'any value: CMS caps {short} at {cap}', claim: 'HACRP-03' },
  solverNoCushion: { text: 'no cushion', claim: null },
  solverNoCushionNote: { text: 'The current value is already the highest that keeps the decision at No.', claim: null },
  solverAssignedNote: { text: "CMS assigned this measure's score, so there is no submitted value to solve for.", claim: 'HACRP-05' },
  // Copy for a slide: plain text lines.
  slideScore: { text: 'Total HAC Score: {before} → {after} (Hypothetical)', claim: null },
  slideDecision: { text: 'Payment reduction decision: {before} → {after} (Hypothetical)', claim: null },
  slideDecisionOnly: { text: 'Payment reduction decision: {decision}', claim: null },
  // Under every what-if, verbatim.
  whatifStanding: {
    text: "A what-if shows the formula's arithmetic, not what a hospital could realistically change or how. CMS's real result also depends on other hospitals.",
    claim: 'HACRP-02',
  },

  // The what-if component on a page.
  whatifHeading: { text: 'What if a measure were different?', claim: null },
  whatifIntro: {
    text: "Change a measure's value to see how this site recomputes the Total HAC Score and the payment reduction decision, starting from CMS's values.",
    claim: null,
  },
  whatifIntroMedian: {
    text: "Change a measure's value to see how this site recomputes the score of its hypothetical hospital at the national median on every measure.",
    claim: null,
  },
  whatifNoScript: { text: 'The what-if needs JavaScript. Without it, the values below stay as they are.', claim: null },
  whatifBanner: { text: 'Reader-made scenario, not CMS data.', claim: null },
  whatifBannerLink: { text: "Open this page with CMS's values", claim: null },
  whatifStartCms: { text: 'CMS reports', claim: null },
  whatifStartMedian: { text: 'Starting point', claim: null },
  whatifHypothetical: { text: 'Hypothetical', claim: null },
  whatifRowScore: { text: 'Total HAC Score', claim: null },
  whatifRowDecision: { text: 'Payment reduction decision', claim: null },
  whatifRowCut: { text: 'Payment cut', claim: 'HACRP-01' },
  whatifResultLabel: { text: 'Result of the what-if', claim: null },
  whatifRampLine: { text: "CMS's line", claim: null },
  whatifEstimate: {
    text: "Estimate: a changed measure's z-score is this site's recompute, which can differ slightly from CMS's.",
    claim: null,
  },
  whatifCopy: { text: 'Copy for a slide', claim: null },
  whatifCopied: { text: 'Copied.', claim: null },
  whatifCopyFallback: { text: 'This browser did not copy the text. It is selected below: copy it from there.', claim: null },
  whatifSlideLabel: { text: 'Text for a slide', claim: null },
  whatifReset: { text: 'Reset', claim: null },
  whatifMedian: { text: 'Bring all to the national median', claim: null },
  whatifMedianHelp: {
    text: '{button} lowers each measure above its national median to that median and leaves the measures CMS assigned as they are.',
    claim: null,
  },
  whatifSolveYes: { text: 'What would it take?', claim: null },
  whatifSolveNo: { text: 'How much cushion?', claim: null },
  whatifFieldsLegend: { text: 'Measure values', claim: null },
  whatifWeight: { text: 'Each measure weighs {one} ÷ {n} of the score.', claim: 'HACRP-04' },
  whatifLeverage: { text: "Each {tenth} moves the score by {leverage}, between CMS's floor and cap.", claim: 'HACRP-03' },
  whatifSirHelp: { text: 'SIR {one} = as many infections as predicted', claim: 'HACRP-14' },
  whatifPsiHelp: { text: 'Lower is better', claim: 'HACRP-16' },
  whatifMarks: {
    text: 'National median {median} (the tick). CMS cap {cap}: every value above it scores the same (shaded).',
    claim: 'HACRP-03',
  },
  whatifMarksFloor: {
    text: 'National median {median} (the tick). CMS floor {floor} and cap {cap}: every value below the floor, or above the cap, scores the same (shaded).',
    claim: 'HACRP-03',
  },
  whatifSliderLabel: { text: '{short} value', claim: null },
  // A slider's aria-valuetext beside its value.
  valueAtCap: { text: "{value}, at CMS's cap", claim: 'HACRP-03' },
  valueAboveCap: { text: "{value}, above CMS's cap", claim: 'HACRP-03' },
  valueAssigned: { text: 'no value: CMS assigned the worst score', claim: 'HACRP-05' },
  whatifInvalid: { text: 'Enter a number from {min} to {max}.', claim: null },
  whatifAssignedPlaceholder: { text: 'none (assigned z-score {z})', claim: null },
  whatifAssignedHelp: {
    text: "CMS assigned this measure's score; CMS's footnote in the table above gives the reason. Enter a value to see the score had it been submitted.",
    claim: 'HACRP-05',
  },
  whatifPredictedLabel: { text: 'Optional: your NHSN predicted infections for {short}, {start} to {end}', claim: null },
  whatifPredictedHelp: { text: 'Stays in your browser; never sent.', claim: null },
  whatifPredictedInvalid: { text: 'Enter a number of {min} or more.', claim: null },
  whatifCountMore: {
    text: "About {count} more infections than at CMS's value. This rests on the predicted count you entered, not on CMS data.",
    claim: null,
  },
  whatifCountFewer: {
    text: "About {count} fewer infections than at CMS's value. This rests on the predicted count you entered, not on CMS data.",
    claim: null,
  },
  whatifCountSame: { text: "The same number of infections as at CMS's value.", claim: null },
  whatifBarsHeading: { text: "Each measure's part of the score", claim: 'HACRP-04' },
  whatifBarsCaption: {
    text: 'A measure adds its z-score divided by {n}, the number of measures scored. Bars right of the center line raise the score. Hatched: assigned by CMS.',
    claim: 'HACRP-04',
  },
  whatifBarAssigned: { text: 'assigned by CMS', claim: 'HACRP-05' },
  solverCaption: { text: "From CMS's values, one measure at a time, with every other measure held at CMS's value.", claim: null },
  solverCaptionMedian: { text: 'From the starting values, one measure at a time, with every other measure held where it starts.', claim: null },
  solverColMeasure: { text: 'Measure', claim: null },
  solverColNeeded: { text: 'Value that would read No', claim: null },
  solverColCushion: { text: 'Highest value that keeps No', claim: null },
  solverColNote: { text: 'Note', claim: null },
  whatifHeld: {
    text: "Held fixed: every other hospital's results, CMS's line, and each measure's mean, spread, floor and cap as this site fits them to CMS's published values.",
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
  hospitalDescription: {
    text: "{name} ({city}, {state}): CMS's FY{fy} Hospital-Acquired Condition score and payment decision, from public CMS data.",
    claim: null,
  },
  kicker: { text: '{subtitle} · fiscal year {fy}', claim: null },
  place: { text: '{city}, {state} · CCN {ccn}', claim: null },
  heroScore: { text: 'Total HAC Score, as CMS reports it', claim: null },
  heroLabel: { text: 'Score and payment decision', claim: null },
  noScore: { text: 'No score published', claim: null },
  heroDecision: { text: 'Payment reduction', claim: null },
  decisionCms: { text: "CMS's value: {decision}", claim: null },
  pillYes: { text: '{pct} cut', claim: 'HACRP-01' },
  pillNo: { text: 'No cut', claim: null },
  pillNA: { text: 'N/A', claim: null },
  // The row CMS marked Yes with no score: CMS's literal value, nothing inferred.
  pillCms: { text: '{decision}', claim: null },
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
  estimateNote: {
    text: "This site recomputes this measure's z-score from CMS's published value. The recompute can differ from CMS's z-score by up to {maxError}.",
    claim: null,
  },
  estimateMore: { text: 'How this site estimates', claim: null },
  footnotesHeading: { text: "CMS's footnotes on this page", claim: null },
  backToProgram: { text: 'How the program works, and how to find another hospital', claim: null },

  // As-of bar and source line (hospital and program pages).
  asofHeading: { text: 'About this data', claim: null },
  asofFy: { text: 'Fiscal year {fy}', claim: null },
  asofPsi: { text: '{short} period: {start} to {end}', claim: null },
  asofHai: { text: 'Infection measures period: {start} to {end}', claim: null },
  asofLatest: { text: 'Latest public hospital results: FY{fy}; FY{next} expected early {next}', claim: 'HACRP-12' },
  asofReleased: { text: 'Provider Data Catalog release: {date}', claim: null },
  source: { text: 'Source: CMS Provider Data Catalog, HACRP FY{fy} ({id}), released {date}.', claim: null },
  datasetLink: { text: "CMS's dataset page", claim: null },
  // The data download and the citation block (both pages).
  dataCsv: { text: "Download all hospitals' data (CSV)", claim: null },
  dataDictionary: { text: 'Data dictionary', claim: null },
  citeHeading: { text: 'Cite this page', claim: null },
  citeText: { text: '{site}. {title}. {url}. {source}', claim: null },
  citeCopy: { text: 'Copy citation', claim: null },
  citeCopied: { text: 'Copied.', claim: null },
  citeFailed: { text: 'Could not copy. The citation is selected; copy it with your keyboard.', claim: null },

  // Program page.
  programTitle: { text: 'Hospital-Acquired Conditions (HACRP), FY{fy}', claim: null },
  dek: { text: 'Infections and complications patients develop in the hospital.', claim: null },
  programDescription: {
    text: "How Medicare's Hospital-Acquired Condition Reduction Program works, and CMS's FY{fy} scores and payment decisions for every hospital in its file.",
    claim: null,
  },
  whatHeading: { text: 'What the program is', claim: null },
  whatScore: {
    text: 'Each year, CMS scores hospitals on measures of infections and complications patients develop in the hospital, and combines them into a Total HAC Score.',
    claim: 'HACRP-17',
  },
  whatWho: { text: "The hospitals scored are those paid under Medicare's inpatient payment system.", claim: 'HACRP-18' },
  whatCut: {
    text: 'Hospitals whose score is above the {percentile} percentile of Total HAC Scores, as CMS calculates it, have their Medicare inpatient payments cut by {pct} for the fiscal year.',
    claim: 'HACRP-02',
  },
  whatRelative: {
    text: "Each measure compares a hospital with all hospitals scored on that measure, so the score reflects relative performance, not a fixed standard.",
    claim: 'HACRP-15',
  },
  programMeasures: { text: "The Total HAC Score is the average of a hospital's z-scores on these measures.", claim: 'HACRP-04' },
  programMeasuresZ: { text: 'Each z-score compares the hospital with all hospitals scored on that measure.', claim: 'HACRP-15' },
  periodsHeading: { text: 'When the data are from', claim: null },
  periodPsi: { text: '{label} ({short}): {start} to {end}', claim: null },
  periodHai: { text: 'Infection measures ({shorts}): {start} to {end}', claim: null },
  lineHeading: { text: "CMS's line", claim: null },
  line: {
    text: 'Among hospitals with a Yes or No payment decision, CMS cut those with a published Total HAC Score of {lowestYes} or higher and none at {highestNo} or lower.',
    claim: null,
  },
  lineMaryland: {
    text: "Maryland's hospitals are scored but not subject to the reduction.",
    claim: 'HACRP-13',
  },
  lineRelative: {
    text: "The line depends on other hospitals' scores, so a hospital can land above it without its own results getting worse.",
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
  sandboxLabel: { text: 'Sandbox: a hypothetical hospital at the national median on every measure', claim: null },
  linksHeading: { text: 'Sources and related sites', claim: null },
  linkCmsProgram: { text: "CMS: Hospital-Acquired Condition Reduction Program", claim: null },
  linkPdc: { text: 'CMS Provider Data Catalog: the hospital file this site uses', claim: null },
  linkCareCompare: { text: 'Medicare Care Compare', claim: null },
  linkCareCompareNote: { text: "CMS's own site for comparing hospitals.", claim: null },
  linkLeapfrog: { text: 'Leapfrog Hospital Safety Grade', claim: null },
  linkLeapfrogNote: { text: 'Related, different: a separate rating with its own method.', claim: null },

  // Figures (DES-31): each takeaway is one sentence filled from data; the alt text names what the chart shows.
  figColMark: { text: 'Mark', claim: null },
  figColScore: { text: 'Total HAC Score', claim: null },
  // Hospital page, Figure: each measure's part of the score.
  figPartsTakeaway: {
    text: "{short} added the most to this hospital's Total HAC Score of {total} among its measured results: {contribution}.",
    claim: 'HACRP-04',
  },
  figPartsNone: {
    text: "Each bar is one measure's part of this hospital's Total HAC Score of {total}: its z-score divided by {n}, the number of measures scored.",
    claim: 'HACRP-04',
  },
  figPartsAlt: {
    text: "Bar chart of each measure's part of this hospital's Total HAC Score. Bars right of the center line raise the score; hatched bars are scores CMS assigned.",
    claim: 'HACRP-05',
  },
  figPartsAssigned: { text: '{short}, assigned', claim: 'HACRP-05' },
  figColPart: { text: 'Part of the score', claim: null },
  // Hospital page, Figure: each measure's value against the national range.
  figRangeTakeaway: {
    text: "Of the {k} measures with a published value, this hospital's value is above the national median on {above} and at or below it on {rest}.",
    claim: null,
  },
  figRangeOne: {
    text: 'This hospital has a published value for one measure, {short}, and it is {side} the national median.',
    claim: null,
  },
  figSideAbove: { text: 'above', claim: null },
  figSideBelow: { text: 'at or below', claim: null },
  figRangeAlt: {
    text: "For each measure, this hospital's value marked with a triangle against the national range from CMS's floor to its cap, with the national median as a tick.",
    claim: null,
  },
  figRangeThis: { text: 'This hospital', claim: null },
  figRangeMedian: { text: 'National median', claim: null },
  figRangeRange: { text: "CMS's floor to cap", claim: 'HACRP-03' },
  figRangeNoValue: { text: '{short}: no value published', claim: null },
  figColFloor: { text: 'CMS floor', claim: 'HACRP-03' },
  figColCap: { text: 'CMS cap', claim: 'HACRP-03' },

  // Program page: the formula stepper on the median hospital.
  stepsHeading: { text: 'How a score is built, step by step', claim: null },
  stepsIntro: {
    text: "These steps follow this site's hypothetical hospital at the national median on every measure, so its numbers are this site's, not CMS's. CMS takes the same steps for every hospital it scores.",
    claim: 'HACRP-19',
  },
  stepValue: {
    text: "Start from each measure's value. For this hospital, that is the national median of the values CMS published.",
    claim: null,
  },
  stepLimit: {
    text: "Limit each value to the measure's range: CMS sets a floor at the {low} percentile of values and a cap at the {high}, and a value past either end counts as that end.",
    claim: 'HACRP-03',
  },
  stepZ: {
    text: "Turn each limited value into a z-score: subtract the measure's mean and divide by its standard deviation. This site fits each mean and standard deviation to CMS's published values and z-scores.",
    claim: 'HACRP-15',
  },
  stepAverage: {
    text: 'Average the z-scores: the {n} z-scores add up to {sum}, and {sum} ÷ {n} is {total}, the Total HAC Score.',
    claim: 'HACRP-04',
  },
  stepLine: { text: "Compare the score with CMS's line.", claim: null },
  stepRounded: { text: 'Numbers are rounded for display.', claim: null },
  stepColValue: { text: 'Value', claim: null },
  stepColFloor: { text: 'Floor', claim: null },
  stepColCap: { text: 'Cap', claim: null },
  stepColLimited: { text: 'Limited', claim: null },
  stepColMean: { text: 'Mean', claim: null },
  stepColSd: { text: 'SD', claim: null },
  stepTableValue: { text: "Each measure's value, CMS's floor and cap, and the value limited to them", claim: null },
  stepTableZ: { text: "Each limited value, the measure's mean and standard deviation, and the z-score", claim: null },
  // Program page, Figure: the median hospital against CMS's line (the stepper's last step).
  figLineMedian: { text: 'Median hospital', claim: null },
  figLineNo: {
    text: "This site's hypothetical median hospital scores {total}, at or below {highestNo}, the highest score CMS marked No, so its decision would be No.",
    claim: null,
  },
  figLineYes: {
    text: "This site's hypothetical median hospital scores {total}, at or above {lowestYes}, the lowest score CMS marked Yes, so its decision would be Yes.",
    claim: null,
  },
  figLineClose: {
    text: "This site's hypothetical median hospital scores {total}, between {highestNo} and {lowestYes}, so its decision would be too close to call.",
    claim: null,
  },
  figLineAlt: {
    text: "A line of Total HAC Scores with CMS's line marked and the side above it shaded; a triangle marks the median hospital's score.",
    claim: null,
  },
  figLineHighestNo: { text: 'Highest score CMS marked No', claim: null },
  figLineLowestYes: { text: 'Lowest score CMS marked Yes', claim: null },
  // Program page, Figure: the histogram of scores.
  figScoresTakeaway: {
    text: 'CMS cut payments to {yes} of {decided} hospitals with a payment decision: those whose Total HAC Score was above its line.',
    claim: 'HACRP-02',
  },
  figScoresAlt: {
    text: "Histogram of the Total HAC Scores of hospitals with a Yes or No payment decision, with CMS's line marked; the columns above the line are the hospitals CMS cut.",
    claim: null,
  },
  figScoresTip: { text: "{count} hospitals scored from {from} to {to}; CMS's decision for each: {decision}", claim: null },
  figScoresTipOne: { text: "One hospital scored from {from} to {to}; CMS's decision: {decision}", claim: null },
  figScoresTipNone: { text: 'No hospital scored from {from} to {to}', claim: null },
  figColFrom: { text: 'Scores from', claim: null },
  figColTo: { text: 'To', claim: null },
  figColHospitals: { text: 'Hospitals', claim: null },
  figColDecision: { text: "CMS's decision", claim: null },
  // Program page, Figure: the state tile grid.
  figStatesTakeaway: {
    text: 'Nationally, CMS cut payments to {share} of hospitals with a payment decision; by state, the share ran from {low} to {high}.',
    claim: null,
  },
  figStatesAlt: {
    text: "Map of the states as tiles, each shaded by the share of its hospitals with a payment decision that CMS cut; hatched tiles have no share to show.",
    claim: null,
  },
  figStatesTile: { text: '{yes} of {decided} cut ({share})', claim: null },
  figStatesNA: { text: 'not subject to the reduction', claim: 'HACRP-13' },
  figStatesNone: { text: "no hospitals in CMS's file", claim: null },
  figStatesNoDecision: { text: 'no hospitals with a payment decision', claim: null },
  figColState: { text: 'State', claim: null },
  figColCut: { text: 'Hospitals cut', claim: null },
  figColDecided: { text: 'With a decision', claim: null },
  figColShare: { text: 'Share cut', claim: null },

  // Program page: the table of every hospital (client/program.js fills it from the hospitals asset).
  tableHeading: { text: "Every hospital in CMS's file", claim: null },
  tableIntro: {
    text: 'Sorted by state, then name. Sort by any column, pick a state, or search by name.',
    claim: null,
  },
  tableNoScript: {
    text: 'The sortable table of every hospital needs JavaScript; the CSV file holds the same values.',
    claim: null,
  },
  tableCsv: { text: "Download all hospitals' data (CSV)", claim: null },
  tableCaption: { text: "Every hospital in CMS's file, with its Total HAC Score and payment reduction decision as CMS reports them", claim: null },
  tableState: { text: 'State', claim: null },
  tableAllStates: { text: 'All states', claim: null },
  tableName: { text: 'Hospital name contains', claim: null },
  tableColName: { text: 'Hospital', claim: null },
  tableColCity: { text: 'City', claim: null },
  tableColState: { text: 'State', claim: null },
  tableColScore: { text: 'Total HAC Score', claim: null },
  tableColDecision: { text: 'Payment reduction', claim: null },
  tableCount: { text: '{n} hospitals shown.', claim: null },
  tableCountOne: { text: 'One hospital shown.', claim: null },
  tableCountNone: { text: 'No hospital matches.', claim: null },
  tableCountFirst: { text: 'Showing the first {shown} of {n} hospitals.', claim: null },
  tableShowAll: { text: 'Show all {n}', claim: null },
};

// COPY[key].text with each {placeholder} filled; see fillCopy for the rules.
export const fill = (key, values) => fillCopy(COPY, key, values);

// A measure's name as a label (capitalized): "Central line–associated bloodstream infections".
export const measureLabel = (id) => {
  const text = fill(`measure${id}`);
  return text[0].toUpperCase() + text.slice(1);
};
