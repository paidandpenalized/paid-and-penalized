"""Read CMS's HCRIS hospital zips (`HOSP10FY<YYYY>.ZIP`) and write the tidy hospital-by-year table.

    python3 -I pipeline/py/pp_pipeline/hcris/cli.py extract --out <dir> <zip> [<zip> ...]

Each zip's report and numeric members are read as streams, never unzipped to disk (the numeric file is ~670 MB a
year). Writes to `<dir>`: `hcris_wide.csv` (one row per hospital-year, a column per metric), `hcris_long.csv` (one
row per hospital, year and metric), both under the layer's long-year rule (tidy.hospital_years: a year covering more
than 366 days keeps its fullest report; the spike's first runs summed them), `hcris_reports.csv` (one row per cost
report: identity, status and period) and
`sources.json` (each zip's size and SHA-256, and each output's size and row count). The zips are CMS's and change as
reports are filed and settled; `sources.json` is what pins a run.

This is the spike's table: it doesn't read G-3 line 24's labels, so its `line24_*` columns are blank and its
`other_operating_income` and `operating_margin` count lines 8 to 22 only (the layer's v2 method). The layer itself is
`cli.py emit`.
"""
import contextlib
import csv
import hashlib
import json
import re
import zipfile
from pathlib import Path

from pp_engine.hcris import tidy
from pp_engine.hcris.cells import SHEET_OF, sheets_expected
from pp_pipeline.hcris_extract import _member_rows as member_rows

MEMBER = re.compile(r"HOSP10_(\d{4})_(rpt|nmrc|alpha)\.csv", re.IGNORECASE)
REPORT_COLUMNS = ("rpt_rec_num", "ccn", "year", "status", "period_begin", "period_end", "control", "util", "npr_date")
# A file with fewer reports is the newest year's, a handful of short periods; it may lack a worksheet.
MIN_REPORTS_FOR_SHEET_CHECK = 100
OUTPUTS = {"hcris_wide.csv": tidy.WIDE_COLUMNS, "hcris_long.csv": tidy.LONG_COLUMNS,
           "hcris_reports.csv": REPORT_COLUMNS}


def members(zf):
    """{kind: member name} for the zip's report, numeric and alphanumeric members, and the year they share."""
    found, years = {}, set()
    for name in zf.namelist():
        m = MEMBER.fullmatch(name)
        if m:
            years.add(int(m.group(1)))
            found[m.group(2).lower()] = name
    if len(years) != 1 or not {"rpt", "nmrc"} <= set(found):
        raise tidy.HcrisError(f"not an HCRIS hospital zip (members: {zf.namelist()})")
    (year,) = years
    return found, year


def sha256(path):
    digest, size = hashlib.sha256(), 0
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
            size += len(block)
    return digest.hexdigest(), size


def read_year(zip_path, line24=None):
    """(year, reports, values) from one zip. Refuses a full year in which a worksheet read yields no cell at all (a
    layout change, such as padded codes, would otherwise drop it silently). With a dict `line24`, fills it with G-3
    line 24's amounts in the same pass (tidy.collect)."""
    with zipfile.ZipFile(zip_path) as zf:
        names, year = members(zf)
        reports = tidy.parse_reports(member_rows(zf, names["rpt"]), year)
        values = tidy.collect(member_rows(zf, names["nmrc"]), reports, line24)
    seen = {SHEET_OF[m] for v in values.values() for m in v}
    missing = sheets_expected(year) - seen
    if len(reports) >= MIN_REPORTS_FOR_SHEET_CHECK and missing:
        raise tidy.HcrisError(f"FY{year}: no cells read from {sorted(missing)}")
    return year, reports, values


def report_rows(year, reports):
    rows = (tidy.report_cells(r) for r in sorted(reports.values(), key=lambda r: int(r.rpt)))
    return [[*r[:2], str(year), *r[2:]] for r in rows]


def run(zip_paths, out_dir):
    """Writes each year's rows as soon as they are built, so a run holds one year at a time. `sources.json` is written
    last, and removed first: a run that stops partway leaves tables with no `sources.json` claiming them."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "sources.json").unlink(missing_ok=True)
    sources, counts, years = [], dict.fromkeys(OUTPUTS, 0), set()
    with contextlib.ExitStack() as stack:
        writers = {}
        for name, header in OUTPUTS.items():
            w = csv.writer(stack.enter_context(open(out_dir / name, "w", newline="", encoding="ascii")),
                           lineterminator="\n")
            w.writerow(header)
            writers[name] = w
        for path in sorted(zip_paths):
            digest, size = sha256(path)  # before parsing, so the pin is of the bytes read (and they are cached)
            year, reports, values = read_year(path)
            if year in years:
                raise tidy.HcrisError(f"two zips for FY{year}")
            years.add(year)
            rows = tidy.hospital_years(reports, values, year)
            for name, out in (("hcris_wide.csv", tidy.wide_rows(rows)), ("hcris_long.csv", tidy.long_rows(rows)),
                              ("hcris_reports.csv", report_rows(year, reports))):
                writers[name].writerows(out)
                counts[name] += len(out)
            sources.append({"file": Path(path).name, "year": year, "bytes": size, "sha256": digest,
                            "reports": len(reports), "hospital_years": len(rows)})
    outputs = {name: {"bytes": (out_dir / name).stat().st_size, "rows": counts[name]} for name in OUTPUTS}
    (out_dir / "sources.json").write_text(json.dumps({"sources": sources, "outputs": outputs}, indent=2) + "\n")
    return sources, outputs


def main(argv):
    if len(argv) < 3 or argv[0] != "--out":
        print(__doc__.strip())
        return 2
    try:
        sources, outputs = run(argv[2:], argv[1])
    except (tidy.HcrisError, zipfile.BadZipFile, UnicodeDecodeError, csv.Error, OSError) as err:
        print(f"hcris extract: {err}")
        return 1
    for s in sources:
        print(f"FY{s['year']}: {s['reports']} reports, {s['hospital_years']} hospital-years ({s['file']})")
    for name, o in outputs.items():
        print(f"{name}: {o['rows']} rows, {o['bytes']} bytes")
    return 0
