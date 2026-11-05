"""The cost-report cells the HCRIS layer reads, each named by worksheet, line and column of Form CMS-2552-10.

Source for every cell: the Provider Reimbursement Manual, Part 2 (CMS Pub. 15-2), chapter 40, Transmittal 25 (the
form's instructions): section 4005.1 for Worksheet S-3 Part I, 4012 for Worksheet S-10, 4040.4 for Worksheet G-3.
HCRIS's numeric file keys a cell by WKSHT_CD (S-3 Part I is S300001, S-10 Part I S100001 and Part II S100002, G-3
G300000; CMS's HOSP2010 worksheet-code list), LINE_NUM and CLMN_NUM, each five digits: the line or column number
times 100 (line 24.50 is 02450, column 1 is 00100).

`kind` says how a cell combines when one hospital files more than one report for a year (a change of ownership or of
fiscal year splits the year into short periods): a `flow` (dollars, days, discharges) adds up across the periods; a
`stock` (a count at the period's end, or a ratio) is taken from the period that ends last.
"""
from collections import namedtuple

# `since`: the first HCRIS year whose reports carry the cell (None: every year of the form).
Cell = namedtuple("Cell", "metric sheet line column kind label since", defaults=(None,))

S3 = "S300001"  # Worksheet S-3, Part I: hospital and hospital health care complex statistical data
S10 = "S100001"  # Worksheet S-10, Part I: uncompensated and indigent care, the whole hospital complex
# Before Part II was added (periods beginning on or after 2022-10-01), S-10 was one part, coded S100000, with the
# same lines and columns as today's Part I (4012: "Worksheet S-10 is Worksheet S-10, Part I"). Read as Part I.
S10_BEFORE_PARTS = "S100000"
SHEET_ALIASES = {S10_BEFORE_PARTS: S10}
S10_HOSPITAL = "S100002"  # Worksheet S-10, Part II: the same for the hospital CCN only (periods from 2022-10-01)
G3 = "G300000"  # Worksheet G-3: statement of revenues and expenses, the whole facility

CELLS = (
    # Worksheet S-3, Part I. Line 14 is the hospital total (lines 7 through 13: adults and pediatrics, swing beds,
    # intensive care units, nursery), without subproviders (lines 16-18) or other components. Column 6 is title XVIII
    # (Medicare), 7 title XIX (Medicaid), 8 all patients. Medicaid managed-care and other Medicaid-eligible days are
    # on line 2, column 7, not in line 14 (4005.1, note for column 7; 42 CFR 412.106(b)(4)(ii)); line 14, column 8
    # includes every class of patient, HMO days among them.
    Cell("beds", S3, "01400", "00200", "stock", "S-3 I line 14 col 2: beds available at the end of the period"),
    Cell("bed_days_available", S3, "01400", "00300", "flow", "S-3 I line 14 col 3: bed days available"),
    Cell("days_medicare", S3, "01400", "00600", "flow", "S-3 I line 14 col 6: title XVIII inpatient days"),
    Cell("days_medicaid", S3, "01400", "00700", "flow", "S-3 I line 14 col 7: title XIX inpatient days"),
    Cell("days_total", S3, "01400", "00800", "flow", "S-3 I line 14 col 8: inpatient days, all patients"),
    Cell("days_medicare_advantage", S3, "00200", "00600", "flow", "S-3 I line 2 col 6: Medicare Advantage days"),
    Cell("days_medicaid_managed", S3, "00200", "00700", "flow",
         "S-3 I line 2 col 7: Medicaid HMO and other Medicaid-eligible days not on line 1"),
    Cell("fte_employees", S3, "01400", "01000", "stock", "S-3 I line 14 col 10: average FTE employees on payroll"),
    Cell("discharges_medicare", S3, "01400", "01300", "flow", "S-3 I line 14 col 13: title XVIII discharges"),
    Cell("discharges_medicaid", S3, "01400", "01400", "flow", "S-3 I line 14 col 14: title XIX discharges"),
    Cell("discharges_total", S3, "01400", "01500", "flow", "S-3 I line 14 col 15: discharges, all patients"),
    # Worksheet G-3 (one column).
    Cell("patient_revenue_gross", G3, "00100", "00100", "flow", "G-3 line 1: total patient revenues (charges)"),
    Cell("contractual_allowances", G3, "00200", "00100", "flow",
         "G-3 line 2: allowances and discounts on patients' accounts"),
    Cell("net_patient_revenue", G3, "00300", "00100", "flow", "G-3 line 3: net patient revenues"),
    Cell("operating_expenses", G3, "00400", "00100", "flow", "G-3 line 4: total operating expenses"),
    Cell("net_income_patients", G3, "00500", "00100", "flow", "G-3 line 5: net income from service to patients"),
    Cell("covid_phe_funding", G3, "02450", "00100", "flow", "G-3 line 24.50: COVID-19 PHE funding"),
    Cell("other_income", G3, "02500", "00100", "flow", "G-3 line 25: total other income"),
    Cell("other_expenses", G3, "02800", "00100", "flow", "G-3 line 28: total other expenses"),
    Cell("net_income", G3, "02900", "00100", "flow", "G-3 line 29: net income (or loss) for the period"),
    # Worksheet S-10, Part I (the whole complex). Line 2 is Medicaid net revenue, fee-for-service and managed care,
    # net of associated provider taxes; line 5 the Medicaid DSH and supplemental payments not already in line 2;
    # line 8 the shortfall, line 7 minus lines 2 and 5, entered as zero when payments exceed cost.
    Cell("s10_ccr", S10, "00100", "00100", "stock", "S-10 I line 1: cost-to-charge ratio"),
    Cell("medicaid_net_revenue", S10, "00200", "00100", "flow", "S-10 I line 2: Medicaid net revenue"),
    Cell("medicaid_supplemental", S10, "00500", "00100", "flow",
         "S-10 I line 5: Medicaid DSH and supplemental payments not in line 2"),
    Cell("medicaid_charges", S10, "00600", "00100", "flow", "S-10 I line 6: Medicaid charges"),
    Cell("medicaid_cost", S10, "00700", "00100", "flow", "S-10 I line 7: Medicaid cost (line 1 times line 6)"),
    Cell("medicaid_shortfall", S10, "00800", "00100", "flow",
         "S-10 I line 8: Medicaid cost less payments (zero if payments exceed cost)"),
    Cell("chip_shortfall", S10, "01200", "00100", "flow", "S-10 I line 12: stand-alone CHIP shortfall"),
    Cell("indigent_program_shortfall", S10, "01600", "00100", "flow",
         "S-10 I line 16: state or local indigent care program shortfall"),
    Cell("unreimbursed_government", S10, "01900", "00100", "flow",
         "S-10 I line 19: total unreimbursed cost, Medicaid, CHIP and indigent programs"),
    Cell("charity_charges", S10, "02000", "00300", "flow", "S-10 I line 20 col 3: charity care charges"),
    Cell("charity_cost_uninsured", S10, "02300", "00100", "flow",
         "S-10 I line 23 col 1: cost of charity care, uninsured patients"),
    Cell("charity_cost_insured", S10, "02300", "00200", "flow",
         "S-10 I line 23 col 2: cost of charity care, insured patients"),
    Cell("charity_cost", S10, "02300", "00300", "flow", "S-10 I line 23 col 3: cost of charity care"),
    Cell("bad_debt_charges", S10, "02600", "00100", "flow", "S-10 I line 26: bad debts written off (charges)"),
    Cell("bad_debt_cost", S10, "02900", "00100", "flow",
         "S-10 I line 29: cost of non-Medicare and nonreimbursable Medicare bad debt"),
    Cell("uncompensated_cost", S10, "03000", "00100", "flow",
         "S-10 I line 30: cost of uncompensated care (line 23 col 3 plus line 29)"),
    Cell("unreimbursed_and_uncompensated", S10, "03100", "00100", "flow",
         "S-10 I line 31: unreimbursed and uncompensated care (lines 19 plus 30)"),
    # Worksheet S-10, Part II (hospital CCN only; periods beginning on or after 2022-10-01). A subset of Part I.
    Cell("hospital_charity_cost", S10_HOSPITAL, "02300", "00300", "flow", "S-10 II line 23 col 3: charity care cost",
         2023),
    Cell("hospital_bad_debt_cost", S10_HOSPITAL, "02900", "00100", "flow", "S-10 II line 29: bad debt cost", 2023),
    Cell("hospital_uncompensated_cost", S10_HOSPITAL, "03000", "00100", "flow",
         "S-10 II line 30: cost of uncompensated care", 2023),
)

METRICS = tuple(c.metric for c in CELLS)
SHEET_OF = {c.metric: c.sheet for c in CELLS}
# Every (worksheet code, line, column) read, old codes included, to its cell: one lookup per numeric row.
BY_KEY = {(c.sheet, c.line, c.column): c for c in CELLS}
BY_KEY.update({(old, line, col): c for (sheet, line, col), c in list(BY_KEY.items())
               for old, new in SHEET_ALIASES.items() if sheet == new})
SHEETS_READ = frozenset(sheet for sheet, _, _ in BY_KEY)


def sheets_expected(year):
    """The worksheets a full year's file must yield cells from."""
    return {c.sheet for c in CELLS if c.since is None or year >= c.since}

# Metrics computed from the cells above, on the hospital-year row. Each: (name, formula in words). The formulas are
# in tidy.derive. A ratio is blank when its denominator is missing or zero.
DERIVED = (
    ("medicaid_days_all", "days_medicaid + days_medicaid_managed (S-3 I line 14 col 7 + line 2 col 7)"),
    ("medicaid_day_share", "medicaid_days_all / days_total"),
    ("medicare_day_share", "(days_medicare + days_medicare_advantage) / days_total"),
    ("occupancy", "days_total / bed_days_available"),
    ("operating_margin", "net_income_patients / net_patient_revenue (G-3 line 5 / line 3)"),
    ("total_margin", "net_income / (net_patient_revenue + other_income) (G-3 line 29 / (line 3 + line 25))"),
    ("medicaid_payment_to_cost", "(medicaid_net_revenue + medicaid_supplemental) / medicaid_cost"),
    ("medicaid_revenue_share", "medicaid_net_revenue / net_patient_revenue (S-10 I line 2 / G-3 line 3)"),
    ("uncompensated_share_of_expenses", "uncompensated_cost / operating_expenses (S-10 I line 30 / G-3 line 4)"),
)

# Each column's unit, for readers: dollars (whole or cents, as filed), days, discharges, beds, fte (full-time
# equivalents), ratio (a fraction, 4 places: 0.0500 is 5%). Every metric and derived column has one.
_UNIT_OF_CELL = {
    "beds": "beds", "bed_days_available": "days", "fte_employees": "fte", "s10_ccr": "ratio",
    **{m: "days" for m in ("days_medicare", "days_medicaid", "days_total", "days_medicare_advantage",
                          "days_medicaid_managed")},
    **{m: "discharges" for m in ("discharges_medicare", "discharges_medicaid", "discharges_total")},
}
UNITS = {**{c.metric: _UNIT_OF_CELL.get(c.metric, "dollars") for c in CELLS},
         "medicaid_days_all": "days", **{name: "ratio" for name, _ in DERIVED if name != "medicaid_days_all"}}
# S-10 cells: the ones settlement revises most (the spike's drift study), which a year's `early` flag is about.
S10_METRICS = frozenset(c.metric for c in CELLS if c.sheet in (S10, S10_HOSPITAL)) | {
    "medicaid_payment_to_cost", "uncompensated_share_of_expenses"}
