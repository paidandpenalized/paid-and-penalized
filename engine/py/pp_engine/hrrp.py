"""The HRRP payment-reduction formula, the stored-decimals machinery that makes the site print CMS's 4-decimal values,
the build gates, the fiscal-year share of Medicare-dependent-hospital status, and the dollar estimate.

Ported from Thirty Day Readmissions (pipeline/hrrp/model.py and the pure parts of pipeline/build_data.py at 33d1959).
Pure: records in, values out. Where TDR stopped the build with SystemExit, this raises HrrpError with the same message.

Formula (CMS Payment Reduction Methodology, FY2019+ peer grouping):
    contribution_c = NM x DRG ratio_c x max(ERR_c - peer median ERR_c, 0)
        counted only when eligible discharges_c >= 25 and ERR_c > peer median
    reduction = min(sum of contributions, 0.03);  PAF = 1 - reduction
"""
import math
import re
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from pp_engine.dollars import MDH_SHARE
from pp_engine.parse import CONDITIONS


class HrrpError(ValueError):
    """A build gate failed: the message says what and where."""


MIN_DISCHARGES = 25
CAP = 0.03

# Medicare-dependent hospital status ends on this date under current law (extended through Dec 31, 2026 by section
# 6202 of the Consolidated Appropriations Act, 2026). The MDH add-on counts only for the fiscal-year days up to it;
# move it if Congress extends the program again.
MDH_END = "2026-12-31"

# ERRs, DRG ratios, peer medians, and the neutrality modifier are written with at least this many decimals: the fewest
# that still reproduce every FY2027 PAF from the JSON (5 leaves 7 hospitals 0.0001 off). The build fails if it stops
# sufficing. A value gets more decimals, up to MAX_DECIMALS, when the site's toFixed(4) of it would otherwise differ
# from CMS's published 4-decimal value (1.02485 prints as 1.0249; CMS shows the full 1.0248497... as 1.0248). An exact
# tie that no rounding fixes (the double 0.06145 sits below the tie, so prints 0.0614; Excel shows CMS's 0.0615) is
# stored one unit of its MAX_DECIMALS-th decimal toward CMS's value (0.061450000001), and listed in the build report.
DECIMALS = 6
MAX_DECIMALS = 12


# --- the formula ----------------------------------------------------------------------------------------------------

def contribution(nm, c):
    n, err, med, ratio = c.get("n"), c.get("err"), c.get("med"), c.get("ratio")
    if nm is None or err is None or med is None or ratio is None or (n or 0) < MIN_DISCHARGES:
        return 0.0
    return nm * ratio * max(err - med, 0.0)


def contributions(h):
    return {k: contribution(h["nm"], h["c"][k]) for k in CONDITIONS}


def reduction(h):
    return min(sum(contributions(h).values()), CAP)


def replication_status(h):
    """'exact' when 1 - (reduction rounded to 4 decimals) equals CMS's PAF, else 'mismatch'.

    From the Excel workbook's full-precision values every FY2027 hospital is 'exact'."""
    return "exact" if abs((1 - round(reduction(h), 4)) - h["paf"]) < 1e-9 else "mismatch"


# --- the dollar estimate --------------------------------------------------------------------------------------------

def est_base_payment(imp, rates):
    """Estimated annual Medicare FFS base operating DRG payments (federal rate only).

    cases x CMI x (labor amount x wage index + non-labor amount x COLA), with the
    standardized amounts from Table 1A (wage index > 1) or 1B (<= 1) chosen by the
    hospital's quality-reporting and EHR status.
    """
    if not imp or any(imp.get(k) is None for k in ("cases", "cmi", "wi")):
        return None
    table = "1A" if imp["wi"] > 1 else "1B"
    col = ("n" if imp.get("qual_red") else "q") + ("n" if imp.get("ehr_red") else "e")
    labor, nonlabor = rates[table][col]
    return imp["cases"] * imp["cmi"] * (labor * imp["wi"] + nonlabor * (imp.get("cola") or 1.0))


def est_mdh_addon(imp, federal, share):
    """Medicare-dependent hospital add-on to the base (42 CFR 412.152, 412.108): 75% of the amount by which the
    hospital-specific-rate payment (HSP rate x CMI x cases, the federal estimate's cases and CMI) exceeds the federal
    payment, times `share`, the fraction of the fiscal year the hospital keeps MDH status. 0 without an HSP rate."""
    if federal is None or not imp.get("hsp"):
        return 0.0
    return MDH_SHARE * max(0.0, imp["hsp"] * imp["cmi"] * imp["cases"] - federal) * share


def est_penalty(base, paf):
    if base is None or paf is None:
        return None
    return base * (1 - paf)


def year_share(fy, end):
    """Fraction of fiscal year `fy` (Oct 1 - Sep 30) that falls on or before the ISO date `end`, between 0 and 1."""
    start, stop = date(fy - 1, 10, 1), date(fy, 9, 30)
    last = min(max(date.fromisoformat(end), start - timedelta(days=1)), stop)
    return ((last - start).days + 1) / ((stop - start).days + 1)


def mdh_shortfall(addons):
    """{ccn: % by which the MDH's estimate would fall short if its status lasted the whole year}; MDHs with no
    federal base (no cases, so no full-year total either) are left out."""
    return {c: 100 * (1 - (fed + a) / (fed + full)) for c, (fed, a, full) in addons.items() if fed}


# --- stored decimals ------------------------------------------------------------------------------------------------

def rnd(v, places, half_up=False):
    """v rounded to `places` decimals; None stays None. half_up rounds as CMS's published values are: the value as
    Excel shows it (15 significant digits, so 0.12344999999999999 is 0.12345), ties up (Python's round() would give
    0.15625 -> 0.1562)."""
    if v is None:
        return None
    return float(Decimal(f"{v:.15g}").quantize(Decimal(1).scaleb(-places), ROUND_HALF_UP)) if half_up else round(v, places)


def to_fixed4(v):
    """JavaScript's Number(v).toFixed(4), as a Decimal: the exact binary value rounded, an exact tie to the larger
    (half up, since every value rounded this way is positive)."""
    return Decimal(v).quantize(Decimal("0.0001"), ROUND_HALF_UP)


def stored(v, published, label, ties=None):
    """v as hrrp.json stores it, so that the site's toFixed(4) prints CMS's 4-decimal `published` value; None stays None.
    The first plain rounding that prints right, to DECIMALS, DECIMALS + 1, ... MAX_DECIMALS decimals; only if none does
    (an exact tie no rounding fixes), v rounded to MAX_DECIMALS, MAX_DECIMALS - 1, ... DECIMALS decimals and moved one
    unit of its last decimal toward `published`, finest first so the move is as small as it can be (~1e-12), and
    appended to `ties` as (label, v, stored value). HrrpError when nothing prints right. A moved value is off v by up
    to 1.5 units of its last decimal; the replication gate still checks the PAFs."""
    if v is None:
        return None
    want = Decimal(repr(published))
    places = range(DECIMALS, MAX_DECIMALS + 1)

    def prints(c):
        return to_fixed4(float(c)) == want

    plain = next((c for c in (Decimal(repr(round(v, d))) for d in places) if prints(c)), None)
    if plain is not None:
        return float(plain)
    for d in reversed(places):
        r = Decimal(repr(round(v, d)))
        c = r + Decimal(1 if to_fixed4(float(r)) < want else -1).scaleb(-d)
        if prints(c):
            if ties is not None:
                ties.append((label, v, float(c)))
            return float(c)
    raise HrrpError(f"{label}: {v!r} does not print as CMS's {published} at any precision up to {MAX_DECIMALS} decimals, "
                    "even moved one unit of the last decimal")


def _values(s):
    """(field, value) pairs of one supplemental-file record, conditions flattened as 'HF.err'."""
    yield from ((f, s[f]) for f in ("paf", "dual", "peer", "nm"))
    yield from ((f"{k}.{f}", v) for k, c in s["c"].items() for f, v in c.items())


def precision_mismatches(full, published):
    """(ccn, field) where a full-precision workbook value, rounded as CMS rounds, differs from the 4-decimal export."""
    if set(full) != set(published):
        return sorted((c, "missing") for c in set(full) ^ set(published))
    return [(c, f) for c in sorted(full) for (f, a), (_, b) in zip(_values(full[c]), _values(published[c]))
            if rnd(a, 4, half_up=True) != b]


def as_stored(ccn, s, pub, nm, peer_med, ties=None):
    """A full-precision supplemental record (s) with its formula inputs stored as hrrp.json writes them: the stored
    neutrality modifier (nm) and its peer group's medians (peer_med, {"1".."5": {condition: median}}), and its ERRs and
    DRG ratios each printing as in CMS's tab-delimited record (pub); see stored(), which appends any value it moves off
    an exact tie to `ties`. HrrpError naming the hospital when its peer group is missing or not one of 1-5."""
    med = peer_med.get(str(s.get("peer")))
    if med is None:
        raise HrrpError(f"{ccn}: peer group {s.get('peer')!r} is not one of 1-5")
    return {**s, "nm": nm,
            "c": {k: {**c, "med": med[k], **{f: stored(c[f], pub["c"][k][f], f"{ccn} {k}.{f}", ties) for f in ("err", "ratio")}}
                  for k, c in s["c"].items()}}


def stored_constant(rows, full, published, label, ties=None):
    """The value `full(row)` that every row shares at full precision, stored as hrrp.json writes it (see stored(), which
    appends a value it moves off an exact tie to `ties`) with any one row's 4-decimal `published(row)`; HrrpError if
    rows disagree."""
    vals = {full(r) for r in rows}
    if len(vals) != 1:
        raise HrrpError(f"{label} is not constant: {sorted(vals, key=str)[:5]}")
    return stored(vals.pop(), published(rows[0]), label, ties)


def replication_gate(kept):
    """HrrpError naming every hospital whose PAF the stored values ({ccn: as_stored record}) do not reproduce."""
    short = sorted(c for c, s in kept.items() if replication_status(s) != "exact")
    if short:
        raise HrrpError(f"The stored values do not reproduce the PAF of {len(short)} hospitals: {', '.join(short)}. "
                        f"Either {DECIMALS} decimals are too few (raise DECIMALS) or CMS counted a flagged condition "
                        "whose payment weight it did not publish, which the formula cannot recompute.")


def extra_places(hospitals, peer_med, nm):
    """(stored with more than DECIMALS decimals, all) over the 4-decimal values the site prints: the neutrality
    modifier, each peer median, and each hospital's ERRs and DRG ratios."""
    shown = [nm, *(v for g in peer_med.values() for v in g.values()),
             *(c[f] for x in hospitals for c in x["c"].values() for f in ("err", "ratio"))]
    shown = [v for v in shown if v is not None]
    return sum(1 for v in shown if round(v, DECIMALS) != v), len(shown)


# --- the other build gates ------------------------------------------------------------------------------------------

def table15_mismatches(t15, supp):
    """Hospitals on which Table 15 ({ccn: PAF}) and the supplemental file disagree: those in only one, then those whose
    PAFs differ (compared exactly, as TDR did)."""
    return sorted(set(t15) ^ set(supp)) + [c for c in supp if c in t15 and t15[c] != supp[c]["paf"]]


def out_of_range(supp):
    """Hospitals whose PAF is outside 1 - CAP to 1."""
    return [c for c, s in supp.items() if not 1 - CAP <= s["paf"] <= 1.0]


# --- the cost-report comparison Methods quotes ----------------------------------------------------------------------

def _is_date(v):
    """True for a real calendar date written YYYY-MM-DD."""
    if not (isinstance(v, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", v)):
        return False
    try:
        date.fromisoformat(v)
    except ValueError:
        return False
    return True


def _is_number(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def _is_int(v):
    return isinstance(v, int) and not isinstance(v, bool)


def _between(lo, hi):
    return lambda v: _is_number(v) and lo <= v <= hi


# The dollar-check fields the build requires. The site reads asOf, costFy, rateDrift, within15, and within15Small
# (Methods); source, n, within10, and within15Large are recorded for provenance. "note" is optional and unchecked.
DOLLAR_CHECK_FIELDS = ("asOf", "source", "costFy", "n", "rateDrift", "within10", "within15", "within15Small", "within15Large")


def _rule(field, fy):
    """(check, what the field must be) for one of DOLLAR_CHECK_FIELDS; every field not named here is a percentage."""
    if field == "asOf":
        return _is_date, "a YYYY-MM-DD date"
    if field == "source":
        return (lambda v: isinstance(v, str) and v.strip() != ""), "a non-empty string"
    if field == "costFy":
        return (lambda v: _is_int(v) and 2013 <= v <= fy), f"a fiscal year from 2013 to {fy}"
    if field == "n":
        return (lambda v: _is_int(v) and v > 0), "a positive integer"
    if field == "rateDrift":
        return _between(0.5, 2), "a number between 0.5 and 2"
    return _between(0, 100), "a percentage between 0 and 100"


def dollar_check_about(rec):
    """What the dollar check is and how to fix it, dated by the record's own asOf when it has a valid one."""
    when = f"the {rec['asOf']}" if _is_date(rec.get("asOf")) else "the"
    return (f"It is a dated result of {when} cost-report comparison (the dollar estimates checked against hospitals' "
            "Medicare cost reports), which Methods quotes. No script makes it: update it by hand when that comparison is redone.")


def check_dollar_check(rec, fy):
    """The parsed dollar-check record, returned as given; HrrpError naming every field of DOLLAR_CHECK_FIELDS that is
    missing, of the wrong type, or out of range (`fy` bounds costFy). A record that is not an object is missing all."""
    rec_ = rec if isinstance(rec, dict) else {}
    bad = [f"{f} is missing" if f not in rec_ else f"{f} should be {want}, not {rec_[f]!r}"
           for f, (ok, want) in ((f, _rule(f, fy)) for f in DOLLAR_CHECK_FIELDS) if not ok(rec_.get(f))]
    if bad:
        raise HrrpError(f"{'; '.join(bad)}. {dollar_check_about(rec_)}")
    return rec


# --- one hospital's HRRP fields -------------------------------------------------------------------------------------

def program_fields(s, imp, types, rates, mdh_share):
    """The HRRP part of one hospital's data-contract record, from its as_stored supplemental record (s), its estimate
    inputs (imp, {} when the impact file has none), its provider types (types, e.g. ["MDH", "RRC"]) and the standardized
    amounts (rates). Returns (fields, addon): fields are paf, red, dual, peer, base, pen and c; addon is
    (federal base, add-on at `mdh_share` of the year, full-year add-on) for an MDH with a base, else None. An MDH's
    base includes the add-on."""
    base = est_base_payment(imp, rates)
    addon = None
    if "MDH" in types and base is not None:
        addon = (base, est_mdh_addon(imp, base, mdh_share), est_mdh_addon(imp, base, 1))
        base += addon[1]
    pen = est_penalty(base, s["paf"])
    fields = {
        "paf": s["paf"], "red": round((1 - s["paf"]) * 100, 2), "dual": rnd(s["dual"], 4, half_up=True), "peer": s["peer"],
        "base": round(base) if base is not None else None,
        "pen": round(pen) if pen is not None else None,
        "c": {k: {"n": c["n"], "err": c["err"], "flag": c["flag"], "ratio": c["ratio"]}
              for k, c in s["c"].items() if not (c["n"] is None and c["err"] is None)},
    }
    return fields, addon
