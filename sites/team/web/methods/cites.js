// The citation set after a Methods sentence, by what it cites (constants.js CITES holds the program page's): each is
// the source of the row the sentence's claim id names in sites/team/CLAIMS.md. A citation is a reference, not a number,
// so it lives here, outside the copy (which holds no digit); here rather than in constants.js so the program page's
// script, which reads that file, never carries them.
const CFR = '42 CFR';
const FAQ = 'CMS TEAM FAQ, question';
export const METHODS_CITES = Object.freeze({
  mup: "CMS, Medicare Inpatient Hospitals methodology",
  outpatient: `${CFR} 512.525(d)`,
  lowVolume: `${CFR} 512.550(c)(9)`,
  lowVolumeFaq: `${FAQ} 38`,
  prices: 'CMS, TEAM PY2 preliminary target prices',
  risk: `${CFR} 512.545(a)`,
  cohort: `${CFR} 512.547(b)(1)`,
  periods: `${CFR} 512.547(a)(2); 91 FR 50096`,
  missing: `${CFR} 512.547(b)(1)(i)(D)`,
  weights: `${CFR} 512.547(a)(2), (b)(2)`,
  cqs: 'CMS, TEAM Quality Scoring fact sheet; 42 CFR 512.547(b)',
  cqsAdjust: `CMS, TEAM Quality Scoring fact sheet; ${CFR} 512.550(d)`,
  track2: `${CFR} 512.550(e)`,
  cjrRural: `${CFR} 510.305(e)(1)(v)(C), (m)(1)(vii)(C)`,
  categories: `${CFR} 512.525(d)`,
  standardized: `${CFR} 512.505; CMS, TEAM PY2 preliminary target prices`,
  moves: `${CFR} 512.545(a), (e)(1)(iii), (f)(2)`,
  post: `${CFR} 512.550(e), (f)`,
  outlier: `${CFR} 512.505; 512.550(c)(4)`,
  track: `${FAQ}s 16 and 55`,
  report: `${CFR} 512.560(a); ${FAQ} 37`,
  fallsAssume: `${CFR} 512.547(b)(1)(i)(D); ${FAQ} 73`,
  falls: `${FAQ} 73`,
  fallsCfr: `${CFR} 512.547(a)(2)(ii)–(iii)`,
  fallsCms: `91 FR 50096; ${FAQ} 71`,
  lowWhere: `${CFR} 512.562(b)(6); ${FAQ} 38`,
  mdh: `${CFR} 512.520(b)(4)`,
  areas: `${CFR} 512.505; 512.515`,
  newHospital: `${CFR} 512.508`,
});

// The hash's name, which has a digit, so copy writes {hash}.
export const HASH_NAME = 'SHA-256';
