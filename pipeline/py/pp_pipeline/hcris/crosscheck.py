"""Check the tidy HCRIS table against an outside reference and the hospital master.

    python3 -I pipeline/py/pp_pipeline/hcris/cli.py crosscheck <hcris_wide.csv> <year> <reference> <reference.csv> \
        [<hospital_master.json>]

`<reference>` names a column map in REFERENCES: `puf` (CMS's Hospital Provider Cost Report public use file on
data.cms.gov, one file per HCRIS year) or `nber` (NBER's HCRIS extract, `hcris2552_10_<year>.csv`). Only hospital-years
built from one report are compared, matched to the reference on CCN and period (a report's record number is not
stable: CMS gives a settled report a new one). A value counts as equal when it differs by less than 0.5 (the
references round some cells) or both are blank or zero; `close` is within 1%.
"""
import csv
import datetime
import json
from decimal import Decimal, InvalidOperation

REFERENCES = {
    "puf": {
        "key": ("Provider CCN", "Fiscal Year Begin Date", "Fiscal Year End Date"),
        "date": "%m/%d/%Y",
        "columns": {
            "beds": "Number of Beds", "bed_days_available": "Total Bed Days Available",
            "days_medicare": "Total Days Title XVIII", "days_medicaid": "Total Days Title XIX",
            "days_total": "Total Days (V + XVIII + XIX + Unknown)", "fte_employees": "FTE - Employees on Payroll",
            "discharges_medicare": "Total Discharges Title XVIII", "discharges_medicaid": "Total Discharges Title XIX",
            "discharges_total": "Total Discharges (V + XVIII + XIX + Unknown)",
            "patient_revenue_gross": "Total Patient Revenue",
            "contractual_allowances": "Less Contractual Allowance and Discounts on Patients' Accounts",
            "net_patient_revenue": "Net Patient Revenue", "operating_expenses": "Less Total Operating Expense",
            "net_income_patients": "Net Income from Service to Patients", "other_income": "Total Other Income",
            "other_expenses": "Total Other Expenses", "net_income": "Net Income", "s10_ccr": "Cost To Charge Ratio",
            "medicaid_net_revenue": "Net Revenue from Medicaid", "medicaid_charges": "Medicaid Charges",
            "charity_cost": "Cost of Charity Care", "bad_debt_charges": "Total Bad Debt Expense",
            "uncompensated_cost": "Cost of Uncompensated Care",
            "unreimbursed_and_uncompensated": "Total Unreimbursed and Uncompensated Care",
        },
    },
    "nber": {
        "key": ("prvdr_num", "fy_bgn_dt", "fy_end_dt"),
        "date": "%Y-%m-%d",
        "columns": {"patient_revenue_gross": "g3_c1_1", "days_medicaid_managed": "s3_1_c7_2"},
    },
}


def _num(text):  # not pp_engine.parse.num: Decimal, for the 0.5 tolerance
    text = (text or "").strip().replace(",", "").replace("$", "")
    if text in ("", "."):
        return None
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def _iso(text, fmt):
    return datetime.datetime.strptime(text.strip(), fmt).date().isoformat()


def verdict(ours, theirs):
    a, b = ours or Decimal(0), theirs or Decimal(0)
    if abs(a - b) < Decimal("0.5"):
        return "equal"
    if b != 0 and abs(a - b) / abs(b) <= Decimal("0.01"):
        return "close"
    if ours is None or theirs is None:
        return "one_blank"
    return "differ"


def compare(ours_rows, ref_rows, ref):
    """{metric: {verdict: count}} over hospital-years matched to the reference, and the match counts."""
    spec = REFERENCES[ref]
    k_ccn, k_begin, k_end = spec["key"]
    index = {}
    for r in ref_rows:
        index.setdefault((r[k_ccn].strip(), _iso(r[k_begin], spec["date"]), _iso(r[k_end], spec["date"])), []).append(r)
    single = [r for r in ours_rows if r["shape"] == "one"]
    matched = []
    for r in single:
        hits = index.get((r["ccn"], r["period_begin"], r["period_end"]), [])
        if len(hits) == 1:
            matched.append((r, hits[0]))
    result = {}
    for metric, column in spec["columns"].items():
        counts = result.setdefault(metric, {})
        for ours, theirs in matched:
            v = verdict(_num(ours[metric]), _num(theirs[column]))
            counts[v] = counts.get(v, 0) + 1
    return result, {"ours": len(ours_rows), "single_report": len(single), "reference": len(ref_rows),
                    "matched": len(matched)}


def master_join(ours_rows, master):
    """How the year's hospitals and the master's records meet by CCN, by the master's `kind` and by HCRIS's CCN
    range (the last four digits of a CCN say the facility type)."""
    by_ccn = {h["ccn"]: h for h in master["hospitals"]}
    ours = {r["ccn"] for r in ours_rows}
    in_master = ours & set(by_ccn)
    kinds = {}
    for ccn, h in by_ccn.items():
        k = kinds.setdefault(h.get("kind") or "unknown", {"master": 0, "with_report": 0})
        k["master"] += 1
        k["with_report"] += ccn in ours
    ranges = {}
    for ccn in ours - set(by_ccn):
        ranges[ccn_range(ccn)] = ranges.get(ccn_range(ccn), 0) + 1
    return {"hcris_ccns": len(ours), "in_master": len(in_master), "master_ccns": len(by_ccn),
            "master_by_kind": kinds, "hcris_not_in_master_by_range": ranges}


def ccn_range(ccn):
    """The facility type a CCN's last four digits give (CMS's HCRIS facility-numbering table), coarsely."""
    tail = ccn[2:]
    if not tail.isdigit():
        return "lettered (subunit or other)"
    n = int(tail)
    for lo, hi, name in ((1, 879, "short-term acute"), (1300, 1399, "critical access"),
                         (2000, 2299, "long-term care"), (3025, 3099, "rehabilitation"),
                         (3300, 3399, "children's"), (4000, 4499, "psychiatric")):
        if lo <= n <= hi:
            return name
    return "other"


def main(argv):
    if len(argv) not in (4, 5) or argv[2] not in REFERENCES:
        print(__doc__.strip())
        return 2
    wide, year, ref, ref_path = argv[:4]
    with open(wide, newline="", encoding="ascii") as f:
        ours = [r for r in csv.DictReader(f) if r["year"] == year]
    with open(ref_path, newline="", encoding="latin-1") as f:
        theirs = list(csv.DictReader(f))
    result, counts = compare(ours, theirs, ref)
    out = {"year": int(year), "reference": ref, "counts": counts, "metrics": result}
    if len(argv) == 5:
        with open(argv[4], encoding="utf-8") as f:
            out["master"] = master_join(ours, json.load(f))
    print(json.dumps(out, indent=2))
    return 0
