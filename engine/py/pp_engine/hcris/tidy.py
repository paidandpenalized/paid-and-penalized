"""HCRIS cost reports to a tidy hospital-by-year table. Pure: rows in, rows out (the caller reads the files).

HCRIS's hospital file for a year (`HOSP10FY<YYYY>.ZIP`) holds three headerless CSV members: the report file (one row
per cost report), the numeric file (one row per non-zero numeric cell) and the alphanumeric file. A year's file holds
the reports whose period *begins* in that federal fiscal year (October through September): the FY2024 file runs from
periods beginning 2023-10-01 to periods beginning 2024-09-30, so most of its periods end in FY2025. That is the year
this table keys on (`year`), CMS's own convention for cost-report years (e.g., "FY 2021 cost reports" in the IPPS
uncompensated-care rules).

Each file holds the highest-status version CMS has of each report (HCRIS documentation: a settled report replaces the
as-submitted one, a reopened report the settled one), so a later download can change any number. `status` keeps
CMS's code: 1 as submitted, 2 settled without audit, 3 settled with audit, 4 reopened, 5 amended.

A zero is not stored in the numeric file, so a blank cell means zero *or* not reported; the table can't tell them
apart and leaves it blank.
"""
import datetime
import re
from collections import namedtuple
from decimal import Decimal

from pp_engine.hcris.cells import BY_KEY, CELLS, DERIVED, SHEETS_READ

RPT_FIELDS = 18
NMRC_FIELDS = 5
STATUS = {"1": "as submitted", "2": "settled without audit", "3": "settled with audit", "4": "reopened",
          "5": "amended"}
CCN = re.compile(r"[0-9A-Z]{6}")
DATE = re.compile(r"(\d{2})/(\d{2})/(\d{4})")
NUMBER = re.compile(r"-?(\d+(\.\d*)?|\.\d+)")

Report = namedtuple("Report", "rpt ccn status begin end control util npr")


class HcrisError(ValueError):
    pass


def _date(text, what, rpt, required=True):
    text = text.strip()
    if not text and not required:
        return None
    m = DATE.fullmatch(text)
    if not m:
        raise HcrisError(f"report {rpt}: {what} {text!r} is not MM/DD/YYYY")
    month, day, year = (int(g) for g in m.groups())
    return datetime.date(year, month, day)


def federal_fy(day):
    """The federal fiscal year a date falls in (FY2024 is 2023-10-01 through 2024-09-30)."""
    return day.year + 1 if day.month >= 10 else day.year


def parse_reports(rows, year):
    """{report number: Report} from the report file's rows. Refuses a malformed row, a repeated report number, and a
    report whose period does not begin in `year` (the file's year)."""
    reports = {}
    for r in rows:
        if len(r) != RPT_FIELDS:
            raise HcrisError(f"report file: a row of {len(r)} fields, not {RPT_FIELDS}")
        rpt = r[0].strip()
        if not rpt.isdigit() or rpt in reports:
            raise HcrisError(f"report file: report number {rpt!r} is not a number or appears twice")
        ccn = r[2].strip()
        if not CCN.fullmatch(ccn):
            raise HcrisError(f"report {rpt}: malformed CCN")
        status = r[4].strip()
        if status not in STATUS:
            raise HcrisError(f"report {rpt}: unknown status {status!r}")
        begin, end = _date(r[5], "FY_BGN_DT", rpt), _date(r[6], "FY_END_DT", rpt)
        if end < begin:
            raise HcrisError(f"report {rpt}: period ends before it begins")
        if federal_fy(begin) != year:
            raise HcrisError(f"report {rpt}: period begins {begin}, not in FY{year}")
        reports[rpt] = Report(rpt, ccn, status, begin, end, r[1].strip(), r[14].strip(),
                              _date(r[15], "NPR_DT", rpt, required=False))
    return reports


def collect(number_rows, reports):
    """{report number: {metric: Decimal}} for the cells in `cells.CELLS`, from the numeric file's rows. Rows on
    other worksheets are skipped before anything else is read (they are ~97% of the file). A worksheet's old code
    (`cells.SHEET_ALIASES`) reads as its new one; a report that has a cell under both stops the extract."""
    values = {}
    for r in number_rows:
        if len(r) != NMRC_FIELDS:
            raise HcrisError(f"numeric file: a row of {len(r)} fields, not {NMRC_FIELDS}")
        if r[1] not in SHEETS_READ:
            continue
        cell = BY_KEY.get((r[1], r[2].strip(), r[3].strip()))
        if cell is None:
            continue
        rpt, text = r[0].strip(), r[4].strip()
        if rpt not in reports:
            raise HcrisError(f"numeric file: report {rpt!r} is not in the report file")
        if not NUMBER.fullmatch(text):
            raise HcrisError(f"numeric file: report {rpt}, {cell.metric}: {text!r} is not a number")
        row = values.setdefault(rpt, {})
        if cell.metric in row:
            raise HcrisError(f"numeric file: report {rpt}, {cell.metric} appears twice")
        row[cell.metric] = Decimal(text)
    return values


MAX_YEAR_DAYS = 366  # periods adding up to more than this are a `long` year (two periods' starts in one year)


def _days(report):
    return (report.end - report.begin).days + 1


def hospital_years(reports, values, year):
    """One row per CCN for the year: its reports combined (flows added, stocks from the last period that has them), with
    what was combined. `shape` names the case: `one` (a single report), `split` (periods that meet end to start and
    cover at most 366 days: a change of ownership, say), `long` (more than 366 days in all: a change of fiscal year
    puts two periods' starts in one year), `gap` or `overlap` (periods that don't meet)."""
    by_ccn = {}
    for rep in reports.values():
        by_ccn.setdefault(rep.ccn, []).append(rep)
    out = []
    for ccn in sorted(by_ccn):
        reps = sorted(by_ccn[ccn], key=lambda r: (r.begin, r.end, int(r.rpt)))
        days = sum(_days(r) for r in reps)
        if len(reps) == 1:
            shape = "one"
        else:
            steps = [(b.begin - a.end).days for a, b in zip(reps, reps[1:])]
            if any(s < 1 for s in steps):
                shape = "overlap"
            elif any(s > 1 for s in steps):
                shape = "gap"
            else:
                shape = "long" if days > MAX_YEAR_DAYS else "split"
        last = max(reps, key=lambda r: (r.end, int(r.rpt)))
        row = {"ccn": ccn, "year": year, "n_reports": len(reps), "shape": shape,
               "reports": " ".join(r.rpt for r in reps), "status": " ".join(r.status for r in reps),
               "period_begin": reps[0].begin.isoformat(), "period_end": last.end.isoformat(), "period_days": days,
               "control": last.control}
        newest_first = sorted(reps, key=lambda r: (r.end, int(r.rpt)), reverse=True)
        for cell in CELLS:
            if cell.kind == "stock":  # from the last period that reports it
                row[cell.metric] = next((v for v in (values.get(r.rpt, {}).get(cell.metric) for r in newest_first)
                                         if v is not None), None)
            else:
                row[cell.metric] = _sum(*(values.get(r.rpt, {}).get(cell.metric) for r in reps))
        derive(row)
        out.append(row)
    return out


RATIO_PLACES = Decimal("0.0001")


def _ratio(num, den):
    if num is None or den is None or den == 0:
        return None
    return (num / den).quantize(RATIO_PLACES)


def _sum(*parts):
    present = [p for p in parts if p is not None]
    return sum(present, Decimal(0)) if present else None


# The formulas behind `cells.DERIVED` (which names them in words), in its order; each reads the row as built so far.
FORMULAS = {
    "medicaid_days_all": lambda g: _sum(g("days_medicaid"), g("days_medicaid_managed")),
    "medicaid_day_share": lambda g: _ratio(g("medicaid_days_all"), g("days_total")),
    "medicare_day_share": lambda g: _ratio(_sum(g("days_medicare"), g("days_medicare_advantage")), g("days_total")),
    "occupancy": lambda g: _ratio(g("days_total"), g("bed_days_available")),
    "operating_margin": lambda g: _ratio(g("net_income_patients"), g("net_patient_revenue")),
    "total_margin": lambda g: _ratio(g("net_income"), _sum(g("net_patient_revenue"), g("other_income"))),
    "medicaid_payment_to_cost": lambda g: _ratio(_sum(g("medicaid_net_revenue"), g("medicaid_supplemental")),
                                                 g("medicaid_cost")),
    "medicaid_revenue_share": lambda g: _ratio(g("medicaid_net_revenue"), g("net_patient_revenue")),
    "uncompensated_share_of_expenses": lambda g: _ratio(g("uncompensated_cost"), g("operating_expenses")),
}


def derive(row):
    """Adds `cells.DERIVED` to a hospital-year row, in place."""
    for name, _ in DERIVED:
        row[name] = FORMULAS[name](row.get)
    return row


IDENTITY = ("ccn", "year", "n_reports", "shape", "reports", "status", "period_begin", "period_end", "period_days",
            "control")
VALUE_COLUMNS = tuple(c.metric for c in CELLS) + tuple(name for name, _ in DERIVED)
WIDE_COLUMNS = IDENTITY + VALUE_COLUMNS


def text(value):
    """A cell as the table writes it: blank for None, a Decimal in plain notation without trailing zeros."""
    if value is None:
        return ""
    if isinstance(value, Decimal):
        t = format(value.normalize(), "f")
        return "0" if t == "-0" else t
    return str(value)


def wide_rows(rows):
    """Each hospital-year row as a list in WIDE_COLUMNS order, as text."""
    return [[text(r.get(c)) for c in WIDE_COLUMNS] for r in rows]


def long_rows(rows):
    """(ccn, year, metric, value) for every non-blank value, as text."""
    return [[r["ccn"], str(r["year"]), m, text(r[m])] for r in rows for m in VALUE_COLUMNS if r.get(m) is not None]
