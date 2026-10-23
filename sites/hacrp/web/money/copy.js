// The dollars' words on the hospital page (money-figures.js, pages/hospital.js): the verdict's estimate, the record
// card's field, the statement of the payment, the share control and the page's description. Built into the pages and
// never shipped to a browser (the what-if's dollar words are in copy.js, which the browser loads). Same rules as copy.js:
// no digit characters, every number through a {placeholder}; `claim` names a row of sites/hacrp/CLAIMS.md, or a list
// of rows (null for this site's own framing or arithmetic). Dollars are always this site's estimate, never CMS's.
// fill, fillKeep and t read here, then copy.js.
import { copyOf } from '../../../../web/render/components.js';
import { COPY as SHARED } from '../copy.js';

export const COPY = {
  // ---------- the verdict ----------
  // The verdict's figure for a hospital CMS cut: the dollars, then what they are.
  moneyCutWhat: { text: 'cut from its FY{fy} Medicare inpatient payments, this site estimates', claim: 'HACRP-24' },
  moneyOfWhole: { text: 'That is {pct} of about {after}, everything traditional Medicare pays it for inpatient stays in a year: about {perStay} per Medicare stay.', claim: ['HACRP-01', 'HACRP-75'] },
  // Not cut: nothing from this program, and, quieter, what a cut would have taken.
  moneyZeroWhat: { text: 'from this program', claim: null },
  moneyWouldHave: { text: 'A cut would have taken about {amount}', claim: 'HACRP-01' },
  moneyWouldOf: { text: '{pct} of about {after}, everything traditional Medicare pays it for inpatient stays in a year.', claim: ['HACRP-01', 'HACRP-75'] },
  moneyCliffNo: { text: 'Its score was {distance} under {lowestYes}, the lowest score CMS cut.', claim: null },
  moneyMaryland: { text: "Maryland's hospitals are exempt from this program's cut.", claim: 'HACRP-26' },
  moneyNone: { text: 'No dollar estimate', claim: null },
  moneyNoInputs: { text: "CMS's FY{fy} impact file, which this site's estimate is built from, has no usable row for this hospital.", claim: null },
  moneyParhm: { text: "This site makes no estimate for hospitals in Pennsylvania's Rural Health Model.", claim: null },
  // Until the back-test's ranges arrive, the range's place on every dollar figure (a page in review only: a production
  // build refuses it).
  rangePending: { text: 'Likely range: pending', claim: null },

  // ---------- the cliff: the cut at any score, for this hospital ----------
  cliffHeading: { text: 'The money is a cliff', claim: null },
  cliffIntro: {
    text: "This program's cut doesn't grow with the score. Over CMS's line, a hospital loses {pct} of everything traditional Medicare pays it for inpatient stays that year; at or under the line, it loses nothing from this program.",
    claim: ['HACRP-01', 'HACRP-75'],
  },
  cliffHow: {
    text: "The chart draws what the cut would be for this hospital at any Total HAC Score, from this site's estimate of its payments, with its own score marked.",
    claim: null,
  },
  // The two levels' words, after their dollars.
  cliffZero: { text: 'at any score up to {highestNo}', claim: 'HACRP-01' },
  cliffCut: { text: 'at any score from {lowestYes}', claim: 'HACRP-01' },
  cliffHighest: { text: "CMS's highest score", claim: null },
  cliffTakeawayYes: {
    text: "The cut is a cliff, not a slope: this hospital's score, {distance} over the highest score CMS didn't cut, costs it about {amount}, and at CMS's highest score, {highest}, the cut would be the same.",
    claim: 'HACRP-01',
  },
  cliffTakeawayNo: {
    text: "The cut is a cliff, not a slope: this hospital's score, {distance} under the lowest score CMS cut, costs it nothing; {distance} higher, the cut would have been about {amount}, the same as at CMS's highest score, {highest}.",
    claim: 'HACRP-01',
  },
  cliffAlt: { text: "Step chart of this hospital's estimated HAC cut at any Total HAC Score: flat at {zero} up to CMS's line, then a drop to {amount}, flat out to the highest score.", claim: null },
  cliffStrip: { text: "Under the axis, every Total HAC Score CMS published: {n} of the {all} scored within {near} of CMS's line, on one side or the other.", claim: null },
  cliffColPoint: { text: 'Score', claim: null },
  cliffColScore: { text: 'Total HAC Score', claim: null },
  cliffColCut: { text: 'Estimated HAC cut (whole dollars)', claim: null },
  cliffRowUnder: { text: 'Any score up to {highestNo}', claim: null },
  cliffRowOver: { text: 'Any score from {lowestYes}', claim: null },

  // ---------- the record card ----------
  fieldMoney: { text: 'Estimated cut', claim: null },
  fieldMoneyStay: { text: 'About {perStay} per Medicare stay', claim: null },
  fieldMoneyWould: { text: 'A cut would have been {amount}', claim: 'HACRP-01' },
  fieldMoneyExempt: { text: 'Maryland: exempt', claim: 'HACRP-26' },
  fieldMoneyNoRow: { text: 'No usable impact-file row', claim: null },

  // ---------- the statement: the payment, line by line ----------
  stmtHeading: { text: 'The money, line by line', claim: null },
  stmtIntro: {
    text: "This site estimates what traditional Medicare pays the hospital for a year of inpatient stays, from CMS's FY{fy} payment files, then applies Medicare's three hospital quality programs in the order the law sets.",
    claim: 'HACRP-74',
  },
  stmtOrder: {
    text: 'The readmissions and value-based programs adjust only the base payment, the DRG rates times the hospital\'s cases. The HAC cut comes last and takes {pct} of everything left, teaching, low-income-patient, outlier, capital and uncompensated care payments included.',
    claim: ['HACRP-72', 'HACRP-73', 'HACRP-74', 'HACRP-75'],
  },
  stmtTitle: { text: 'Estimated Medicare inpatient payments · FY{fy}', claim: null },
  stmtGroupPay: { text: 'What traditional Medicare pays it for inpatient stays', claim: null },
  stmtGroupPrograms: { text: 'The three programs, in the order the law applies them', claim: 'HACRP-74' },
  stmt_fed: { text: 'DRG payments at the federal rates', claim: null },
  stmt_mdhAddon: { text: 'Medicare-dependent hospital add-on', claim: null },
  stmt_ime: { text: 'Teaching (indirect medical education)', claim: null },
  stmt_dsh: { text: 'Many low-income patients (disproportionate share)', claim: null },
  stmt_outlierOp: { text: 'Outliers: unusually costly stays', claim: null },
  stmt_schDiff: { text: 'Sole community hospital rate difference', claim: null },
  stmt_lowVolume: { text: 'Low-volume adjustment', claim: null },
  stmt_capital: { text: 'Capital: buildings and equipment', claim: null },
  stmt_uc: { text: 'Uncompensated care', claim: null },
  // The same parts mid-sentence, where the statement names those not paid to the hospital.
  stmtOff_fed: { text: 'DRG payments', claim: null },
  stmtOff_mdhAddon: { text: 'a Medicare-dependent hospital add-on', claim: null },
  stmtOff_ime: { text: 'teaching payments', claim: null },
  stmtOff_dsh: { text: 'low-income-patient payments', claim: null },
  stmtOff_outlierOp: { text: 'outlier payments', claim: null },
  stmtOff_schDiff: { text: 'a sole community hospital rate difference', claim: null },
  stmtOff_lowVolume: { text: 'a low-volume adjustment', claim: null },
  stmtOff_capital: { text: 'capital payments', claim: null },
  stmtOff_uc: { text: 'uncompensated care payments', claim: null },
  stmtBaseNote: { text: 'the base', claim: null },
  stmtBase: { text: 'Base payment', claim: null },
  stmtTotal: { text: 'Total, before the three programs', claim: null },
  stmtHrrp: { text: 'Readmissions (HRRP)', claim: null },
  stmtHvbp: { text: 'Value-based purchasing (HVBP)', claim: null },
  stmtFactor: { text: 'base × ({factor} − {one})', claim: ['HACRP-72', 'HACRP-73'] },
  stmtHrrpUnlisted: { text: "not in CMS's readmissions file: no adjustment", claim: null },
  stmtHvbpUnlisted: { text: "not in CMS's value-based factors: no adjustment", claim: null },
  stmtAfter: { text: 'After these two', claim: null },
  stmtHac: { text: 'HAC Reduction Program', claim: null },
  stmtHacAll: { text: '{pct} of everything above', claim: ['HACRP-01', 'HACRP-75'] },
  stmtHacNone: { text: 'no cut; {pct} would have been {amount}', claim: 'HACRP-01' },
  stmtNet: { text: 'Net of the three programs', claim: null },
  stmtNone: { text: 'Not paid to this hospital: {list}.', claim: null },
  stmtWhole: { text: 'Whole dollars, so every line adds up; the estimate is not that precise.', claim: null },
  stmtKeyPart: { text: 'Part of the payment', claim: null },
  stmtKeyScope: { text: 'What a program applies to', claim: null },
  stmtKeyCut: { text: 'The adjustment', claim: null },
  stmtTakeawayYes: {
    text: "This site estimates the HAC cut at {amount}: {pct} of the hospital's whole inpatient payment, taken last. The readmissions and value-based adjustments, on the base alone, came to {hrrp} and {hvbp}.",
    claim: ['HACRP-01', 'HACRP-72', 'HACRP-73', 'HACRP-74', 'HACRP-75'],
  },
  stmtTakeawayNo: {
    text: "No HAC cut this year; {pct} of the hospital's whole inpatient payment would have been about {amount}. The readmissions and value-based adjustments, on the base alone, came to {hrrp} and {hvbp}.",
    claim: ['HACRP-01', 'HACRP-72', 'HACRP-73', 'HACRP-75'],
  },
  stmtSource: {
    text: "Source: this site's arithmetic on CMS's FY{fy} IPPS final rule files (the impact file, the rate tables and the value-based factors), its FY{fy} HRRP supplemental file and HACRP FY{fy} ({id}), released {date}.",
    claim: null,
  },
  // The cut's worksheet, in the hospital's own numbers.
  wsMoneyLabel: { text: 'The HAC cut in this hospital\'s numbers', claim: null },
  wsPayment: { text: 'payment', claim: null },
  wsHrrp: { text: 'readmissions', claim: null },
  wsHvbp: { text: 'value-based', claim: null },
  wsPct: { text: 'the cut', claim: null },
  wsCut: { text: 'HAC cut', claim: null },
  wsStake: { text: 'at stake', claim: null },
  wsStays: { text: 'Medicare stays', claim: null },
  wsPerStay: { text: 'per stay', claim: null },
  stmtColLine: { text: 'Line', claim: null },
  stmtColAmount: { text: 'Amount (whole dollars)', claim: null },

  // ---------- sharing ----------
  shareHeading: { text: 'Share this hospital', claim: null },
  shareCopyLink: { text: 'Copy link', claim: null },
  shareCopyText: { text: 'Copy a sentence with the link', claim: null },
  shareNative: { text: 'Share…', claim: null },
  shareCopied: { text: 'Copied.', claim: null },
  shareFailed: { text: 'Could not copy. The text is selected; copy it with your keyboard.', claim: null },
  shareNote: { text: 'No tracking: the buttons copy text to your clipboard, or hand it to your device to share.', claim: null },
  // The sentence a link carries (and the page's description): one per verdict, the source of any dollars named.
  shareYes: {
    text: "In FY{fy}, Medicare cut {name}'s inpatient payments {pct} under the HAC Reduction Program: about {amount}, by {site}'s estimate. Its Total HAC Score was {distance} over the highest score CMS didn't cut.",
    claim: ['HACRP-01', 'HACRP-24'],
  },
  shareYesNoScore: {
    text: "In FY{fy}, Medicare cut {name}'s inpatient payments {pct} under the HAC Reduction Program: about {amount}, by {site}'s estimate.",
    claim: ['HACRP-01', 'HACRP-24'],
  },
  shareYesNoEstimate: { text: "In FY{fy}, Medicare cut {name}'s inpatient payments {pct} under the HAC Reduction Program.", claim: ['HACRP-01', 'HACRP-24'] },
  shareNo: {
    text: "In FY{fy}, Medicare's HAC Reduction Program did not cut {name}'s payments: its Total HAC Score was {distance} under the lowest score CMS cut. A cut would have been about {amount}, by {site}'s estimate.",
    claim: 'HACRP-01',
  },
  shareNoPlain: { text: "In FY{fy}, Medicare's HAC Reduction Program did not cut {name}'s payments.", claim: 'HACRP-01' },
  shareMaryland: { text: "{name} is in Maryland, whose hospitals are exempt from the cuts of Medicare's HAC Reduction Program.", claim: 'HACRP-26' },

  // ---------- the program page: the summary form's estimate ----------
  summaryMoney: { text: 'Estimated dollars', claim: null },
  summaryMoneyNote: { text: "This site's estimate of the cut, for {cut} of the {yes} hospitals CMS cut", claim: null },

  // ---------- the program page's Part: the money ----------
  moneyPartHeading: { text: 'The money', claim: null },
  moneyPartIntro: {
    text: "This site estimates the FY{fy} cut at about {money}, from {cut} of the {yes} hospitals CMS cut; CMS's impact file, which the estimate is built from, has no usable row for the other {missing}. The cut is {pct} of everything traditional Medicare pays a hospital for inpatient stays, so it lands hardest where those payments are largest.",
    claim: ['HACRP-01', 'HACRP-75'],
  },
  // The bill.
  billHeading: { text: 'Who carries the cut', claim: null },
  billText: { text: "Every hospital CMS cut is a tile, its area this site's estimate of its cut, grouped by teaching status. Point at or tap a tile for the hospital.", claim: null },
  billText2: { text: 'A few large hospitals carry much of the money: the cut is a share of a payment, and their payments are large.', claim: 'HACRP-01' },
  billTakeaway: { text: "The largest tenth of the cuts, {hospitals}, are {share} of the {money} this site estimates the program took.", claim: null },
  billGroupSub: { text: '{n} · {money}', claim: null },
  billTip: { text: '{name}, {city}, {state}: {money}', claim: null },
  billAlt: { text: "Treemap of every hospital CMS cut, each tile's area this site's estimate of its cut, grouped by teaching status.", claim: null },
  billNote: { text: "Teaching status from CMS's impact file.", claim: null },
  billNoteUnknown: { text: "Teaching status from CMS's impact file; the hospital master has none for {n} of the cut hospitals ({money}), the group too small to label.", claim: null },
  billNoteUnknownOne: { text: "Teaching status from CMS's impact file; the hospital master has none for one of the cut hospitals ({money}), the group too small to label.", claim: null },
  billUnknown: { text: 'Teaching status unknown', claim: null },
  groupColGroup: { text: 'Group', claim: null },
  groupColHospitals: { text: 'Hospitals cut', claim: null },
  groupColMoney: { text: 'Estimated cut (whole dollars)', claim: null },
  groupColShareHospitals: { text: 'Share of the hospitals', claim: null },
  groupColShareMoney: { text: 'Share of the money', claim: null },
  // Across the line.
  acrossHeading: { text: 'Across the line', claim: null },
  acrossText: { text: "Every hospital that scored within {window} of CMS's line, each dot as large as the cut it took, or would have taken, by this site's estimate. Point at or tap a dot for the hospital.", claim: null },
  acrossText2: { text: 'A hair apart in score, the two sides are all or nothing in money.', claim: 'HACRP-01' },
  acrossTakeaway: { text: "Within {window} of CMS's line, CMS cut {over}, about {overMoney} by this site's estimate; the {under} just under it kept about {underMoney}.", claim: null },
  acrossUnder1: { text: '{n} not cut', claim: null },
  acrossUnder2: { text: '{money} at stake', claim: null },
  acrossOver1: { text: '{n} cut', claim: null },
  acrossOver2: { text: '{money} cut', claim: null },
  acrossLine: { text: "CMS's line", claim: null },
  acrossAxis: { text: 'Total HAC Score', claim: null },
  acrossTip: { text: '{name}, {city}, {state}: score {score}; {what} {money}', claim: null },
  acrossTipCut: { text: 'cut', claim: null },
  acrossTipNot: { text: 'a cut would have been', claim: null },
  acrossAlt: { text: "Dots for the hospitals nearest CMS's line on its score axis, each sized by its estimated cut, filled where CMS cut it.", claim: null },
  acrossColSide: { text: 'Side of the line', claim: null },
  acrossColHospitals: { text: 'Hospitals', claim: null },
  acrossColMoney: { text: 'Estimated cut, taken or not (whole dollars)', claim: null },
  acrossSideUnder: { text: 'Under the line: not cut', claim: null },
  acrossSideOver: { text: 'Over the line: cut', claim: null },
  // Shares.
  sharesHeading: { text: 'The same hospitals, a different share of the money', claim: null },
  sharesText: { text: "For each kind of hospital: its share of the hospitals CMS cut, and its share of the dollars this site estimates they lost.", claim: null },
  sharesTakeaway: { text: '{group} are {shareHospitals} of the hospitals CMS cut and {shareMoney} of the money.', claim: null },
  // A group as the takeaway names it, by kind.
  sharesNoun_teach: { text: '{group} hospitals', claim: null },
  sharesNoun_beds: { text: 'Hospitals of {group}', claim: null },
  sharesNoun_own: { text: '{group} hospitals', claim: null },
  sharesNoun_urban: { text: '{group} hospitals', claim: null },
  sharesKeyHospitals: { text: 'Share of the hospitals cut', claim: null },
  sharesKeyMoney: { text: 'Share of the money', claim: null },
  sharesTipHospitals: { text: '{group}: {n} of the cut hospitals ({share})', claim: null },
  sharesTipMoney: { text: '{group}: {money} of the money ({share})', claim: null },
  sharesAlt: { text: 'Paired bars for each kind of hospital: its share of the hospitals CMS cut and its share of the estimated dollars.', claim: null },
  // By state.
  statesHeading: { text: 'Where the money comes from', claim: null },
  statesText: { text: "Each state's circle is as large as this site's estimate of its hospitals' cuts. Switch to the cut per Medicare stay to compare states of different sizes: the dollars over every Medicare stay at the state's hospitals with a decision.", claim: null },
  statesTakeaway: { text: "By state, this site's estimate of the cut ran from {low} to {high}; per Medicare stay, from {lowStay} to {highStay}.", claim: null },
  statesTotal: { text: 'Dollars', claim: null },
  statesPerStay: { text: 'Per Medicare stay', claim: null },
  statesToggle: { text: 'Show the money as', claim: null },
  statesTipTotal: { text: '{money} from {hospitals}', claim: null },
  statesTipStay: { text: '{perStay} per Medicare stay', claim: null },
  statesNone: { text: 'States whose hospitals CMS didn\'t cut, and Maryland, have no circle.', claim: 'HACRP-26' },
  // A place with money the map has no place for (Puerto Rico's): the table lists it, the drawing can't.
  statesOffMap: { text: 'The map has no place for {places}, which the table lists.', claim: null },
  statesAlt: { text: "Map of the states with a circle on each, its area this site's estimate of the state's cut, or of its cut per Medicare stay.", claim: null },
  statesColState: { text: 'State', claim: null },
  statesColCut: { text: 'Hospitals cut', claim: null },
  statesColMoney: { text: 'Estimated cut (whole dollars)', claim: null },
  statesColStays: { text: 'Medicare stays', claim: null },
  statesColPerStay: { text: 'Per stay', claim: null },
  // Three programs.
  threeHeading: { text: 'Three programs, three shapes', claim: null },
  threeText: { text: "Medicare's three hospital quality programs move money in three ways. The readmissions program cuts each hospital by its own factor; the value-based program pays some hospitals a bonus and cuts others; this program is a cliff.", claim: ['HACRP-01', 'HACRP-72', 'HACRP-73'] },
  threeTakeaway: { text: "Readmissions cuts spread from {hrrpLow} to {hrrpHigh} of the base payment and total about {hrrp}; value-based adjustments run from {vbpLow} to {vbpHigh} and net {hvbp}; the HAC cut is {zero} or {pct}, about {hac} in all.", claim: null },
  threeHrrp: { text: 'Readmissions', claim: null },
  threeHvbp: { text: 'Value-based purchasing', claim: null },
  threeHac: { text: 'HAC Reduction Program', claim: null },
  threeHrrpShape: { text: 'a sliding scale', claim: null },
  threeHvbpShape: { text: 'a seesaw', claim: null },
  threeHacShape: { text: 'a cliff', claim: 'HACRP-01' },
  threeHrrpAxis: { text: 'Cut, share of the base payment', claim: null },
  threeHvbpAxis: { text: 'Adjustment, share of the base payment', claim: null },
  threeHacAxis: { text: 'Cut, share of the whole payment', claim: null },
  threeHvbpSplit: { text: '{bonus} paid in bonuses, {penalty} taken in cuts', claim: null },
  threeTip: { text: '{hospitals} at {range}', claim: null },
  threeAlt: { text: 'Three column charts: how many hospitals each program moves by how much.', claim: null },
  threeNote: { text: 'Hospitals each file lists; the readmissions and value-based adjustments are shares of the base payment, the HAC cut of the whole payment.', claim: ['HACRP-72', 'HACRP-73', 'HACRP-75'] },
  threeColProgram: { text: 'Program', claim: null },
  threeColHospitals: { text: 'Hospitals adjusted', claim: null },
  threeColMoney: { text: 'Net estimated dollars (whole dollars)', claim: null },
  // A place page.
  placeMoney: { text: 'Estimated dollars', claim: null },
  placeMoneyNote: { text: "{share} of the nation's {money}, this site's estimate", claim: null },
  placePerStay: { text: 'Per Medicare stay', claim: null },
  placePerStayNote: { text: 'The nation: {nation}', claim: null },
  placeAcrossHeading: { text: '{name} across the line', claim: null },
  placeAcrossText: { text: "The nation's hospitals within {window} of CMS's line, {name}'s in full ink: scores a hair apart, money all or nothing.", claim: 'HACRP-01' },
  // A place with hospitals on both sides of the line near it (so at least two).
  placeAcrossTakeaway: {
    text: "{k} of the nation's {n} hospitals within {window} of CMS's line are {name}'s: {over} cut, about {overMoney} by this site's estimate, and {under} not cut, where a cut would have been about {underMoney}.",
    claim: null,
  },
  // A place whose hospitals near the line are all on one side says only that side ({over}, {under}: counted hospitals,
  // singular for one).
  placeAcrossTakeawayOver: {
    text: "Of the nation's {n} hospitals within {window} of CMS's line, {name} has {over}, about {overMoney} by this site's estimate.",
    claim: null,
  },
  placeAcrossTakeawayUnder: {
    text: "Of the nation's {n} hospitals within {window} of CMS's line, {name} has {under}, where a cut would have been about {underMoney}.",
    claim: null,
  },
};

export const { fill, fillKeep, t } = copyOf(COPY, SHARED);
