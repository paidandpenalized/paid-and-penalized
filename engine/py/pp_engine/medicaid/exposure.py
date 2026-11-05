"""Per-hospital exposure: steps 1 to 4 of the method, on one hospital-year row of the HCRIS tidy table.

1. Expansion revenue at risk: Medicaid net revenue (S-10 I line 2) times the state's VIII share of Medicaid spending.
   This assumes the hospital's Medicaid revenue mix mirrors its state's: the method's largest assumption.
2. Revenue lost: step 1 times the state's percentage decline in expansion enrollment for the scenario, times the
   reader's use multiple (1 by default).
3. The cost of the lost patients' care, at the hospital's Medicaid cost per dollar of Medicaid revenue, splits three
   ways: the uninsured share who still use care (UNINSURED_SHARE x CARE_STILL_USED) becomes uncompensated care; the
   uninsured share who don't (UNINSURED_SHARE x (1 - CARE_STILL_USED)) is care no longer delivered, its cost removed;
   the rest find other coverage, which is taken to pay the care's cost (cost-neutral).
4. Margins after: revenue loses step 2 and gains the other coverage's payment; expenses lose the cost of care no
   longer delivered; uncompensated care stays as expense.

Dollars are the cost report's (base-year dollars, no projection), put on a 365-day basis when the period isn't a year.
"""
import statistics

from pp_engine.medicaid import params

# The tidy table's columns this module reads (HCRIS layer names; S-10 Part I and G-3).
FLOWS = ("medicaid_net_revenue", "medicaid_supplemental", "medicaid_cost", "net_patient_revenue",
         "net_income_patients", "net_income", "other_income", "uncompensated_cost", "medicaid_days_all", "days_total")


class ExposureError(ValueError):
    """An input outside what the method accepts."""


def _number(value):
    if value is None or value == "":
        return None
    return float(value)


def status_label(status):
    """`settled` when every report behind the row is settled (or reopened after settlement), else `as filed`. `status`
    is the tidy table's space-separated list of HCRIS status codes."""
    codes = (status or "").split()
    if not codes:
        raise ExposureError("no report status")
    return "settled" if all(c in params.SETTLED_STATUSES for c in codes) else "as filed"


def annual_factor(period_days):
    """The multiple that puts a period's flows on a 365-day basis: 1 for a period of 360 to 366 days."""
    days = int(period_days)
    if days <= 0:
        raise ExposureError(f"period of {days} days")
    lo, hi = params.FULL_YEAR_DAYS
    return 1.0 if lo <= days <= hi else params.YEAR_DAYS / days


def _cost_ratio(cost, revenue, flags=None):
    """Medicaid cost per dollar of Medicaid revenue for one revenue base; 1 (cost equals payment) when the cost is
    missing, capped at MAX_COST_RATIO. Notes either case in `flags` when given."""
    if revenue is None or revenue <= 0:
        return None
    flags = [] if flags is None else flags
    if cost is None or cost <= 0:
        flags.append("cost_missing")
        return 1.0
    ratio = cost / revenue
    if ratio > params.MAX_COST_RATIO:
        flags.append("cost_ratio_capped")
        return params.MAX_COST_RATIO
    return ratio


def hospital_base(row):
    """The measured base for one hospital-year row (a dict of the tidy table's text or numbers): flows on a 365-day
    basis, the cost ratios for both revenue bases, the report status label and flags naming anything unusual."""
    days = int(row["period_days"])
    factor = annual_factor(days)
    flags = []
    if factor != 1.0:
        flags.append("annualized")
        if days < params.SHORT_PERIOD_DAYS:
            flags.append("short_period")
    raw = {k: _number(row.get(k)) for k in FLOWS}
    base = {k: (None if v is None else v * factor) for k, v in raw.items()}
    rev = base["medicaid_net_revenue"]
    if rev is None:
        flags.append("no_medicaid_revenue")
    elif rev < 0:
        flags.append("negative_medicaid_revenue")
    rev25 = None if rev is None and base["medicaid_supplemental"] is None else (
        (rev or 0.0) + (base["medicaid_supplemental"] or 0.0))
    npr = base["net_patient_revenue"]
    has_margin = npr is not None and npr > 0 and base["net_income_patients"] is not None
    if not has_margin:
        flags.append("no_margin")
    elif rev is not None and rev > npr:
        flags.append("medicaid_exceeds_patient_revenue")
    if base["uncompensated_cost"] is None:
        flags.append("no_uncompensated_cost")
    if base["uncompensated_cost"] is not None and base["uncompensated_cost"] < 0:
        flags.append("negative_uncompensated_cost")
    # Not scored: Medicaid revenue below zero, or above the hospital's whole net patient revenue (filing errors; the
    # scenario would remove more revenue than the hospital has). A blank line 2 is scored: it has no line-2 revenue
    # at risk, but its line 5 can be in the lines 2 + 5 comparison.
    scored = not {"negative_medicaid_revenue", "medicaid_exceeds_patient_revenue"} & set(flags)
    base.update(
        ccn=row["ccn"], period_begin=row["period_begin"], period_end=row["period_end"], period_days=days,
        factor=factor, status=status_label(row["status"]),
        revenue_line2_5=rev25, has_margin=has_margin, scored=scored, margin_outlier=False,
        cost_ratio=_cost_ratio(base["medicaid_cost"], rev, flags),
        cost_ratio_line2_5=_cost_ratio(base["medicaid_cost"], rev25),
        flags=flags)
    return base


def operating_margin(base):
    """The base's operating margin (G-3 line 5 over line 3); None without usable patient revenue."""
    return base["net_income_patients"] / base["net_patient_revenue"] if base["has_margin"] else None


def flag_margin_outliers(bases, fence=None):
    """Marks, in place, each base whose operating margin falls outside `fence` (default: margin_fence over these
    bases' margins). An outlier stays in the dollar sums but leaves the margin roll-ups. Returns the fence used."""
    bases = list(bases)
    fence = fence or margin_fence(operating_margin(b) for b in bases)
    for b in bases:
        m = operating_margin(b)
        if m is not None and not fence[0] <= m <= fence[1]:
            b["margin_outlier"] = True
            b["flags"].append("margin_outlier")
    return fence


def revenue_at_risk(base, share, line2_5=False):
    """Step 1: the Medicaid revenue base times the state's VIII share; 0 when the base is missing or not positive."""
    revenue = base["revenue_line2_5"] if line2_5 else base["medicaid_net_revenue"]
    if share is None or not base["scored"] or revenue is None or revenue <= 0:
        return 0.0
    if not 0 <= share <= 1:
        raise ExposureError(f"VIII share {share} outside 0..1")
    return revenue * share


def margin_fence(margins, width=2.0):
    """The (low, high) range outside which an operating margin is an outlier: the first and third quartiles widened by
    `width` interquartile ranges (Commonwealth Fund's 2025 screen, Q1 - 2 IQR to Q3 + 2 IQR)."""
    values = sorted(m for m in margins if m is not None)
    if len(values) < 4:
        raise ExposureError("too few margins for a fence")
    q1, _, q3 = statistics.quantiles(values, n=4)
    return q1 - width * (q3 - q1), q3 + width * (q3 - q1)


def _margin(income, revenue):
    return None if income is None or revenue is None or revenue <= 0 else income / revenue


def scenario(base, share, decline, use=params.USE_DEFAULT, line2_5=False):
    """Steps 1 to 4 for one hospital. `share`: the state's VIII share (None: no expansion group); `decline`: the
    state's expansion-enrollment decline for the scenario, a fraction (0.32 for Urban's -32%); `use`: the reader's
    use multiple. Returns the step results; margins are None when the base has no usable patient revenue."""
    if not params.USE_MIN <= use <= params.USE_MAX:
        raise ExposureError(f"use multiple {use} outside {params.USE_MIN}..{params.USE_MAX}")
    if not 0 <= decline <= 1:
        raise ExposureError(f"enrollment decline {decline} outside 0..1")
    at_risk = revenue_at_risk(base, share, line2_5)
    lost = at_risk * decline * use
    ratio = (base["cost_ratio_line2_5"] if line2_5 else base["cost_ratio"]) or 0.0
    lost_cost = lost * ratio
    uninsured = lost_cost * params.UNINSURED_SHARE
    added_uc = uninsured * params.CARE_STILL_USED
    avoided = uninsured - added_uc
    replaced = lost_cost - uninsured
    income_change = -lost + replaced + avoided
    out = {"at_risk": at_risk, "lost": lost, "lost_cost": lost_cost, "added_uncompensated": added_uc,
           "care_avoided": avoided, "other_coverage": replaced, "income_change": income_change}
    npr, oth = base["net_patient_revenue"], base["other_income"] or 0.0
    if base["has_margin"]:
        npr_after = npr - lost + replaced
        nip, ni = base["net_income_patients"], base["net_income"]
        out.update(operating_margin=_margin(nip, npr), operating_margin_after=_margin(nip + income_change, npr_after),
                   total_margin=_margin(ni, npr + oth),
                   total_margin_after=None if ni is None else _margin(ni + income_change, npr_after + oth))
    else:
        out.update(operating_margin=None, operating_margin_after=None, total_margin=None, total_margin_after=None)
    uc = base["uncompensated_cost"]
    out["uncompensated_change"] = added_uc / uc if uc and uc > 0 else None
    return out


def margin_change(result):
    """The scenario's change in operating margin, in percentage points; None without one."""
    before, after = result["operating_margin"], result["operating_margin_after"]
    return None if before is None or after is None else (after - before) * 100
