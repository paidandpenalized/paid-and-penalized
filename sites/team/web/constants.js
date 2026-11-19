// The TEAM site's fixed choices, and what the copy gate (pipeline/test/copy-gate.test.js) reads once the site is
// registered: the prefix of its claim ids (sites/team/CLAIMS.md), the method constants it checks and the claim of each
// constant named here. The method constants are the engine's (engine/js/team/params.js), re-exported so the gate sees
// them; the band's constants are this site's own choices, not rules, so they are not here. The dates below are rules of
// CMS's, dated and sourced in the register.
import { CQS_CAPS, EPISODE_DAYS, LOW_VOLUME, MEASURES, MISSING_QUALITY, TRACKS } from '../../../engine/js/team/params.js';

export { CQS_CAPS, EPISODE_DAYS, LOW_VOLUME, MEASURES, MISSING_QUALITY, TRACKS };
export const CLAIM_PREFIX = 'TEAM';
export const METHOD_CONSTANTS = Object.freeze({ TRACKS: 'object', CQS_CAPS: 'object', LOW_VOLUME: 'number', EPISODE_DAYS: 'number', MISSING_QUALITY: 'number', MEASURES: 'object' });

// The model's dates, each a rule of CMS's (its claim below). ISO dates; pages format them with web/render/format.js.
//   MODEL_START, MODEL_END  the model performance period (§ 512.505)
//   PY2_START               the second performance year's first day (performance years are calendar years)
//   TRACK1_LAST             the last day a safety-net hospital may be in Track 1: performance year 3's end (§ 512.520(b))
//   PY2_DATA_DUE            when performance year 2's data request and data sharing agreement were due (CMS's FAQ)
//   CJRX_START              the day CJR-X starts (the nationwide expansion of the joint-replacement model)
export const MODEL_START = '2026-01-01';
export const MODEL_END = '2030-12-31';
export const PY2_START = '2027-01-01';
export const TRACK1_LAST = '2028-12-31';
export const PY2_DATA_DUE = '2026-09-01';
export const CJRX_START = '2028-01-01';
// An ISO date's year ("2027"), as copy names it.
export const yearOf = (iso) => iso.slice(0, 4);

// The track CMS assigns from performance year 2 unless a participant asks for another and qualifies (§ 512.520(b)).
export const DEFAULT_TRACK = 3;

// The rules' other numbers the program page states: how many months after a performance year ends CMS reconciles it
// (§ 512.550(b)); the days a participant has to flag a calculation error, which are also the days after which an
// unflagged report is final (§ 512.560(a)); the years a participant keeps its records (§ 512.586(c)); and how long a
// CJR-X episode runs (CMS's CJR-X page).
export const RECON_MONTHS = 6;
export const ERROR_DAYS = 30;
export const RECORD_YEARS = 6;
export const CJRX_DAYS = 90;
// The TEAM Portal's roles that have a limit (CMS's FAQ): primary points of contact and data custodians per hospital.
export const PORTAL = Object.freeze({ primary: 2, custodians: 2 });

// CMS's names with a digit in them, which copy can't hold (the copy gate): the waiver of Medicare's rule that a skilled
// nursing stay follow an inpatient stay of three days (§ 512.580(b)). Copy writes {snfRule}.
export const RULE_NAMES = Object.freeze({ snfRule: 'SNF 3-day rule' });

// The citation set after a sentence (a rule's section, or the CMS document and its question), by what it cites: each is
// the row the sentence's claim id names in sites/team/CLAIMS.md. A citation is a reference, not a number, so it lives
// here, outside the copy (which holds no digit).
const CFR = '42 CFR';
export const CITES = Object.freeze({
  subpart: `${CFR} 512 subpart E`,
  track1: `${CFR} 512.520(a); 512.550(g)`,
  tracks: `${CFR} 512.520(b)`,
  limits: `${CFR} 512.550(e)`,
  limitsAll: `${CFR} 512.550(d), (e), (g)`,
  money: `${CFR} 512.525(e), 512.550`,
  standardized: `${CFR} 512.505`,
  episode: `${CFR} 512.525, 512.537`,
  choice: `${CFR} 512.582(a)(1)`,
  notice: `${CFR} 512.582(b)(1)`,
  noticeCost: `${CFR} 512.582(b)(3); 512.580(b)(5)`,
  postAcute: `${CFR} 512.582(a)(3)`,
  primaryCare: `${CFR} 512.564(a)`,
  lists: `${CFR} 512.522(b)–(d)`,
  snf: `${CFR} 512.580(b)`,
  quality: 'CMS TEAM FAQ, question 72',
  trackAsk: `${CFR} 512.520(b)(2), (5); CMS TEAM FAQ, question 16`,
  data: `${CFR} 512.562(b)(2), (e)(1); CMS TEAM FAQ, question 66`,
  aapm: `${CFR} 512.522(a)(1)`,
  recon: `${CFR} 512.550(b)`,
  error: `${CFR} 512.560(a)`,
  pay: `${CFR} 512.550(g)`,
  records: `${CFR} 512.586(c)`,
  portal: 'CMS TEAM FAQ, questions 54 and 55',
  reports: `${CFR} 512.540(b)(8), 512.562(b)(6); CMS TEAM FAQ, questions 54, 61 and 62`,
  cqs: `${CFR} 512.547(b)`,
});

// This site's own count, not a CMS rule (no claim): in CJR's full-risk performance years, about this share of hospitals
// ended a year within `within` of their target, counted from CMS's CJR final reconciliation file (performance years 1 to
// 7). The calculator's band "why?" says it; Methods (BAND_ANCHOR) gives how it was counted.
export const CJR_BAND = Object.freeze({ share: 0.5, within: 0.05 });
export const BAND_ANCHOR = 'band';

export const CLAIMS = Object.freeze({
  MODEL_START: 'TEAM-07', MODEL_END: 'TEAM-20', PY2_START: 'TEAM-07', TRACK1_LAST: 'TEAM-25', PY2_DATA_DUE: 'TEAM-44', CJRX_START: 'TEAM-12',
  RECON_MONTHS: 'TEAM-29', ERROR_DAYS: 'TEAM-30', RECORD_YEARS: 'TEAM-31', CJRX_DAYS: 'TEAM-55', PORTAL: 'TEAM-48', DEFAULT_TRACK: 'TEAM-24',
  TRACKS: 'TEAM-14', CQS_CAPS: 'TEAM-15', LOW_VOLUME: 'TEAM-16', MISSING_QUALITY: 'TEAM-17', MEASURES: 'TEAM-18', EPISODE_DAYS: 'TEAM-19',
});

// The program page's Parts, in order, by the id each section carries (the section menu links #<id>), then Methods.
export const SECTIONS = Object.freeze(['who', 'change', 'money', 'bar', 'yours', 'do', 'find']);

// Part 3's worked example: round numbers, not a hospital, so they are this site's choice and carry no claim. A year's
// target amount (standardized dollars), spending against it (−0.05: 5% under), a composite quality score and a track.
// The engine (engine/js/team/reconcile.js) computes every line of the ledger from these.
export const EXAMPLE = Object.freeze({ target: 10_000_000, spend: -0.05, cqs: 40, track: 3 });
// Part 4's map and its picker start on this episode type (an MS-DRG in the price file; 470 is the joint replacement
// without major complications). A choice of this site's, not a rule, so no claim; a test holds it to the price file.
export const BAR_DRG = '470';
// Figure 3, the worked example's payoff: spending from SPAN under target to SPAN over, its table every STEP. The
// calculator draws its hospital's payoff on the same span.
export const PAYOFF = Object.freeze({ span: 0.3, step: 0.05 });

// The calculator's own choices, not rules, so no claim: the "all five" slider's reach either side of target and its step
// (percent; a link's wider value is held to the reach), and the width its payoff is drawn at beside the worksheet (a
// viewBox near the column's own width there, so its labels print at about their size).
export const CALC = Object.freeze({ slider: 25, sliderStep: 0.5, figWide: 400 });
