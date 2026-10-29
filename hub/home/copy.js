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
  // hospital's pay; then {zeroN} hospitals in the program at {zero}, and {outN} it does not list (never counted at $0),
  // when there are any.
  hrrpHead: 'Readmissions: most hospitals take a small cut.',
  hrrpText: 'The readmissions program (HRRP) cuts pay, by up to {cap}, when a hospital’s readmissions run above expected. {cutN} hospitals take a cut; the median cut is {median} of a hospital’s Medicare inpatient pay.',
  hrrpZero: '{zeroN} pass through at {zero}.',
  hrrpZeroOut: '{zeroN} pass through at {zero}, and {outN} are not in the program.',

  // Step 3: hospital-acquired conditions. {cut} the flat cut, {cutN} hospitals cut, {onlyN} cut by it alone.
  hacHead: 'Hospital-acquired conditions: a flat {cut} off one quarter.',
  hacText: 'The HAC program scores infections and other patient-safety events. The {cutN} hospitals in the quarter with the highest scores lose {cut} of their Medicare inpatient pay. The tall column: {onlyN} whose only cut is this one.',

  // Step 4: value-based purchasing. {withhold} the share withheld, {bonusN} and {cutN} hospitals ahead and behind,
  // {bonus} the bonuses in FY{fy}.
  vbpHead: 'Value-based purchasing: some move right.',
  vbpText: 'HVBP withholds {withhold} of each participant’s pay and pays it back by score, so it is budget-neutral by design. {bonusN} hospitals come out ahead and {cutN} behind; about {bonus} moves between them in FY{fy}, estimated.',

  // Step 5: the net. {part} and {whole}: the simple fraction nearest the share of hospitals with a net cut, in words
  // ("Two of every three").
  netHead: '{part} of every {whole} hospitals take a net cut.',
  // When no simple fraction is near the share: the share itself.
  netHeadShare: '{share} of hospitals take a net cut.',
  netText: 'This is where the {programs} programs leave each hospital: its net change as a share of its Medicare inpatient pay. {cutN} take a net cut, {bonusN} a net bonus and {zeroN} come out at {zero}. Altogether about {notPaid} is not paid in FY{fy}, estimated.',

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
  // Short enough to show whole in the box at every width, down to 320.
  findPlaceholder: 'Hospital or city',

  // The scale bar (bar.js). Its caption ({n} hospitals), the pay and what the programs move ({gross}, {share}, with the
  // words that say so), the magnification ({times}), the two parts, and the image's takeaway for a screen reader.
  barCaption: 'Estimated FY{fy} Medicare inpatient pay to {n} hospitals, one dot each',
  barMoved: '{gross}, {share}',
  barMovedBy: 'moved by the programs',
  barTimes: '×{times}',
  barNotPaid: 'not paid',
  barBonus: 'moved to other hospitals as bonuses',
  barLabel: 'A bar of the {pay} Medicare will pay in FY{fy}, estimated, with one dot for each of the {n} hospitals, ordered by their pay. The {gross} the programs move is the red sliver at its right end, {share} of the bar. Magnified {times} times, it splits into {notPaid} not paid and {bonus} moved to other hospitals as bonuses.',

  // The states map (states.js): its name, each state's line, the readout's prompt (hidden until the story's script makes
  // the states answer to it), the key, the small states.
  mapLabel: 'States, shaded by their hospitals’ combined net change. Each state’s numbers are its title.',
  stateLine: '{name}: {hospitals}, net {share} of pay, {cutShare} take a net cut',
  stateNone: '{name}: no hospital with an estimate',
  stateMaryland: '{name}: not in these programs. Its {hospitals} are paid under the state’s all-payer model.',
  hospital: 'hospital',
  hospitals: 'hospitals',
  readout: 'Point at, tap or tab to a state for its numbers.',
  keyTitle: 'State net change, est. FY{fy}, % of Medicare inpatient pay',
  // The title the narrowest phones show instead, on one line.
  keyTitleShort: 'Net change, est. FY{fy}, % of pay',
  keyCut: '{end} cut',
  keyBonus: '{end} bonus',
  keyMaryland: 'Maryland: not in these programs',
  smallStates: 'Small states',

  // The example card's own words: its lead (the hint shows with the search), the label of its programs' rows, the
  // pointer to the hospital's page. What it says about the hospital is the story's (hub/client/story/copy.js), so the script that
  // rewrites the card for a found hospital says it the same way.
  cardExample: 'An example.',
  cardHint: 'Search above for yours.',
  cardRowsLabel: 'Estimated FY{fy} dollars by program',
  cardNext: 'Its hospital page shows every program among its peers, with a what-if.',
  cardGo: 'Open its hospital page',

  // ---------- below the story (below.js) ----------
  // The program directory: its heading ({count}: the programs with data, {more}: the programs under consideration, in
  // words; it promises no site and no date), the lede ({gross}: what they move in FY{fy}), the group over the cards.
  dirKicker: 'The programs',
  dirHead: '{count} programs live, {more} under consideration.',
  dirLede: 'Each card puts its program’s hospitals on one shared scale. Together these {count} move about {gross} of FY{fy} Medicare inpatient pay, estimated.',
  dirGroup: 'Quality programs',
  dirGroupNote: 'Estimated FY{fy}',
  // Each card's takeaway over its histogram. Readmissions: the share of its hospitals at {zero}, as one in {whole} when a
  // simple fraction is near, else as {share}. Hospital-acquired conditions: {quarter} the rule's share ("the quarter"),
  // {cut} its cut. Value-based purchasing: its two sides (its dek already says it is budget-neutral).
  takeHrrp: 'Most cuts are small; about one hospital in {whole} pays {zero}.',
  takeHrrpShare: 'Most cuts are small; {share} of its hospitals pay {zero}.',
  takeHac: 'One flat step: {quarter} with the highest scores take the {cut} cut; the rest pay {zero}.',
  takeVbp: 'One pool, two sides: the cuts on the left pay for the bonuses on the right.',
  // The histogram: its takeaway for a screen reader ({n} the hospitals in {program}, the program's full name, so nothing
  // is spelled out letter by letter; {bin} the bins' width in points; {parts} the groups it has, joined, so a program
  // without bonuses never says "0 with a bonus": histCut, histZero and histPartBonus) and its two labels (histCut, then
  // histBonus or histZero).
  histLabel: '{n} hospitals in the {program}, each by its estimated FY{fy} change as a share of its Medicare inpatient pay, in bins of {bin} points: {parts}.',
  histPartBonus: '{n} with a bonus',
  histCut: '{n} cut',
  histBonus: '{n} bonus',
  histZero: '{n} at {zero}',
  // The card's national figure: what Readmissions and hospital-acquired conditions take ({fy}), what value-based
  // purchasing moves ({amount}) and its net.
  dirNotPaid: 'not paid to hospitals nationally, FY{fy}',
  dirMoved: '{amount} moved',
  dirNet: 'net {amount} nationally, FY{fy}',
  // The way to a program's page: its short name ({ab}), the same length on every card so the three read on one line; a
  // screen reader hears the name after it ({name}).
  dirOpen: 'Open {ab}',
  dirOpenLabel: 'Open {ab}, {name}',
  // The programs under consideration, by what they do to payment (web/site.js `group`; the keys keep the registry's
  // internal stage, soon), and the words in each slip's empty band. Each group's name and each band's words fit one line
  // in the narrowest group (hub/styles.css).
  soonPrice: 'Price adjustments',
  soonReporting: 'Reporting rules',
  soonEpisode: 'Episode payment',
  soonNone: 'under consideration',

  // Methods, in brief: the heading, a paragraph and three points ({fy}), then the worksheet (worksheet.js fills it for a
  // found hospital). Its lines' numbers arrive as {pay}, {base}, {hrrp}, {vbp}, {a} {b} {c}; {one} is the factor's 1,
  // {cut} the HAC cut.
  estKicker: 'Methods, in brief',
  estHead: 'Every dollar here is an estimate, and is labeled one.',
  estText: 'An estimate applies CMS’s published method to CMS’s public data, where an input CMS used is not public. It lands close to CMS’s own figure, not exactly on it.',
  estStepPay: 'Start from each hospital’s {b} for FY{fy}.',
  estStepPayB: 'estimated Medicare inpatient pay',
  estStepRule: 'Apply each program’s {b} to the part of pay it covers.',
  estStepRuleB: 'published factor or rule',
  estStepAdd: 'Add the programs {b}: each percentage applies to a different base.',
  estStepAddB: 'in dollars, never in percent',
  estMore: 'Read the methods',
  wsLabel: 'Worksheet: one hospital’s estimated FY{fy} dollars, line by line',
  wsTitle: 'Worksheet · FY{fy}',
  wsExample: 'An example',
  wsCcn: 'CCN {ccn}',
  wsPay: '{name}, {place}: estimated Medicare inpatient pay',
  wsBase: 'The part of pay the readmissions and value-based factors apply to',
  wsBaseNote: 'base operating payments, estimated',
  wsHrrp: 'Readmissions',
  wsFactor: '(factor {factor} − {one}) × line {base}',
  wsHac: 'Hospital-acquired conditions',
  wsCut: 'in the {cut} cut: −{cut} × (line {pay} + line {hrrp} + line {vbp})',
  wsNoCut: 'not in the {cut} cut',
  wsVbp: 'Value-based purchasing',
  wsNet: '{net}, lines {a} + {b} + {c}',
  wsNetWord: 'Net',
  // Each line is rounded on its own (line 3 is the factor times the unrounded base), so worked from the printed lines the
  // arithmetic can be a dollar off.
  wsNetNote: 'in whole dollars, each line rounded on its own, so the arithmetic can be off by a dollar; percentages don’t add across programs',
  wsFind: 'Find your hospital above and this worksheet fills in for it.',
  wsGo: 'Its hospital page',

  // Your turn: the invitation (the form's note is the footer's, web/copy.js).
  askKicker: 'Your turn',
  askHead: 'What should I build next?',
  askText: 'Which Medicare program, question or dataset would you want to see explained next? Spotted a number that looks wrong? Say so on the same form.',
  askGo: 'Suggest an idea',
});

// What a program does to payment (web/site.js `group`), in words, in the order the directory shows the groups: the
// directory's group headings and the placeholder pages' kickers (hub/coming.js).
export const GROUP_WORDS = Object.freeze({ quality: COPY.dirGroup, price: COPY.soonPrice, reporting: COPY.soonReporting, episode: COPY.soonEpisode });
