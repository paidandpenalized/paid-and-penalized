"""Derive the CJR reconciliation pin (data/pinned/cjr/reconciliation-py1-7.csv) from CMS's CJR final reconciliation
workbook, and record it in the manifest. The raw workbook stays out of git.

    python3 -I pipeline/py/run.py derive-cjr <workbook> --retrieved YYYY-MM-DD --last-modified YYYY-MM-DD [--repin]

`--retrieved` is the day the workbook was downloaded and `--last-modified` CMS's Last-Modified date for it, as its
server gave it. The workbook has one sheet per performance year ("PY1 CJRREC" to "PY7 CJRREC", PY5 in two, 5.1 and 5.2),
one row per participant hospital with CJR episodes in the year; the pin keeps, per row, the year (as the sheet names it,
"PY" dropped), the CCN (six digits), the final quality category, the final episode count, the final reconciliation
amount and whether the hospital met CJR's rural definition that year (Y or N; 42 CFR 510.2): the columns
pp_engine.team.cjr reads, and the CCN, so a row can be traced to CMS's. Its headers differ by year ("PY1 Final CJR
Episode Count (as of March 1, 2018)*", "PY6 CJR Episode Count*"), so each is found by its start, and the rural one by
its start and its year ("Meets CJR Rural definition (42 CFR 510.2) for PY5.1"); every year's sheet has one. A sheet with
none, or two, of a column is refused, as is a rural cell other than Y or N.

Its companion pin, `cjr-target-averages` (data/pinned/cjr/target-averages.csv), is a hand transcription of one line of a
figure in the CJR evaluation's seventh annual report; its manifest entry records the report's URL and SHA-256.

A derived pin whose bytes differ from the committed manifest entry is refused, by name, unless --repin
(pp_pipeline.team.derive.write_pins).
"""
import argparse
import hashlib
import math
import re
from collections import Counter
from pathlib import Path

from pp_engine import xlsx
from pp_engine.team.cjr import BELOW_ACCEPTABLE
from pp_pipeline.files import file_sha256
from pp_pipeline.team.derive import _check_date, _csv, write_pins

PIN_ID = "cjr-reconciliation"
TARGETS_ID = "cjr-target-averages"
COLUMNS = ("py", "ccn", "quality", "episodes", "amount", "rural")
YEARS = ("1", "2", "3", "4", "5.1", "5.2", "6", "7")  # the workbook's performance years, in its sheet order
QUALITY = ("Excellent", "Good", "Acceptable", BELOW_ACCEPTABLE, "")  # the final quality categories; '' for none
RURAL = ("Y", "N")  # the rural column's values: met CJR's rural definition that year, or not
# The summary rows under each year's table, as CMS labels them in the CCN column: the totals of the episode count and
# amount columns (checked against the hospital rows), and the average amount per episode (in the episode count column).
TOTALS_ROW = "Totals row"
SUMMARY_ROWS = (TOTALS_ROW, "Average row")
TOTAL_TOLERANCE = 0.005  # dollars: half a cent, for the workbook's own summing of the amounts in binary floating point
SOURCE = {
    "title": "CJR final reconciliation payments, performance years 1 to 7 (CMS): each participant hospital's final "
             "quality category, episode count and reconciliation amount per year, and whether it met CJR's rural "
             "definition that year",
    "path": "cjr/reconciliation-py1-7.csv", "file": "cjr-final-reconciliation-payments-yrs1-7.xlsx",
    "downloadUrl": "https://www.cms.gov/files/document/cjr-final-reconciliation-payments-yrs1-7.xlsx",
    "landingPage": "https://www.cms.gov/priorities/innovation/innovation-models/cjr"}


def sheet_of(py):
    return f"PY{py} CJRREC"


def _column(header, py, name):
    """The index of the one header that starts 'PY<py> ' then, optionally, 'Final ', then `name`."""
    return _one(header, py, re.compile(rf"PY{re.escape(py)} (Final )?{re.escape(name)}").match, f"starting {name!r}")


def _rural_column(header, py):
    """The index of the one header that starts 'Meets CJR Rural definition' and ends 'for PY<py>' (a footnote's '*'
    allowed)."""
    pattern = re.compile(rf"Meets CJR Rural definition\b.* for PY{re.escape(py)}\*?")
    return _one(header, py, pattern.fullmatch, "for CJR's rural definition")


def _one(header, py, test, what):
    hits = [j for j, h in enumerate(header) if test(h.strip())]
    if len(hits) != 1:
        raise ValueError(f"CJR workbook, {sheet_of(py)}: expected one column {what}, found {len(hits)}")
    return hits[0]


def _number(text, what):
    try:
        v = float(text)
    except ValueError:
        v = math.nan
    if not math.isfinite(v):
        raise ValueError(f"CJR workbook: {what} {text!r} is not a number")
    return v


def _whole(text, what):
    v = _number(text, what)
    if v != int(v) or v < 0:
        raise ValueError(f"CJR workbook: {what} {text!r} is not a whole count")
    return int(v)


def year_rows(sheet, py):
    """[[py, ccn, quality, episodes, amount, rural]] from one year's sheet rows: every row under the header whose first
    cell is a CCN. A row whose first cell is not one is skipped: a note under the table, a blank row, "End of worksheet",
    and the two summary rows CMS labels in that cell (SUMMARY_ROWS). A summary "Totals row" is checked: its episode count
    must equal the hospital rows' sum and its amount their sum to within TOTAL_TOLERANCE. Any other skipped row that
    carries an episode count, an amount or a quality category is refused (as is a sheet without exactly one Totals row), naming its sheet and its place among the rows under the header
    (the reader drops empty rows, so not the sheet's own row number), so a hospital whose CCN the workbook stores
    another way (as a number, say) is never dropped unseen."""
    at = next((i for i, r in enumerate(sheet) if r and r[0].strip() == "CCN"), None)
    if at is None:
        raise ValueError(f"CJR workbook, {sheet_of(py)}: no header row starting 'CCN'")
    header = sheet[at]
    cols = [*(_column(header, py, name) for name in ("Quality Performance Category", "CJR Episode Count",
                                                     "Reconciliation Amount")), _rural_column(header, py)]
    out, totals = [], []
    for i, r in enumerate(sheet[at + 1:], start=1):
        ccn = r[0].strip() if r else ""
        quality, episodes, amount, rural = ((r[j] if j < len(r) else "").strip() for j in cols)
        if not re.fullmatch(r"[0-9]{5,6}", ccn):
            if ccn == TOTALS_ROW:
                totals.append((episodes, amount))
            elif ccn not in SUMMARY_ROWS and (episodes or amount or quality):
                raise ValueError(f"CJR workbook, {sheet_of(py)}: row {i} under the header has an episode count, an "
                                 "amount or a quality category but its first cell is not a CCN (five or six digits)")
            continue
        if quality not in QUALITY:
            raise ValueError(f"CJR workbook, {sheet_of(py)}: unknown quality category {quality!r}")
        if rural not in RURAL:
            raise ValueError(f"CJR workbook, {sheet_of(py)}: a rural flag of {rural!r}, not Y or N")
        # float repr is the shortest text that reads back as the stored double (the workbook stores 0.1 steps as
        # '-134267.18150000001')
        out.append([py, ccn.zfill(6), quality, _whole(episodes, "an episode count"),
                    repr(_number(amount, "a reconciliation amount")), rural])
    if not out:
        raise ValueError(f"CJR workbook, {sheet_of(py)}: no hospital rows")
    if len(totals) != 1:
        raise ValueError(f"CJR workbook, {sheet_of(py)}: expected one Totals row to check the hospital rows against, "
                         f"found {len(totals)}")
    for episodes, amount in totals:
        if _whole(episodes, "a total episode count") != sum(r[3] for r in out) or abs(
                _number(amount, "a total amount") - math.fsum(float(r[4]) for r in out)) > TOTAL_TOLERANCE:
            raise ValueError(f"CJR workbook, {sheet_of(py)}: the hospital rows do not add up to its Totals row")
    return out


def reconciliation(data):
    """(csv text, counts) from the workbook's bytes: every year's rows, in year order, by CCN within a year (a hospital
    with two rows in a year keeps both, in the workbook's order)."""
    body = []
    for py in YEARS:
        body += sorted(year_rows(xlsx.sheet_rows(data, sheet_of(py), "CJR workbook"), py), key=lambda r: r[1])
    return _csv(COLUMNS, body), {"rows": len(body), "byYear": dict(Counter(r[0] for r in body))}


def build(path, retrieved, last_modified):
    """{PIN_ID: (CSV bytes, manifest entry)} from the workbook at `path`."""
    _check_date(retrieved, "retrieved")
    _check_date(last_modified, "last-modified")
    path = Path(path)
    if path.name != SOURCE["file"]:
        raise ValueError(f"expected CMS's file name {SOURCE['file']}, got {path.name}")
    text, counts = reconciliation(path.read_bytes())
    data = text.encode("utf-8")
    sha, size = file_sha256(path)
    entry = {"id": PIN_ID, "title": SOURCE["title"], "path": SOURCE["path"], "bytes": len(data),
             "sha256": hashlib.sha256(data).hexdigest(),
             "derivedFrom": {"file": SOURCE["file"], "bytes": size, "sha256": sha, "downloadUrl": SOURCE["downloadUrl"],
                             "lastModified": last_modified},
             "derivedBy": "pipeline/py/pp_pipeline/team/cjr.py", "landingPage": SOURCE["landingPage"],
             "retrieved": retrieved, "counts": counts}
    return {PIN_ID: (data, entry)}


def main(argv):
    parser = argparse.ArgumentParser(prog="run.py derive-cjr", description="Derive the CJR reconciliation pin.")
    parser.add_argument("workbook", help=f"CMS's {SOURCE['file']}")
    parser.add_argument("--retrieved", required=True, help="the day it was downloaded (YYYY-MM-DD)")
    parser.add_argument("--last-modified", required=True, help="CMS's Last-Modified date for it (YYYY-MM-DD)")
    parser.add_argument("--repin", action="store_true", help="write a pin whose bytes differ from the manifest entry")
    args = parser.parse_args(argv)
    return write_pins(build(args.workbook, args.retrieved, args.last_modified), args.repin, command="derive-cjr")
