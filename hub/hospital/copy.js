// The words of a hospital's page across the programs (/hospital/<ccn>/: hub/hospital/page.js). No digit characters:
// numbers arrive through {placeholders}, the programs' rules through their named constants (web/programs.js).
import { typesetCopy } from '../../web/render/components.js';
import { GROUPS } from './group-copy.js';

// Typeset once (straight apostrophes and quotes to curly), as every page shows them.
export const COPY = typesetCopy({
  // <title> (the site's name follows it) and the description. {name}: the master record's; {place}: its city and state
  // (placeText: the state alone where the master has no city); {n} {group}: the peers the page compares it with.
  title: '{name}, {place}: Medicare payment programs, FY{fy}',
  description: "Estimated FY{fy} dollars for {name} in {place}, in Medicare's Readmissions, hospital-acquired conditions and value-based purchasing programs, the net of the three, and how it compares with {n} {group}.",
  descriptionMaryland: { text: "{name} in {place} is paid under Maryland's all-payer model, so Medicare's Readmissions, hospital-acquired conditions and value-based purchasing programs don't adjust its pay.", claim: ['HUB-04', 'HUB-05', 'HACRP-26', 'HACRP-91'] },
  descriptionNoInputs: "{name} in {place}: CMS's FY{fy} payment file has no usable row for this hospital, so this site has no estimate of its dollars in Medicare's Readmissions, hospital-acquired conditions and value-based purchasing programs.",

  // The sticky peer row: its label, the toggle (shown by the page's script) and the group it names. A toggle a hospital
  // has no group for is disabled, and the note says why.
  peersLabel: 'Compare with',
  peersGroupLabel: 'Peer group',
  peerState: 'Same state',
  peerSize: 'Same size',
  peerTeach: 'Same teaching',
  // The group's name (group-copy.js, shared with the front page's last step).
  ...GROUPS,
  peerNoSize: 'Same size: no bed count on record for this hospital.',
  peerNoTeach: 'Same teaching: no teaching status on record for this hospital.',

  // The record card: its title bar, then the hospital, where it is and what it is (from the hospital master).
  recordTitle: 'Hospital record · FY{fy}',
  recordCcn: 'CCN {ccn}',
  fieldHospital: 'Hospital',
  // A hospital no CMS file names (the master's stand-in name): the name the page shows, and the card's note under it.
  nameStandIn: 'Hospital {ccn}',
  nameNotInCms: 'Name not in CMS files',
  fieldLocation: 'Location',
  fieldType: 'Type',
  // The kind of a hospital that isn't a short-term acute care one (the master's kind), first in its Type field.
  'typeKind.critical_access': 'Critical access',
  'typeKind.psychiatric': 'Psychiatric',
  'typeKind.childrens': "Children's",
  'typeKind.cancer': 'Cancer',
  'typeKind.long_term': 'Long-term care',
  'typeKind.rural_emergency': 'Rural emergency',
  'typeKind.va': 'VA medical center',
  'typeKind.dod': 'Department of Defense',
  typeTeachMajor: 'Major teaching',
  typeTeachMinor: 'Minor teaching',
  typeTeachNone: 'Not a teaching hospital',
  typeBeds: '{beds} beds',
  typeBed: '{beds} bed',
  typeUrban: 'Urban',
  typeRural: 'Rural',

  // The net: its label (and the estimate tag, hub/parts.js), the stamp, the common fiscal year's note, then each program's
  // dollars as rows adding to it, each with its peers' median tick, and the key to the tick.
  netLabel: 'Net, three programs, FY{fy}',
  stampCut: 'Net cut',
  stampBonus: 'Net bonus',
  stampZero: 'No net change',
  fyNote: { text: "All three programs' FY{fy} figures, the latest year they share. A program's own pages may show a newer year.", claim: 'HACRP-12' },
  // The net's likely range under it (its key links to the back-test that made it); bandRange: its two ends in whole
  // dollars, where rounding would print them alike.
  bandLikely: 'Likely range',
  bandRange: '{lo} to {hi}',
  sumLabel: "Each program's estimated FY{fy} dollars, adding to the net",
  sumNet: 'Net, estimated',
  sumMedian: "median of its peers, scaled to this hospital's pay: {amount}",
  sumKey: "Median of its peers, scaled to this hospital's pay",
  // Under the dollar rows when, as printed, they don't add up to the net (shown and hidden by the what-if too).
  sumRounded: "Each figure is rounded on its own, so the programs' rows may not add exactly to the net.",
  notInProgram: 'Not in this program',
  // The same for Readmissions, whose file not listing a hospital doesn't put it outside the program (text.js outKey).
  notInProgramFile: "Not in CMS's file",
  wordCut: 'cut',
  wordBonus: 'bonus',
  wordNoCut: 'no cut',
  wordNoChange: 'no change',
  wordHacCut: '{rate} cut',
  whatIfButton: 'What if? Adjust any program',

  // The headline over the peer swarm: the hospital's net as a share of its pay, against the median of its peers. {share}
  // is unsigned; {median} is one of the median's phrases.
  headCut: 'A {share} net cut of Medicare inpatient pay, against {median} at the median of {n} {group}.',
  headBonus: 'A {share} net bonus of Medicare inpatient pay, against {median} at the median of {n} {group}.',
  headZero: 'No net change in Medicare inpatient pay, against {median} at the median of {n} {group}.',
  medianCut: 'a {share} cut',
  medianBonus: 'a {share} bonus',
  medianZero: 'no change',

  // The swarm the page's script draws: its caption and hint (shown with it), and the one line a failed load shows.
  swarmCaption: 'Each dot is a hospital, placed by its estimated FY{fy} net as a share of its Medicare inpatient pay: above, the {n} {group}; below, all {all} hospitals with an estimate. This hospital is ringed in both.',
  swarmHint: 'Hover or tap a dot for its name; click it to open that hospital.',
  loadError: "Couldn't load the chart data. Reload to try again.",
  // Scripts off (shown only then): what the chart needs.
  swarmNoScript: 'The chart of its peers needs JavaScript. The rows below compare this hospital with them in words.',
  // The swarm's own words (drawn on its canvas): the two piles' names, the peers' median, their cuts and bonuses, and
  // what a dot says when hovered, tapped or reached by the arrow keys.
  swarmAll: 'All {n} hospitals',
  swarmMedian: 'median {share}',
  swarmCut: '{n} net cut',
  swarmBonus: '{n} net bonus',
  swarmAxisCut: 'cut',
  swarmAxisBonus: 'bonus',
  swarmLabel: 'The {n} {group} and all {all} hospitals with an estimate, each a dot placed by its estimated FY{fy} net as a share of its Medicare inpatient pay; this hospital is ringed. Arrow keys step through the peers; Enter opens one.',
  dotText: '{name}, {place}: {share} net, estimated FY{fy}',
  dotThis: 'This hospital',
  dotOpen: 'Tap again to open its page.',
  stripMedian: 'median',
  stripOut: 'This hospital: not in this program',
  stripOutFile: "This hospital: not in CMS's file",

  // The what-if section (#whatif): one row per program, an empty row for another (it promises none), then the net with
  // its result.
  whatifKicker: 'Every program, among its peers',
  whatifHeading: 'What if? Adjust any program',
  // Scripts off, the section is headed by what it shows (the kicker's words) and says what the what-if needs.
  whatifNoScript: 'The what-if needs JavaScript. Without it, the figures below stay as they are.',
  whatifLede: "This hospital's estimated FY{fy} dollars in each program, beside the same {n} {group}.",
  rowValue: 'Estimated FY{fy}:',
  whyFactor: 'FY{fy} payment factor {factor}.',
  // A hospital with a Readmissions page here (sites/hrrp/), which shows CMS's newer file: why the factor there differs.
  whyHrrpYear: { text: "Its Readmissions page shows CMS's FY{next} factor, {factor}. This page uses FY{fy}'s, the latest year all three programs share.", claim: 'HACRP-12' },
  // The same for a hospital FY{fy}'s file did not list.
  whyHrrpYearOut: { text: "Its Readmissions page shows CMS's FY{next} factor, {factor}. This page uses FY{fy}, the latest year all three programs share, whose file did not list it.", claim: 'HACRP-12' },
  // The same for a hospital FY{fy}'s file lists but the newer one doesn't, which so has no Readmissions page here.
  whyHrrpYearGone: "CMS's FY{next} Readmissions file doesn't list it, so it has no Readmissions page here.",
  whyHrrpOut: "Not in CMS's FY{fy} Readmissions file.",
  whyVbpOut: "Not in CMS's FY{fy} value-based purchasing file.",
  whyHacCut: { text: "CMS's FY{fy} decision: the flat {rate} cut.", claim: 'HACRP-01' },
  whyHacNone: "CMS's FY{fy} decision: no cut.",
  // The peers' counts: "Of the 74 Alabama hospitals: 59 with a cut, 12 with no cut, 3 not in the program." Each part is
  // a count and its words; a count of none drops the parts after the first two.
  whyPeers: 'Of the {n} {group}: {parts}.',
  partCut: '{n} with a cut',
  partHacCut: { text: '{n} with the {rate} cut', claim: 'HACRP-01' },
  partBonus: '{n} with a bonus',
  partNoCut: '{n} with no cut',
  // Hospital-acquired conditions' peers CMS gave no Total HAC Score (and so no cut), which the HACRP pages leave out of
  // their counts.
  partUnscored: "{n} that CMS didn't score",
  partUnscoredCut: { text: '{n} with the {rate} cut but no score', claim: 'HACRP-01' },
  partNoChange: '{n} with no change',
  partOut: '{n} not in the program',
  partOutFile: "{n} not in CMS's file",
  whyMedian: 'Peer median, among those in the program: {median} of pay.',
  whyMedianFile: "Peer median, among those in CMS's file: {median} of pay.",
  // Under the hospital-acquired conditions row's counts: why the HACRP pages' counts of the same group can differ.
  whyHacCount: "The HAC pages count only the hospitals CMS scored with a payment decision, with or without an estimate here.",
  deepHospital: '{name} for this hospital',
  deepNotBuilt: '{name}: page under construction',
  deepProgram: '{name}: program page',
  netHeading: 'Net, all three programs',
  resultHead: "Estimated FY{fy}, from CMS's factors",
  resultCut: 'That is a {share} net cut of Medicare inpatient pay; the median of the {n} {group} is {median}.',
  resultBonus: 'That is a {share} net bonus of Medicare inpatient pay; the median of the {n} {group} is {median}.',
  resultZero: 'That is no net change in Medicare inpatient pay; the median of the {n} {group} is {median}.',
  whatifStanding: { text: "A what-if shows the formula's arithmetic, not what a hospital could realistically change or how. CMS's real result also depends on other hospitals. This one moves each program's payment factor; each program's own pages have the measure-level what-if.", claim: ['HRRP-04', 'HACRP-02', 'HUB-02'] },
  matchAll: 'Match the peer median on all three',
  reset: 'Reset to actual',

  // The what-if's controls (added by the page's script): how to use them, each row's handle, factor field, steppers and
  // median, and the hospital-acquired conditions toggle. {program}: the program's name.
  wiHow: 'Drag a handle along its row, type a factor, or tab to a handle and press the arrow keys (Shift for bigger steps; Escape resets). Everything on the page follows and is marked hypothetical; the actual figures stay as a ghost.',
  wiHint: 'drag me ↔',
  wiHandle: '{program}, what-if',
  wiFactor: 'Payment factor',
  wiFactorFor: '{program} payment factor, what-if',
  wiLower: 'Lower the {program} factor',
  wiRaise: 'Raise the {program} factor',
  // Under a factor field whose typed value was refused (the field shows the factor in force again).
  wiInvalid: 'Enter a factor from {min} to {max}.',
  wiMedian: 'Use peer median',
  wiHacGroup: 'Hospital-acquired conditions, what-if',
  wiHacCut: '{rate} cut',
  wiHacNone: 'No cut',
  // The handle's aria-valuetext: the factor (or the cut) and the estimated dollars it gives; ", hypothetical" once moved.
  wiValueFactor: 'factor {factor}: estimated FY{fy} {amount}, {word}',
  wiValueHac: '{word}: estimated FY{fy} {amount}',
  wiValueHyp: '{text}, hypothetical',
  // Once anything changes: the banner in the sticky row, the stamp, the marks on the charts, the struck-through actual
  // figures, the headline and the result. The headline keeps the comparison's words for the hypothetical net.
  wiTag: 'Hypothetical',
  wiBanner: 'Estimated FY{fy} net {net} instead of {actual}',
  wiStamp: 'What if',
  wiMark: 'What if',
  wiActual: 'actual',
  headHypCut: 'What if: a {share} net cut of Medicare inpatient pay, against {median} at the median of {n} {group}.',
  headHypBonus: 'What if: a {share} net bonus of Medicare inpatient pay, against {median} at the median of {n} {group}.',
  headHypZero: 'What if: no net change in Medicare inpatient pay, against {median} at the median of {n} {group}.',
  resultHyp: 'What if, estimated FY{fy}',
  // The result sentence once anything changes: each change as a clause (several join as a list), then the estimated net
  // the hospital would have, its share of pay and its actual net, and the group's median net share.
  wiIf: 'If {changes}, its estimated FY{fy} net would be {net} ({share} of Medicare inpatient pay) instead of {actual}. The group median is {median}.',
  wiIfHrrp: 'its readmissions factor were {to} instead of {from}',
  wiIfHvbp: 'its value-based purchasing factor were {to} instead of {from}',
  wiIfHacOn: { text: 'it had the {rate} hospital-acquired conditions cut', claim: 'HACRP-01' },
  wiIfHacOff: 'it had no hospital-acquired conditions cut',
  wiAnd: '{list} and {last}',
  // A page opened from a shared link with a changed scenario.
  wiShared: 'Reader-made scenario, not CMS data.',
  wiSharedReset: 'Show the actual figures',

  // The Medicaid work-requirement band (medicaid.js): a scenario, not a payment, never part of the net. Its heading and
  // note (a hospital with no scenario gets one that promises none); for a hospital with a loss to draw, its label (the
  // scenario tag follows), the range, its axis's scale, each case's share and how the cases are made; the link to the hospital on the work-requirement page. A hospital with no loss to draw gets the
  // reason's stamp and sentence instead (web/medicaid/copy.js, the work-requirement page's words).
  wbKicker: 'Medicaid scenario (not a payment)',
  wbHeading: 'The Medicaid work requirement',
  wbNote: 'A scenario of what the requirement could cost this hospital, not a payment, so it is never added to the Medicare net above.',
  wbNoteAlone: 'A scenario of what the requirement could cost this hospital, not a payment.',
  // A hospital with no scenario: the note promises none.
  wbNoteReason: 'The work-requirement pages model the Medicaid revenue a hospital could lose: not a payment, and never added to the Medicare net above.',
  wbNoteReasonAlone: 'The work-requirement pages model the Medicaid revenue a hospital could lose: not a payment.',
  wbLabel: 'Share of its patient revenue it could lose a year',
  wbRange: '{low} to {high}',
  // Under the range, the same cases' dollars, low to high (Dalton's review 11-11), and the middle case's beside its share:
  // step 4's own strings, unsigned beside "lose".
  wbDollars: '{low} to {high} a year, in {fy} dollars',
  // Under the range's axis: how it is drawn.
  wbScale: "Square-root scale, the same on every hospital's page",
  wbLow: 'Low case {share}',
  wbMiddle: 'Middle case {share}',
  wbMiddleLost: 'Middle case {share} · {lost}',
  wbHigh: 'High case {share}',
  wbHow: { text: "The three cases follow the Urban Institute's three state mitigation scenarios for the drop in each state's Medicaid expansion enrollment, applied to this hospital's FY{fy} Medicare cost report.", claim: ['WR-05', 'WR-18'] },
  wbLink: 'This hospital on the work-requirement page',

  // The TEAM section (team.js), the Medicaid band's twin: a scenario of a payment model's reconciliation, never a penalty,
  // never part of the net. Its heading; the status line (its start, mandatory or voluntary, the area as CMS's list names
  // it), the track it would be in, the note and the list's date. For a participant with public episodes: the label (the
  // scenario tag follows), the range (printed as the calculator prints its own), the line under it, the
  // ruler's words, the hatched walls' note, where the numbers come from and the link into the calculator. One with none: a
  // sentence and the link. One that left: the stamp and its end date, no dollars.
  tmKicker: 'Surgical episodes (a scenario)',
  tmKickerEnded: 'Surgical episodes',
  tmHeading: { text: "TEAM, Medicare's surgical episode model", claim: ['HUB-11', 'HUB-25'] },
  tmSince: { text: 'In TEAM since {date} · {kind} · {area} area', claim: 'TEAM-09' },
  tmFrom: { text: 'In TEAM from {date} · {kind} · {area} area', claim: 'TEAM-09' },
  tmMandatory: 'mandatory',
  tmVoluntary: { text: 'voluntary', claim: 'TEAM-06' },
  tmTrack: { text: 'From {date}, CMS puts it in Track {n} unless it asks for another track and CMS approves.', claim: 'TEAM-24' },
  tmNote: 'A scenario, not a payment, so it is never added to the Medicare net above.',
  tmNoteAlone: 'A scenario, not a payment.',
  tmAsOf: { text: "CMS's TEAM list as of {date}.", claim: 'TEAM-09' },
  tmLabel: 'If its {year} episode spending lands in a {band} band around target',
  tmTag: 'SCENARIO · PUBLIC DATA',
  tmRange: '{lo} to {hi}',
  tmDollars: { text: 'a year, Track {n} · at least {episodes} Medicare episodes a year · target amount {target}, in standardized dollars', claim: 'TEAM-59' },
  tmStopGain: 'stop-gain {amount}',
  tmStopLoss: 'stop-loss {amount}',
  tmNoLoss: 'no repayment',
  tmTip: '{lo} to {hi}: spending in a {band} band around target',
  tmWallGain: { text: "Track {n}'s stop-gain: {amount}", claim: 'TEAM-14' },
  tmWallLoss: { text: "Track {n}'s stop-loss: {amount}", claim: 'TEAM-14' },
  tmHatched: { text: "Hatched: past Track {n}'s limits, {loss} and {gain}", claim: 'TEAM-14' },
  tmHow: {
    text: "Episodes: its Medicare inpatient discharges in {year} for each episode type, a floor (the public file has no outpatient cases). Prices: CMS's preliminary target prices for {py} in its region.",
    claim: ['TEAM-57', 'TEAM-52'],
  },
  tmLink: 'This hospital in the TEAM calculator',
  tmNone: 'No public episode counts for this hospital: enter its own in the calculator and the scenario follows.',
  tmEndedStamp: 'Left TEAM',
  tmEnded: { text: "CMS's list gives {date} as the end of its participation, so this site has no scenario for it.", claim: 'TEAM-09' },

  // The peer table the page's script fills when it is opened.
  tableSummary: 'Every peer as a table',
  tableCount: '({n} {group}, alphabetical)',
  tableCaption: "Estimated FY{fy} dollars for each of the {n} {group}, alphabetical. Net % is the net as a share of each hospital's estimated Medicare inpatient pay.",
  colHospital: 'Hospital',
  colCity: 'City',
  colState: 'State',
  colHrrp: 'Readmissions',
  colHac: 'HAC',
  colVbp: 'VBP',
  colNet: 'Net',
  colNetPct: 'Net %',
  tableThis: '(this hospital)',

  // The source and fairness lines.
  source: "Source: CMS FY{fy} program files (HRRP, HACRP, HVBP) and this site's dollar model.",
  sourceDollars: "Dollars are estimates of FY{fy} effects on Medicare inpatient pay; percentages are each hospital's estimated change divided by its estimated Medicare inpatient pay.",
  fairness: "A cut is a program's formula at work, not a verdict on a hospital's care.",

  // A hospital without an estimate: its status and why, and the program pages it has.
  statusMaryland: { text: 'Not adjusted', claim: ['HUB-05', 'HACRP-26', 'HACRP-91'] },
  statusMarylandText: { text: "Maryland's hospitals are paid under the state's all-payer model, so these three programs don't adjust their pay. The hospital-acquired conditions program still scores them.", claim: ['HUB-04', 'HUB-05', 'HACRP-26', 'HACRP-91', 'HACRP-13'] },
  statusNoInputs: 'No estimate',
  statusNoInputsText: "CMS's FY{fy} payment file has no usable row for this hospital, so this site can't price it.",
  // What CMS decided for it all the same, in the hospital-acquired conditions program (every hospital here is in its file).
  statusHacCut: { text: "CMS's FY{fy} hospital-acquired conditions decision: the flat {rate} cut. This site has no dollar estimate of it.", claim: 'HACRP-01' },
  statusHacNone: "CMS's FY{fy} hospital-acquired conditions decision: no cut.",
  pagesHeading: "This hospital's program pages",
});
