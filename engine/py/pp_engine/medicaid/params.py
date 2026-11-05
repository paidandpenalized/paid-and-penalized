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

# A cost-report year with fewer than this share of its reports settled is "early" on uncompensated-care figures,
# which change most on settlement (DATA-B-04).
EARLY_SETTLED_SHARE = 0.80

# HCRIS status codes: 1 as submitted, 2 settled without audit, 3 settled with audit, 4 reopened, 5 amended. A
# reopened report was settled first; an amended one is the hospital's own correction, not yet settled.
SETTLED_STATUSES = frozenset({"2", "3", "4"})

# Flows from a period of other than a year (a change of fiscal year puts two periods' starts in one HCRIS year, or a
# hospital files one short period) are put on a 365-day basis. Periods of 360 to 366 days are left as filed.
YEAR_DAYS = 365
FULL_YEAR_DAYS = (360, 366)
# A period this short is annualized but flagged: a few months' flows scaled to a year are unreliable.
SHORT_PERIOD_DAYS = 180

# Medicaid cost (S-10 line 7) per dollar of Medicaid net revenue (line 2) above this is treated as a data error and
# capped here (about the 98th percentile of FY2023 acute and critical access hospitals); the hospital is flagged.
MAX_COST_RATIO = 5.0
