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

Pure: no file, network or clock.
"""
import math

from pp_engine.ipps import rate_key

HAC_RATE = 0.01  # the HAC Reduction Program's payment reduction: 1% of the hospital's payments (SSA 1886(p))
MDH_SHARE = 0.75  # a Medicare-dependent hospital is paid 75% of the excess of its hospital-specific rate (42 CFR 412.108)

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
