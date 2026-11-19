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

// TEAM-16. An episode category with fewer baseline episodes than this (over the three baseline years) has its
// performance-year spending capped at target, so it can add to a gain but not to a loss (§ 512.550(c)(9)).
export const LOW_VOLUME = 31;

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
// estimate, as a share of target price, with the least and most a reader may set. Five percent is the default because
// that is about where half of CJR's full-risk-year hospitals ended (band-width evidence kept in the planning repo).
export const BAND_DEFAULT = 0.05;
export const BAND_MIN = 0.01;
export const BAND_MAX = 0.20;
