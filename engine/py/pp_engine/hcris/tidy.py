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

Readers see two labels, not five codes (`STATUS_LABEL`): "settled" once the contractor has settled the report (codes 2
and 3, and 4, a settled report reopened), "as filed" before that (1, and 5, the hospital's own amended filing). A year
whose share of settled hospital-years, to a whole percent, is under EARLY_BELOW is "early" (`year_summary`):
settlement moves S-10's uncompensated-care figures most, so those pages say so.
"""
import datetime
import re
from collections import namedtuple
from decimal import ROUND_HALF_UP, Decimal

from pp_engine.hcris import other_income
from pp_engine.hcris.cells import BY_KEY, CELLS, DERIVED, G3, LINE24_METRICS, OPERATING_OTHER_INCOME, SHEETS_READ

RPT_FIELDS = 18
NMRC_FIELDS = 5
STATUS = {"1": "as submitted", "2": "settled without audit", "3": "settled with audit", "4": "reopened",
          "5": "amended"}
STATUS_LABEL = {"1": "as filed", "2": "settled", "3": "settled", "4": "settled", "5": "as filed"}
EARLY_BELOW = Decimal("0.80")  # method constant: a year under 80% settled is "early" on S-10 figures
EARLY_PLACES = Decimal("0.01")  # the share is read to a whole percent first: 79.86% is 80%, not early (DATA-B-04)
RATIO_PLACES = Decimal("0.0001")
# The layer's facility scope, by the CCN's last four digits (CMS's HCRIS facility-numbering table, HCRIS_FACILITY_
# NUMBERING.csv in HOSPITAL2010-DOCUMENTATION.ZIP, and the State Operations Manual, ch. 2, sec. 2779A1, Rev. 205,
# 2022-03-11): 0001-0879 short-term (general and specialty) hospitals; 0880-0899, which both reserve for "hospitals
# participating in ORD demonstration project" (only Texas has any: CMS's provider file codes each a short-term
# hospital, and the FY2026 IPPS final rule's impact file pays the eight still open under the IPPS); 1300-1399, which
# the HCRIS table still calls rural primary care hospitals, the program critical access hospitals replaced.
KINDS = (("acute", 1, 899), ("critical_access", 1300, 1399))
CCN = re.compile(r"[0-9A-Z]{6}")
# The two date layouts the layer reads: HCRIS's report file writes MM/DD/YYYY, the pinned cells table YYYY-MM-DD.
DATE_FORMATS = {"MM/DD/YYYY": re.compile(r"(?P<m>\d{2})/(?P<d>\d{2})/(?P<y>\d{4})"),
                "YYYY-MM-DD": re.compile(r"(?P<y>\d{4})-(?P<m>\d{2})-(?P<d>\d{2})")}
NUMBER = other_income.NUMBER

Report = namedtuple("Report", "rpt ccn status begin end control util npr")


class HcrisError(ValueError):
    pass


def _date(text, fmt, where, required=True):
    """The date `text` holds in `fmt` (a DATE_FORMATS key), or None for a blank one that isn't `required`. `where`
    begins the error."""
    if not text and not required:
        return None
    m = DATE_FORMATS[fmt].fullmatch(text)
    try:
        if m:
            return datetime.date(int(m["y"]), int(m["m"]), int(m["d"]))
    except ValueError:  # a day or month out of range
        pass
    raise HcrisError(f"{where} {text!r} is not a date in {fmt}")


def kind_of(ccn):
    """`acute` or `critical_access` from a CCN's facility range (`KINDS`), else None (outside the layer's scope)."""
    tail = ccn[2:]
    if len(ccn) == 6 and tail.isdigit():
        n = int(tail)
        for name, lo, hi in KINDS:
            if lo <= n <= hi:
                return name
    return None


def status_label(codes):
    """"settled" when every report behind a value is settled, else "as filed". `codes`: CMS status codes."""
    return "settled" if codes and all(STATUS_LABEL[c] == "settled" for c in codes) else "as filed"


def filing_due_by(year):
    """The last day a regular 12-month report in the year's file is due: a period beginning 30 September (the year's
    last day) ends 29 September next year, and a report that does not end on a month's last day is due 150 days later
    (42 CFR 413.24(f)(2)(i)). Before then, CMS is still receiving the year's reports. Extensions aside."""
    return datetime.date(year + 1, 9, 29) + datetime.timedelta(days=150)


def federal_fy(day):
    """The federal fiscal year a date falls in (FY2024 is 2023-10-01 through 2024-09-30)."""
    return day.year + 1 if day.month >= 10 else day.year


def _check_report(where, rpt, ccn, status, begin, end, year):
    """The rules every report row meets, whichever file it comes from (the caller checks the number first)."""
    if not CCN.fullmatch(ccn):
        raise HcrisError(f"{where}: report {rpt}: malformed CCN")
    if status not in STATUS:
        raise HcrisError(f"{where}: report {rpt}: unknown status {status!r}")
    if end < begin:
        raise HcrisError(f"{where}: report {rpt}: period ends before it begins")
    if federal_fy(begin) != year:
        raise HcrisError(f"{where}: report {rpt}: period begins {begin}, not in FY{year}")


def parse_reports(rows, year):
    """{report number: Report} from the report file's rows. Refuses a malformed row, a repeated report number, and a
    report whose period does not begin in `year` (the file's year)."""
    reports = {}
    for r in rows:
        if len(r) != RPT_FIELDS:
            raise HcrisError(f"report file: a row of {len(r)} fields, not {RPT_FIELDS}")
        rpt, ccn, status = r[0].strip(), r[2].strip(), r[4].strip()
        if not rpt.isdigit() or rpt in reports:
            raise HcrisError(f"report file: report number {rpt!r} is not a number or appears twice")
        begin = _date(r[5].strip(), "MM/DD/YYYY", f"report {rpt}: FY_BGN_DT")
        end = _date(r[6].strip(), "MM/DD/YYYY", f"report {rpt}: FY_END_DT")
        _check_report("report file", rpt, ccn, status, begin, end, year)
        reports[rpt] = Report(rpt, ccn, status, begin, end, r[1].strip(), r[14].strip(),
                              _date(r[15].strip(), "MM/DD/YYYY", f"report {rpt}: NPR_DT", required=False))
    return reports


def collect(number_rows, reports, line24=None):
    """{report number: {metric: Decimal}} for the cells in `cells.CELLS`, from the numeric file's rows. Rows on
    other worksheets are skipped before anything else is read (they are ~97% of the file). A worksheet's old code
    (`cells.SHEET_ALIASES`) reads as its new one; a report that has a cell under both stops the extract. With a dict
    `line24`, also fills it with {(report number, line code): text} for G-3 line 24 and its subscripts 24.01 to 24.49
    (other_income.py), in the same pass."""
    values = {}
    for r in number_rows:
        if len(r) != NMRC_FIELDS:
            raise HcrisError(f"numeric file: a row of {len(r)} fields, not {NMRC_FIELDS}")
        if r[1] not in SHEETS_READ:
            continue
        rpt, line, column, text = r[0].strip(), r[2].strip(), r[3].strip(), r[4].strip()
        if line24 is not None and r[1] == G3 and column == "00100" and other_income.is_line24(line):
            if rpt not in reports or not NUMBER.fullmatch(text) or (rpt, line) in line24:
                raise HcrisError(f"numeric file: report {rpt!r}, G-3 line {line}: unknown report, not a number, "
                                 "or twice")
            line24[(rpt, line)] = text
        cell = BY_KEY.get((r[1], line, column))
        if cell is None:
            continue
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


def _shape(reps, days):
    """`reps` sorted by period; `days`, the days they cover in all."""
    if len(reps) == 1:
        return "one"
    steps = [(b.begin - a.end).days for a, b in zip(reps, reps[1:])]
    if any(s < 1 for s in steps):
        return "overlap"
    if any(s > 1 for s in steps):
        return "gap"
    return "long" if days > MAX_YEAR_DAYS else "split"


def _fullest(reps):
    """The report covering the most days (then the later end, then the higher report number)."""
    return max(reps, key=lambda r: (_days(r), r.end, int(r.rpt)))


def hospital_years(reports, values, year, line24=None):
    """One row per CCN for the year, from its reports, with what was combined. `shape` names the case: `one` (a single
    report), `split` (periods that meet end to start and cover at most 366 days: a change of ownership, say), `long`
    (more than 366 days in all: a change of fiscal year puts two periods' starts in one year), `gap` or `overlap`
    (periods that don't meet).

    `basis` says how the values were made. Periods that don't overlap and cover at most 366 days in all are added up
    (`sum`: flows added, stocks from the last period that has them); a single report is `report`. Otherwise (`long`,
    `overlap`, a `gap` over 366 days) adding would count more than a year, up to ~90% more, so the row keeps the
    fullest report alone (`fullest`): real filed numbers for one period, one status. `reports`, `status` and the
    period describe the reports used; `n_reports` counts every report the CCN filed in the year. `line24`: {report
    number: {LINE24_METRICS column: Decimal}} (other_income.report_sums), added up like flows; without it those
    columns are blank."""
    line24 = line24 or {}
    by_ccn = {}
    for rep in reports.values():
        by_ccn.setdefault(rep.ccn, []).append(rep)
    out = []
    for ccn in sorted(by_ccn):
        reps = sorted(by_ccn[ccn], key=lambda r: (r.begin, r.end, int(r.rpt)))
        days = sum(_days(r) for r in reps)
        shape = _shape(reps, days)
        if len(reps) == 1:
            basis, used = "report", reps
        elif shape in ("split", "gap") and days <= MAX_YEAR_DAYS:
            basis, used = "sum", reps
        else:
            basis, used = "fullest", [_fullest(reps)]
        last = max(used, key=lambda r: (r.end, int(r.rpt)))
        codes = [r.status for r in used]
        row = {"ccn": ccn, "year": year, "n_reports": len(reps), "shape": shape,
               "reports": " ".join(r.rpt for r in used), "status": " ".join(codes),
               "period_begin": used[0].begin.isoformat(), "period_end": last.end.isoformat(),
               "period_days": days if used is reps else _days(used[0]), "control": last.control,
               "kind": kind_of(ccn), "basis": basis, "status_label": status_label(codes)}
        newest_first = sorted(used, key=lambda r: (r.end, int(r.rpt)), reverse=True)
        for cell in CELLS:
            if cell.kind == "stock":  # from the last period that reports it
                row[cell.metric] = next((v for v in (values.get(r.rpt, {}).get(cell.metric) for r in newest_first)
                                         if v is not None), None)
            else:
                row[cell.metric] = _sum(*(values.get(r.rpt, {}).get(cell.metric) for r in used))
        for metric in LINE24_METRICS:
            row[metric] = _sum(*(line24.get(r.rpt, {}).get(metric) for r in used))
        derive(row)
        out.append(row)
    return out


def year_summary(rows):
    """{"hospital_years", "settled", "settled_share", "early"} over a year's rows: the share of hospital-years whose
    values are all settled (4 places), and whether that share, rounded to a whole percent, is under EARLY_BELOW. An
    empty year is early."""
    settled = sum(r["status_label"] == "settled" for r in rows)
    exact = Decimal(settled) / len(rows) if rows else Decimal(0)
    share = exact.quantize(RATIO_PLACES)
    early = exact.quantize(EARLY_PLACES, rounding=ROUND_HALF_UP) < EARLY_BELOW  # from the exact share: rounded once
    return {"hospital_years": len(rows), "settled": settled, "settled_share": share, "early": early}


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
    "medicaid_days_maternity": lambda g: _sum(g("days_medicaid_nursery"), g("days_medicaid_labor_delivery")),
    "other_operating_income": lambda g: _sum(*(g(m) for m in OPERATING_OTHER_INCOME), g("line24_operating")),
    "patient_margin": lambda g: _ratio(g("net_income_patients"), g("net_patient_revenue")),
    # Blank other operating income counts as zero; a blank line 3 or line 5 leaves the margin blank.
    "operating_margin": lambda g: None if g("net_income_patients") is None or g("net_patient_revenue") is None else
    _ratio(_sum(g("net_income_patients"), g("other_operating_income")),
           _sum(g("net_patient_revenue"), g("other_operating_income"))),
    "total_margin": lambda g: _ratio(g("net_income"), _sum(g("net_patient_revenue"), g("other_income"))),
    "medicaid_payment_to_cost": lambda g: _ratio(_sum(g("medicaid_net_revenue"), g("medicaid_supplemental")),
                                                 g("medicaid_cost")),
    "medicaid_revenue_share": lambda g: _ratio(g("medicaid_net_revenue"), g("net_patient_revenue")),
    "uncompensated_share_of_expenses": lambda g: _ratio(g("uncompensated_cost"), g("operating_expenses")),
}
if list(FORMULAS) != [name for name, _ in DERIVED]:  # derive runs them in DERIVED's order; later ones read earlier
    raise ValueError("tidy.FORMULAS and cells.DERIVED must name the same metrics in the same order")


def derive(row):
    """Adds `cells.DERIVED` to a hospital-year row, in place."""
    for name, _ in DERIVED:
        row[name] = FORMULAS[name](row.get)
    return row


# The spike's ten identity columns first, in its order, then the layer's three.
IDENTITY = ("ccn", "year", "n_reports", "shape", "reports", "status", "period_begin", "period_end", "period_days",
            "control", "kind", "basis", "status_label")
VALUE_COLUMNS = tuple(c.metric for c in CELLS) + LINE24_METRICS + tuple(name for name, _ in DERIVED)
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


LONG_COLUMNS = ("ccn", "year", "period_begin", "period_end", "shape", "basis", "status_label", "metric", "value")


def long_rows(rows):
    """LONG_COLUMNS for every non-blank value, as text: each value with its period, shape and status beside it."""
    return [[r["ccn"], str(r["year"]), r["period_begin"], r["period_end"], r["shape"], r["basis"], r["status_label"],
             m, text(r[m])] for r in rows for m in VALUE_COLUMNS if r.get(m) is not None]


# The per-report cells table: what the repo pins from each year's zip (pp_pipeline.hcris.pins), one row per report in
# the layer's scope, sorted by report number, each cell as `text` writes it. The hospital-year table is rebuilt from it.
PIN_REPORT_COLUMNS = ("rpt_rec_num", "ccn", "status", "period_begin", "period_end", "control", "util", "npr_date")
PIN_COLUMNS = PIN_REPORT_COLUMNS + tuple(c.metric for c in CELLS)


def report_cells(r):
    """A report's PIN_REPORT_COLUMNS, as text."""
    return [r.rpt, r.ccn, r.status, r.begin.isoformat(), r.end.isoformat(), r.control, r.util,
            r.npr.isoformat() if r.npr else ""]


def pin_rows(reports, values):
    """PIN_COLUMNS rows (header first) for `reports` ({report number: Report}) and their `values`."""
    out = [list(PIN_COLUMNS)]
    for rpt in sorted(reports, key=int):
        r, v = reports[rpt], values.get(rpt, {})
        out.append([*report_cells(r), *(text(v.get(c.metric)) for c in CELLS)])
    return out


def from_pin_rows(rows, year):
    """(reports, values) from the per-report cells table's rows (header first), held to the same rules as the zip's:
    the header must be PIN_COLUMNS, each report number appears once, each period begins in `year`, each value is a
    number."""
    rows = iter(rows)
    header = next(rows, None)
    if header != list(PIN_COLUMNS):
        raise HcrisError("cells table: the header is not the layer's columns (a new cell needs a re-derived pin)")
    reports, values = {}, {}
    n = len(PIN_REPORT_COLUMNS)
    for r in rows:
        if len(r) != len(PIN_COLUMNS):
            raise HcrisError(f"cells table: a row of {len(r)} fields, not {len(PIN_COLUMNS)}")
        rpt, ccn, status, begin, end, control, util, npr = r[:n]
        if not rpt.isdigit() or rpt in reports:
            raise HcrisError(f"cells table: report number {rpt!r} is not a number or appears twice")
        where = f"cells table: report {rpt}:"
        rep = Report(rpt, ccn, status, _date(begin, "YYYY-MM-DD", f"{where} period_begin"),
                     _date(end, "YYYY-MM-DD", f"{where} period_end"), control, util,
                     _date(npr, "YYYY-MM-DD", f"{where} npr_date", required=False))
        _check_report("cells table", rpt, ccn, status, rep.begin, rep.end, year)
        reports[rpt] = rep
        got = {}
        for cell, value in zip(CELLS, r[n:]):
            if value == "":
                continue
            if not NUMBER.fullmatch(value):
                raise HcrisError(f"cells table: report {rpt}, {cell.metric}: {value!r} is not a number")
            got[cell.metric] = Decimal(value)
        if got:
            values[rpt] = got
    return reports, values
