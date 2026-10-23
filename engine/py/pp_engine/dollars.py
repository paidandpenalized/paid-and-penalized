"""The dollars behind the three payment adjustments, per hospital: an estimate of what Medicare pays one hospital for
FY2026 inpatient care, and how much each of the Hospital Readmissions Reduction Program (HRRP), the Hospital
Value-Based Purchasing Program (HVBP) and the Hospital-Acquired Condition Reduction Program (HAC) moves it.

It is a model, not a bill. The inputs are the FY2026 final-rule impact file (`ipps.read_payment_inputs`) and Tables
1A-1E (`ipps.read_rates`), which CMS built to model the year's payments, not to reproduce each hospital's claims. Every
place this module chooses between readings of the rule is marked ASSUMPTION; Methods lists them. The back-test
(`pp_pipeline.backtest_dollars`) runs the same functions on the FY2024 rule's files and holds them against hospitals'
FY2024 cost reports; nothing here knows the year.

Why T is built term by term: the HAC cut is 1% of the hospital's whole IPPS payment after the HRRP and HVBP
adjustments (T', below), and that payment is the sum of a dozen pieces, only one of which the other two programs touch.

    fed        = cases x cmi x (labor x wage index + nonlabor x cola)        the federal DRG payment
    F          = fed + IME + DSH + outliers + uncompensated care             the federal operating payment: what an
                                                                             SCH's or MDH's hospital-specific payment
                                                                             is compared with
    B          = fed + mdh_addon                                             base operating payment (HRRP, HVBP base)
    IME (MA)   = IME factor x MA cases x MA cmi x (labor x wage index + nonlabor x cola)
                                                                             IME paid for Medicare Advantage stays
    T          = B + IME + IME (MA) + DSH + outliers + SCH difference + low volume + capital + uncompensated care
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
from pp_engine.parse import MARYLAND

HAC_RATE = 0.01  # the HAC Reduction Program's payment reduction: 1% of the hospital's payments (SSA 1886(p))
MDH_SHARE = 0.75  # a Medicare-dependent hospital is paid 75% of the excess of its hospital-specific rate (42 CFR 412.108)

# The national checks. Each is a range the sums must land in; none is fitted to the estimate. If one fails, find the
# cause; a range is not widened to make a check pass.
#
# HRRP: CMS's published "penalty as a share of payments", 0.44%, from the HRRP impact discussion of the FY2026
# IPPS/LTCH PPS final rule (90 FR 36536, Appendix A; the rule numbers both its HRRP and HACRP impact tables I.G.7.-01,
# so the program and row name the table). The All Hospitals row reads 2,797 eligible, 2,304 penalized, 82.37% penalized,
# 0.44%. CMS's words: "The results in Table I.G.7.-01 include 2,797 non-Maryland hospitals estimated as eligible to
# receive a penalty during the performance period." and "This is calculated as the sum of penalties for all hospitals
# with that characteristic over the sum of all base operating DRG payments for those hospitals between October 1, 2023,
# through September 30, 2024 (FY 2024)." Those words describe all hospitals, 2,797 of them. On the pinned FY2026 files
# the ratio of this module's HRRP dollars to B over every hospital with an HRRP row is 0.387%, and over the penalized
# hospitals alone 0.443%. The check uses the penalized hospitals (`hrrp_base`) because that is the ratio that reproduces
# CMS's published figure. The denominator is unconfirmed (CMS's text and the pins disagree on which hospitals it
# covers) and is flagged for the accuracy pass. The band is 0.04 percentage points each way. This check is fitted to
# CMS's published figure, so passing it proves little: it only rules out a gross error in B or in the factor join. The
# real test of the HRRP dollars is the milestone-3 back-test against cost-report HRRP dollars.
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

STATUSES = ("estimated", "maryland", "parhm", "no-inputs")

# Keys every hospital must carry as numbers (or, for the flags, bools). The ones the file may leave blank (`hsp`,
# `hsp_mdh`, `outlier_op`, `outlier_cap`, `ime_cases`, `ime_cmi`) are handled where they are used and are not listed.
_NUMBERS = ("cases", "cmi", "bills", "cmi_hsp", "wi", "cola", "quality", "ehr", "ime_op", "ime_cap", "dsh_op", "dsh_cap",
            "ucp_per_claim", "gaf", "low_volume")
_FLAGS = ("sch", "mdh", "pr")
_ADD_ONS = ("ime", "ime_ma", "dsh", "outlier_op", "sch_diff", "low_volume", "capital", "uc")  # the parts of T beyond B
PARTS = ("fed", "mdh_addon") + _ADD_ONS  # the dollar components of B and T, in the order `estimate` lists them
SUMMED = ("base", "total", "hrrp", "hvbp", "after", "hac", "net")  # a row's dollar sums, which `national` adds up


def _missing(value):
    """True when a count or case-mix is absent or not above zero (also NaN)."""
    return value is None or not value > 0


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
    if _missing(rate):
        return None
    return rate * inp["cmi_hsp"] * inp["cases"]


def _mdh_update(inp, rates):
    """The multiplier that brings an MDH's hospital-specific rate to the rates' year: 1 + the hospital's quality/EHR
    scenario's `mdh_update` (percent; `ipps.read_rates`: the update the Table 1A/1B heading states where the file's rate
    is the year before's, else 0). ASSUMPTION (verify in the accuracy pass): hospital-specific rates are updated by the
    applicable percentage increase, the update those headings state. The FY2026 impact file's MDH column is the FY2025
    rate ("HSP Rate updated to FY 2025 for MDH providers"; the FY2026 rule modeled the MDH status expiring), while its
    SCH column is already "updated to FY 2026", so only the MDH rate takes this; FY2024's file has both updated."""
    key = rate_key(inp["quality"], inp["ehr"])
    try:
        return 1.0 + rates["mdh_update"][key] / 100.0
    except KeyError:
        raise ValueError(f"the rates have no update for scenario {key!r}") from None


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

    # ASSUMPTION: the IME and DSH add-on factors apply to the federal DRG payment (not to the MDH add-on or the SCH
    # difference); `TCHOP` and `DSHOPP` are fractions of it, DSH after the 75% section 1886(r) reduction.
    ime = inp["ime_op"] * fed
    dsh = inp["dsh_op"] * fed

    # ASSUMPTION: OUTFACT_F is applied to the federal DRG payment plus IME plus DSH. The README defines it as "estimated
    # operating outlier payments as a percentage of the provider's Federal operating IPPS payments", which does not say
    # whether that is the DRG payment alone; the wider reading is used, and the MDH add-on, low-volume payment and
    # uncompensated care stay out of the base. A blank factor (70 hospitals) is no outlier payments.
    outlier_op = (inp["outlier_op"] or 0.0) * (fed + ime + dsh)

    # ASSUMPTION: interim uncompensated care is paid per claim, so the per-claim amount times the file's Medicare cases.
    # The amount's own denominator is a three-year average of claims the file does not carry; Bills (FY2024) is its
    # nearest, and the national total is checked against the final rule's pool separately.
    uc = inp["ucp_per_claim"] * inp["bills"]

    # F, the federal operating payment, is what the hospital-specific payment is compared with. The FY2026 final rule
    # (90 FR 36536; FR-2025-08-04): a sole community hospital is paid "the higher of the applicable Federal rate, or the
    # hospital-specific rate"; a Medicare-dependent hospital "the higher of the Federal rate, or the Federal rate plus 75
    # percent of the difference between the Federal rate and the hospital-specific rate"; and a hospital paid its
    # hospital-specific rate gets no DSH ("the eligibility of SCHs paid under hospital-specific rate and MDHs to receive
    # DSH payments" was a commenters' question). So the comparison is against everything the federal side pays the
    # hospital, not the bare DRG payment. ASSUMPTION (verify in the accuracy pass): IME, operating outliers and
    # uncompensated care sit inside F on both comparisons; the rule's text confirms DSH only. An SCH paid its
    # hospital-specific rate is paid H = F + `sch_diff` in all, with nothing on top of it.
    federal_operating = fed + ime + dsh + outlier_op + uc

    # Medicare-dependent hospital: F plus 75% of the amount by which its (updated) hospital-specific payment exceeds F,
    # never negative. The extension ran through all of FY2026 (hence the FY2025-extension columns) and all of FY2024.
    mdh_addon = 0.0
    hsp_mdh = _hsp_payment(inp["hsp_mdh"], inp) if inp["mdh"] else None
    if hsp_mdh is not None:
        mdh_addon = MDH_SHARE * max(0.0, hsp_mdh * _mdh_update(inp, rates) - federal_operating)

    # A sole community hospital is paid the higher of F and its hospital-specific rate. The difference is not part of B:
    # 42 CFR 412.152 defines the SCH base operating DRG payment amount to exclude it (an MDH's includes its add-on), so
    # HRRP and HVBP adjust the federal base only. The real comparison is made payment by payment (the README says the
    # per-claim uncompensated care amount feeds it); here it is made once, on the year's totals, which can only
    # understate the difference for a hospital that wins on some claims and loses on others.
    sch_diff = 0.0
    hsp_sch = _hsp_payment(inp["hsp"], inp) if inp["sch"] else None
    if hsp_sch is not None:
        sch_diff = max(0.0, hsp_sch - federal_operating)

    # Capital: the single federal rate (Table 1D, for Puerto Rico too) x case-mix x the capital geographic adjustment
    # factor (which already includes the Alaska and Hawaii capital COLA) x (1 + IME + DSH) x cases, plus outliers.
    capital = (rates["capital"] * inp["cmi"] * inp["gaf"] * (1.0 + inp["ime_cap"] + inp["dsh_cap"]) * inp["cases"]
               * (1.0 + (inp["outlier_cap"] or 0.0)))

    # The low-volume adjustment (42 CFR 412.101), FY2026 final rule: it "is based on total per discharge payments made
    # under section 1886 of the Act, including capital, DSH, IME, and outlier payments. For SCHs and MDHs, the
    # low-volume hospital payment adjustment is based in part on either the Federal rate or the hospital-specific rate,
    # whichever results in a greater operating IPPS payment." So its base is the federal payment, the MDH add-on, IME,
    # DSH, operating outliers, the SCH difference and capital. ASSUMPTION (verify in the accuracy pass): uncompensated
    # care stays out, since the rule's list does not name it.
    low_volume = (inp["low_volume"] - 1.0) * (fed + mdh_addon + ime + dsh + outlier_op + sch_diff + capital)

    # IME for Medicare Advantage stays: a teaching hospital is paid IME on its Medicare Advantage discharges too, on the
    # DRG payment those stays would have drawn ("Multiply the appropriate multiplier of the adjustment factor ... times
    # line 3", the managed care simulated payments: PRM-II ch. 40, 4030.1, Worksheet E Part A line 22.01; line 29.01
    # totals it). The HAC cut is taken on it: Exhibit 5 lists "Operating IME payments for Medicare Advantage patients"
    # among the payments "required to calculate the HAC reduction adjustment". The impact file models those stays in
    # its IME_CASETA and IME_TACMIV columns ("Transfer adjusted cases ... for Medicare Advantage cases submitted by
    # teaching hospitals that receive a fee-for-service IME payment"), priced here at the same wage-adjusted rate pair
    # and IME factor as the hospital's own stays; blank columns (non-teaching hospitals) are none. It enters T only: it
    # is not part of the base HRRP and HVBP adjust; Worksheet E adds line 29.01 after the SCH and MDH comparison (line
    # 49), so it is outside F; and the low-volume adjustment, a percentage of payments per traditional Medicare
    # discharge, does not take it. ASSUMPTION (verify in the accuracy pass): the section 422 IME add-on for these
    # stays (line 28.01) is in the impact file's IME factor as it is for the hospital's own stays.
    ime_ma = 0.0
    if not _missing(inp["ime_cases"]) and not _missing(inp["ime_cmi"]):
        ime_ma = inp["ime_op"] * inp["ime_cases"] * inp["ime_cmi"] * (labor * inp["wi"] + nonlabor * inp["cola"])

    return {"fed": float(fed), "mdh_addon": float(mdh_addon), "ime": float(ime), "ime_ma": float(ime_ma), "dsh": float(dsh),
            "outlier_op": float(outlier_op), "sch_diff": float(sch_diff), "low_volume": float(low_volume),
            "capital": float(capital), "uc": float(uc)}


def _factor(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not value > 0:
        raise ValueError(f"{name} must be a positive adjustment factor (1 = none), not {value!r}")
    return float(value)


def _base(parts):
    """B: the federal DRG payment plus the MDH add-on, the base operating payment HRRP and HVBP adjust. An SCH's
    hospital-specific difference is not in it: 42 CFR 412.152 defines the SCH base operating DRG payment amount to
    exclude that difference, while an MDH's includes its add-on."""
    return parts["fed"] + parts["mdh_addon"]


def _chain(parts, hrrp, hvbp, cut, rnd):
    """From a hospital's `parts` and the HRRP and HVBP dollars to the net: B, T, T', the at-stake figure, HAC, net, as a
    dict with the keys of `estimate`'s first eight. Both the estimate (floats) and the whole-dollar row run this, so the
    arithmetic is written once; `rnd` turns the 1% into the number type of its inputs (`float`, or `round` for a row
    whose figures are integers, so every sum is of the figures beside it). `cut` is whether the HAC Reduction Program
    cuts the hospital."""
    base = _base(parts)
    total = base + sum(parts[k] for k in _ADD_ONS)
    after = total + hrrp + hvbp
    at_stake = rnd(HAC_RATE * after)
    hac = -at_stake if cut and at_stake else rnd(0)  # a plain zero, never -0.0
    return {"base": base, "total": total, "hrrp": hrrp, "hvbp": hvbp, "after": after, "at_stake": at_stake, "hac": hac,
            "net": hrrp + hvbp + hac}


def estimate(inp, rates, *, hrrp, vbp, cut):
    """One hospital's dollars. `hrrp` and `vbp` are the program adjustment factors (multipliers; 1.0 where the hospital
    has none); `cut` is whether the HAC Reduction Program cuts it. Returns floats:
      base, total        B and T
      hrrp, hvbp         dollars: B x (factor - 1), so negative for a penalty
      after              T' = T + hrrp + hvbp
      at_stake           0.01 x T' for every hospital
      hac                -at_stake if cut, else 0
      net                hrrp + hvbp + hac
    then the parts of T (`PARTS`): fed, mdh_addon, ime, ime_ma, dsh, outlier_op, sch_diff, low_volume, capital, uc."""
    hrrp_factor, vbp_factor = _factor(hrrp, "hrrp"), _factor(vbp, "vbp")
    parts = _parts(inp, rates)
    base = _base(parts)
    # ASSUMPTION: HRRP and HVBP each adjust the base operating payment B (not IME, DSH, capital or the rest); the HAC
    # cut is then 1% of everything the hospital is paid after both.
    return {**_chain(parts, base * (hrrp_factor - 1.0), base * (vbp_factor - 1.0), cut, float), **parts}


# --- the row, statuses and the national sums -------------------------------------------------------------------------

def _require_bool(cut):
    """`cut` as the real bool it must be: CMS's Payment Reduction column says "Yes" or "No", and the string "No" is
    truthy, so the emitter converts and this refuses anything else."""
    if not isinstance(cut, bool):
        raise ValueError(f"cut must be True or False, not {cut!r}")
    return cut


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


def round_dollars(est, *, cut):
    """`est` in whole dollars, built so that every sum a reader can add up is exact. Python `round` (halves to the even
    dollar) is applied to each part (`PARTS`) and to `hrrp` and `hvbp` (from the unrounded B x (factor - 1)). The sums
    follow from those integers:
      base = fed + mdh_addon;  total = base + the other parts;  after = total + hrrp + hvbp;
      at_stake = round(0.01 x after);  hac = -at_stake when the hospital is `cut`, else 0;  net = hrrp + hvbp + hac.
    So a figure can sit a dollar from its own unrounded value (a hospital's `total` is not always `round(T)`); the sums
    are never a dollar from their parts. `est` is `estimate`'s dict; anything else in it (factors, `cases`) is left as
    it is, and the keys keep their order."""
    parts = {k: round(est[k]) for k in PARTS}
    return {**est, **_chain(parts, round(est["hrrp"]), round(est["hvbp"]), cut, round), **parts}


def hospital_row(ccn, state, inp, rates, *, hrrp, vbp, cut, parhm):
    """One HACRP-file hospital's row: `{ccn, status, cut, hrrp_listed, vbp_listed}`, then (only when the status is
    "estimated") the factors it took (`hrrp_factor`, `vbp_factor`), its `cases` and Medicare `bills`, and the
    whole-dollar estimate (`round_dollars`). `hrrp` and `vbp` are the hospital's factors from the HRRP file and Table
    16B, or None when it has no row there (it then takes factor 1, and `*_listed` is False). `cut` is a bool. `inp` is
    its impact-file inputs or None; `parhm` the participant CCNs. A hospital that cannot be priced raises
    (`ValueError`, or `SchemaError` from `rate_key`), so the build fails instead of the hospital vanishing."""
    row = {"ccn": ccn, "status": status(ccn, state, inp, parhm), "cut": _require_bool(cut),
           "hrrp_listed": hrrp is not None, "vbp_listed": vbp is not None}
    if row["status"] == "estimated":
        hrrp_factor, vbp_factor = 1.0 if hrrp is None else hrrp, 1.0 if vbp is None else vbp
        row.update(hrrp_factor=hrrp_factor, vbp_factor=vbp_factor, cases=inp["cases"], bills=inp["bills"])
        row.update(round_dollars(estimate(inp, rates, hrrp=hrrp_factor, vbp=vbp_factor, cut=cut), cut=cut))
    return row


def national(rows):
    """The sums over a set of `hospital_row`s. Over the rows with status "estimated": `hospitals` (how many), the sums
    of the rounded `SUMMED` (`base, total, hrrp, hvbp, after, hac, net`), `cut` (how many are cut), `hrrp_base` (the sum
    of B over the penalized hospitals: those whose HRRP dollars are negative) and `vbp_base` (the sum of B over those in
    Table 16B): the bases the checks divide by. Over every row, any status: `yes` (how many are cut), `yes_unestimated`
    (cut, but not estimated) and `by_status`. And `parts`: the sum of each of `PARTS` over the estimated rows."""
    nat = {"hospitals": 0, **dict.fromkeys(SUMMED, 0), "cut": 0, "hrrp_base": 0, "vbp_base": 0, "yes": 0,
           "yes_unestimated": 0, "by_status": dict.fromkeys(STATUSES, 0), "parts": dict.fromkeys(PARTS, 0)}
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
        for k in SUMMED:
            nat[k] += r[k]
        for k in PARTS:
            nat["parts"][k] += r[k]
        nat["hrrp_base"] += r["base"] if r["hrrp"] < 0 else 0
        nat["vbp_base"] += r["base"] if r["vbp_listed"] else 0
    return nat


def _ratio(num, den):
    return num / den if den else None


def result(id_, value, low, high):
    """One check's result: `{id, value, low, high, pass}`; a value of None fails."""
    return {"id": id_, "value": value, "low": low, "high": high,
            "pass": value is not None and low <= value <= high}


def checks(nat, *, hacrp_yes):
    """Hold `national`'s sums against what CMS publishes about the programs. A list of `{id, value, low, high, pass}`:
      hrrp_share       HRRP dollars lost over B of the penalized hospitals, in HRRP_SHARE
      vbp_net          |HVBP dollars| (the net of winners and losers), at most VBP_NET_OF_POOL of the 2% pool
      hac_share        HAC dollars lost over everyone's T, in HAC_SHARE
      hac_count        hospitals marked cut, any status, equal to `hacrp_yes`: the Yes count the caller reads from
                       the HACRP site's emitted file, not from the rows being checked
      yes_unestimated  cut hospitals with no estimate, at most YES_UNESTIMATED_MAX
    A share with nothing to divide by has value None and fails."""
    return [
        result("hrrp_share", _ratio(-nat["hrrp"], nat["hrrp_base"]), *HRRP_SHARE),
        result("vbp_net", abs(nat["hvbp"]), 0, VBP_NET_OF_POOL * VBP_WITHHOLD * nat["vbp_base"]),
        result("hac_share", _ratio(-nat["hac"], nat["total"]), *HAC_SHARE),
        result("hac_count", nat["yes"], hacrp_yes, hacrp_yes),
        result("yes_unestimated", nat["yes_unestimated"], 0, YES_UNESTIMATED_MAX),
    ]
