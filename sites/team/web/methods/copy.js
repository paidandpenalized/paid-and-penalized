// The TEAM Methods page's words (pages/methods.js), built into the page and never shipped to a browser. Same rules as
// the site's copy.js: for hospital staff, plain; TEAM is a payment model, never a penalty; no digit characters, every
// number, date and citation through a {placeholder}; `claim` names the row (or rows) of sites/team/CLAIMS.md a sentence
// about the rules rests on, null for this site's own arithmetic, choices or framing. fill and t read here, then the
// site's copy.js (and the calculator's and the lookup's words it layers), for the labels the pages share.
import { copyOf } from '../../../../web/render/components.js';
import { COPY as CALC } from '../calc-copy.js';
import { COPY as SITE } from '../copy.js';
import { COPY as LOOKUP } from '../lookup-copy.js';

export const COPY = {
  // The top.
  methodsKicker: { text: 'TEAM · Methods', claim: null },
  methodsTitle: { text: 'TEAM: methods and sources', claim: null },
  methodsDescription: {
    text: "How the TEAM page and its calculator are built: every source and its date, how each number is made, what the calculator leaves out and where a hospital finds its real values.",
    claim: null,
  },
  methodsIntro: {
    text: "Every number on the TEAM page comes from a public file, pinned and checked by its hash, or from the rules in {cite}. Below: how each is made, what the calculator leaves out, and where your hospital finds the real value. A sentence that states a rule names its source, and the claims register in the repository quotes each one.",
    claim: null,
  },
  contentsHeading: { text: 'On this page', claim: null },

  // Sources and their dates: the file's pins in two tables, then the published sources the page cites.
  srcHeading: { text: 'Sources and their dates', claim: null },
  srcText: {
    text: "Each file the TEAM page reads, as pinned: who publishes it, the date the source gives (its as-of date, release or last change), the day this site fetched it, and the start of its {hash} hash. The full hashes are in the repository's manifest. A dash means the source gives no date of its own.",
    claim: null,
  },
  srcOwn: { text: "TEAM's own files", claim: null },
  srcShared: { text: "The hospital list's files, which every page of the site shares", claim: null },
  srcColFile: { text: 'File', claim: null },
  srcColBy: { text: 'From', claim: null },
  srcColDate: { text: "Source's date", claim: null },
  srcColGot: { text: 'Fetched', claim: null },
  srcColHash: { text: '{hash} begins', claim: null },
  srcNoDate: { text: '–', claim: null },
  pubCms: { text: 'CMS', claim: null },
  pubCensus: { text: 'Census Bureau', claim: null },
  pubAtlas: { text: 'us-atlas, from Census boundaries', claim: null },
  pubTdr: { text: 'Thirty Day Readmissions', claim: null },
  srcPublished: { text: 'Other sources this page cites', claim: null },
  srcRule: { text: 'The TEAM rules: {cite} (eCFR)', claim: null },
  srcFaq: { text: "CMS's TEAM technical FAQs", claim: null },
  srcQuality: { text: "CMS's TEAM Quality Scoring fact sheet", claim: null },
  srcFinalRule: { text: 'The fiscal year {fy} inpatient final rule (Federal Register)', claim: null },
  srcMup: { text: "CMS's methodology for its Medicare Inpatient Hospitals files", claim: null },
  srcCjr: { text: "CMS's CJR final reconciliation file", claim: null },
  srcCjrReport: { text: "The CJR evaluation's seventh annual report", claim: null },
  srcBpci: { text: "BPCI Advanced's final evaluation, appendices", claim: null },

  // The episode counts (C16).
  epHeading: { text: 'Episode counts: a floor, not a forecast', claim: null },
  epWhat: {
    text: "A hospital's episodes are its Medicare fee-for-service inpatient discharges in {year} under each category's MS-DRGs, from CMS's Medicare Inpatient Hospitals by Provider and Service file.",
    claim: 'TEAM-79',
  },
  epFloor: { text: 'They are a floor:', claim: null },
  epHiddenHead: { text: 'Hidden cells.', claim: null },
  epOutpatientHead: { text: 'No outpatient cases.', claim: null },
  epYearHead: { text: 'One past year.', claim: null },
  epHidden: {
    text: 'CMS leaves out of the file any hospital and MS-DRG row built from {max} or fewer discharges, so each missing row of an episode MS-DRG is none to {max} discharges, counted here as none.',
    claim: 'TEAM-79',
  },
  epOutpatient: {
    text: "Joint replacement and spinal fusion episodes can also start from an outpatient claim, and the file has none; the calculator marks both rows inpatient only.",
    claim: 'TEAM-78',
  },
  epYear: {
    text: "The counts are {year}'s inpatient stays, not a forecast of {pyYear}'s.",
    claim: null,
  },
  epNoBound: {
    text: "A hidden cell may be a surgery the hospital doesn't do at all, so hidden cells times {max} is no bound on what is missing. Of the {active} hospitals still in TEAM in {pyYear}, {none} show no public episodes at all. The calculator shows each row's hidden cells beside its count, and you can type your own.",
    claim: null,
  },
  epRemap: {
    text: "The data year counts some cases under MS-DRGs that CMS's performance year {py} prices don't have. This site moves them to the priced MS-DRGs that took them over; where the cases went two ways by procedure code, which the file doesn't carry, it splits them evenly between the two. Both halves of each split stay in one episode type, so every count stays whole; only the mix of MS-DRG prices behind a count is an even guess.",
    claim: null,
  },
  remapCaption: { text: 'MS-DRGs in the data year, moved to the priced ones', claim: null },
  remapColFrom: { text: 'Counted under, in the data', claim: null },
  remapColTo: { text: 'Moved to', claim: null },
  remapShare: { text: '{share} to {drg}', claim: null },

  // Low volume.
  lvHeading: { text: 'Low volume, approximated', claim: null },
  lvRule: {
    text: "A category with fewer than {lv} episodes over the {years} baseline years can't add to a repayment: CMS caps its spending at its target, so it can only add to a gain.",
    claim: 'TEAM-16',
  },
  lvHere: {
    text: "The baseline years' counts aren't public. This site adds the file's {n} data years, {list}, multiplies the sum by {scale} to stand in for {years} years, and ticks the category when the result is under {lv}. The calculator lets you change any tick.",
    claim: null,
  },
  lvLean: {
    text: "The tick is built on the public counts, where each hidden cell counts as none, so it leans toward low volume. Untick a category when the baseline data CMS sends the hospital shows {lv} or more episodes for it.",
    claim: ['TEAM-56', 'TEAM-16'],
  },
  lvScope: {
    text: "CMS's FAQ applies the cap to each episode's amount before it sums them for the hospital. The calculator applies it to the category's total, which comes to the same only when the category's episodes all land on the same side of target.",
    claim: 'TEAM-75',
  },

  // Prices and the target amount.
  prHeading: { text: 'Prices and the target amount', claim: null },
  prPrices: {
    text: "Prices are CMS's preliminary performance year {py} target prices, one for each MS-DRG or HCPCS episode type in each census division, in standardized dollars.",
    claim: ['TEAM-57', 'TEAM-59'],
  },
  prCategory: {
    text: "A category's price for a hospital is its division's prices for the category's MS-DRGs, averaged by the hospital's episodes; with no episodes, the division's average for the category. CMS's file gives no such average for {cats}, so this site's is the plain mean of its MS-DRGs' prices.",
    claim: null,
  },
  prTarget: {
    text: "The target amount is episodes times price, summed over the categories, before the risk adjustment CMS makes in each hospital's own prices.",
    claim: 'TEAM-63',
  },

  // Quality percentiles.
  qHeading: { text: 'Quality percentiles', claim: null },
  qRule: {
    text: "CMS scores each quality measure as a percentile: where the hospital's value falls among a national cohort of TEAM participants and hospitals not in TEAM, with the higher percentile on a tie. For these measures a lower value is better.",
    claim: ['TEAM-66', 'TEAM-67', 'TEAM-68'],
  },
  qHere: {
    text: "This site prefills the two measures Care Compare publishes for each hospital: {hwrName} ({hwr} hospitals with a value) and {iscmrName} ({iscmr}). Its cohort is every open hospital the inpatient system pays that has a value, outside Maryland and other than Indian Health Service and tribal hospitals. That stands in for CMS's cohort, so the percentiles are near CMS's, not the same.",
    claim: null,
  },
  qPeriods: {
    text: "The public values cover {hwrFrom} to {hwrTo} and {iscmrFrom} to {iscmrTo}. Performance year {py}'s measures cover {pyHwrFrom} to {pyHwrTo} and {pyIscmrFrom} to {pyIscmrTo}, and CMS ranks each hospital against the same period's values, so its real percentile comes from later data than this site has.",
    claim: ['TEAM-69', 'TEAM-71'],
  },
  qMissing: {
    text: 'A measure with no value counts at {missing}, the score CMS gives a measure with no or an incomplete raw score. The other {n} measures have no public hospital values, so the calculator starts them at {missing} too.',
    claim: 'TEAM-17',
  },

  // The composite quality score.
  cqsHeading: { text: 'The composite quality score', claim: null },
  cqsWeights: {
    text: "Each measure is weighted by the hospital's episodes it covers, over the total of those volumes across the measures: each measure for every inpatient episode counts all of them, and the joint replacement survey counts only inpatient joint replacements.",
    claim: ['TEAM-61', 'TEAM-18'],
  },
  cqsSum: { text: "The score is the sum of each measure's percentile times its weight, from zero to {max}.", claim: 'TEAM-74' },
  cqsAdjust: {
    text: "CMS then adjusts the hospital's reconciliation amount by the score. A gain gives up as much as {gain} of itself: all {gain} at a score of zero, none at {max}, in a straight line between. A repayment shrinks with the score: not at all at zero, and by the full {lossB} (Track {tb}) or {lossC} (Track {tc}) at a score of {max}, in a straight line between.",
    claim: ['TEAM-74', 'TEAM-15'],
  },
  cqsSource: { text: "CMS's {sheet} gives the formula with worked examples.", claim: null },
  cqsSheet: { text: 'Quality Scoring fact sheet', claim: null },

  // The band's evidence (the calculator's "why?" links here: constants.js BAND_ANCHOR).
  bandHeading: { text: "The calculator's band", claim: null },
  bandWhat: {
    text: "The calculator draws its result {band} of target either way by default, and you can set it from {lo} to {hi}. The band is this site's choice, not a rule.",
    claim: null,
  },
  bandWhy: {
    text: "Why {band}: in Medicare's joint-replacement bundle (CJR), {near} of non-rural hospitals' yearly results in performance years {years} ended within {band} of target and {far} within {wide}, in this site's count from {file}. The band covers the middle of those results, {band} on each side of target, the same under as over: where a year is likely to land, not how far it can go.",
    claim: null,
  },
  bandHow: {
    text: "How this site counted: CMS's file gives each hospital's final reconciliation amount and episode count for each performance year, but not its target. So a year's result is its amount per episode over that year's CJR-wide average target per episode, from {report}: a payment to the hospital means spending under target, a repayment spending over it.",
    claim: null,
  },
  bandReport: { text: "the CJR evaluation's seventh annual report", claim: null },
  bandPool: {
    text: "The count takes performance years {years}: of the years in CMS's file with CJR's widest limits on a gain and a repayment, all but year {euc}, which CMS reconciled under the extreme and uncontrollable circumstances policy it applied for the COVID pandemic. Their average targets were {targets}. It takes only a hospital's year of {floor} episodes or more, and leaves out a zero that hides a result: a hospital rated below acceptable on quality could not be paid, so its zero may stand for a year under target.",
    claim: null,
  },
  bandRural: {
    text: "It also leaves out a year at a rural hospital, which CMS's file marks year by year. In these years a rural hospital, like a sole community hospital, a Medicare-dependent hospital or a rural referral center, had a far lower limit on a repayment than other hospitals, so a year that ran far over target could still end close to it in CMS's file. A sole community hospital, Medicare-dependent hospital or rural referral center that is not rural had the same lower limit, but CMS's file does not mark it, so its years remain in the count.",
    claim: null,
  },
  bandCount: {
    text: "Of {rows} results in those years, {censored} zeros that hide a result, {rural} years at rural hospitals and {small} years under {floor} episodes are left out, in that order, leaving {n}: {nearN} within {band} and {farN} within {wide}.",
    claim: null,
  },
  bandApprox: {
    text: "Each result is approximate: one average target stands in for every hospital's own, which turns on its mix of cases and its region. The error grows with a result's distance from target: small near target, where the band sits, and larger far from it. And CMS's amount is more than target less spending: it carries other adjustments too, among them a recoupment when a hospital's average spending in the month after its episodes ran far above its region's, so a hospital that owed one reads further over target than its episodes alone put it. The evaluation's report finds those recoupments a small share of repayments overall, though a large one for some hospitals.",
    claim: null,
  },
  bandExtremes: {
    text: "Some hospitals' years run well past {band} either way; Track {tc}'s limits stop a TEAM hospital's result at {limit} either way.",
    claim: 'TEAM-14',
  },
  bandFile: { text: "CMS's CJR final reconciliation file", claim: null },
  bandBpci: {
    text: "BPCI Advanced, Medicare's voluntary bundle of the same years, shows about the same spread in its later model years, in this site's reading of the per-episode reconciliation table in {eval}.",
    claim: null,
  },
  bandEval: { text: "the appendix to its final evaluation", claim: null },
  bandTrack2: {
    text: "A band of {band} either way is also Track {tb}'s limit on a gain and on a repayment, so for a Track {tb} hospital the band's edges are the limits themselves.",
    claim: 'TEAM-14',
  },
  bandCaveat: {
    text: 'CJR paid for joint replacement alone; TEAM reconciles {n} kinds of surgery together, so its spread may be wider or narrower.',
    claim: 'TEAM-21',
  },

  // Standardized dollars, and what can still move the target.
  movesHeading: { text: 'Standardized dollars, and a target that can still move', claim: null },
  movesStd: {
    text: "Every dollar on the TEAM pages is a standardized dollar, the unit CMS counts episode spending and its prices in. Compare them with the standardized spending in CMS's reports to the hospital, not with charges, costs or what Medicare paid.",
    claim: ['TEAM-23', 'TEAM-59'],
  },
  movesTarget: {
    text: "The target a hospital is held to is set after the year. CMS adjusts each preliminary price for the patient's and the hospital's risk, and two factors move it within limits: the final normalization within {norm} either way of the prospective one, and the trend within {trend} of the updated prospective trend.",
    claim: ['TEAM-63', 'TEAM-64'],
  },
  movesSo: {
    text: 'So even with spending exactly on target in the preliminary prices, the result can move by a few percent of the target either way. The calculator holds the target fixed.',
    claim: null,
  },

  // What the calculator leaves out.
  leftHeading: { text: 'What the calculator leaves out', claim: null },
  leftRiskHead: { text: 'Risk adjustment.', claim: null },
  leftRisk: {
    text: "CMS adjusts each episode's price for the patient and for the hospital. The calculator uses the region's prices, before that adjustment.",
    claim: 'TEAM-63',
  },
  leftPostHead: { text: 'The post-episode spending adjustment.', claim: null },
  leftPost: {
    text: "CMS subtracts what a hospital's patients cost in the days after their episodes when it runs far above its region's average, outside the track's limits. It needs CMS's own data, so it is zero here.",
    claim: 'TEAM-62',
  },
  leftCapHead: { text: 'The high-cost cap.', claim: null },
  leftCap: {
    text: "CMS caps each episode's spending at the {pctile} percentile of its region's spending for its episode type, in the baseline and in the year. The calculator takes spending as a percent of target and caps nothing itself.",
    claim: 'TEAM-65',
  },

  // The unknowns (C15): what the calculator assumes, and where the real value lives.
  unkHeading: { text: "What isn't public, and where the real value lives", claim: null },
  unkIntro: { text: 'These stay inputs you can change. For each, what the calculator assumes, then where your hospital finds the real value.', claim: null },
  unkAssumes: { text: 'Assumed:', claim: null },
  unkWhere: { text: 'Real value:', claim: null },
  unkTrackHead: { text: 'Your track', claim: null },
  unkTrackAssume: { text: "Track {tc}, CMS's assignment from performance year {py} unless a hospital asks for another and qualifies.", claim: 'TEAM-24' },
  unkTrackWhere: {
    text: "CMS tells participants the selection deadline and their safety-net status before each year. Only the hospital's authorized signatory submits the track form, in the TEAM Portal.",
    claim: ['TEAM-77', 'TEAM-47'],
  },
  unkReportHead: { text: 'Report dates', claim: null },
  unkReportAssume: { text: 'No date. The calculator gives a result, not when it arrives.', claim: null },
  unkReportWhere: {
    text: 'Reconciliation begins about {months} months after the year. CMS sends the report to the hospital, and the {days} days to flag a calculation error run from then.',
    claim: ['TEAM-76', 'TEAM-30'],
  },
  unkFallsHead: { text: 'Falls with injury and postoperative respiratory failure', claim: null },
  unkFallsAssume: {
    text: "{missing} each, CMS's score for a measure with no value. Reporting either is voluntary for performance year {py}.",
    claim: ['TEAM-17', 'TEAM-73'],
  },
  unkFallsWhere: { text: "The hospital's own submissions of either measure to CMS, if it sends them.", claim: 'TEAM-73' },
  unkFallsCfr: {
    text: "Their baseline period is unsettled in print. The eCFR's text still gives both a calendar {cfrYear} baseline for performance year {py}.",
    claim: 'TEAM-70',
  },
  unkFallsCms: {
    text: "The latest inpatient final rule made each year's baseline the same period as its measurement, and CMS's FAQ table gives both calendar {cmsYear}. This site follows CMS's table.",
    claim: ['TEAM-71', 'TEAM-72'],
  },
  unkLowHead: { text: 'Low-volume status', claim: null },
  unkLowAssume: { text: "From public counts, as above, applied to each category's total.", claim: null },
  unkLowWhere: {
    text: "The baseline data CMS gives each participant before the year, which count its baseline episodes. CMS's FAQ applies the cap episode by episode.",
    claim: ['TEAM-56', 'TEAM-75'],
  },
  unkMdhHead: { text: 'Medicare-dependent hospitals', claim: null },
  unkMdhAssume: { text: "The flag on Medicare's hospital list.", claim: null },
  unkMdhWhere: {
    text: "A Medicare-dependent hospital qualifies for Track {tb} only while that program hasn't expired when selections are due, and CMS approves each request.",
    claim: ['TEAM-26', 'TEAM-24'],
  },
  unkOwnHead: { text: 'Your prices, baseline and spending', claim: null },
  unkOwnAssume: { text: "The region's prices and the public counts above.", claim: null },
  unkOwnWhere: { text: "CMS's reports to the hospital, listed under {find}.", claim: null },

  // Who's in: the area test.
  areaHeading: { text: "Who's in: the area test", claim: null },
  areaRule: {
    text: "A hospital in one of the areas CMS selected must take part. Each area is a core-based statistical area (CBSA); the selected areas here are the {n} CBSAs CMS's list gives its mandatory participants.",
    claim: ['TEAM-01', 'TEAM-02'],
  },
  areaPlace: {
    text: "For any other hospital, this site finds its county (from Medicare's hospital list, else by its county's name, else its map point, else its city's other hospitals) and asks OMB's {omb} delineation which CBSA holds it. The delineation names every county of every CBSA. CMS's county crosswalk for fiscal year {fy} follows it for nearly every county but not all, so the delineation decides, and the crosswalk only helps find a county.",
    claim: null,
  },
  areaCheckAll: {
    text: "A check: CMS's list has {mandatory} mandatory participants. This site places {placed} of them in a county, and the delineation puts every one of those counties in the participant's own list CBSA; the repository's tests hold that.",
    claim: null,
  },
  areaCheckSome: {
    text: "A check: CMS's list has {mandatory} mandatory participants. This site places {placed} of them in a county, and the delineation puts {mismatched} of those counties outside the participant's own list CBSA; each still counts as in its area.",
    claim: null,
  },
  areaUnknownNote: {
    text: "Area unknown: {n} hospitals whose county couldn't be placed, in a state with a selected area. The lookup says it can't tell.",
    claim: null,
  },
  areaUnlisted: {
    text: "In an area, not on the list: {n} acute hospitals the inpatient system pays. A hospital new to an area takes part only after one full performance year, and others may have closed or changed; the lookup says so rather than guess.",
    claim: 'TEAM-08',
  },

  // The map and the worked example.
  otherHeading: { text: 'The map and the worked example', claim: null },
  methodsMap: {
    text: "The map's hollow dots are the open acute hospitals on Medicare's hospital list that its inpatient system pays, outside Maryland, that aren't in TEAM for {year}.",
    claim: 'TEAM-03',
  },
  methodsExample: {
    text: "Part three's worked example uses round numbers, not a hospital: a target amount of {target}, spending {spend} under it, a composite quality score of {cqs} and Track {track}. This site's code computes every line with the same arithmetic the calculator uses, in standardized dollars.",
    claim: null,
  },

  // The code, the claims and changes.
  codeHeading: { text: 'The code and the claims', claim: null },
  codeText: {
    text: 'The code, the pinned files and the claims register, which quotes the source of every rule a sentence states: {repo}.',
    claim: null,
  },
  codeChanges: {
    text: "These are methods version {v}. A change to the method is logged in the repository; corrections to the numbers are on the {log} page.",
    claim: null,
  },
  codeLog: { text: 'corrections', claim: null },
};

export const { fill, fillKeep, t } = copyOf(COPY, SITE, LOOKUP, CALC);
