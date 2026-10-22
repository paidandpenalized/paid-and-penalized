// The HACRP site's words. No digit characters: every number arrives through a {placeholder}, formatted before it
// is filled. `claim` names the row (or a list of rows) of sites/hacrp/CLAIMS.md that backs a statement about CMS's program (null for
// sentences that only restate CMS's file or this site's arithmetic).
import { fillCopy, fillCopyKeep, lastCall } from '../../../web/render/components.js';
import { capitalize, isoDate } from '../../../web/render/format.js';

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
  whyYes: { text: "Its score was above CMS's line, so CMS cut its traditional Medicare inpatient payments by {pct} for the year.", claim: ['HACRP-02', 'HACRP-01', 'HACRP-24'] },
  whyNo: {
    text: "Its score was at or below CMS's line, so this program did not cut its Medicare payments for the year.",
    claim: 'HACRP-01',
  },

  // This site's arithmetic.
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
  whatifCapLower: { text: "Lowering {short} to {after} would not change the score: it is still past the cap ({cap}).", claim: 'HACRP-03' },
  whatifCapRaise: { text: "Raising {short} to {after} would not change the score: every value past the cap ({cap}) scores the same.", claim: 'HACRP-03' },
  whatifCapAssigned: { text: "{short} at {after} (had it been submitted) would not change the score: every value past the cap ({cap}) scores the same.", claim: 'HACRP-03' },
  whatifFloorLower: { text: "Lowering {short} to {after} would not change the score: every {short} value at or below the floor ({floor}) scores the same.", claim: 'HACRP-03' },
  whatifFloorRaise: { text: "Raising {short} to {after} would not change the score: every {short} value at or below the floor ({floor}) scores the same.", claim: 'HACRP-03' },
  // The same, for one change among several.
  whatifCapNote: { text: "{short} stays past the cap ({cap}), so the change to {short} does not move the score.", claim: 'HACRP-03' },
  // A change that moves the score and ends in the dead zone: past it, the value no longer matters.
  whatifCapReached: { text: "Past the cap ({cap}), any {short} value scores the same.", claim: 'HACRP-03' },
  whatifFloorReached: { text: "At or below the floor ({floor}), any {short} value scores the same.", claim: 'HACRP-03' },
  whatifFloorNote: { text: "Every {short} value at or below the floor ({floor}) scores the same, so the change to {short} does not move the score.", claim: 'HACRP-03' },
  whatifYes: { text: "That would be above CMS's line, so the payment reduction decision would be Yes: a {pct} cut.", claim: ['HACRP-02', 'HACRP-01'] },
  whatifNo: { text: "That would be at or below CMS's line, so the payment reduction decision would be No: no cut.", claim: ['HACRP-02', 'HACRP-01'] },
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
  solverUnlimited: { text: "any value: every {short} value past the cap ({cap}) scores the same", claim: 'HACRP-03' },
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
  // A hypothetical cell in the result table that equals the start.
  whatifSame: { text: 'same', claim: null },
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
  whatifSirHelp: { text: 'SIR {one} = as many infections as predicted', claim: 'HACRP-14' },
  whatifPsiHelp: { text: 'Lower is better', claim: 'HACRP-16' },
  // Said once over the measures: what each track marks.
  whatifTrackKey: { text: "On each track the tick is the national median; shaded values score the same as the floor or cap, as this site fits them to CMS's values.", claim: 'HACRP-03' },
  // Each measure's facts in one line: its national median, CMS's floor (above zero) and cap, and what each step of
  // the value moves the score, between the floor and the cap.
  // On a hospital page the facts line starts with CMS's value, which the field and slider stop showing once changed.
  whatifFactsCms: { text: 'CMS {value}', claim: null },
  whatifFacts: { text: 'median {median} · cap {cap} · each {tenth} = {leverage}', claim: 'HACRP-03' },
  whatifFactsFloor: { text: 'median {median} · floor {floor} · cap {cap} · each {tenth} = {leverage}', claim: 'HACRP-03' },
  whatifSliderLabel: { text: '{short} value', claim: null },
  // A slider's aria-valuetext beside its value.
  valueAtCap: { text: "{value}, at the cap", claim: 'HACRP-03' },
  valueAboveCap: { text: "{value}, above the cap", claim: 'HACRP-03' },
  valueAssigned: { text: 'no value: CMS assigned the worst score', claim: 'HACRP-05' },
  whatifInvalid: { text: 'Enter a number from {min} to {max}.', claim: null },
  whatifAssignedPlaceholder: { text: 'none (assigned z-score {z})', claim: null },
  whatifAssignedHelp: {
    text: "CMS assigned this measure's score; CMS's footnote in the table above gives the reason. Enter a value to see the score had it been submitted.",
    claim: 'HACRP-05',
  },
  whatifPredictedSummary: { text: 'Have your NHSN predicted counts? (optional, stays in your browser)', claim: null },
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
  whatifBarsCaption: { text: "A measure adds its z-score divided by {n}, the number of measures scored. Bars right of the center line raise the score. Hatched: assigned by CMS.", claim: ['HACRP-04', 'HACRP-05'] },
  whatifBarAssigned: { text: 'assigned by CMS', claim: 'HACRP-05' },
  solverCaption: { text: "From CMS's values, one measure at a time, with every other measure held at CMS's value.", claim: null },
  solverCaptionMedian: { text: 'From the starting values, one measure at a time, with every other measure held where it starts.', claim: null },
  solverColMeasure: { text: 'Measure', claim: null },
  solverColNeeded: { text: 'Value that would read No', claim: null },
  solverColCushion: { text: 'Highest value that keeps No', claim: null },
  solverColNote: { text: 'Note', claim: null },
  // On paper, in place of the what-if's controls.
  whatifPrint: { text: 'Interactive what-if at {url}', claim: null },
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

  // The site's top bar (pages/parts.js siteHeader): the edition tag beside the program's name and the numbered nav.
  edition: { text: '{subtitle} · FY{fy}', claim: null },
  navHow: { text: 'How it works', claim: null },
  navFy: { text: 'FY{fy}', claim: null },
  fyShort: { text: 'FY{fy}', claim: null },
  navHistory: { text: 'History', claim: null },
  navHospitals: { text: 'Every hospital', claim: null },

  // Hospital page, the record card (pages/hospital.js recordCard): its title bar, then one numbered field each.
  recordTitle: { text: 'Hospital record · FY{fy}', claim: null },
  recordCcn: { text: 'CCN {ccn}', claim: null },
  fieldHospital: { text: 'Hospital', claim: null },
  fieldLocation: { text: 'Location', claim: null },
  location: { text: '{city}, {state} {zip}', claim: null },
  // The Location field's state link, for screen readers after the state's code: where it goes.
  locationState: { text: "({state}'s hospitals on the map and in the table)", claim: null },
  locationNoZip: { text: '{city}, {state}', claim: null },
  fieldType: { text: 'Type', claim: null },
  typeTeachMajor: { text: 'Major teaching', claim: null },
  typeTeachMinor: { text: 'Minor teaching', claim: null },
  typeTeachNone: { text: 'Not a teaching hospital', claim: null },
  typeBeds: { text: '{beds} beds', claim: null },
  typeUrban: { text: 'Urban', claim: null },
  typeRural: { text: 'Rural', claim: null },
  typeRRC: { text: 'Rural referral center', claim: null },
  typeSCH: { text: 'Sole community hospital', claim: null },
  typeMDH: { text: 'Medicare-dependent hospital', claim: null },
  typeIHS: { text: 'Indian Health Service', claim: null },
  typeEACH: { text: 'Essential access community hospital', claim: null },
  fieldScore: { text: 'Total HAC Score', claim: null },
  scoreNote: { text: 'As CMS reports it', claim: null },
  fieldStars: { text: 'Care Compare stars', claim: null },
  stars: { text: '{n} of {max} stars', claim: null },
  starsNote: { text: 'Overall rating, CMS Care Compare data of {date}', claim: null },
  starsLink: { text: 'Open on Care Compare', claim: null },
  // Beside the record card: the stamp, then a numbers card (CMS's line and this site's distance to it).
  stampYes: { text: 'Cut {pct}', claim: 'HACRP-01' },
  stampNo: { text: 'No cut', claim: null },
  stampNA: { text: 'Not subject', claim: 'HACRP-13' },
  stampNoScore: { text: 'No score', claim: null },
  stampCms: { text: '{decision}', claim: null },
  // The locator map: its name for screen readers.
  mapLabel: { text: "Map of {state} with this hospital's location marked", claim: null },

  // Hospital page.
  hospitalTitle: { text: '{name}, {city}, {state}: Hospital-Acquired Conditions, FY{fy}', claim: null },
  hospitalDescription: {
    text: "{name} ({city}, {state}): CMS's FY{fy} Hospital-Acquired Condition score and payment decision, from public CMS data.",
    claim: null,
  },
  kicker: { text: '{subtitle} · fiscal year {fy}', claim: null },
  heroLabel: { text: 'Score and payment decision', claim: null },
  // Under a scored hospital's number (not Maryland's): CMS's line as the gap in its decisions, CMS's text of the scores.
  heroLine: { text: "CMS's line: between {highestNo} and {lowestYes}", claim: null },
  noScore: { text: 'No score published', claim: null },
  heroDecision: { text: 'Payment reduction', claim: null },
  decisionCms: { text: "CMS's value: {decision}", claim: null },
  pillYes: { text: '{pct} cut', claim: 'HACRP-01' },
  pillNo: { text: 'No cut', claim: null },
  pillNA: { text: 'N/A', claim: null },
  // The row CMS marked Yes with no score: CMS's literal value, nothing inferred.
  pillCms: { text: '{decision}', claim: null },
  colMeasure: { text: 'Measure', claim: null },
  colValue: { text: 'CMS value', claim: null },
  colZ: { text: 'Z-score', claim: null },
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

  // As-of bar and source line (hospital and program pages). Each fact of the as-of bar is a term (…Label) and its
  // value, one row of its list.
  asofHeading: { text: 'About this data', claim: null },
  asofFyLabel: { text: 'Fiscal year', claim: null },
  asofFy: { text: '{fy}', claim: null },
  asofPsiLabel: { text: '{short} period', claim: null },
  asofPsi: { text: '{start} to {end}', claim: null },
  asofHaiLabel: { text: 'Infection measures period', claim: null },
  asofHai: { text: '{start} to {end}', claim: null },
  asofLatestLabel: { text: 'Latest public hospital results', claim: null },
  asofLatest: { text: 'FY{fy}; FY{next} expected early {next}', claim: 'HACRP-12' },
  asofReleasedLabel: { text: 'Provider Data Catalog release', claim: null },
  asofReleased: { text: '{date}', claim: null },
  // A hospital page's record: where its Type field's facts come from (shown with the field).
  asofTypeLabel: { text: 'Teaching, urban and special status', claim: null },
  asofType: { text: "CMS's FY{fy} IPPS impact file", claim: null },
  asofBedsLabel: { text: 'Beds', claim: null },
  asofBeds: { text: "CMS's Provider of Services file", claim: null },
  // A hospital page whose map dot is a geocoded street address: the geocoder, named once.
  asofMapLabel: { text: 'Map location', claim: null },
  asofMap: { text: 'U.S. Census Bureau Geocoder', claim: null },
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
  // The page's top: a summary form beside the program's name.
  summaryTitle: { text: 'Program summary · FY{fy}', claim: null },
  summaryReleased: { text: 'CMS data released {date}', claim: null },
  summaryCut: { text: 'Hospitals cut', claim: null },
  summaryCutNote: { text: "Of {decided} scored hospitals with a Yes or No", claim: null },
  summaryPct: { text: 'The cut', claim: 'HACRP-01' },
  summaryPctNote: { text: "Of each traditional Medicare inpatient payment, for the fiscal year", claim: ['HACRP-01', 'HACRP-24'] },
  summaryScored: { text: 'Scored', claim: null },
  summaryScoredNote: { text: 'Hospitals with a Total HAC Score', claim: null },
  // CMS's line, as a summary field and in a sentence.
  lineHeading: { text: "CMS's line", claim: null },
  line: {
    text: 'Among hospitals with a Yes or No payment decision, CMS cut those with a published Total HAC Score of {lowestYes} or higher and none at {highestNo} or lower.',
    claim: null,
  },
  lineMaryland: {
    text: "Maryland's hospitals are scored but not subject to the reduction.",
    claim: 'HACRP-13',
  },
  // The top bar's search (pages/parts.js searchBox): its form's name, the visible "Find" and the rest of the box's
  // name for screen readers, and the placeholder. What its list and status say is in search/copy.js.
  searchHeading: { text: 'Find a hospital', claim: null },
  searchFind: { text: 'Find', claim: null },
  searchFindRest: { text: 'a hospital or place by name, city, state, ZIP code or CCN', claim: null },
  searchPlaceholder: { text: 'Hospital, city, state or metro', claim: null },
  heroFindRest: { text: 'a hospital, state or metro area', claim: null },
  heroPlaceholder: { text: 'Look up a hospital, city, state or metro area', claim: null },
  sandboxLabel: { text: 'Sandbox: a hypothetical hospital at the national median on every measure', claim: null },
  linksHeading: { text: 'Sources and related sites', claim: null },
  linkCmsProgram: { text: "CMS: Hospital-Acquired Condition Reduction Program", claim: null },
  linkPdc: { text: 'CMS Provider Data Catalog: the hospital file this site uses', claim: null },
  linkCareCompare: { text: 'Medicare Care Compare', claim: null },
  linkCareCompareNote: { text: "CMS's own site for comparing hospitals.", claim: null },
  linkLeapfrog: { text: 'Leapfrog Hospital Safety Grade', claim: null },
  linkLeapfrogNote: { text: 'Related, different: a separate rating with its own method.', claim: null },

  // Figures (DES-31): each takeaway is one sentence filled from data; the alt text names what the chart shows.
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
  // Under the takeaway (CMS's values) once the reader changes the what-if: the same finding for the hypothetical.
  figPartsHyp: { text: 'Hypothetical: {short} adds the most, {contribution}.', claim: 'HACRP-04' },
  figPartsHypNone: { text: 'Hypothetical: no measured result adds to the score.', claim: 'HACRP-04' },
  figColPart: { text: 'Part of the score', claim: null },
  // Hospital page, Figure: each measure's value against the national range.
  figRangeOne: {
    text: 'This hospital has a published value for one measure, {short}, and it is {side} the national median.',
    claim: null,
  },
  figSideAbove: { text: 'above', claim: null },
  figSideBelow: { text: 'at or below', claim: null },
  // Said as the chart's description once it takes focus.
  figRangeKeys: { text: 'Arrow keys step through the measures.', claim: null },
  figRangeThis: { text: 'This hospital', claim: null },
  figRangeMedian: { text: 'National median', claim: null },
  // The figure's hatch: values past CMS's floor or cap, which score the same as that end.
  figRangeSame: { text: "Scores the same as CMS's floor or cap", claim: 'HACRP-03' },

  // A range of two values, "5 to 7": a map key's step (history-figures.js), a count across years (pages/methods.js).
  valueRange: { text: '{from} to {to}', claim: null },
  // Figure tables' column heads the program page shares.
  figColHospitals: { text: 'Hospitals', claim: null },
  figColDecision: { text: "CMS's decision", claim: null },
  // Program page, Figure: the US map of states (program-figures.js mapFigure).
  figStatesTakeaway: {
    text: 'Nationally, CMS cut payments to {share} of hospitals with a payment decision; by state, the share ran from {low} to {high}.',
    claim: null,
  },
  figStatesAlt: {
    text: 'Map of the states, each shaded by the share of its hospitals with a payment decision that CMS cut; hatched and plain states have no share to show.',
    claim: null,
  },
  // Said as the map's description once it takes focus; Enter (or a click) lists a state's hospitals in the table.
  figStatesKeys: { text: "Arrow keys step through the states; Enter lists the state's hospitals in the table below.", claim: null },
  figStatesTile: { text: '{yes} of {decided} cut ({share})', claim: null },
  figStatesNA: { text: 'not subject to the reduction', claim: 'HACRP-13' },
  figStatesNone: { text: "no hospitals in CMS's file", claim: null },
  figStatesNoDecision: { text: 'no hospitals with a payment decision', claim: null },
  // The map's legend rows for a zero share and for a share that rests on few decisions.
  figStatesZero: { text: 'no hospitals cut', claim: null },
  figStatesFew: { text: 'fewer than {n} hospitals with a payment decision', claim: null },
  figColState: { text: 'State', claim: null },
  figColCut: { text: 'Hospitals cut', claim: null },
  figColDecided: { text: 'With a decision', claim: null },
  figColShare: { text: 'Share cut', claim: null },

  // ---------- The hospital page's redesign (draft words: claims are checked in the accuracy pass) ----------
  // The verdict beside the record card.
  scoreCompares: {
    text: 'The score compares hospitals with each other; it is not a grade of the quality of care.',
    claim: 'HACRP-15',
  },
  lineCut: { text: 'CMS cut scores of {lowestYes} and above.', claim: null },
  barLine: { text: "CMS's line", claim: null },
  barLineValue: { text: '{lowestYes} and up', claim: null },
  barMiddle: { text: 'Middle hospital', claim: null },
  barThis: { text: 'This hospital', claim: null },
  barLow: { text: 'lowest {low}', claim: null },
  barHigh: { text: 'highest {high}', claim: null },
  barAlt: {
    text: "Every Total HAC Score CMS published, from {low} to {high}: this hospital's is {score}, the middle hospital's {middle}, and CMS cut scores of {lowestYes} and above.",
    claim: null,
  },
  rankHigher: { text: 'Higher than {share} of the other {n} scores CMS published (higher is worse).', claim: null },
  lineHow: { text: "Each year CMS cuts the hospitals with the highest quarter of scores, those above the {percentile} percentile, so the line moves with other hospitals' scores.", claim: ['HACRP-02', 'HACRP-23'] },

  // Figure: the ledger of measures.
  ledgerHeading: { text: 'Where the score came from', claim: null },
  ledgerIntro: {
    text: 'CMS scored this hospital on {n} of the {all} measures. On every measure a lower value is better. Each row puts the hospital among every hospital with a value: the gray columns are those hospitals, the tall tick is the national median, and the hatched ends score the same as CMS\'s floor or cap.',
    claim: 'HACRP-03',
  },
  leverOne: {
    text: 'Bringing {short} down to the national median ({median}) would lower the score the most: by {drop}, to {after}.',
    claim: null,
  },
  leverTry: { text: 'Try it in the what-if', claim: null },
  distanceYes: { text: "This hospital's score is {distance} above {highestNo}, the highest score CMS marked No. (This site recomputes.)", claim: null },
  distanceNo: { text: "This hospital's score is {distance} below {lowestYes}, the lowest score CMS marked Yes. (This site recomputes.)", claim: null },
  // The one measure whose name doesn't say what it counts, defined under it in the ledger (draft ML1).
  defineMore: { text: '(what it counts)', claim: null },
  // Each measure's definition, in the box its short name opens in the ledger (draft words, checked in the accuracy
  // pass). The infection measures' values are standardized infection ratios.
  defineCLABSI: { text: "Bloodstream infections tied to a central line, a tube often placed in a large vein in the neck, chest or groin. Hospitals report them to the CDC's National Healthcare Safety Network. A value of {one} means as many infections as the CDC's model predicted.", claim: ['HACRP-07', 'HACRP-37', 'HACRP-33', 'HACRP-14'] },
  defineCAUTI: { text: "Urinary tract infections that start from a urinary catheter, a tube that drains the bladder. Hospitals report them to the CDC's National Healthcare Safety Network. A value of {one} means as many infections as the CDC's model predicted.", claim: ['HACRP-08', 'HACRP-38', 'HACRP-33', 'HACRP-14'] },
  defineSSI: { text: "Deep infections at the site of colon surgery or an abdominal hysterectomy, within a month of the operation, pooled into one measure. Hospitals report them to the CDC's National Healthcare Safety Network. A value of {one} means as many infections as the CDC's model predicted.", claim: ['HACRP-09', 'HACRP-39', 'HACRP-53', 'HACRP-40', 'HACRP-33', 'HACRP-14'] },
  defineCDI: { text: "C. diff infections, which cause diarrhea and inflammation of the colon, found by a lab test and starting in the hospital. Hospitals report them to the CDC's National Healthcare Safety Network. A value of {one} means as many infections as the CDC's model predicted.", claim: ['HACRP-10', 'HACRP-41', 'HACRP-42', 'HACRP-33', 'HACRP-14'] },
  defineMRSA: { text: "Bloodstream infections with MRSA, a germ that resists several antibiotics, found by a lab test and starting in the hospital. Hospitals report them to the CDC's National Healthcare Safety Network. A value of {one} means as many infections as the CDC's model predicted.", claim: ['HACRP-11', 'HACRP-43', 'HACRP-44', 'HACRP-33', 'HACRP-14'] },
  definePSI90: { text: "Safety problems such as serious bedsores, falls that break a bone and blood clots after surgery, found by CMS in traditional Medicare claims. A value of {one} matches the national composite value.", claim: ['HACRP-30', 'HACRP-70', 'HACRP-29', 'HACRP-31'] },
  leverFlip: { text: "That change alone would put the score under CMS's line.", claim: null },
  leverNone: { text: 'None of the measures CMS scored it on is above the national median, so no single measure at the median would lower its score.', claim: null },
  ledgerColRuler: { text: 'Among all hospitals', claim: null },
  ledgerBetter: { text: 'better', claim: null },
  ledgerWorse: { text: 'worse', claim: null },
  ledgerColPart: { text: 'Part of score', claim: null },
  ledgerTop: { text: 'added the most', claim: null },
  rankWorse: { text: 'Worse than {share} of the other {n} hospitals', claim: null },
  rankBetter: { text: 'Better than {share} of the other {n} hospitals', claim: null },
  rankMiddle: { text: 'At the national median', claim: null },
  rankNone: { text: 'Not scored on this measure', claim: null },
  rulerMedian: { text: 'median {median}', claim: null },
  figLedgerTakeaway: {
    text: 'Of its {k} measures with a value, this hospital is above the national median on {above}; {short} added the most to its score.',
    claim: null,
  },
  figLedgerTakeawayNone: { text: 'Of its {k} measures with a value, this hospital is above the national median on {above}.', claim: null },
  figLedgerNoValues: { text: 'CMS published no measure values for this hospital.', claim: null },
  figColMedian: { text: 'National median', claim: null },
  figColRank: { text: 'Among hospitals', claim: null },

  // Figure: how the parts add up.
  sumHeading: { text: 'How the parts add up', claim: null },
  sumIntro: {
    text: 'CMS adds the z-scores and divides by the number of measures scored, so each measure counts the same. Each bar below is one z-score divided by {n}; a bar right of zero raised the score and one left of zero lowered it.',
    claim: 'HACRP-04',
  },
  sumRounded: { text: "Added from the rounded z-scores CMS published, the parts make {recomputed}; CMS reports {total}. The small difference is rounding.", claim: null },
  wsN: { text: 'measures', claim: null },
  wsTotal: { text: 'Total HAC Score', claim: null },
  figSumTakeaway: { text: 'The parts add up to {total}, {side} CMS\'s line.', claim: null },
  figSumAbove: { text: 'above', claim: null },
  figSumBelow: { text: 'below', claim: null },
  figSumAlt: {
    text: "Bars stacking each measure's part of the Total HAC Score from zero, ending at the score, with CMS's line drawn through them.",
    claim: null,
  },
  figColRunning: { text: 'Running total', claim: null },
  sumTotal: { text: 'Score', claim: null },
  sumPartTip: { text: '{short}: z-score {z} divided by {n} = {part}', claim: null },
  sumTotalTip: { text: 'Total HAC Score: {total}', claim: null },

  // Figure: among hospitals like it.
  peersHeading: { text: 'Among hospitals like it', claim: null },
  peersIntro: {
    text: "Each row is a group this hospital belongs to, drawn from every hospital in it with a payment decision. Red columns are hospitals past CMS's line, the ones CMS cut; the short tick is the group's middle score.",
    claim: null,
  },
  peersRank: { text: 'In {group}, its score is higher than {share} of the other {n} scored there.', claim: null },
  groupNation: { text: 'All hospitals', claim: null },
  groupRegion: { text: '{region} region', claim: null },
  groupState: { text: '{state}', claim: null },
  groupMetro: { text: '{metro} area', claim: null },
  groupTeachmajor: { text: 'Major teaching', claim: null },
  groupTeachminor: { text: 'Minor teaching', claim: null },
  groupTeachnone: { text: 'Not teaching', claim: null },
  groupBedsUnder: { text: 'Under {beds} beds', claim: null },
  groupBedsRange: { text: '{low} to {high} beds', claim: null },
  groupBedsUp: { text: '{beds} beds and up', claim: null },
  groupOwnNonprofit: { text: 'Nonprofit', claim: null },
  groupOwnGovernment: { text: 'Government', claim: null },
  'groupOwnFor-profit': { text: 'For-profit', claim: null },
  groupUrbantrue: { text: 'Urban', claim: null },
  groupUrbanfalse: { text: 'Rural', claim: null },
  groupSub: { text: '{n} hospitals', claim: null },
  groupShare: { text: '{share} cut', claim: null },
  groupTip: { text: '{group}: CMS cut {yes} of {decided} ({share}); middle score {median}', claim: null },
  figPeersTakeaway: {
    text: 'Its score is above the middle of {above} of the {k} groups it belongs to; the share cut runs from {low} ({lowGroup}) to {high} ({highGroup}).',
    claim: null,
  },
  figPeersAlt: {
    text: "Small distributions of Total HAC Scores, one for each group this hospital belongs to, with CMS's line and this hospital's score drawn through all of them.",
    claim: null,
  },
  figColGroup: { text: 'Group', claim: null },
  figColMiddle: { text: 'Middle score', claim: null },
  figColHigher: { text: 'Hospital higher than', claim: null },

  // Figure: the nearest hospitals.
  nearbyHeading: { text: 'The nearest hospitals', claim: null },
  nearbyIntro: {
    text: "The {k} closest hospitals with a Total HAC Score, in a straight line. The squares are each hospital's measures in order: filled, above the national median; open, at or below it; hatched, assigned by CMS; blank, not scored.",
    claim: null,
  },
  nearbyColName: { text: 'Hospital', claim: null },
  nearbyColMiles: { text: 'Miles', claim: null },
  nearbyColScore: { text: 'Score', claim: null },
  nearbyColDecision: { text: 'Decision', claim: null },
  nearbyColMeasures: { text: 'Measures', claim: null },
  nearbyGlyph: { text: 'Above the national median on {worse} of {scored} measures', claim: null },
  nearbyTip: { text: '{n}. {name}, {city}: score {score}, {decision}, {miles} miles', claim: null },
  nearbyThis: { text: 'This hospital', claim: null },
  nearbyRing: { text: '{miles} mi', claim: null },
  figNearbyTakeaway: { text: 'CMS cut {yes} of the {k} nearest hospitals; the closest is {miles} miles away.', claim: null },
  figNearbyTakeawayNear: { text: 'CMS cut {yes} of the {k} nearest hospitals; the closest is less than a mile away.', claim: null },
  // A distance under a mile, in the table.
  nearbyUnderMile: { text: 'under {one}', claim: null },
  figPeersSame: { text: 'Its score is above the middle of {above} of the {k} groups it belongs to; the share cut is {share} in every group.', claim: null },
  figNearbyAlt: { text: 'Map of the area around this hospital, with its nearest scored hospitals numbered as in the table.', claim: null },
  nearbyCut: { text: 'cut', claim: null },
  nearbyNotCut: { text: 'not cut', claim: null },
  nearbyNA: { text: 'not subject', claim: null },

  // Program page: the table of every hospital (client/program.js fills it from the hospitals asset).
  tableHeading: { text: "Every hospital in CMS's file", claim: null },
  tableIntro: {
    text: 'Sorted by state, then name. Sort by any column, pick a state, or search by name, city or CCN.',
    claim: null,
  },
  tableNoScript: {
    text: 'The sortable table of every hospital needs JavaScript; the CSV file holds the same values.',
    claim: null,
  },
  tableCaption: { text: "Every hospital in CMS's file, with its Total HAC Score and payment reduction decision as CMS reports them", claim: null },
  tableState: { text: 'State', claim: null },
  tableAllStates: { text: 'All states', claim: null },
  tableName: { text: 'Name, city or CCN contains', claim: null },
  // The phone's sort menu, in place of the column heads.
  tableSortBy: { text: 'Sort by', claim: null },
  tableSortUp: { text: '{column}, ascending', claim: null },
  tableSortDown: { text: '{column}, descending', claim: null },
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
  tableFailed: { text: "The table didn't load.", claim: null },
  tableRetry: { text: 'Try again', claim: null },
};

// COPY[key].text with each {placeholder} filled; see fillCopy for the rules.
export const fill = (key, values) => fillCopy(COPY, key, values);
// As markup, keeping each group in `keep` on one line (see fillCopyKeep): dates, number pairs.
export const fillKeep = (key, values, keep) => fillCopyKeep(COPY, key, values, keep);
// The hero's short form of the line, its two scores kept on one line; the what-if's ramp repeats it.
export const heroLineText = (boundaryText) => fillKeep('heroLine', boundaryText, [['highestNo', 'lowestYes']]);
// A word or sentence with no placeholders, filled once per key.
const WORDS = new Map();
export const t = (key) => {
  if (!WORDS.has(key)) WORDS.set(key, fill(key));
  return WORDS.get(key);
};

// The source line's values: the fiscal year, the dataset id and its release date.
const sourceValues = ({ fy, source }) => ({ fy: String(fy), id: source.id, date: isoDate(source.pdcReleased) });
const sourceKey = ({ fy, source }) => [fy, source];
// The source line as every HACRP figure writes it: markup, its release date kept on one line.
export const sourceText = lastCall(sourceKey, (args) => fillKeep('source', sourceValues(args), ['date']));
// The same line as plain text, for the citation and the what-if's "Copy for a slide".
export const sourcePlain = lastCall(sourceKey, (args) => fill('source', sourceValues(args)));

// A fiscal year as the history and Methods figures label it: "FY2016".
export const fyLabel = (fy) => fill('fyShort', { fy: String(fy) });
// A measure's name as a label (capitalized): "Central line–associated bloodstream infections".
export const measureLabel = (id) => capitalize(fill(`measure${id}`));
