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
    outliers   = outlier factor x fed                                        operating outliers
    UC         = Factor 3 x (Factor 1 x Factor 2)                            uncompensated care: the hospital's share
                                                                             of the year's pool
    F          = fed + IME + DSH + outliers + uncompensated care             the federal operating payment: what an
                                                                             SCH's or MDH's hospital-specific payment
                                                                             is compared with
    B          = fed + mdh_addon                                             base operating payment (HRRP, HVBP base)
    IME (MA)   = IME factor x MA cases x MA cmi x (labor x wage index + nonlabor x cola)
                                                                             IME paid for Medicare Advantage stays
    low volume = (low-volume multiplier - 1) x every other part of T
    T          = B + IME + IME (MA) + DSH + outliers + SCH difference + low volume + capital + uncompensated care
    T'         = T + B x (hrrp - 1) + B x (vbp - 1)
    at stake   = 0.01 x T'            (for every hospital; the dollars at risk)
    HAC        = -at stake            (only for a hospital the program cuts)
    net        = HRRP$ + HVBP$ + HAC

ASSUMPTION (new-technology add-on payments, NTAP): they are in none of these terms. B, and so T, the HRRP and HVBP
dollars and the at-stake figure, run slightly low for a hospital that receives them. The reasoning is at the federal
payment in `_parts`; `estimate` and Methods point here.

Below the estimate: a status for every hospital in the HACRP file (`status`), the row the emitter keeps for it
(`hospital_row`, whole dollars), the national sums of those rows (`national`), and the checks that hold the sums against
what CMS publishes about the programs (`checks`). A row's figures are whole dollars that add exactly (its sums are built
from its rounded parts), and a national sum is the sum of the rounded rows, so a reader adding up a table gets the
headline.

Pure: no file, network or clock.
"""
import math

from pp_engine.ipps import PUERTO_RICO, rate_key
from pp_engine.parse import MARYLAND

HAC_RATE = 0.01  # the HAC Reduction Program's payment reduction: 1% of the hospital's payments (SSA 1886(p))
# A Medicare-dependent hospital is paid 75% of the excess of its hospital-specific rate over the federal rate
# (42 CFR 412.108).
MDH_SHARE = 0.75

# The national checks. Each is a range the sums must land in; none is fitted to the estimate. If one fails, find the
# cause; a range is not widened to make a check pass.
#
# HRRP: CMS's published "penalty as a share of payments", 0.44%: the All Hospitals row of Table I.G.7.-01 in the HRRP
# impact discussion of the FY2026 IPPS/LTCH PPS final rule (90 FR 37265-37266; the rule numbers its HACRP impact table
# I.G.7.-01 too, so the program and row name the table). The row reads 2,797 eligible, 2,304 penalized, 82.37%
# penalized, 0.44%. The pinned HRRP supplemental file lists 2,945 hospitals, more than the table's 2,797 eligible. Its
# 2,304 below a factor of 1 equal the table's penalized, so by count the 148 listed but not counted are among the 641
# listed at 1 (the table's 493 eligible and unpenalized are the rest). This check divides by the penalized hospitals'
# B alone, so those 148 do not enter it.
# CMS's words say the share is over every eligible hospital's payments: "The results in Table I.G.7.-01 include 2,797
# non-Maryland hospitals estimated as eligible to receive a penalty during the performance period.", and the column's
# footnote: "calculated as the sum of all penalties for the group of hospitals with that characteristic divided by total
# base operating DRG payments for all those hospitals". CMS's rows say otherwise. On the pinned FY2026 files this
# module's HRRP dollars over B are 0.443% over the penalized hospitals and 0.387% over every hospital with an HRRP row;
# over the penalized hospitals each of the table's nine census-division rows and its non-teaching row reproduces to
# within 0.01 percentage point, and over all of them each runs 0.03 to 0.11 point low. So the check divides by the
# penalized hospitals' B (`hrrp_base`), the reading that reproduces CMS's published rows; docs/METHODS-LOG.md (dollars
# methods_version 4) records that CMS's footnote reads the other way. The band is 0.04 percentage points each way.
# Because the denominator was chosen to match CMS's figure, passing proves little: it rules out a gross error in B or
# in the factor join. The test of the HRRP dollars is the back-test against cost-report HRRP dollars.
HRRP_SHARE = (0.0040, 0.0048)
# HAC: the program cuts the worst-scoring quartile of hospitals (SSA 1886(p)) by 1% of their payments, so the cut is
# about a quarter of 1% of all hospitals' payments: 0.25%. The ratio is the HAC dollars over everyone's T; the band is
# 0.05 percentage points each way, because the cut hospitals are not an average quarter of payments.
HAC_SHARE = (0.002, 0.003)
# HVBP is budget-neutral: the 2% withheld from each participant's base operating payments is paid back out as incentive
# payments, so the dollars net to about zero over the participants (42 CFR 412.162(b)(1): the total amount available for
# value-based incentive payments "is equal to the total amount of base-operating DRG payment reductions for that fiscal
# year, as estimated by the Secretary"). The check holds |sum of HVBP dollars| to a tenth of the pool, 2% of the base
# payments of the hospitals in Table 16B; the tenth allows for estimate error in B and for participants the estimate
# cannot price. It is vacuous if that base is zero (nothing joined), which the tests assert it is not.
VBP_NET_OF_POOL = 0.10
# The pool's rate, the "applicable percent": 42 CFR 412.160 defines it, "(5) For FY 2017 and subsequent fiscal years,
# 2.0 percent", of the "base operating DRG payment amount" (eCFR, read 2026-10-22).
VBP_WITHHOLD = 0.02
# Operating outliers: the FY2026 final rule sets the outlier threshold so "outlier payments ... would equal 5.1 percent
# of operating DRG payments" (90 FR 37228), the share CMS figures as "total outlier payments" over "total operating
# Federal payments plus total outlier payments" (90 FR 37227). The check holds the same ratio of the estimate's sums,
# operating outliers over the federal DRG payment plus operating outliers, to 5.1% and 0.5 percentage point either way:
# the impact file's factors are CMS's own, so the ratio should land near CMS's target, and the half point allows for the
# estimate's hospitals (the HACRP file's) being fewer than CMS's (every IPPS claim). The band stops short of the
# statute's 6% ceiling, which the misread base (the factor taken on IME and DSH too) went past. Set before the ratio
# was computed on this base (2026-10-23).
OUTLIER_SHARE = (0.046, 0.056)
# Uncompensated care: the sum of the estimated hospitals' payments over the final rule's pool, Factor 1 x Factor 2
# (`rates["uc_pool"]`; FY2026: $7,713,127,500, 90 FR 36886-36889). The impact file's factors share out the whole pool,
# so the sum falls short only by the hospitals outside the estimate: Puerto Rico's, those not in the HACRP file and
# those without inputs. More than 5% short would mean DSH hospitals dropped in the join. It can pass 1 only by the
# per-claim supplemental payments of IHS and Tribal hospitals (`_uncompensated_care`), part of the roughly $108 million
# of supplemental payments in the rule's $7.821 billion total (90 FR 37262), so 2% over is the most it can be. Set
# before the sum was computed (2026-10-23).
UC_POOL_SHARE = (0.95, 1.02)
# Hospitals CMS cuts that this module has no estimate for (a program participant, or no volume in the FY2026 impact
# file) are counted, not silently dropped from the money. On the pinned files there are 9 (2026-10-22), none of them in
# the impact file at all. Their pages say there is no estimate, and the national dollars cover estimated hospitals only.
# A later file with more fails the check, so the new ones are looked at.
YES_UNESTIMATED_MAX = 9

STATUSES = ("estimated", "maryland", "parhm", "no-inputs")

# Keys every hospital must carry as numbers (or, for the flags, bools). The ones the file may leave blank (`hsp`,
# `hsp_mdh`, `outlier_op`, `outlier_cap`, `ime_cases`, `ime_cmi`, `ucp_factor`) are handled where they are used and are
# not listed.
_NUMBERS = ("cases", "cmi", "bills", "cmi_hsp", "wi", "cola", "quality", "ehr", "ime_op", "ime_cap", "dsh_op",
            "dsh_cap", "ucp_per_claim", "gaf", "low_volume")
_FLAGS = ("sch", "mdh")
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
    for k in _FLAGS:
        if not isinstance(inp[k], bool):  # 1, "Y" or None would be read as a truth value, not refused
            raise ValueError(f"{k} must be True or False, not {inp[k]!r}")
    if inp["sch"] and inp["mdh"]:
        # A hospital is one or the other (an SCH that also qualifies is paid as an SCH); counting both would pay its
        # hospital-specific difference twice. The pinned file has no such hospital.
        raise ValueError("a hospital flagged both sole community and Medicare-dependent")


def _rate_pair(inp, rates):
    """(labor, nonlabor) dollars per case-mix-weighted case: Table 1A when the wage index is above 1 (66% labor in
    FY2026) and 1B at or below (62%); the scenario from the two reduced-update flags. Puerto Rico's Table 1C is not
    used: no program applies to a Puerto Rico hospital, so none is priced (`refuse_puerto_rico`)."""
    return rates["operating"]["1A" if inp["wi"] > 1 else "1B"][rate_key(inp["quality"], inp["ehr"])]


def _hsp_payment(rate, inp):
    """What the hospital-specific rate would pay for the year's cases, or None when there is no usable rate.
    ASSUMPTION: a blank or zero rate is "no usable rate" (the file has zero in three rows). The comparison uses CMIV43
    (`cmi_hsp`), which the impact file's README says applies to hospitals paid on their hospital-specific rate, and the
    same transfer-adjusted `cases` as the federal side."""
    if _missing(rate):
        return None
    return rate * inp["cmi_hsp"] * inp["cases"]


def _mdh_factor(inp, rates):
    """The multiplier that brings an MDH's hospital-specific rate to the rates' year, for the hospital's quality/EHR
    scenario: `rates["mdh_factor"]` (`ipps.read_rates`). Where the impact file's MDH rate is the year before's, as
    FY2026's is ("HSP Rate updated to FY 2025 for MDH providers"; the FY2026 rule modeled the MDH status expiring), it
    is 1 + the scenario's update times the rule's two budget-neutrality factors for hospital-specific rates (MS-DRG
    reclassification and recalibration, and the 10% cap on relative-weight cuts; `ipps.ImpactYear` quotes the rule).
    Where the file's rate is already the year's, as FY2024's and as FY2026's SCH rates are, it is 1. Only the MDH rate
    takes it."""
    key = rate_key(inp["quality"], inp["ehr"])
    try:
        return rates["mdh_factor"][key]
    except KeyError:
        raise ValueError(f"the rates have no MDH rate factor for scenario {key!r}") from None


def _uncompensated_care(inp, rates):
    """The hospital's uncompensated care payment for the year, as CMS defines it: its Factor 3 (`ucp_factor`, the
    impact file's `UCP_ADJ`) times the year's pool, Factor 1 x Factor 2 (`rates["uc_pool"]`; the rule: "Factor 3 is
    applied to the product of Factor 1 and Factor 2 to determine the amount of the uncompensated care payment that
    each eligible hospital will receive"). That is the amount the cost report carries (Worksheet E Part A line 35.02,
    "multiplying line 35 by line 35.01", the pool by Factor 3; line 36 its total), the one the HAC cut is taken on.
    The per-claim amount is the same payment spread over claims ("divided by the 3-year claims average"), a count the
    file does not carry, so it is not used to rebuild the year's amount, except:
    ASSUMPTION: a hospital with no Factor 3 whose per-claim amount is not zero is paid the supplemental payment alone
    (an IHS or Tribal hospital: the per-claim amount includes "the IHS/PR Supplemental Payment"); its year's amount is
    the per-claim amount times the file's Medicare cases (`bills`, FY2024 for FY2026), the nearest count the file has.
    A Factor 3 hospital's supplemental payment, if any, is not modeled (Puerto Rico's hospitals, the ones that have
    both, are not priced)."""
    factor = inp.get("ucp_factor") or 0.0
    if factor > 0:
        return factor * rates["uc_pool"]
    return inp["ucp_per_claim"] * inp["bills"]


def _parts(inp, rates):
    """Every dollar component for one hospital, as floats, before any program adjustment."""
    _check(inp)
    labor, nonlabor = _rate_pair(inp, rates)
    # The operating COLA (Alaska and Hawaii) multiplies the nonlabor share only; the labor share takes the wage index.
    fed = inp["cases"] * inp["cmi"] * (labor * inp["wi"] + nonlabor * inp["cola"])

    # ASSUMPTION: new-technology add-on payments (NTAP) are left out of B, and so out of T. They are not published per
    # hospital (the impact file has no NTAP column). B, the HRRP and HVBP dollars (both taken on B) and the at-stake
    # figure therefore run slightly low for a hospital that receives them; the direction is the same for every
    # hospital, the size is not known. They are in the base by rule: 42 CFR 412.152, "Base operating DRG payment amount
    # is the wage-adjusted DRG operating payment plus any applicable new technology add-on payments". Like them, ESRD
    # payments (Worksheet E Part A line 46) and credits for replaced devices are in the HAC cut's base and no figure.

    # ASSUMPTION: the IME and DSH add-on factors apply to the federal DRG payment (not to the MDH add-on or the SCH
    # difference); `TCHOP` and `DSHOPP` are fractions of it, DSH after the 75% section 1886(r) reduction. `TCHOP` is the
    # base IME formula alone, 1.35 x ((1 + resident-to-bed ratio)^0.405 - 1), on every teaching row of the FY2026 and
    # FY2024 files (to within 5e-6), so the section 422 IME add-on (42 CFR 412.105(e)(2); Worksheet E Part A line
    # 28.01) is in no figure, for a hospital's own stays or its Medicare Advantage stays.
    ime = inp["ime_op"] * fed
    dsh = inp["dsh_op"] * fed

    # Operating outliers: OUTFACT_F is "estimated operating outlier payments as a percentage of the provider's Federal
    # operating IPPS payments" (the impact file's README), and those payments are the DRG payments alone. The FY2026
    # final rule sets the threshold so outliers are 5.1% of "total “operating DRG payments,” which does not include
    # IME and DSH payments" (90 FR 37214), dividing "total outlier payments by total operating Federal payments plus
    # total outlier payments" (90 FR 37227). Taken on the DRG payment plus IME and DSH, as methods_versions 1 to 3 did,
    # the factors summed to more than the statute's 6% ceiling. A blank factor (70 hospitals) is no outlier payments.
    outlier_op = (inp["outlier_op"] or 0.0) * fed

    uc = _uncompensated_care(inp, rates)

    # F, the federal operating payment, is what the hospital-specific payment is compared with. The FY2026 final rule
    # (90 FR 36536; FR-2025-08-04): a sole community hospital is paid "the higher of the applicable Federal rate, or the
    # hospital-specific rate"; a Medicare-dependent hospital "the higher of the Federal rate, or the Federal rate plus
    # 75 percent of the difference between the Federal rate and the hospital-specific rate". The federal side is
    # everything it pays the hospital: the cost report compares Worksheet E Part A line 47, "the sum of lines 1, 1.01,
    # 1.02, 2, 2.01, 2.02, 2.03, 2.04, 29, 34, 36, and 46" (the DRG payments, outliers, IME, DSH, uncompensated care and
    # ESRD), with line 48, the hospital-specific payment (PRM-II ch. 40, 4030.1); the rule: "we take into consideration
    # uncompensated care payments in the comparison" (90 FR 37215). ESRD is not modeled. An SCH paid its
    # hospital-specific rate is paid H = F + `sch_diff` in all, with nothing on top of it.
    federal_operating = fed + ime + dsh + outlier_op + uc

    # Medicare-dependent hospital: F plus 75% of the amount by which its (updated) hospital-specific payment exceeds F,
    # never negative. The extension ran through all of FY2026 (hence the FY2025-extension columns) and all of FY2024.
    mdh_addon = 0.0
    hsp_mdh = _hsp_payment(inp["hsp_mdh"], inp) if inp["mdh"] else None
    if hsp_mdh is not None:
        mdh_addon = MDH_SHARE * max(0.0, hsp_mdh * _mdh_factor(inp, rates) - federal_operating)

    # A sole community hospital is paid the higher of F and its hospital-specific rate. The difference is not part of B:
    # 42 CFR 412.152 defines the SCH base operating DRG payment amount to exclude it (an MDH's includes its add-on), so
    # HRRP and HVBP adjust the federal base only. The real comparison is made payment by payment (the README says the
    # per-claim uncompensated care amount feeds it); here it is made once, on the year's totals, which can only
    # understate the difference for a hospital that wins on some claims and loses on others.
    sch_diff = 0.0
    hsp_sch = _hsp_payment(inp["hsp"], inp) if inp["sch"] else None
    if hsp_sch is not None:
        sch_diff = max(0.0, hsp_sch - federal_operating)

    # Capital: the single federal rate (Table 1D) x case-mix x the capital geographic adjustment factor (which already
    # includes the Alaska and Hawaii capital COLA) x cases x (1 + IME + DSH + outliers). Like the operating factor,
    # COUTFACT_F is a share of the capital federal payment alone: the rule's capital outlier percentage, 3.84%, is "of
    # capital payments based on the Federal rate" (90 FR 37228), so the outlier term sits beside IME and DSH rather than
    # multiplying them.
    capital = (rates["capital"] * inp["cmi"] * inp["gaf"] * inp["cases"]
               * (1.0 + inp["ime_cap"] + inp["dsh_cap"] + (inp["outlier_cap"] or 0.0)))

    # IME for Medicare Advantage stays: a teaching hospital is paid IME on its Medicare Advantage discharges too, on the
    # DRG payment those stays would have drawn ("Multiply the appropriate multiplier of the adjustment factor ... times
    # line 3", the managed care simulated payments: PRM-II ch. 40, 4030.1, Worksheet E Part A line 22.01; line 29.01
    # totals it). The HAC cut is taken on it: Exhibit 5 lists "Operating IME payments for Medicare Advantage patients"
    # among the payments "required to calculate the HAC reduction adjustment". The impact file models those stays in
    # its IME_CASETA and IME_TACMIV columns ("Transfer adjusted cases ... for Medicare Advantage cases submitted by
    # teaching hospitals that receive a fee-for-service IME payment"), priced here at the same wage-adjusted rate pair
    # and IME factor as the hospital's own stays; blank columns (non-teaching hospitals) are none. It is not part of the
    # base HRRP and HVBP adjust, and Worksheet E adds line 29.01 after the SCH and MDH comparison (line 49), so it is
    # outside F. The section 422 IME add-on for these stays (line 28.01) is left out: `TCHOP` carries none (above).
    ime_ma = 0.0
    if not _missing(inp["ime_cases"]) and not _missing(inp["ime_cmi"]):
        ime_ma = inp["ime_op"] * inp["ime_cases"] * inp["ime_cmi"] * (labor * inp["wi"] + nonlabor * inp["cola"])

    # The low-volume adjustment (42 CFR 412.101) is a percentage of every other part of the payment. The cost report's
    # low-volume worksheet (PRM-II ch. 40, 4030.1, Exhibit 4): "The following payment amounts are multiplied by the
    # low-volume payment adjustment percentage by FFY": the operating federal and hospital-specific payments, outliers,
    # IME, "Operating IME payments for Medicare Advantage patients", DSH, "Uncompensated care payments", ESRD, "Total
    # Capital IPPS payment", new technology payments and credits for replaced devices. So its base is everything else in
    # T: B (the federal payment and the MDH add-on), IME on both kinds of stay, DSH, operating outliers, the SCH
    # difference, capital and uncompensated care; the unpriced items (new technology, ESRD, replaced devices) are not.
    low_volume = (inp["low_volume"] - 1.0) * (fed + mdh_addon + ime + ime_ma + dsh + outlier_op + sch_diff + capital
                                              + uc)

    return {"fed": float(fed), "mdh_addon": float(mdh_addon), "ime": float(ime), "ime_ma": float(ime_ma),
            "dsh": float(dsh), "outlier_op": float(outlier_op), "sch_diff": float(sch_diff),
            "low_volume": float(low_volume), "capital": float(capital), "uc": float(uc)}


def _factor(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not value > 0:
        raise ValueError(f"{name} must be a positive adjustment factor (1 = none), not {value!r}")
    return float(value)


def _require_bool(cut):
    """`cut` as the real bool it must be: CMS's Payment Reduction column says "Yes" or "No", and the string "No" is
    truthy, so the emitter converts and this refuses anything else."""
    if not isinstance(cut, bool):
        raise ValueError(f"cut must be True or False, not {cut!r}")
    return cut


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
    then the parts of T (`PARTS`): fed, mdh_addon, ime, ime_ma, dsh, outlier_op, sch_diff, low_volume, capital, uc.
    Raises `ValueError` for a hospital it cannot price (a missing input, a factor that is not a positive finite number,
    a `cut` that is not a bool, a hospital flagged both sole community and Medicare-dependent) and `SchemaError` for
    quality or EHR flags `rate_key` does not know.
    New-technology add-on payments are in none of these figures: see the module docstring's ASSUMPTION (reasoning at the
    federal payment in `_parts`); B and so T, and the dollars taken on them, run slightly low for a hospital that
    receives them."""
    hrrp_factor, vbp_factor, cut = _factor(hrrp, "hrrp"), _factor(vbp, "vbp"), _require_bool(cut)
    parts = _parts(inp, rates)
    base = _base(parts)
    # HRRP and HVBP each adjust the base operating payment B and nothing else (not IME, DSH, capital or the rest), each
    # on its own: 42 CFR 412.154(b)(1), "an applicable hospital's base operating DRG payment amount is adjusted for each
    # discharge", and 412.162(b)(2), "calculated by multiplying the base operating DRG payment amount by the value-based
    # incentive payment percentage"; 412.152 and 412.160 define that amount "without regard to" the other program's
    # adjustment. The HAC cut is then 1% of everything the hospital is paid after both (42 CFR 412.172). What B leaves
    # out, new-technology add-on payments, is the assumption (at the federal payment, in `_parts`).
    return {**_chain(parts, base * (hrrp_factor - 1.0), base * (vbp_factor - 1.0), cut, float), **parts}


# --- the row, statuses and the national sums -------------------------------------------------------------------------

def refuse_puerto_rico(ccns, where):
    """Raise if any of `ccns`, the hospitals a program file (`where`) lists, is in Puerto Rico. None of the three
    programs applies there: each is for "subsection (d) hospitals", and SSA 1886(d)(1)(B) defines those as hospitals
    "located in one of the fifty States or the District of Columbia"; Puerto Rico's are "subsection (d) Puerto Rico
    hospitals" (1886(d)(9)(A)). CMS's FY2026 and FY2024 program files list none. A file that lists one has changed in a
    way this module does not price, so the build stops rather than price the hospital as an ordinary one."""
    found = sorted(ccn for ccn in ccns if ccn[:2] == PUERTO_RICO)
    if found:
        raise ValueError(f"{where} lists {len(found)} Puerto Rico hospital(s) ({found[0][:2]}xxxx): no program "
                         "applies to Puerto Rico's hospitals, so the file or its reading has changed; look before "
                         "pricing them")


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
    return {**est, **_chain(parts, round(est["hrrp"]), round(est["hvbp"]), _require_bool(cut), round), **parts}


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


def checks(nat, *, hacrp_yes, uc_pool):
    """Hold `national`'s sums against what CMS publishes about the programs and the payment. A list of
    `{id, value, low, high, pass}`:
      hrrp_share       HRRP dollars lost over B of the penalized hospitals, in HRRP_SHARE
      vbp_net          |HVBP dollars| (the net of winners and losers), at most VBP_NET_OF_POOL of the 2% pool
      hac_share        HAC dollars lost over everyone's T, in HAC_SHARE
      outlier_share    operating outliers over the federal DRG payment plus operating outliers, in OUTLIER_SHARE
      uc_pool          uncompensated care over `uc_pool`, the final rule's pool (`rates["uc_pool"]`), in UC_POOL_SHARE
      hac_count        hospitals marked cut, any status, equal to `hacrp_yes`: the Yes count the caller reads from
                       the HACRP site's emitted file, not from the rows being checked
      yes_unestimated  cut hospitals with no estimate, at most YES_UNESTIMATED_MAX
    A share with nothing to divide by has value None and fails."""
    parts = nat["parts"]
    return [
        result("hrrp_share", _ratio(-nat["hrrp"], nat["hrrp_base"]), *HRRP_SHARE),
        result("vbp_net", abs(nat["hvbp"]), 0, VBP_NET_OF_POOL * VBP_WITHHOLD * nat["vbp_base"]),
        result("hac_share", _ratio(-nat["hac"], nat["total"]), *HAC_SHARE),
        result("outlier_share", _ratio(parts["outlier_op"], parts["fed"] + parts["outlier_op"]), *OUTLIER_SHARE),
        result("uc_pool", _ratio(parts["uc"], uc_pool), *UC_POOL_SHARE),
        result("hac_count", nat["yes"], hacrp_yes, hacrp_yes),
        result("yes_unestimated", nat["yes_unestimated"], 0, YES_UNESTIMATED_MAX),
    ]
