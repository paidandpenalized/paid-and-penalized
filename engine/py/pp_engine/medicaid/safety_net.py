"""The safety-net flag: ours, from the Medicaid DSH deeming criteria (SSA sec. 1923(b)(1)) as the cost report can
show them; not an official list (params.MIUR_SDS, params.LOW_INCOME_SHARE).

A hospital is flagged when either holds:
- its Medicaid inpatient utilization rate (MIUR; the HCRIS layer's `medicaid_day_share`, S-3 I line 14 col 7 +
  line 2 col 7 over line 14 col 8) is at least one standard deviation above the mean MIUR of the hospitals in its
  state that have Medicaid days. The statute's pool is "hospitals receiving medicaid payments in the State": every
  hospital in CMS's HCRIS hospital file for the state, psychiatric, long-term care and others included, which the
  pipeline pins as `state_stats` rows (a state is a CCN's first two digits, CMS's state code);
- its Medicaid revenue (S-10 I lines 2 + 5) is more than 25% of its net patient revenue (G-3 line 3): the statute's
  low-income utilization rate without its charity term, which the form doesn't split by inpatient and outpatient.
"""
import statistics

from pp_engine.medicaid import params


def state_stats(miurs):
    """(hospitals, mean, sample standard deviation, cut) over one state's MIURs above zero; None with fewer than two."""
    values = [m for m in miurs if m is not None and m > 0]
    if len(values) < 2:
        return None
    mean, sd = statistics.mean(values), statistics.stdev(values)
    return len(values), mean, sd, mean + params.MIUR_SDS * sd


def low_income_share(base):
    """S-10 I lines 2 + 5 over G-3 line 3, or None without both (an exposure base, pp_engine.medicaid.exposure)."""
    npr, rev = base["net_patient_revenue"], base["revenue_line2_5"]
    return rev / npr if npr and npr > 0 and rev is not None else None


def reasons(miur, cut, low_income):
    """Which criteria a hospital meets: a tuple of "miur" and/or "low_income" (empty: not flagged)."""
    out = ()
    if miur is not None and cut is not None and miur >= cut:
        out += ("miur",)
    if low_income is not None and low_income > params.LOW_INCOME_SHARE:
        out += ("low_income",)
    return out
