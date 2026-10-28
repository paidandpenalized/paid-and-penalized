// The home page's words (hub/home/): the hero, the story's nine steps, the scale bar's labels, the states map's key and
// readout, the peer toggle and the example card. No digit characters: every number arrives through a {placeholder}
// (page.js fills them from the data; the programs' rules from web/programs.js).
import { typesetCopy } from '../../web/render/components.js';

// Typeset once (straight apostrophes and quotes to curly), as every page shows them.
export const COPY = typesetCopy({
  description: 'Where Medicare’s hospital quality programs move inpatient pay, hospital by hospital and state by state, estimated from public CMS data.',

  // The rail: the story's steps, by name.
  railLabel: 'The story’s steps',
  railScale: 'Scale',
  railStart: 'Start at {zero}',
  railHrrp: 'Readmissions',
  railHac: 'Hospital-acquired',
  railVbp: 'Value-based',
  railNet: 'Net result',
  railMap: 'On the map',
  railStates: 'By state',
  railFind: 'Find yours',

  // Step 0: the scale. {n} hospitals, {pay} their pay, {gross} what the programs move ({share} of the pay), {notPaid}
  // what is not paid and {bonus} what moves as bonuses; {programs} how many programs ("Three").
  scaleHead: 'Medicare will pay {n} hospitals about {pay} for inpatient care in FY{fy}.',
  scaleText: '{programs} quality programs adjust that pay by about {gross}, {share} of it: the red sliver magnified under the bar. {notPaid} is not paid at all, and {bonus} moves between hospitals as bonuses.',
  scaleCue: 'Scroll to follow the money',
  scaleAsOf: 'Estimated from public CMS files, FY{fy}',

  // Step 1: every hospital at $0 ({zero}).
  startHead: 'Every hospital starts at {zero}.',
  startText: 'Each dot is one hospital, poured out of that bar. Under them sit the {programs} programs as gates. As each gate rises through the crowd, every hospital it passes shifts by that program’s adjustment.',

  // Step 2: Readmissions. {cap} the program's cap, {cutN} hospitals cut, {median} the median cut as a share of a
  // hospital's pay, {zeroN} hospitals at {zero}.
  hrrpHead: 'Readmissions: most hospitals take a small cut.',
  hrrpText: 'The readmissions program (HRRP) cuts pay, by up to {cap}, when a hospital’s readmissions run above expected. {cutN} hospitals take a cut; the median cut is {median} of a hospital’s Medicare inpatient pay. {zeroN} pass through at {zero}.',

  // Step 3: hospital-acquired conditions. {cut} the flat cut, {cutN} hospitals cut, {onlyN} cut by it alone.
  hacHead: 'Hospital-acquired conditions: a flat {cut} off one quarter.',
  hacText: 'The HAC program scores infections and other patient-safety events. The {cutN} hospitals in the quarter with the highest scores lose {cut} of their Medicare inpatient pay. The tall column: {onlyN} whose only cut is this one.',

  // Step 4: value-based purchasing. {withhold} the share withheld, {bonusN} and {cutN} hospitals ahead and behind,
  // {bonus} the bonuses.
  vbpHead: 'Value-based purchasing: some move right.',
  vbpText: 'HVBP withholds {withhold} of each participant’s pay and pays it back by score, so it is budget-neutral by design. {bonusN} hospitals come out ahead and {cutN} behind; about {bonus} moves between them.',

  // Step 5: the net. {part} and {whole}: the simple fraction nearest the share of hospitals with a net cut, in words
  // ("Two of every three").
  netHead: '{part} of every {whole} hospitals take a net cut.',
  // When no simple fraction is near the share: the share itself.
  netHeadShare: '{share} of hospitals take a net cut.',
  netText: 'This is where the {programs} programs leave each hospital: its net change as a share of its Medicare inpatient pay. {cutN} take a net cut, {bonusN} a net bonus and {zeroN} come out at {zero}. Altogether about {notPaid} is not paid, estimated.',

  // Step 6: the dots on the map.
  mapHead: 'Cuts reach every state.',
  mapText: 'The same dots, each now at its hospital’s location. Net cuts outnumber net bonuses almost everywhere, so a map of dots mostly shows where hospitals are. To compare states, add up each state’s hospitals.',

  // Step 7: the states. {low} and {high}: the lowest and highest state's share (unsigned) and name. The heading with
  // "add" when the highest state comes out ahead, "less" when every state takes a cut.
  statesHead: 'The programs take {lowShare} of hospital pay in {low} and add {highShare} in {high}.',
  statesHeadLess: 'The programs take {lowShare} of hospital pay in {low} and {highShare} in {high}.',
  statesText: 'Each state is shaded by its hospitals’ combined net change as a share of their Medicare inpatient pay. {ahead} Maryland is paid under its own all-payer model, outside these programs.',
  // Which states come out ahead ({states}: their names, as a list).
  aheadMany: 'Only {states} come out ahead.',
  aheadOne: 'Only {states} comes out ahead.',
  aheadNone: 'No state comes out ahead.',

  // Step 8: find yours.
  findHead: 'Find yours among its peers.',
  findLabel: 'Find your hospital',
  findWord: 'Find',
  findRest: 'your hospital among its peers',
  findPlaceholder: 'Hospital name, city or state',

  // The scale bar (bar.js). Its caption ({n} hospitals), the pay and what the programs move ({gross}, {share}), the
  // magnification ({times}), the two parts, and the image's takeaway for a screen reader.
  barCaption: 'Estimated FY{fy} Medicare inpatient pay to {n} hospitals, one dot each',
  barMoved: '{gross}, {share}',
  barTimes: '×{times}',
  barNotPaid: 'not paid',
  barBonus: 'moved to other hospitals as bonuses',
  barLabel: 'A bar of the {pay} Medicare will pay in FY{fy}, estimated, with one dot for each of the {n} hospitals, ordered by their pay. The {gross} the programs move is the red sliver at its right end, {share} of the bar. Magnified {times} times, it splits into {notPaid} not paid and {bonus} moved to other hospitals as bonuses.',

  // The states map (states.js): its name, each state's line, the readout's default, the key, the small states.
  mapLabel: 'States, shaded by their hospitals’ combined net change. Each state’s numbers are its title.',
  stateLine: '{name}: {hospitals}, net {share} of pay, {cutShare} take a net cut',
  stateNone: '{name}: no hospital with an estimate',
  stateMaryland: '{name}: not in these programs. Its {hospitals} are paid under the state’s all-payer model.',
  hospital: 'hospital',
  hospitals: 'hospitals',
  readout: 'Point at, tap or tab to a state for its numbers.',
  keyTitle: 'State net change, est. FY{fy}, % of Medicare inpatient pay',
  keyCut: '{end} cut',
  keyBonus: '{end} bonus',
  keyMaryland: 'Maryland: not in these programs',
  smallStates: 'Small states',

  // The peer toggle the story's last step shows (a script's).
  peersLabel: 'Compare with',
  peerState: 'Same state',
  peerSize: 'Same size',
  peerTeach: 'Same teaching',

  // The example card: its lead (the hint shows with the search), the hospital's place and size ({beds} beds, its
  // {teaching} status), its net, the three programs, its peers, its page.
  cardExample: 'An example.',
  cardHint: 'Search above for yours.',
  cardPlace: '{city}, {state}. {beds}, {teaching}.',
  cardPlaceNoBeds: '{city}, {state}. {teaching}.',
  bed: 'bed',
  beds: 'beds',
  teachMajor: 'major teaching',
  teachMinor: 'minor teaching',
  teachNone: 'non-teaching',
  teachUnknown: 'teaching status not reported',
  cardNetCut: 'Estimated FY{fy} net cut, share of Medicare inpatient pay',
  cardNetBonus: 'Estimated FY{fy} net bonus, share of Medicare inpatient pay',
  cardNetZero: 'Estimated FY{fy} net: no change',
  cardRowsLabel: 'Estimated FY{fy} dollars by program',
  programHrrp: 'Readmissions',
  programHac: 'Hospital-acquired conditions',
  programVbp: 'Value-based purchasing',
  wordCut: 'cut',
  wordBonus: 'bonus',
  wordNone: 'no change',
  notInProgram: 'Not in this program',
  cardPeers: 'Of {n} {group} hospitals, {cutN} take a net cut; the median is {median}.',
  cardNext: 'Its hospital page shows every program among its peers, with a what-if.',
  cardGo: 'Open its hospital page',
});
