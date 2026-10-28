// The words of a hospital's page across the programs (/hospital/<ccn>/: hub/hospital/page.js). No digit characters:
// numbers arrive through {placeholders}, the programs' rules through their named constants (web/programs.js).
import { typesetCopy } from '../../web/render/components.js';

// Typeset once (straight apostrophes and quotes to curly), as every page shows them.
export const COPY = typesetCopy({
  // <title> (the site's name follows it) and the description. {name}, {city}, {state}: the master record's; {n} {group}:
  // the peers the page compares it with.
  title: '{name}, {city}, {state}: Medicare payment programs, FY{fy}',
  description: "Estimated FY{fy} dollars for {name} in {city}, {state}, in Medicare's Readmissions, hospital-acquired conditions and value-based purchasing programs, the net of the three, and how it compares with {n} {group}.",
  descriptionMaryland: "{name} in {city}, {state} is paid under Maryland's all-payer model, outside Medicare's Readmissions, hospital-acquired conditions and value-based purchasing programs.",
  descriptionNoInputs: "{name} in {city}, {state}: CMS's FY{fy} payment file has no usable row for this hospital, so this site has no estimate of its dollars in Medicare's Readmissions, hospital-acquired conditions and value-based purchasing programs.",

  // The sticky peer row: its label, the toggle (shown by the page's script) and the group it names. A toggle a hospital
  // has no group for is disabled, and the note says why.
  peersLabel: 'Compare with',
  peersGroupLabel: 'Peer group',
  peerState: 'Same state',
  peerSize: 'Same size',
  peerTeach: 'Same teaching',
  groupState: '{state} hospitals',
  groupSizeLow: 'hospitals with fewer than {beds} beds',
  groupSizeMid: 'hospitals with {lo} to {hi} beds',
  groupSizeHigh: 'hospitals with {beds} beds or more',
  groupTeachMajor: 'major teaching hospitals',
  groupTeachMinor: 'minor teaching hospitals',
  groupTeachNone: 'non-teaching hospitals',
  peerNoSize: 'Same size: no bed count on record for this hospital.',
  peerNoTeach: 'Same teaching: no teaching status on record for this hospital.',

  // The record card: its title bar, then the hospital, where it is and what it is (from the hospital master).
  recordTitle: 'Hospital record · FY{fy}',
  recordCcn: 'CCN {ccn}',
  fieldHospital: 'Hospital',
  fieldLocation: 'Location',
  fieldType: 'Type',
  location: '{city}, {state}',
  typeTeachMajor: 'Major teaching',
  typeTeachMinor: 'Minor teaching',
  typeTeachNone: 'Not a teaching hospital',
  typeBeds: '{beds} beds',
  typeUrban: 'Urban',
  typeRural: 'Rural',

  // The net: its label and estimate tag, the stamp, the common fiscal year's note, then each program's dollars as rows
  // adding to it, each with its peers' median tick, and the key to the tick.
  netLabel: 'Net, three programs, FY{fy}',
  estimateTag: 'Estimate',
  estimateTagLabel: 'Estimate: how this site estimates the dollars',
  stampCut: 'Net cut',
  stampBonus: 'Net bonus',
  stampZero: 'No net change',
  fyNote: "All three programs' FY{fy} figures, the latest year they share. A program's own pages may show a newer year.",
  sumLabel: "Each program's estimated FY{fy} dollars, adding to the net",
  sumNet: 'Net, estimated',
  sumMedian: "median of its peers, scaled to this hospital's pay: {amount}",
  sumKey: "Median of its peers, scaled to this hospital's pay",
  notInProgram: 'Not in this program',
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
  // The swarm's own words (drawn on its canvas): the two piles' names, the peers' median, their cuts and bonuses, and
  // what a dot says when hovered, tapped or reached by the arrow keys.
  swarmAll: 'All {n} hospitals',
  swarmMedian: 'median {share}',
  swarmCut: '{n} net cut',
  swarmBonus: '{n} net bonus',
  swarmNone: '{n} no change',
  swarmAxisCut: 'cut',
  swarmAxisBonus: 'bonus',
  swarmLabel: 'The {n} {group} and all {all} hospitals with an estimate, each a dot placed by its estimated FY{fy} net as a share of its Medicare inpatient pay; this hospital is ringed. Arrow keys step through the peers; Enter opens one.',
  dotText: '{name}, {city}, {state}: {share} net, estimated FY{fy}',
  dotThis: 'This hospital',
  dotOpen: 'Tap again to open its page.',
  stripMedian: 'median',
  stripOut: 'This hospital: not in this program',

  // The what-if section (#whatif): one row per program, an empty row for the next one, then the net with its result.
  whatifKicker: 'Every program, among its peers',
  whatifHeading: 'What if? Adjust any program',
  whatifLede: "This hospital's estimated FY{fy} dollars in each program, beside the same {n} {group}.",
  rowValue: 'Estimated FY{fy}:',
  whyFactor: 'Payment factor {factor}.',
  whyHrrpOut: "Not in CMS's FY{fy} Readmissions file.",
  whyVbpOut: "Not in CMS's FY{fy} value-based purchasing file.",
  whyHacCut: "CMS's FY{fy} decision: the flat {rate} cut.",
  whyHacNone: "CMS's FY{fy} decision: no cut.",
  // The peers' counts: "Of the 74 Alabama hospitals: 59 with a cut, 12 with no cut, 3 not in the program." Each part is
  // a count and its words; a count of none drops the parts after the first two.
  whyPeers: 'Of the {n} {group}: {parts}.',
  partCut: '{n} with a cut',
  partHacCut: '{n} with the {rate} cut',
  partBonus: '{n} with a bonus',
  partNoCut: '{n} with no cut',
  partNoChange: '{n} with no change',
  partOut: '{n} not in the program',
  whyMedian: 'Peer median, among those in the program: {median} of pay.',
  deepHospital: '{name} for this hospital',
  deepComing: '{name}: coming',
  nextHeading: 'Next program',
  nextText: 'Each program joins this page as its site launches, as one more row on the same scale.',
  nextBox: 'Room for the next program',
  netHeading: 'Net, all three programs',
  resultHead: "Estimated FY{fy}, from CMS's factors",
  resultCut: 'That is a {share} net cut of Medicare inpatient pay; the median of the {n} {group} is {median}.',
  resultBonus: 'That is a {share} net bonus of Medicare inpatient pay; the median of the {n} {group} is {median}.',
  resultZero: 'That is no net change in Medicare inpatient pay; the median of the {n} {group} is {median}.',
  whatifStanding: "A what-if shows the formula's arithmetic, not what a hospital could realistically change or how. CMS's real result also depends on other hospitals. This one moves each program's payment factor; each program's own pages have the measure-level what-if.",
  matchAll: 'Match the peer median on all three',
  reset: 'Reset to actual',

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
  fairness: "A cut is a program's formula at work, not a verdict on a hospital's care. Peers are listed alphabetically; nothing on this page ranks hospitals.",

  // A hospital without an estimate: its status and why, and the program pages it has.
  statusMaryland: 'Not in these programs',
  statusMarylandText: "Maryland's hospitals are paid under the state's all-payer model, outside these three programs.",
  statusNoInputs: 'No estimate',
  statusNoInputsText: "CMS's FY{fy} payment file has no usable row for this hospital, so this site can't price it.",
  pagesHeading: "This hospital's program pages",
});
