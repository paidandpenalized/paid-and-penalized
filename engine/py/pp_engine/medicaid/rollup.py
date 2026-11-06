"""State and national roll-ups of the per-hospital results: dollars add up; margins and percent changes are recomputed
from the sums (a group's margin is its total income over its total revenue, not an average of hospitals' margins)."""
from pp_engine.medicaid import exposure

DOLLARS = ("at_risk", "lost", "lost_cost", "added_uncompensated", "care_avoided", "other_coverage", "income_change")


def into_red(result):
    """Whether the scenario turns a non-negative total margin negative."""
    before, after = result["total_margin"], result["total_margin_after"]
    return before is not None and after is not None and before >= 0 > after


def roll_up(pairs):
    """Totals over (base, result) pairs. Operating-margin sums cover hospitals with usable patient revenue whose
    operating margin isn't an outlier; total-margin sums, those of them that also report net income; the
    uncompensated-care percent, those that report a positive uncompensated care cost. The revenue and income after
    are exposure.scenario's; this only sums them."""
    out = {k: 0.0 for k in DOLLARS}
    out.update(hospitals=0, exposed=0, medicaid_revenue=0.0, uncompensated_cost=0.0, uc_added_where_reported=0.0,
               margin_hospitals=0, into_red=0, falls_1pp=0)
    npr = 0.0  # net patient revenue (G-3 line 3) of the margin hospitals
    rev = inc = rev_after = inc_after = 0.0  # operating margin: G-3 lines 3 and 5, each plus other operating income
    npr_t = ni = oth = npr_t_after = ni_after = 0.0  # total margin
    for base, res in pairs:
        out["hospitals"] += 1
        out["exposed"] += res["lost"] > 0
        if base["scored"]:
            out["medicaid_revenue"] += base["medicaid_net_revenue"] or 0.0
        for k in DOLLARS:
            out[k] += res[k] or 0.0
        if (base["uncompensated_cost"] or 0) > 0:
            out["uncompensated_cost"] += base["uncompensated_cost"]
            out["uc_added_where_reported"] += res["added_uncompensated"]
        if base["has_margin"] and not base["margin_outlier"]:
            out["margin_hospitals"] += 1
            npr += base["net_patient_revenue"]
            rev += res["operating_revenue"]
            inc += res["operating_income"]
            rev_after += res["operating_revenue_after"]
            inc_after += res["operating_income_after"]
            change = exposure.margin_change(res)
            if change is not None and change <= -1:
                out["falls_1pp"] += 1
            if base["net_income"] is not None:
                npr_t += base["net_patient_revenue"]
                npr_t_after += res["net_patient_revenue_after"]
                ni += base["net_income"]
                ni_after += res["net_income_after"]
                oth += base["other_income"] or 0.0
                out["into_red"] += into_red(res)
    out["operating_margin"] = _ratio(inc, rev)
    out["operating_margin_after"] = _ratio(inc_after, rev_after)
    out["total_margin"] = _ratio(ni, npr_t + oth)
    out["total_margin_after"] = _ratio(ni_after, npr_t_after + oth)
    out["net_patient_revenue"] = npr
    out["lost_share_of_medicaid"] = _ratio(out["lost"], out["medicaid_revenue"])
    out["lost_share_of_at_risk"] = _ratio(out["lost"], out["at_risk"])
    out["uncompensated_change"] = _ratio(out["uc_added_where_reported"], out["uncompensated_cost"])
    return out


def _ratio(num, den):
    return num / den if den > 0 else None
