"""The likely ranges on the dollar estimates: the statistics of the back-test (pp_pipeline.backtest_dollars), which
re-runs the estimate on an earlier year and sets each hospital's figure beside what its Medicare cost report says.

For one measure (the HAC cut, the HRRP and HVBP adjustments, the net of the three, the federal DRG payment) the
back-test gives, per hospital, the model's figure and the cost report's. Where both are nonzero and of one sign, the
error is log(model / actual). Each stratum of hospitals (by beds, and whether a sole community or Medicare-dependent
hospital) gets the 10th and 90th percentiles of its errors, p10 and p90. A hospital's range for the measure is then
estimate / exp(p90) to estimate / exp(p10): in the back-test, a hospital's actual figure lay in such a range for 8 in
10 of its stratum. The ranges are not centred on the estimate: a stratum whose median error is above zero (the model
runs high) gets a range that sits below its estimates. The point estimates themselves are not corrected.

A stratum with fewer than MIN_STRATUM hospitals for a measure borrows the percentiles of its bed band (both kinds
pooled), and a bed band with too few borrows the whole set's; every borrowing is recorded.

The national range: the sum of the cut hospitals' estimates, times the 10th and 90th percentiles of
sum(actual) / sum(model) over the back-test's cut hospitals, resampled with replacement (a bootstrap of hospitals).
It says how far one year's national sum was from the model's, not how the next year's will move.

Pure: no file, network or clock. The bootstrap's draws come from a fixed seed, so a rebuild gives the same bytes.
"""
import math
import random

# Bed bands (the impact file's `Beds`, from cost reports): [low, high] inclusive, high None for no upper bound.
BED_BANDS = (("under-100", 0, 99), ("100-299", 100, 299), ("300-plus", 300, None))
# Whether the hospital is paid, in part, on a hospital-specific rate: a sole community or Medicare-dependent hospital.
KINDS = ("sch-mdh", "other")
SCH_MDH, OTHER = KINDS


def stratum_id(band, kind):
    """'<bed band>/<kind>': the id of one stratum."""
    return f"{band}/{kind}"


STRATA = tuple(stratum_id(band, kind) for band, _, _ in BED_BANDS for kind in KINDS)
MIN_STRATUM = 30  # the fewest hospitals a stratum's own percentiles rest on; fewer borrow the bed band's
LOW_PCT, HIGH_PCT = 0.10, 0.90  # the range brackets the middle 80% of the back-test's errors
DECIMALS = 4  # log ratios and multipliers are written to 4 places
BOOTSTRAP_DRAWS = 10000
BOOTSTRAP_SEED = 20261023  # fixed, so the national range is the same on every rebuild
# How a hospital's figure and its cost report's compare (`pair_kind`): both nonzero and of one sign (an error can be
# taken), opposite signs, the cost report zero (it stores no value), the model zero with the cost report not, both zero.
PAIR_KINDS = ("compared", "sign_mismatch", "zero_actual", "zero_model", "both_zero")


def bed_band(beds):
    """The bed band id for a bed count, or None for a count that is missing or not above zero."""
    if beds is None or not beds > 0:
        return None
    for band, low, high in BED_BANDS:
        if beds >= low and (high is None or beds <= high):
            return band
    raise ValueError(f"no bed band holds {beds!r}")


def stratum_of(inp):
    """A hospital's stratum (one of STRATA) from its impact-file inputs (`beds`, `sch`, `mdh`), or None when the bed
    count is missing."""
    band = bed_band(inp["beds"])
    if band is None:
        return None
    return stratum_id(band, SCH_MDH if inp["sch"] or inp["mdh"] else OTHER)


def pair_kind(model, actual):
    """Which of PAIR_KINDS a (model, actual) pair is."""
    if actual == 0:
        return "both_zero" if model == 0 else "zero_actual"
    if model == 0:
        return "zero_model"
    return "compared" if (model > 0) == (actual > 0) else "sign_mismatch"


def log_ratio(model, actual):
    """log(model / actual) for a compared pair (both nonzero, one sign)."""
    if pair_kind(model, actual) != "compared":
        raise ValueError(f"no error for model {model!r} and actual {actual!r}: they are not both nonzero and of one sign")
    return math.log(model / actual)


def percentile(values, p):
    """The p-th quantile (0 to 1) by linear interpolation between order statistics: Excel's PERCENTILE.INC, numpy's
    default (engine/js/stats.js percentileInc is the same)."""
    s = sorted(values)
    if not s:
        raise ValueError("percentile of no values")
    k = (len(s) - 1) * p
    f = math.floor(k)
    c = min(f + 1, len(s) - 1)
    return s[f] + (s[c] - s[f]) * (k - f)


def _round(x):
    return round(x, DECIMALS)


def summary(errors):
    """{n, p10, p90, median} of a list of log errors, rounded to DECIMALS; the three statistics are None when empty."""
    if not errors:
        return {"n": 0, "p10": None, "p90": None, "median": None}
    return {"n": len(errors), "p10": _round(percentile(errors, LOW_PCT)), "p90": _round(percentile(errors, HIGH_PCT)),
            "median": _round(percentile(errors, 0.5))}


def multipliers(p10, p90):
    """(low, high): what an estimate is multiplied by for its range, from the rounded percentiles: exp(-p90), exp(-p10)."""
    return _round(math.exp(-p90)), _round(math.exp(-p10))


def stratum_bands(errors_by_stratum):
    """The bands for one measure. `errors_by_stratum`: {stratum id: [log errors]} (strata with none may be missing).
    Returns (`strata`, `overall`): `strata` a list, in STRATA's order, of {stratum, n, median, pool, poolN, p10, p90,
    low, high}, where n and median are the stratum's own (median None with no hospitals), and pool says whose
    percentiles it takes: "stratum" (its own, n >= MIN_STRATUM), "beds" (its bed band's, both kinds pooled) or "all"
    (every hospital's); `overall` the summary over every hospital."""
    everyone = [e for s in STRATA for e in errors_by_stratum.get(s, [])]
    if len(everyone) < MIN_STRATUM:
        raise ValueError(f"{len(everyone)} hospitals: too few for any band (at least {MIN_STRATUM})")
    by_band = {band: [e for kind in KINDS for e in errors_by_stratum.get(stratum_id(band, kind), [])]
               for band, _, _ in BED_BANDS}
    out = []
    for band, _, _ in BED_BANDS:
        for kind in KINDS:
            s = stratum_id(band, kind)
            own = errors_by_stratum.get(s, [])
            pool, pooled = (("stratum", own) if len(own) >= MIN_STRATUM else
                            ("beds", by_band[band]) if len(by_band[band]) >= MIN_STRATUM else ("all", everyone))
            stats = summary(pooled)
            low, high = multipliers(stats["p10"], stats["p90"])
            out.append({"stratum": s, "n": len(own), "median": summary(own)["median"], "pool": pool,
                        "poolN": len(pooled), "p10": stats["p10"], "p90": stats["p90"], "low": low, "high": high})
    return out, summary(everyone)


def bootstrap_ratio(pairs, draws=BOOTSTRAP_DRAWS, seed=BOOTSTRAP_SEED):
    """{n, ratio, p10, p90, draws, seed}: sum(actual) / sum(model) over `pairs` [(model, actual), ...], and the 10th and
    90th percentiles of that ratio over `draws` resamples of the pairs with replacement (each resample as many pairs
    as there are), rounded to DECIMALS. The draws come from Python's Mersenne Twister seeded with `seed`, whose
    `random()` sequence for an integer seed is fixed across Python 3 versions; `choices` without weights takes each pick
    as pairs[floor(random() x n)], one `random()` per pick, as it has since Python 3.6. The sums add up in the
    resample's order, in floats, as they always have, so a rebuild gives the same bytes."""
    if len(pairs) < MIN_STRATUM:
        raise ValueError(f"{len(pairs)} hospitals: too few to resample (at least {MIN_STRATUM})")
    if any(not m > 0 or not a > 0 for m, a in pairs):
        raise ValueError("the national ratio needs positive model and actual figures")
    rng = random.Random(seed)
    n = len(pairs)
    ratios = []
    for _ in range(draws):
        sm = sa = 0.0
        for m, a in rng.choices(pairs, k=n):
            sm += m
            sa += a
        ratios.append(sa / sm)
    return {"n": n, "ratio": _round(sum(a for _, a in pairs) / sum(m for m, _ in pairs)),
            "p10": _round(percentile(ratios, LOW_PCT)), "p90": _round(percentile(ratios, HIGH_PCT)), "draws": draws,
            "seed": seed}
