"""Quality percentiles: where a hospital's public measure value falls among a national cohort's.

TEAM scales each raw measure score to "the percentile to which the TEAM participant's raw quality measure score would
have belonged" in the cohort's distribution, and a score that ties others takes the higher percentile
(42 CFR 512.547(b)(1)(i)(A)). For both measures used here (hybrid hospital-wide readmission and surgical-complication
mortality) lower is better (§ 512.547(b)(1)(i)(C)). The cohort is an approximation of CMS's: every open IPPS hospital
outside Maryland, other than Indian Health Service and tribal hospitals, with a public value for the measure
(build.in_quality_cohort).
"""
from bisect import bisect_left, bisect_right
from math import floor


def percentile(value, cohort, in_cohort=True):
    """The percentile (0-100, whole) of `value` in `cohort` (sorted values; lower is better): the share of the other
    cohort hospitals with a worse (higher) value or the same value, floored. `in_cohort`: whether `value` is one of
    the cohort's own (it is then not compared with itself)."""
    self_count = 1 if in_cohort else 0
    others = len(cohort) - self_count
    if others <= 0:
        return None
    worse = len(cohort) - bisect_right(cohort, value)
    tied = bisect_right(cohort, value) - bisect_left(cohort, value) - self_count
    return floor(100 * (worse + tied) / others)


def percentiles(values, cohort=None):
    """{ccn: percentile} for every hospital in the cohort {ccn: value}; `cohort`: its sorted values, when the caller
    has them."""
    if cohort is None:
        cohort = sorted(values.values())
    return {ccn: percentile(v, cohort) for ccn, v in values.items()}
