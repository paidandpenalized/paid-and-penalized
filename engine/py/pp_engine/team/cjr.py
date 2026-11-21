"""How far hospitals' years in CJR, Medicare's joint-replacement bundle (42 CFR 510), ended from target: the evidence
for the TEAM calculator's default band (the TEAM Methods page, #band).

CMS's CJR final reconciliation file gives, for each participant hospital and performance year, its final episode count
and final reconciliation amount (positive when Medicare paid the hospital, negative when it repaid), but no target
price. So each row's result is approximate: its amount per episode over the CJR-wide average target price per episode
for that year (the evaluation's "Overall Average", pinned by transcription), with the sign turned so that spending over
target is positive. One average stands in for every hospital's own target, which moves a hospital's result most where it
sits far from target. And the amount is not target minus spending alone: it also carries CMS's other adjustments, among
them the recoupment for high post-episode spending, which makes a hospital that owed one look further over target.

The counted rows are those of POOL_YEARS (the years in CMS's workbook with CJR's widest limits on a gain and a
repayment, less performance year 5, EUC_YEAR) and only rows of MIN_EPISODES episodes or more. A zero that hides the result is left out
(`censored`): a hospital whose quality was "Below Acceptable" could not be paid, so its zero may stand for a year under
target; in performance year 1, which had no repayment, a zero may stand for a year over it; and a zero with no quality
category may be a year CMS never reconciled. Each counted row is one hospital's year as CMS's file has it (a hospital
with two rows in a year counts twice).
"""

# CJR's performance years in CMS's workbook (1 to 7; year 8, its last, is not yet in it) with its widest stop-loss and
# stop-gain limits, as the pin spells them, leaving out
# performance year 5 (EUC_YEAR; the pin's 5.1 and 5.2), which had those limits too but which CMS reconciled under its
# COVID-19 extreme and uncontrollable circumstances policy.
POOL_YEARS = ("4", "6", "7")
EUC_YEAR = "5"
# The fewest episodes a row needs to count: a hospital with only a few episodes swings far on one costly case.
MIN_EPISODES = 20
# The half-widths counted, as shares of target. The first is the TEAM calculator's default band (engine/js/team/params.js
# BAND_DEFAULT: pp_pipeline/tests/team/test_cjr.py reads it from there and holds the two equal, and the site's
# sites/team/web/band.js refuses a file without it); the second, twice it, a wider view.
WIDTHS = (0.05, 0.10)

BELOW_ACCEPTABLE = "Below Acceptable"  # the file's lowest quality category: no reconciliation payment
NO_REPAYMENT_YEAR = "1"  # performance year 1 had no downside


def spending_vs_target(amount, episodes, target):
    """(actual - target) / target, approximately: a final reconciliation amount is roughly (target - actual) summed over
    the episodes (with the adjustments the module docstring names), so minus the amount per episode over the average
    target per episode."""
    return -(amount / episodes) / target


def censored(row):
    """Whether a row's zero amount hides its result (the module docstring)."""
    return row["amount"] == 0 and (row["quality"] in (BELOW_ACCEPTABLE, "") or row["py"] == NO_REPAYMENT_YEAR)


def spread(rows, targets):
    """What the Methods page and the calculator's "why?" state about CJR's spread, from the reconciliation rows
    ([{py, quality, episodes (int), amount (float)}]) and each year's average target price ({py: dollars}):

    years, minEpisodes   the method constants (POOL_YEARS, MIN_EPISODES)
    eucYear              the year with those limits left out (EUC_YEAR)
    targets              the average target price of each counted year
    rows                 the rows of those years with an episode
    censored             of those, the zeros left out
    small                of the rest, the rows under MIN_EPISODES episodes
    n                    the rows counted
    within               per WIDTHS: {width, n}, the counted rows whose |spending vs target| is within the width
    """
    missing = [py for py in POOL_YEARS if py not in targets]
    if missing:
        raise ValueError(f"CJR targets: no average target price for performance year {', '.join(missing)}")
    pool = [r for r in rows if r["py"] in POOL_YEARS and r["episodes"] > 0]
    kept = [r for r in pool if not censored(r)]
    counted = [r for r in kept if r["episodes"] >= MIN_EPISODES]
    if not counted:
        raise ValueError("CJR reconciliation: no row to count")
    x = [spending_vs_target(r["amount"], r["episodes"], targets[r["py"]]) for r in counted]
    return {"years": list(POOL_YEARS), "eucYear": EUC_YEAR, "minEpisodes": MIN_EPISODES,
            "targets": {py: targets[py] for py in POOL_YEARS},
            "rows": len(pool), "censored": len(pool) - len(kept), "small": len(kept) - len(counted), "n": len(counted),
            "within": [{"width": w, "n": sum(abs(v) <= w for v in x)} for w in WIDTHS]}
