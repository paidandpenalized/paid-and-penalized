"""The dollars behind the three payment adjustments, per hospital: an estimate of what Medicare pays one hospital for
FY2026 inpatient care, and how much each of the Hospital Readmissions Reduction Program (HRRP), the Hospital
Value-Based Purchasing Program (HVBP) and the Hospital-Acquired Condition Reduction Program (HAC) moves it.

It is a model, not a bill. The inputs are the FY2026 final-rule impact file (`ipps.read_payment_inputs`) and Tables
1A-1E (`ipps.read_rates`), which CMS built to model the year's payments, not to reproduce each hospital's claims. Every
place this module chooses between readings of the rule is marked ASSUMPTION; Methods lists them.

Why T is built term by term: the HAC cut is 1% of the hospital's whole IPPS payment after the HRRP and HVBP
adjustments (T', below), and that payment is the sum of a dozen pieces, only one of which the other two programs touch.

    fed        = cases x cmi x (labor x wage index + nonlabor x cola)        the federal DRG payment
    B          = fed + mdh_addon                                             base operating payment (HRRP, HVBP base)
    T          = B + IME + DSH + outliers + SCH difference + low volume + capital + uncompensated care
    T'         = T + B x (hrrp - 1) + B x (vbp - 1)
    at stake   = 0.01 x T'            (for every hospital; the dollars at risk)
    HAC        = -at stake            (only for a hospital the program cuts)
    net        = HRRP$ + HVBP$ + HAC

New-technology add-on payments (NTAP) are in none of these terms (see the ASSUMPTION at the federal payment): B, and
so T, the HRRP and HVBP dollars and the at-stake figure, run slightly low for a hospital that receives them.

Below the estimate: a status for every hospital in the HACRP file (`status`), the row the emitter keeps for it
(`hospital_row`, whole dollars), the national sums of those rows (`national`), and the checks that hold the sums against
what CMS publishes about the programs (`checks`). A row's figures are whole dollars that add exactly (its sums are built
from its rounded parts), and a national sum is the sum of the rounded rows, so a reader adding up a table gets the
headline.

Pure: no file, network or clock.
"""
import math

from pp_engine.ipps import rate_key

HAC_RATE = 0.01  # the HAC Reduction Program's payment reduction: 1% of the hospital's payments (SSA 1886(p))
MDH_SHARE = 0.75  # a Medicare-dependent hospital is paid 75% of the excess of its hospital-specific rate (42 CFR 412.108)

# The national checks. Each is a range the sums must land in; none is fitted to the estimate. If one fails, find the
# cause; a range is not widened to make a check pass.
#
# HRRP: CMS's published "penalty as a share of payments", 0.44% in the All Hospitals row of the HRRP impact table of the
# FY2026 IPPS/LTCH PPS final rule (90 FR 36536; the rule numbers both its HRRP and HACRP impact tables I.G.7.-01, so
# the row and program name the table), with a band of 0.04 percentage points each way. CMS defines the share as the sum
# of the penalties over the sum of base operating DRG payments (FY2024) of the hospitals with the characteristic; the
# All Hospitals row counts 2,797 eligible hospitals, 2,304 of them penalized. The ratio checked is the HRRP dollars lost
# over the base operating payments (B) of the penalized hospitals (`hrrp_base`). On the pinned FY2026 files that is
# 0.443%; over every hospital with an HRRP row it would be 0.387%, so the published 0.44% matches the penalized-only
# ratio. Flagged for the accuracy pass, which confirms the denominator against the rule's text.
HRRP_SHARE = (0.0040, 0.0048)
# HAC: the program cuts the worst-scoring quartile of hospitals (SSA 1886(p)) by 1% of their payments, so the cut is
# about a quarter of 1% of all hospitals' payments: 0.25%. The ratio is the HAC dollars over everyone's T; the band is
# 0.05 percentage points each way, because the cut hospitals are not an average quarter of payments.
HAC_SHARE = (0.002, 0.003)
# HVBP is budget-neutral: the 2% withheld from each participant's base operating payments is paid back out as incentive
# payments, so the dollars net to about zero over the participants (42 CFR 412.162(b)(1): "The total amount available
# for value based incentive payments to all hospitals for a fiscal year is equal to the total amount of base-operating
# DRG payment reductions for that fiscal year"). The check holds |sum of HVBP dollars| to a tenth of the pool, 2% of the
# base payments of the hospitals in Table 16B; the tenth allows for estimate error in B and for participants the
# estimate cannot price.
VBP_NET_OF_POOL = 0.10
# The pool's rate, the "applicable percent": 42 CFR 412.160 defines it, "(5) For FY 2017 and subsequent fiscal years,
# 2.0 percent", of the "base operating DRG payment amount" (eCFR, read 2026-10-22).
VBP_WITHHOLD = 0.02
# Hospitals CMS cuts that this module has no estimate for (a program participant, or no volume in the FY2026 impact
# file) are counted, not silently dropped from the money. On the pinned files there are 9 (2026-10-22), none of them in
# the impact file at all. Their pages say there is no estimate, and the national dollars cover estimated hospitals only.
# A later file with more fails the check, so the new ones are looked at.
YES_UNESTIMATED_MAX = 9

MARYLAND = "MD"  # the state whose hospitals are paid under the state's own model: no HRRP, HVBP or HAC adjustment
STATUSES = ("estimated", "maryland", "parhm", "no-inputs")

# Keys every hospital must carry as numbers (or, for the flags, bools). The ones the file may leave blank (`hsp`,
# `hsp_mdh`, `outlier_op`, `outlier_cap`) are handled where they are used and are not listed.
_NUMBERS = ("cases", "cmi", "bills", "cmi_hsp", "wi", "cola", "quality", "ehr", "ime_op", "ime_cap", "dsh_op", "dsh_cap",
            "ucp_per_claim", "gaf", "low_volume")
_FLAGS = ("sch", "mdh", "pr")
_ADD_ONS = ("ime", "dsh", "outlier_op", "sch_diff", "low_volume", "capital", "uc")  # the parts of T beyond B


def _check(inp):
    missing = [k for k in _NUMBERS if inp.get(k) is None] + [k for k in _FLAGS if k not in inp]
    if missing:
        raise ValueError(f"cannot price a hospital without {', '.join(missing)}")
    if inp["sch"] and inp["mdh"]:
        # A hospital is one or the other (an SCH that also qualifies is paid as an SCH); counting both would pay its
        # hospital-specific difference twice. The pinned file has no such hospital.
        raise ValueError("a hospital flagged both sole community and Medicare-dependent")


def _rate_pair(inp, rates):
    """(labor, nonlabor) dollars per case-mix-weighted case: Table 1C for Puerto Rico; otherwise Table 1A when the wage
    index is above 1 (66% labor) and 1B at or below (62%); the scenario from the two reduced-update flags."""
    key = rate_key(inp["quality"], inp["ehr"])
    operating = rates["operating"]
    table = "1C" if inp["pr"] else ("1A" if inp["wi"] > 1 else "1B")
    try:
        return operating[table][key]
    except KeyError:
        # Table 1C lists the EHR split only (no quality-reporting split); no Puerto Rico hospital in the file needs the
        # missing scenarios, so a miss means the input or the table changed. Better to stop than to price from 1B.
        raise ValueError(f"Table {table} has no rate for scenario {key!r}") from None


def _hsp_payment(rate, inp):
    """What the hospital-specific rate would pay for the year's cases, or None when there is no usable rate.
    ASSUMPTION: a blank or zero rate is "no usable rate" (the file has zero in three rows). The comparison uses CMIV43
    (`cmi_hsp`), which the impact file's README says applies to hospitals paid on their hospital-specific rate, and the
    same transfer-adjusted `cases` as the federal side."""
    if rate is None or not rate > 0:
        return None
    return rate * inp["cmi_hsp"] * inp["cases"]


def _parts(inp, rates):
    """Every dollar component for one hospital, as floats, before any program adjustment."""
    _check(inp)
    labor, nonlabor = _rate_pair(inp, rates)
    # The operating COLA (Alaska and Hawaii) multiplies the nonlabor share only; the labor share takes the wage index.
    fed = inp["cases"] * inp["cmi"] * (labor * inp["wi"] + nonlabor * inp["cola"])

    # ASSUMPTION: new-technology add-on payments (NTAP) are left out of B, and so out of T. They are not published per
    # hospital (the impact file has no NTAP column). B, the HRRP and HVBP dollars (both taken on B) and the at-stake
    # figure therefore run slightly low for a hospital that receives them; the direction is the same for every
    # hospital, the size is not known.

    # Medicare-dependent hospital: the federal payment plus 75% of the amount by which its hospital-specific payment
    # exceeds it, never negative. The extension ran through all of FY2026 (hence the FY2025-extension columns).
    mdh_addon = 0.0
    hsp_mdh = _hsp_payment(inp["hsp_mdh"], inp) if inp["mdh"] else None
    if hsp_mdh is not None:
        mdh_addon = MDH_SHARE * max(0.0, hsp_mdh - fed)

    # ASSUMPTION: the IME and DSH add-on factors apply to the federal DRG payment (not to the MDH add-on or the SCH
    # difference); `TCHOP` and `DSHOPP` are fractions of it, DSH after the 75% section 1886(r) reduction.
    ime = inp["ime_op"] * fed
    dsh = inp["dsh_op"] * fed

    # ASSUMPTION: OUTFACT_F is applied to the federal DRG payment plus IME plus DSH. The README defines it as "estimated
    # operating outlier payments as a percentage of the provider's Federal operating IPPS payments", which does not say
    # whether that is the DRG payment alone; the wider reading is used, and the MDH add-on, low-volume payment and
    # uncompensated care stay out of the base. A blank factor (70 hospitals) is no outlier payments.
    outlier_op = (inp["outlier_op"] or 0.0) * (fed + ime + dsh)

    # ASSUMPTION: a sole community hospital is paid the higher of the federal payment and its hospital-specific rate, and
    # the difference is not part of B (HRRP and HVBP adjust the federal base). The real comparison is made payment by
    # payment (the README says the per-claim uncompensated care amount feeds it); here it is made once, on the year's
    # totals, which can only understate the difference for a hospital that wins on some claims and loses on others.
    sch_diff = 0.0
    hsp_sch = _hsp_payment(inp["hsp"], inp) if inp["sch"] else None
    if hsp_sch is not None:
        sch_diff = max(0.0, hsp_sch - fed)

    # ASSUMPTION (verify against 42 CFR 412.101 in the accuracy pass): the low-volume adjustment is a percentage add-on to
    # the operating payment (federal, MDH add-on, IME, DSH and operating outliers), not to capital or uncompensated care.
    low_volume = (inp["low_volume"] - 1.0) * (fed + mdh_addon + ime + dsh + outlier_op)

    # Capital: the single federal rate (Table 1D, for Puerto Rico too) x case-mix x the capital geographic adjustment
    # factor (which already includes the Alaska and Hawaii capital COLA) x (1 + IME + DSH) x cases, plus outliers.
    capital = (rates["capital"] * inp["cmi"] * inp["gaf"] * (1.0 + inp["ime_cap"] + inp["dsh_cap"]) * inp["cases"]
               * (1.0 + (inp["outlier_cap"] or 0.0)))

    # ASSUMPTION: interim uncompensated care is paid per claim, so the per-claim amount times the file's Medicare cases.
    # The amount's own denominator is a three-year average of claims the file does not carry; Bills (FY2024) is its
    # nearest, and the national total is checked against the final rule's pool separately.
    uc = inp["ucp_per_claim"] * inp["bills"]

    return {"fed": float(fed), "mdh_addon": float(mdh_addon), "ime": float(ime), "dsh": float(dsh),
            "outlier_op": float(outlier_op), "sch_diff": float(sch_diff), "low_volume": float(low_volume),
            "capital": float(capital), "uc": float(uc)}


def _total(parts, base):
    return base + sum(parts[k] for k in _ADD_ONS)


def base_payment(inp, rates):
    """B: the federal DRG payment plus the MDH add-on, in dollars for the year. The base HRRP and HVBP adjust."""
    parts = _parts(inp, rates)
    return parts["fed"] + parts["mdh_addon"]


def total_payment(inp, rates, base):
    """T: `base` (B) plus IME, DSH, operating outliers, the SCH difference, low volume, capital and uncompensated care."""
    return _total(_parts(inp, rates), base)


def _factor(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not value > 0:
        raise ValueError(f"{name} must be a positive adjustment factor (1 = none), not {value!r}")
    return float(value)


def estimate(inp, rates, *, hrrp, vbp, cut):
    """One hospital's dollars. `hrrp` and `vbp` are the program adjustment factors (multipliers; 1.0 where the hospital
    has none); `cut` is whether the HAC Reduction Program cuts it. Returns floats:
      base, total        B and T
      hrrp, hvbp         dollars: B x (factor - 1), so negative for a penalty
      after              T' = T + hrrp + hvbp
      at_stake           0.01 x T' for every hospital
      hac                -at_stake if cut, else 0
      net                hrrp + hvbp + hac
    then the parts of T: fed, mdh_addon, ime, dsh, outlier_op, sch_diff, low_volume, capital, uc."""
    hrrp_factor, vbp_factor = _factor(hrrp, "hrrp"), _factor(vbp, "vbp")
    parts = _parts(inp, rates)
    base = parts["fed"] + parts["mdh_addon"]
    total = _total(parts, base)
    # ASSUMPTION: HRRP and HVBP each adjust the base operating payment B (not IME, DSH, capital or the rest); the HAC
    # cut is then 1% of everything the hospital is paid after both.
    hrrp_dollars = base * (hrrp_factor - 1.0)
    hvbp_dollars = base * (vbp_factor - 1.0)
    after = total + hrrp_dollars + hvbp_dollars
    at_stake = HAC_RATE * after
    hac = -at_stake if cut and at_stake else 0.0
    return {"base": float(base), "total": float(total), "hrrp": float(hrrp_dollars), "hvbp": float(hvbp_dollars),
            "after": float(after), "at_stake": float(at_stake), "hac": float(hac),
            "net": float(hrrp_dollars + hvbp_dollars + hac), **parts}


# --- the row, statuses and the national sums -------------------------------------------------------------------------

_PARTS = ("fed", "mdh_addon") + _ADD_ONS  # the dollar components of B and T
_SUMMED = ("base", "total", "hrrp", "hvbp", "after", "hac", "net")  # what `national` adds up


def _require_bool(cut):
    """`cut` as the real bool it must be: CMS's Payment Reduction column says "Yes" or "No", and the string "No" is
    truthy, so the emitter converts and this refuses anything else."""
    if not isinstance(cut, bool):
        raise ValueError(f"cut must be True or False, not {cut!r}")
    return cut


def _missing(value):
    """True when a count or case-mix is absent or not above zero (also NaN)."""
    return value is None or not value > 0


def status(ccn, state, inp, parhm):
    """Why a hospital does or does not get an estimate: "maryland" (state MD), "parhm" (a Pennsylvania Rural Health
    Model participant: its payments are set by the model, so there is nothing to estimate), "no-inputs" (no impact-file
    row, or cases or case-mix blank or not above zero: `estimate` would price such a hospital at zero, which is not
    the same as not knowing), else "estimated". The first that applies wins. `parhm` is the set of participant CCNs."""
    if state == MARYLAND:
        return "maryland"
    if ccn in parhm:
        return "parhm"
    if inp is None or _missing(inp.get("cases")) or _missing(inp.get("cmi")):
        return "no-inputs"
    return "estimated"


def round_dollars(est):
    """`est` in whole dollars, built so that every sum a reader can add up is exact. Python `round` (halves to the even
    dollar), then `int`, is applied to each part (fed, mdh_addon, ime, dsh, outlier_op, sch_diff, low_volume, capital,
    uc) and to `hrrp` and `hvbp` (from the unrounded B x (factor - 1)). The sums follow from those integers:
      base = fed + mdh_addon;  total = base + the other parts;  after = total + hrrp + hvbp;
      at_stake = round(0.01 x after);  hac = -at_stake when the hospital is cut, else 0;  net = hrrp + hvbp + hac.
    So a figure can sit a dollar from its own unrounded value (a hospital's `total` is not always `round(T)`); the sums
    are never a dollar from their parts. `est` is `estimate`'s dict; anything else in it (factors, `cases`) is left as
    it is, and the keys keep their order."""
    out = dict(est)
    out.update({k: int(round(est[k])) for k in _PARTS})
    out["base"] = out["fed"] + out["mdh_addon"]
    out["total"] = out["base"] + sum(out[k] for k in _ADD_ONS)
    out["hrrp"], out["hvbp"] = int(round(est["hrrp"])), int(round(est["hvbp"]))
    out["after"] = out["total"] + out["hrrp"] + out["hvbp"]
    out["at_stake"] = int(round(HAC_RATE * out["after"]))
    out["hac"] = -out["at_stake"] if est["hac"] else 0  # `estimate` leaves hac at zero for a hospital that is not cut
    out["net"] = out["hrrp"] + out["hvbp"] + out["hac"]
    return out


def hospital_row(ccn, state, inp, rates, *, hrrp, vbp, cut, parhm):
    """One HACRP-file hospital's row: `{ccn, status, cut, hrrp_listed, vbp_listed}`, then (only when the status is
    "estimated") the whole-dollar estimate. `hrrp` and `vbp` are the hospital's factors from the HRRP file and Table
    16B, or None when it has no row there (it then takes factor 1, and `*_listed` is False). `cut` is a bool.
    `inp` is its impact-file inputs or None; `parhm` the participant CCNs. A hospital that cannot be priced raises
    (`ValueError`, or `SchemaError` from `rate_key`), so the build fails instead of the hospital vanishing."""
    row = {"ccn": ccn, "status": status(ccn, state, inp, parhm), "cut": _require_bool(cut),
           "hrrp_listed": hrrp is not None, "vbp_listed": vbp is not None}
    if row["status"] == "estimated":
        row.update(round_dollars(estimate(inp, rates, hrrp=1.0 if hrrp is None else hrrp,
                                          vbp=1.0 if vbp is None else vbp, cut=cut)))
    return row


def national(rows):
    """The sums over a set of `hospital_row`s. Over the rows with status "estimated": `hospitals` (how many), the sums
    of the rounded `base, total, hrrp, hvbp, after, hac, net`, `cut` (how many are cut), `hrrp_base` (the sum of B over
    the penalized hospitals: those whose HRRP dollars are negative) and `vbp_base` (the sum of B over those in Table
    16B): the bases the checks divide by. Over every row, any status: `yes` (how many are cut), `yes_unestimated` (cut,
    but not estimated) and `by_status`."""
    nat = {"hospitals": 0, **dict.fromkeys(_SUMMED, 0), "cut": 0, "hrrp_base": 0, "vbp_base": 0, "yes": 0,
           "yes_unestimated": 0, "by_status": dict.fromkeys(STATUSES, 0)}
    for r in rows:
        if r["status"] not in nat["by_status"]:
            raise ValueError(f"unknown status {r['status']!r} for {r['ccn']}")
        cut = _require_bool(r["cut"])
        nat["by_status"][r["status"]] += 1
        nat["yes"] += cut
        if r["status"] != "estimated":
            nat["yes_unestimated"] += cut
            continue
        nat["hospitals"] += 1
        nat["cut"] += cut
        for k in _SUMMED:
            nat[k] += r[k]
        nat["hrrp_base"] += r["base"] if r["hrrp"] < 0 else 0
        nat["vbp_base"] += r["base"] if r["vbp_listed"] else 0
    return nat


def _ratio(num, den):
    return num / den if den else None


def _result(id_, value, low, high):
    return {"id": id_, "value": value, "low": low, "high": high,
            "pass": value is not None and low <= value <= high}


def checks(nat, *, hacrp_yes):
    """Hold `national`'s sums against what CMS publishes about the programs. A list of `{id, value, low, high, pass}`:
      hrrp_share       HRRP dollars lost over B of the penalized hospitals, in HRRP_SHARE
      vbp_net          |HVBP dollars| (the net of winners and losers), at most VBP_NET_OF_POOL of the 2% pool
      hac_share        HAC dollars lost over everyone's T, in HAC_SHARE
      hac_count        hospitals marked cut, any status, equal to `hacrp_yes`: the HACRP file's Yes count
      yes_unestimated  cut hospitals with no estimate, at most YES_UNESTIMATED_MAX
    A share with nothing to divide by has value None and fails."""
    return [
        _result("hrrp_share", _ratio(-nat["hrrp"], nat["hrrp_base"]), *HRRP_SHARE),
        _result("vbp_net", abs(nat["hvbp"]), 0, VBP_NET_OF_POOL * VBP_WITHHOLD * nat["vbp_base"]),
        _result("hac_share", _ratio(-nat["hac"], nat["total"]), *HAC_SHARE),
        _result("hac_count", nat["yes"], hacrp_yes, hacrp_yes),
        _result("yes_unestimated", nat["yes_unestimated"], 0, YES_UNESTIMATED_MAX),
    ]
