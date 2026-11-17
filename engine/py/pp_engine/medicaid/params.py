"""The exposure method's constants, each with its source. Changing one is a methods change."""

# Base year: cost reports beginning in federal FY2023 (HCRIS's year convention), and CMS-64 spending for the same
# federal fiscal year (October 2022 through September 2023).
BASE_YEAR = 2023

# Share of people losing Medicaid under the work requirement who become uninsured: CBO's supplemental cost estimate
# for P.L. 119-21, Title VII (2025-10-28), sec. 71119 in 2034: about 5.3 million more uninsured of about 5.7 million
# losing coverage (2.9 million for not meeting the requirement, 2.8 million from the added application steps).
UNINSURED_SHARE = 0.93

# Share of their hospital care the newly uninsured still use: 1 - 0.44. The 44% reduction is a modeling assumption
# "reverse engineered" from an Institute of Medicine review (2003) and a McKinsey model (2013) by Dobson|DaVanzo
# (Commonwealth Fund technical appendix, June 2017, p. 20), not a measured effect.
CARE_STILL_USED = 0.56

# The reader's what-if: how much hospital care the people losing coverage used, as a multiple of the average
# expansion adult's. Default 1 (no adjustment); range 0.75 to 1.25, symmetric because the unwinding evidence leans,
# weakly, toward disenrollees using as much or more care.
USE_MIN = 0.75
USE_DEFAULT = 1.0
USE_MAX = 1.25

# The three scenarios, low to high losses, and the Urban Institute / RWJF (March 2026) Appendix Table A.2 column each
# reads: work-requirement-only declines in 2028 expansion enrollment under high, medium and low state mitigation.
SCENARIOS = (("low", "wr_high_mitigation"), ("middle", "wr_medium_mitigation"), ("high", "wr_low_mitigation"))
SCENARIO_IDS = tuple(s for s, _ in SCENARIOS)

# A hospital-year's values are the HCRIS layer's as filed: a change of fiscal year keeps the fullest single report,
# and nothing is annualized (ARCH-16, decided 2026-11-05). A period shorter than this many days is flagged
# `part_year`: its dollars are that period's, not a year's. Reopened reports count as settled, and the year's "early"
# flag is the layer's (DATA-B-04).
PART_YEAR_DAYS = 360

# The day-count floor on the hospital-specific expansion share (DATA-B-03, decided 2026-11-05, later): a hospital with
# fewer Medicaid inpatient days than this (S-3 I lines 14 + 2 + 32, column 7) keeps its state's VIII share unchanged,
# flagged `few_medicaid_days`. Chosen from the layer's FY2021 to FY2023 files: among hospitals with maternity Medicaid
# days in either year, the median year-to-year move in a hospital's non-maternity share of its Medicaid days is over 5
# points in at least one of the two year pairs in every bin below 200 days (up to 20 points under 25 days), about the
# factor's whole interquartile range (0.98 to 1.04); from 200 days up it is under 5 points in both pairs and falls
# with size (4.9, 3.8 to 4.7, 2.5 to 2.8, 1.6 and 0.7 points for 200-299, 300-499, 500-999, 1,000-4,999 and 5,000+).
MIN_MEDICAID_DAYS = 200

# The operating-margin outlier screen: a margin below Q1 - MARGIN_FENCE_IQR x IQR or above Q3 + MARGIN_FENCE_IQR x IQR
# (over the hospitals rolled up) stays in the dollar sums but leaves the margin roll-ups. Commonwealth Fund's 2025
# screen, Q1 - 2 IQR to Q3 + 2 IQR.
MARGIN_FENCE_IQR = 2.0

# Medicaid cost (S-10 line 7) per dollar of Medicaid net revenue (line 2) above this is treated as a data error and
# capped here (about the 98th percentile of FY2023 acute and critical access hospitals); the hospital is flagged.
MAX_COST_RATIO = 5.0

# The safety-net flag (ours, not an official list): the Medicaid DSH deeming criteria, SSA sec. 1923(b)(1) as read from
# the cost report (research note b1-safety-net, 2026-11-04). A hospital is flagged when its Medicaid inpatient
# utilization rate (S-3 I line 14 col 7 + line 2 col 7, over line 14 col 8) is at least MIUR_SDS standard deviations
# above the mean of every hospital in its state with Medicaid days (all facility types in the HCRIS hospital file),
# or when its Medicaid revenue (S-10 I lines 2 + 5) is more than LOW_INCOME_SHARE of net patient revenue (G-3 line 3).
# The statute's charity term is left out: the form has no inpatient charity split. 87% of Commonwealth Fund's 2025
# safety-net hospitals are flagged, and 87% of flagged hospitals are theirs (FY2023, expansion states).
MIUR_SDS = 1.0
LOW_INCOME_SHARE = 0.25
