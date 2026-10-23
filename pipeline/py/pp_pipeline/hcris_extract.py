"""Derive the committed HCRIS extract the dollar back-test reads from CMS's hospital cost report file for FY2024.

CMS's HCRIS zip (Form CMS-2552-10, `HOSP10FY2024.ZIP`) is 136 MB and unzips to 673 MB, far over the repo's 10 MiB limit,
so the repo pins a subset: one row per cost report in the zip's report file (`HOSP10_2024_rpt.csv`), with the report's
identity, the worksheets the back-test checks for, and the Worksheet E Part A cells it reads from the numeric file
(`HOSP10_2024_nmrc.csv`), sorted by report number. The two members are read as streams from the zip, never unzipped
to disk. The manifest entry's `derivedFrom` records the zip's size, SHA-256 and CMS URL; anyone with that zip can
re-run this and get the same bytes:

    python3 -I pipeline/py/run.py extract-hcris <path to HOSP10FY2024.ZIP>

CMS regenerates the HCRIS zips as reports are filed, amended and settled (this one's Last-Modified was 2026-10-05), so
the SHA-256 is that of the copy retrieved on 2026-10-23; a later download of the same URL will differ.

The layout, from CMS's HCRIS documentation and the files themselves: neither member has a header row. A report row is
RPT_REC_NUM, PRVDR_CTRL_TYPE_CD, PRVDR_NUM, NPI, RPT_STUS_CD, FY_BGN_DT, FY_END_DT, PROC_DT, INITL_RPT_SW, LAST_RPT_SW,
TRNSMTL_NUM, FI_NUM, ADR_VNDR_CD, FI_CREAT_DT, UTIL_CD, NPR_DT, SPEC_IND, FI_RCPT_DT; a numeric row is RPT_REC_NUM,
WKSHT_CD, LINE_NUM, CLMN_NUM, ITM_VAL_NUM. Lines and columns are five digits, the line or column number times 100
(line 70.99 is 07099, column 1 is 00100). A zero value is not stored.
"""
import csv
import datetime
import hashlib
import io
import re
import zipfile
from pathlib import Path

from pp_pipeline.files import PINNED_DIR, manifest_entry

PIN_ID = "hcris-fy2024-wse"
REPORTS, NUMBERS = "HOSP10_2024_rpt.csv", "HOSP10_2024_nmrc.csv"
RPT_FIELDS = 18
RPT = {"rpt": 0, "ccn": 2, "status": 4, "begin": 5, "end": 6}  # positions in a report row
NMRC_FIELDS = 5

PART_A = "E00A18A"  # Worksheet E, Part A: inpatient hospital services under IPPS
# Worksheet E, Part A for the share of a period a hospital spent in the Pennsylvania Rural Health Model (PRM-II
# ch. 40, 4030.1: such a hospital completes Worksheet E, Part A "for the portion of the cost reporting period included
# in the demonstration"). The back-test leaves those reports out; the extract only says whether one is there.
PARHM = "E00S18A"
# The Worksheet E, Part A lines read, each with the chapter's words for it (PRM-II ch. 40, Transmittal 25, 2026-02-27,
# 4030.1). The first group is the back-test's ground truth; the second explains its misses (in the report it prints).
LINES = (
    ("00101", "1.01: DRG payments \"paid for PPS discharges and transfers occurring prior to October 1\""),
    ("00102", "1.02: DRG payments \"paid for PPS discharges and transfers occurring on or after October 1\""),
    ("07090", "70.90: \"For MDH use only. Enter the hospital value-based purchasing (HVBP) adjustment amount relative "
              "to the HSP bonus payment\""),
    ("07091", "70.91: \"For MDH use only. Enter the hospital readmission reduction (HRR) adjustment amount relative to "
              "the HSP bonus payment\""),
    ("07093", "70.93: \"the payment adjustment amount for the HVBP program\""),
    ("07094", "70.94: \"the adjustment amount resulting from the HRR program\""),
    ("07099", "70.99: \"the HAC program payment reduction adjustment amount\" (line 71 subtracts it)"),
    ("04700", "47: \"the sum of lines 1, 1.01, 1.02, 2, 2.01, 2.02, 2.03, 2.04, 29, 34, 36, and 46\""),
    ("04900", "49: the operating payment, \"the greater of line 47 or 48\" for an SCH"),
    ("05000", "50: \"the payment for inpatient program capital costs\""),
    ("05400", "54: \"the special add-on payment for new technologies\""),
)
# The columns a line may carry: column 1, and 1.01 where the hospital's status changed during the period (the
# chapter's subscripted columns). Any other column on a line read here stops the extract.
COLUMNS_READ = ("00100", "00101")
CELLS = tuple(f"l{line}_c{col}" for line, _ in LINES for col in COLUMNS_READ)
COLUMNS = ("rpt_rec_num", "ccn", "status", "fy_begin", "fy_end", "part_a", "parhm", *CELLS)
_LINES = {line for line, _ in LINES}
DATE = re.compile(r"(\d{2})/(\d{2})/(\d{4})")
NUMBER = re.compile(r"-?\d+(\.\d+)?")


def _iso(text, what):
    m = DATE.fullmatch(text.strip())
    if not m:
        raise ValueError(f"HCRIS report file: {what} {text!r} is not MM/DD/YYYY")
    month, day, year = (int(g) for g in m.groups())
    return datetime.date(year, month, day).isoformat()


def extract(report_rows, number_rows):
    """The extract's text from the two members' rows (lists of cells): COLUMNS, one row per report, sorted by report
    number (as a number), '\\n' line ends. `part_a` and `parhm` are Y or N; a cell is the numeric file's value as
    written, blank where the file stores none (a zero)."""
    reports = {}
    for r in report_rows:
        if len(r) != RPT_FIELDS:
            raise ValueError(f"HCRIS report file: a row of {len(r)} fields, not {RPT_FIELDS}")
        rpt = r[RPT["rpt"]].strip()
        if not rpt.isdigit() or rpt in reports:
            raise ValueError(f"HCRIS report file: report number {rpt!r} is not a number or appears twice")
        ccn = r[RPT["ccn"]].strip()
        if not re.fullmatch(r"[0-9A-Z]{6}", ccn):
            raise ValueError(f"HCRIS report file: report {rpt} has a malformed CCN")
        reports[rpt] = {"rpt_rec_num": rpt, "ccn": ccn, "status": r[RPT["status"]].strip(),
                        "fy_begin": _iso(r[RPT["begin"]], "FY_BGN_DT"), "fy_end": _iso(r[RPT["end"]], "FY_END_DT"),
                        "part_a": "N", "parhm": "N"}
    for r in number_rows:
        if len(r) != NMRC_FIELDS:
            raise ValueError(f"HCRIS numeric file: a row of {len(r)} fields, not {NMRC_FIELDS}")
        rpt, sheet, line, col, value = (c.strip() for c in r)
        if sheet not in (PART_A, PARHM):
            continue
        if rpt not in reports:
            raise ValueError(f"HCRIS numeric file: report {rpt!r} is not in the report file")
        row = reports[rpt]
        if sheet == PARHM:
            row["parhm"] = "Y"
            continue
        row["part_a"] = "Y"
        if line not in _LINES:
            continue
        if col not in COLUMNS_READ:
            raise ValueError(f"HCRIS numeric file: report {rpt}, Worksheet E Part A line {line} has column {col}, "
                             f"not one of {COLUMNS_READ}")
        if not NUMBER.fullmatch(value):
            raise ValueError(f"HCRIS numeric file: report {rpt}, line {line} column {col}: {value!r} is not a number")
        cell = f"l{line}_c{col}"
        if cell in row:
            raise ValueError(f"HCRIS numeric file: report {rpt}, line {line} column {col} appears twice")
        row[cell] = value
    out = io.StringIO()
    w = csv.writer(out, lineterminator="\n")
    w.writerow(COLUMNS)
    for rpt in sorted(reports, key=int):
        w.writerow([reports[rpt].get(c, "") for c in COLUMNS])
    return out.getvalue()


def _member_rows(zf, member):
    """A member's CSV rows, read as a stream (the numeric file is too large to hold as one string)."""
    with zf.open(member) as raw:
        yield from csv.reader(io.TextIOWrapper(raw, encoding="ascii", newline=""))


def derive(zip_path, source):
    """The extract's bytes from the zip at `zip_path`, refused unless its size and SHA-256 are the manifest's
    (`source`, the entry's derivedFrom)."""
    digest, size = hashlib.sha256(), 0
    with open(zip_path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
            size += len(block)
    if (size, digest.hexdigest()) != (source["bytes"], source["sha256"]):
        raise ValueError(f"not the zip the manifest names ({source['file']}, {source['sha256']})")
    with zipfile.ZipFile(zip_path) as zf:  # zipfile checks each member's CRC-32 as it reads
        return extract(_member_rows(zf, source["members"][0]), _member_rows(zf, source["members"][1])).encode("ascii")


def main(zip_path):
    entry = manifest_entry(PIN_ID)
    try:
        out = derive(Path(zip_path), entry["derivedFrom"])
    except (ValueError, KeyError, zipfile.BadZipFile, UnicodeDecodeError) as err:
        print(f"{zip_path}: {err}")
        return 1
    path = PINNED_DIR / entry["path"]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(out)
    sha = hashlib.sha256(out).hexdigest()
    print(f"wrote {entry['path']}: {len(out)} bytes, sha256 {sha}")
    if (len(out), sha) != (entry["bytes"], entry["sha256"]):
        print(f"the manifest entry {PIN_ID} records {entry['bytes']} bytes, sha256 {entry['sha256']}")
        return 1
    return 0
