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
  // The estimate tag on every dollar figure, linking to how this site makes the estimate.
  estTag: { text: 'estimate', claim: null },
  estTagLabel: { text: 'Estimate: how this site estimates the dollars', claim: null },

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
  cliffStrip: { text: 'Under the axis, every Total HAC Score CMS published: many hospitals sit within a hair of the line.', claim: null },
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
    text: "Source: CMS's FY{fy} IPPS final rule files (the impact file, the rate tables and the value-based factors), its FY{fy} HRRP supplemental file and HACRP FY{fy} ({id}); this site's arithmetic.",
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
};

export const { fill, fillKeep, t } = copyOf(COPY, SHARED);
