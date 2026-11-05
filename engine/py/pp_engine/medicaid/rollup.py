"""State and national roll-ups of the per-hospital results: dollars add up; margins and percent changes are recomputed
from the sums (a group's margin is its total income over its total revenue, not an average of hospitals' margins)."""
from pp_engine.medicaid import exposure

DOLLARS = ("at_risk", "lost", "lost_cost", "added_uncompensated", "care_avoided", "other_coverage", "income_change")


def _add(total, value):
    return total + (value or 0.0)


def into_red(result):
    """Whether the scenario turns a non-negative total margin negative."""
    before, after = result["total_margin"], result["total_margin_after"]
    return before is not None and after is not None and before >= 0 > after


def roll_up(pairs):
    """Totals over (base, result) pairs. Margin sums cover only hospitals with usable patient revenue whose operating
    margin isn't an outlier; the uncompensated-care percent covers only those that report it."""
    out = {k: 0.0 for k in DOLLARS}
    out.update(hospitals=0, exposed=0, medicaid_revenue=0.0, uncompensated_cost=0.0, uc_added_where_reported=0.0,
               margin_hospitals=0, into_red=0, falls_1pp=0)
    npr = nip = ni = oth = npr_after = nip_after = ni_after = 0.0
    for base, res in pairs:
        out["hospitals"] += 1
        out["exposed"] += res["lost"] > 0
        if base["scored"]:
            out["medicaid_revenue"] += base["medicaid_net_revenue"]
        for k in DOLLARS:
            out[k] = _add(out[k], res[k])
        if base["uncompensated_cost"]:
            out["uncompensated_cost"] += base["uncompensated_cost"]
            out["uc_added_where_reported"] += res["added_uncompensated"]
        if base["has_margin"] and not base["margin_outlier"] and base["net_income"] is not None:
            out["margin_hospitals"] += 1
            npr += base["net_patient_revenue"]
            nip += base["net_income_patients"]
            ni += base["net_income"]
            oth += base["other_income"] or 0.0
            npr_after += base["net_patient_revenue"] - res["lost"] + res["other_coverage"]
            nip_after += base["net_income_patients"] + res["income_change"]
            ni_after += base["net_income"] + res["income_change"]
            if into_red(res):
                out["into_red"] += 1
            change = exposure.margin_change(res, "operating_margin")
            if change is not None and change <= -1:
                out["falls_1pp"] += 1
    out["operating_margin"] = nip / npr if npr > 0 else None
    out["operating_margin_after"] = nip_after / npr_after if npr_after > 0 else None
    out["total_margin"] = ni / (npr + oth) if npr + oth > 0 else None
    out["total_margin_after"] = ni_after / (npr_after + oth) if npr_after + oth > 0 else None
    out["net_patient_revenue"] = npr
    out["lost_share_of_medicaid"] = out["lost"] / out["medicaid_revenue"] if out["medicaid_revenue"] else None
    out["lost_share_of_at_risk"] = out["lost"] / out["at_risk"] if out["at_risk"] else None
    out["uncompensated_change"] = (out["uc_added_where_reported"] / out["uncompensated_cost"]
                                   if out["uncompensated_cost"] else None)
    return out
