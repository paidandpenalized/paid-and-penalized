// TEAM's method parameters: rules of CMS's (42 CFR 512 subpart E) and this site's own choices. Pure data, frozen. Each
// export names its claim id (sites/team/CLAIMS.md); sites/team/web/constants.js re-exports these for the copy gate.

// TEAM-14. Per track: the stop-gain and stop-loss limits (§ 512.550(e)), as shares of the aggregated reconciliation
// target price, and the largest quality adjustment on a gain and on a loss (§ 512.550(d)(1)), as shares of the amount.
// Track 1 has no loss side. Track 2's loss limit is 5% for performance years 2 to 5 (§ 512.550(e)(3)).
export const TRACKS = Object.freeze({
  1: Object.freeze({ gain: 0.10, loss: 0, qGain: 0.10, qLoss: 0 }),
  2: Object.freeze({ gain: 0.05, loss: 0.05, qGain: 0.10, qLoss: 0.15 }),
  3: Object.freeze({ gain: 0.20, loss: 0.20, qGain: 0.10, qLoss: 0.10 }),
});

// TEAM-15. The quality-adjustment caps alone, per track: the share of a gain and of a loss the quality score can move.
// Derived from TRACKS so the two cannot drift.
export const CQS_CAPS = Object.freeze(Object.fromEntries(
  Object.entries(TRACKS).map(([track, t]) => [track, Object.freeze({ gain: t.qGain, loss: t.qLoss })]),
));

// TEAM-07. The second performance year's first day (performance years are calendar years; the model began January 1,
// 2026), an ISO date. TEAM-24. The track CMS assigns from performance year 2 unless a participant asks for another and
// qualifies (§ 512.520(b)).
export const PY2_START = '2027-01-01';
export const DEFAULT_TRACK = 3;

// TEAM-19. The episode runs through the 30th day after the anchor discharge (or the anchor procedure), the discharge
// day counting as day 1 (§ 512.537(a)(1)).
export const EPISODE_DAYS = 30;

// TEAM-16. An episode category with fewer baseline episodes than this (over the three baseline years) has its
// performance-year spending capped at target, so it can add to a gain but not to a loss (§ 512.550(c)(9)).
export const LOW_VOLUME = 31;

// TEAM-79. CMS's Medicare Inpatient Hospitals file, which the episode counts come from, leaves out any hospital-DRG row
// built from this many discharges or fewer (CMS's methodology for the file), so the counts are a floor.
export const SUPPRESSED_MAX = 10;

// TEAM-17. The scaled score CMS gives a measure the hospital has no, or an incomplete, raw score for (§ 512.547(b)(1)(i)(D)).
export const MISSING_QUALITY = 50;

// TEAM-18. The five measures behind performance year 2's composite quality score (§ 512.547(a)(2)): the key matches the
// emitted file's quality keys; `appliesTo` is the episodes the measure's weight counts (all inpatient episodes, or the
// inpatient joint-replacement ones); `public` is whether the measure is published at hospital level, so a page can
// prefill it. Only the readmission and surgical-death measures are.
export const MEASURES = Object.freeze({
  hybrid_hwr: Object.freeze({ appliesTo: 'inpatient', public: true }),
  iscmr: Object.freeze({ appliesTo: 'inpatient', public: true }),
  falls: Object.freeze({ appliesTo: 'inpatient', public: false }),
  prf: Object.freeze({ appliesTo: 'inpatient', public: false }),
  thatka_prom: Object.freeze({ appliesTo: 'lejr', public: false }),
});

// This site's own choices, not CMS rules, so no claim id: the half-width of the range the calculator draws around its
// estimate, as a share of target price, with the least and most a reader may set. The default follows the spread of
// results hospitals had in CJR and BPCI Advanced, Medicare's earlier surgical bundles, and equals Track 2's limit; the
// TEAM Methods page (#band) explains it, with the share of CJR hospitals' yearly results inside it that the emitter
// counts (engine/py/pp_engine/team/cjr.py WIDTHS, whose first width a test holds equal to this).
export const BAND_DEFAULT = 0.05;
export const BAND_MIN = 0.01;
export const BAND_MAX = 0.20;

// This site's own choice too: "What would it take?" prices this many more composite quality score points (capped at
// 100), the step a reader can picture on the score's 0-100 scale.
export const QUALITY_STEP = 10;

// This site's own choice too: "What would it take?" searches for a spending level within this share of target either
// way (60% over to 60% under), far past where any track's limit binds on the gain side.
export const SOLVE_SPAN = 0.6;

// The five episode categories, in the emitted file's drgCategory spelling and the order the pages list them.
// (Mirrors engine/py/pp_engine/team/episodes.py CATEGORIES.)
export const CATEGORIES = Object.freeze(['LEJR', 'SHFFT', 'SPINAL', 'CABG', 'BOWEL']);
