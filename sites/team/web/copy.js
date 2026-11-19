// The TEAM site's words, for hospital staff: plain, and TEAM is a payment model, never a penalty. No digit characters:
// every number, date and rule citation arrives through a {placeholder}, formatted (constants.js holds the rules' numbers,
// each with its claim). A sentence that states a fact about the model's rules carries the claim id (or ids) of its row in
// sites/team/CLAIMS.md; sentences about this site's own arithmetic or framing carry none. Results say "would", never
// "will". The lookup's words are lookup-copy.js's, a copy file of its own.
import { copyOf } from '../../../web/render/components.js';
import { COPY as LOOKUP } from './lookup-copy.js';

export const COPY = {
  // The page: its title, its description for search results and link previews, the Part tag ("Part 1 · Who's in").
  title: { text: 'TEAM, hospital by hospital', claim: null },
  description: {
    text: "Medicare's mandatory model for surgical episodes: which hospitals are in it, what changes on {date}, how the money works and what each hospital has to do.",
    claim: ['TEAM-02', 'TEAM-07'],
  },
  partTag: { text: 'Part {n}', claim: null },

  // The Parts (constants.js SECTIONS): each one's label in the section menu and its tag, then its heading.
  navWho: { text: "Who's in", claim: null },
  navChange: { text: 'What changes {date}', claim: null },
  navMoney: { text: 'How the money works', claim: null },
  navBar: { text: 'The bar to beat', claim: null },
  navYours: { text: 'Your hospital', claim: null },
  navDo: { text: 'What your hospital has to do', claim: null },
  navFind: { text: 'Where your numbers are', claim: null },
  // The section menu's shorter labels (its row has room for all seven and Methods on a laptop).
  menuWho: { text: "Who's in", claim: null },
  menuChange: { text: '{date}', claim: null },
  menuMoney: { text: 'The money', claim: null },
  menuBar: { text: 'Bar to beat', claim: null },
  menuYours: { text: 'Your hospital', claim: null },
  menuDo: { text: 'To do', claim: null },
  menuFind: { text: 'Your reports', claim: null },

  // Part 1, who's in: the line over the title, the dek, the button to the calculator, the record card.
  kicker: { text: 'Medicare · mandatory model · {from} to {to}', claim: ['TEAM-02', 'TEAM-20'] },
  dek: {
    text: "Medicare's mandatory payment model for surgical episodes. For {n} kinds of surgery, CMS sets each hospital target prices that cover the stay and the {days} days after it. From {date}, a hospital in Track {track} pays Medicare back what its episodes cost over target, and is paid what they come in under, up to {limit} of its yearly target either way.",
    claim: ['TEAM-02', 'TEAM-21', 'TEAM-19', 'TEAM-24', 'TEAM-14'],
  },
  toCalc: { text: 'Go to the calculator', claim: null },
  cardTitle: { text: 'TEAM at a glance', claim: null },
  cardRight: { text: 'Performance year {n} · {year}', claim: 'TEAM-07' },
  cardListed: { text: "On CMS's list", claim: null },
  cardListedNote: { text: 'hospitals, as of {date}', claim: 'TEAM-09' },
  cardAreas: { text: 'Selected areas', claim: null },
  cardAreasNote: { text: "metro and micro areas CMS chose by random sampling, as its list names them", claim: 'TEAM-02' },
  cardKinds: { text: 'Kinds of surgery', claim: null },
  cardKindsNote: { text: 'each episode runs through day {days} after discharge', claim: ['TEAM-21', 'TEAM-19'] },
  cardLimit: { text: 'Track {track} limit', claim: null },
  cardLimitNote: { text: 'of the yearly target, either way, from {date}', claim: ['TEAM-14', 'TEAM-24'] },

  // Part 1's lookup box (client/lookup.js fills the mount; without a script it says so).
  lookupHeading: { text: 'Is a hospital in TEAM?', claim: null },
  lookupNote: { text: "Every hospital on Medicare's hospital list. CMS's TEAM list as of {date}; CMS updates it each quarter.", claim: 'TEAM-09' },
  lookupNoScript: { text: 'The search runs in your browser and needs JavaScript.', claim: null },

  // Figure 1, the map of participants: filled dots in TEAM, hollow ones for the other hospitals the inpatient system pays.
  mapTakeaway: {
    text: "The {n} hospitals in TEAM for {year}, in the areas CMS selected. Hollow: the {other} other hospitals Medicare's inpatient system pays, outside Maryland.",
    claim: ['TEAM-02', 'TEAM-03'],
  },
  mapKeyIn: { text: 'In TEAM ({n})', claim: null },
  mapKeyOther: { text: 'Other inpatient-system hospitals, not in TEAM ({n})', claim: null },
  mapNote: {
    text: "CMS's list names {listed} hospitals. Not counted here: those whose participation ended before {year} ({ended}) and any not on Medicare's hospital list ({missing}).",
    claim: 'TEAM-09',
  },
  mapUnplaced: { text: 'The map has no place for {places}; the table counts their hospitals.', claim: null },
  mapSource: { text: "CMS, TEAM participant list, as of {date}; Medicare's hospital list, for each hospital's place and kind.", claim: null },
  mapAlt: { text: "Map of the United States: a filled dot for each hospital in TEAM, a hollow dot for each other hospital Medicare's inpatient system pays.", claim: null },
  mapTip: { text: '{in} in TEAM, {other} other', claim: null },
  mapColState: { text: 'State', claim: null },
  mapColIn: { text: 'In TEAM', claim: null },
  mapColOther: { text: 'Other inpatient-system hospitals', claim: null },

  // Part 1's note for patients, under the map.
  patientHeading: { text: "If you're a patient", claim: null },
  patientChoice: { text: "TEAM doesn't limit your choice of hospital, doctor or rehab: a hospital in TEAM must not restrict it.", claim: 'TEAM-33' },
  patientHeld: {
    text: 'Your hospital is held to a spending target and quality measures for your care, from the surgery through {days} days after you leave.',
    claim: ['TEAM-20', 'TEAM-19'],
  },
  patientNotice: {
    text: 'Before you leave the hospital after your surgery, it must give you a written notice that explains TEAM and says your Medicare protections continue.',
    claim: 'TEAM-32',
  },

  // Part 2, what changes on the first day of performance year 2.
  changeHeading: { text: 'From upside only to two-sided', claim: null },
  changeYearOne: {
    text: "In {year}, the model's first year, a hospital could choose Track {ta} or Track {tc}, and CMS put any that didn't choose in Track {ta}. Track {ta} can be paid for spending under target and never owes Medicare for spending over it.",
    claim: ['TEAM-27', 'TEAM-28'],
  },
  changeYearTwo: {
    text: 'From {date}, CMS puts every hospital in Track {tc} unless it asks for another track and qualifies. Track {tb} is for safety-net, rural, sole community, Medicare-dependent and essential access community hospitals; a safety-net hospital may stay in Track {ta} through {last}.',
    claim: ['TEAM-24', 'TEAM-26', 'TEAM-25'],
  },
  changeStamp: { text: 'Track {track}', claim: null },
  changeStampSub: { text: '{limit} from {date}', claim: null },
  changeShare: { text: "The limit is a share of the hospital's whole target amount for the year, not of each episode.", claim: 'TEAM-14' },

  // Figure 2, the tracks' limits.
  tracksTakeaway: { text: 'The most a hospital can be paid or owe for {year}, by track, as a share of its yearly target amount.', claim: 'TEAM-14' },
  trackName: { text: 'Track {n}', claim: null },
  trackSub1: { text: 'upside only', claim: null },
  trackSub2: { text: 'two-sided, smaller', claim: null },
  trackSub3: { text: 'two-sided', claim: null },
  trackNone: { text: 'owes nothing', claim: 'TEAM-28' },
  trackTipGain: { text: 'Track {n}: paid up to {pct} of its target', claim: null },
  trackTipLoss: { text: 'Track {n}: owes up to {pct} of its target', claim: null },
  tracksSource: { text: '{cite}.', claim: null },
  tracksAlt: { text: 'Bar chart: for each track, how far up a hospital can be paid and how far down it can owe, as shares of its yearly target.', claim: null },
  tracksColTrack: { text: 'Track', claim: null },
  tracksColWho: { text: 'Kind', claim: null },
  tracksColGain: { text: 'Most it can be paid', claim: null },
  tracksColLoss: { text: 'Most it can owe', claim: null },

  // Part 3, how the money works: the words, the worked example's ledger, Figure 3.
  moneyHeading: { text: "A target, the year's spending, a quality score, a limit", claim: null },
  moneyHow: {
    text: "Once a year, CMS adds up what Medicare paid for each of a hospital's episodes, from the surgery through {days} days after discharge: the hospital stay, the surgeon and other doctors, rehab and nursing facilities, home health and readmissions. It sets that against the hospital's target prices for the same episodes, adjusts the difference for quality and stops it at the track's limit.",
    claim: ['TEAM-54', 'TEAM-19', 'TEAM-22', 'TEAM-15', 'TEAM-14'],
  },
  moneyStandardized: { text: 'CMS counts it all in standardized Medicare payments, and so does every dollar figure on this page.', claim: 'TEAM-23' },
  ledgerLabel: { text: 'The worked example, line by line', claim: null },
  ledgerTarget: { text: 'Target amount', claim: null },
  ledgerTargetNote: { text: "Each episode's target price, summed over the year's episodes", claim: null },
  ledgerSpend: { text: 'Spending', claim: null },
  ledgerSpendNote: { text: 'What Medicare paid for those episodes, every provider, through day {days}', claim: ['TEAM-22', 'TEAM-19'] },
  ledgerRaw: { text: 'Before quality', claim: null },
  ledgerQuality: { text: 'Quality adjustment', claim: null },
  ledgerQualityNote: { text: 'A composite quality score of {cqs} keeps {keep} of a gain in Track {track}', claim: 'TEAM-15' },
  ledgerLimit: { text: 'Track {track} limits', claim: null },
  ledgerLimitNote: { text: '{limit} of line one, either way', claim: 'TEAM-14' },
  ledgerPaid: { text: 'Medicare would pay the hospital', claim: null },
  ledgerOwed: { text: 'The hospital would repay Medicare', claim: null },
  ledgerFoot: { text: 'A worked example with round numbers, not a hospital. Standardized dollars.', claim: null },

  // Figure 3, the worked example at any spending level (web/charts/payoff.js).
  payoffTakeaway: {
    text: 'The same worked example at any spending level: what the hospital would be paid or owe, flat where its track\'s limit holds it.',
    claim: 'TEAM-14',
  },
  payoffUnder: { text: '← spending under target', claim: null },
  payoffOver: { text: 'over target →', claim: null },
  payoffOn: { text: 'on target', claim: null },
  payoffStopGain: { text: 'stop-gain {pct} · {amount}', claim: 'TEAM-14' },
  payoffStopLoss: { text: 'stop-loss {pct} · {amount}', claim: 'TEAM-14' },
  payoffBand: { text: '{band} band', claim: null },
  payoffTip: { text: '{s}: {amount}', claim: null },
  payoffNote: { text: "The ring is the worked example. Shaded: spending within {band} of target either way, the calculator's scenario band. Standardized dollars.", claim: null },
  payoffSource: { text: "{cite}; this site's arithmetic.", claim: null },
  payoffAlt: { text: "Line chart: the worked example's result at each spending level from {lo} under target to {hi} over, flat at the stop-gain and the stop-loss.", claim: null },
  payoffColSpend: { text: 'Spending against target', claim: null },
  payoffColResult: { text: 'Medicare would pay (+) or the hospital would repay (−), standardized dollars', claim: null },

  // Part 4, the bar to beat (its figure: the price by region).
  barHeading: { text: "What {year}'s episodes are priced at, region by region", claim: null },
  barPrices: {
    text: "CMS publishes a preliminary target price for each kind of episode in each region of the country. A hospital's own prices, adjusted for its patients, go to that hospital alone, before the year.",
    claim: ['TEAM-53', 'TEAM-52'],
  },

  // Part 5, your hospital (the calculator).
  yoursHeading: { text: 'Start from public numbers, then put in your own', claim: null },
  yoursIntro: {
    text: "Every TEAM hospital starts with its Medicare discharges for the {n} kinds of surgery and its region's prices. Replace any number with the one in your CMS reports and the result follows.",
    claim: null,
  },
  calcNoScript: { text: 'The calculator runs in your browser and needs JavaScript. Nothing you type is sent anywhere.', claim: null },

  // Part 6, what a hospital has to do: the checklist by phase, beside Figure 5, TEAM's clock.
  doHeading: { text: 'Before, during and after the year', claim: null },
  doIntro: { text: 'What the rules ask of a hospital in TEAM, by when in the year it falls. Each item names its rule.', claim: null },
  phaseBefore: { text: 'Before the year', claim: null },
  phaseDuring: { text: 'During the year', claim: null },
  phaseAfter: { text: 'After the year', claim: null },
  doTrackTitle: { text: 'Ask for Track {ta} or {tb}, if it qualifies', claim: 'TEAM-41' },
  doTrackText: { text: 'Before each year, by the date CMS sets and sends to participants. A hospital that doesn\'t ask, or doesn\'t qualify, is in Track {tc}.', claim: ['TEAM-41', 'TEAM-42', 'TEAM-24'] },
  doDataTitle: { text: 'Request the data and sign the data sharing agreement, every year', claim: 'TEAM-43' },
  doDataText: { text: "Without them CMS shares no claims data on the hospital's patients. For {year}, both were due {date}.", claim: ['TEAM-43', 'TEAM-44'] },
  doAapmTitle: { text: 'If it wants the Advanced APM option, attest to certified EHR use', claim: 'TEAM-45' },
  doAapmText: { text: 'Track {tb} or {tc} only, before each year.', claim: 'TEAM-45' },
  doNoticeTitle: { text: 'Give every TEAM patient the written notice before discharge', claim: 'TEAM-32' },
  doNoticeText: { text: "It explains TEAM and says Medicare's protections continue. Be ready to give CMS a list of who got it, and when.", claim: ['TEAM-32', 'TEAM-34'] },
  doCostTitle: { text: "Put any cost Medicare won't cover in writing first", claim: 'TEAM-36' },
  doCostText: {
    text: 'For any such service offered as an option in discharge planning, a nursing facility stay outside the waiver included. Without that notice, the hospital pays for the stay.',
    claim: ['TEAM-36', 'TEAM-37'],
  },
  doListTitle: { text: 'Give the full post-acute list, partners marked', claim: 'TEAM-35' },
  doListText: {
    text: "Every home health agency and nursing, rehab and long-term care hospital serving the patient's area, with those the hospital has sharing arrangements with marked. Never restrict the patient's choice.",
    claim: ['TEAM-35', 'TEAM-33'],
  },
  doReferTitle: { text: "Refer to the patient's primary care at discharge", claim: 'TEAM-39' },
  doReferText: { text: 'To the one recorded at admission, or to one if none is.', claim: 'TEAM-39' },
  doArrangeTitle: { text: 'File the financial arrangements and clinician engagement lists each quarter', claim: 'TEAM-40' },
  doArrangeText: { text: "Or attest that there's nothing to report.", claim: 'TEAM-40' },
  doSnfTitle: { text: 'Use the {rule} waiver on its terms', claim: 'TEAM-38' },
  doSnfText: { text: "Only for stays within {days} days, at a nursing facility on CMS's qualified list for that quarter.", claim: 'TEAM-38' },
  doQualityTitle: { text: 'No separate TEAM quality report', claim: 'TEAM-46' },
  doQualityText: { text: 'The quality score comes from data hospitals already submit to CMS for other programs.', claim: 'TEAM-46' },
  doReconTitle: { text: 'Reconciliation, {months} months after the year', claim: 'TEAM-29' },
  doReconText: { text: 'Spending against target, the quality score, the track\'s limits: for {year}, from about {month}.', claim: ['TEAM-29', 'TEAM-54'] },
  doErrorTitle: { text: '{days} days to flag a calculation error', claim: 'TEAM-30' },
  doErrorText: { text: 'Without a notice of error, the report is final {days} days after CMS issues it.', claim: 'TEAM-30' },
  doPayTitle: { text: 'Paid in one sum, or repay', claim: 'TEAM-28' },
  doPayText: { text: 'CMS pays a reconciliation payment in one lump sum. A Track {ta} hospital never owes.', claim: 'TEAM-28' },
  doRecordsTitle: { text: 'Keep records {years} years', claim: 'TEAM-31' },
  doRecordsText: { text: 'From the last payment determination or the end of any audit, whichever is later.', claim: 'TEAM-31' },

  // Figure 5, TEAM's clock.
  clockTakeaway: { text: "TEAM's clock: what falls when, {from} to {to}.", claim: 'TEAM-20' },
  clockStart: { text: 'The model starts; Track {ta} for any hospital that didn\'t choose', claim: ['TEAM-07', 'TEAM-27'] },
  clockData: { text: 'Data request and agreement for {year} due', claim: 'TEAM-44' },
  clockPrices: { text: "{year}'s regional target prices posted", claim: 'TEAM-53' },
  clockTrack3: { text: 'Track {tc} unless approved for another, limits of {limit} either way', claim: ['TEAM-24', 'TEAM-14'] },
  clockRecon: { text: 'Reconciliation of {year} starts, {months} months after the year', claim: 'TEAM-29' },
  clockCjrx: { text: 'CJR-X starts nationwide', claim: 'TEAM-12' },
  clockEnd: { text: 'The model ends', claim: 'TEAM-20' },
  clockSource: { text: "{cite}; CMS's TEAM FAQ and CJR-X page; the regional prices' date is CMS's file's.", claim: null },
  clockColWhen: { text: 'When', claim: null },
  clockColWhat: { text: 'What', claim: null },

  // Part 7, where the numbers are and who opens them.
  findHeading: { text: 'The reports CMS sends, and who opens them', claim: null },
  findRoles: {
    text: 'Only named people can open them. In the TEAM Portal, each hospital names up to {primary} primary points of contact, who manage its contacts; an authorized signatory, the only one who can submit the data request, the data sharing agreement and the track form; and up to {custodians} data custodians, the only people who can open the platform where CMS puts the files.',
    claim: ['TEAM-49', 'TEAM-47', 'TEAM-48'],
  },
  findWhere: {
    text: 'At most hospitals these people sit in value-based care or population health, finance or decision support, and quality. That is our observation, not a CMS rule.',
    claim: null,
  },
  findCaption: { text: 'Where CMS puts the numbers the calculator asks for', claim: null },
  findColInput: { text: 'Calculator input', claim: null },
  findColWhere: { text: 'Where CMS puts it', claim: null },
  findColWhen: { text: 'How often', claim: null },
  findPrices: { text: 'Your target prices', claim: null },
  findPricesWhere: { text: 'Preliminary target price reports, in the Custom Export Tool', claim: ['TEAM-52', 'TEAM-50'] },
  findPricesWhen: { text: 'Each year, before the year', claim: 'TEAM-52' },
  findBase: { text: 'Your baseline episodes and spending', claim: null },
  findBaseWhere: { text: 'Baseline data, in the Custom Export Tool', claim: ['TEAM-56', 'TEAM-50'] },
  findBaseWhen: { text: 'Each year, at least a month before the year', claim: 'TEAM-56' },
  findSpend: { text: 'Your spending so far', claim: null },
  findSpendWhere: { text: "Monthly performance-year data, and the quarter's dashboard", claim: ['TEAM-51', 'TEAM-50'] },
  findSpendWhen: { text: 'Monthly; the dashboard each quarter', claim: 'TEAM-51' },
  findTarget: { text: 'Your target as the year goes', claim: null },
  findTargetWhere: { text: 'Interim reconciliation target price reports, in the Custom Export Tool', claim: ['TEAM-51', 'TEAM-50'] },
  findTargetWhen: { text: 'Each quarter', claim: 'TEAM-51' },
  findQuality: { text: 'Your quality scores', claim: null },
  findQualityWhere: { text: "Care Compare, where this site gets the readmission and surgical-death measures; the hospital's own reports for the rest", claim: null },
  findQualityWhen: { text: 'As CMS refreshes each measure', claim: null },
  findSource: { text: '{cite}.', claim: null },

  // After Part 7: CJR-X, and the close (Methods, the as-of line).
  cjrx: {
    text: "Next, from {date}: CJR-X, Medicare's nationwide joint-replacement model, makes hip, knee and ankle replacements a {days}-day episode for hospitals paid under both of Medicare's hospital payment systems that aren't in TEAM or in Maryland. CMS's list names {n}. The lookup above shows them.",
    claim: ['TEAM-12', 'TEAM-55', 'TEAM-13'],
  },
  methodsLine: { text: 'How this page is built, and every source:', claim: null },
  methodsLink: { text: 'Methods', claim: null },
  asofHeading: { text: 'Data as of', claim: null },
  asofList: { text: "CMS's TEAM list", claim: null },
  asofPrices: { text: 'Regional target prices', claim: null },
  asofCjrx: { text: "CMS's CJR-X list", claim: null },
  asofEpisodes: { text: 'Medicare discharges', claim: null },
  asofEpisodesValue: { text: '{from} and {to}', claim: null },
  asofQuality: { text: 'Quality measures', claim: null },

  // The Methods page (pages/methods.js).
  methodsTitle: { text: 'TEAM: methods and sources', claim: null },
  methodsDescription: { text: 'How the TEAM page is built: its sources, their dates, and the rules it quotes.', claim: null },
  methodsIntro: {
    text: 'Every number on the TEAM page comes from a public CMS file, pinned and checked by its hash, or from the rules in {cite}. Each sentence that states a rule names its section, and the claims register in the repository quotes each one.',
    claim: null,
  },
  methodsSources: { text: 'Sources', claim: null },
  methodsMap: {
    text: "The map's hollow dots are the open acute hospitals on Medicare's hospital list that its inpatient system pays, outside Maryland, that aren't in TEAM for {year}.",
    claim: 'TEAM-03',
  },
  methodsExample: {
    text: "Part three's worked example uses round numbers, not a hospital: a target amount of {target}, spending {spend} under it, a composite quality score of {cqs} and Track {track}. This site's code computes every line with the same arithmetic the calculator uses.",
    claim: null,
  },
  methodsRepo: { text: 'The code, the pinned files and the claims register:', claim: null },
};

export const { fill, fillKeep, t } = copyOf(COPY, LOOKUP);
