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
import json
import re
import zipfile
from pathlib import Path

from pp_engine.hcris import tidy
from pp_engine.hcris.cells import SHEET_OF, sheets_expected
from pp_pipeline.files import file_sha256 as sha256, zip_member_rows as member_rows

MEMBER = re.compile(r"HOSP10_(\d{4})_(rpt|nmrc|alpha)\.csv", re.IGNORECASE)
REPORT_COLUMNS = (*tidy.PIN_REPORT_COLUMNS[:2], "year", *tidy.PIN_REPORT_COLUMNS[2:])  # report_rows' order
# A file with fewer reports is the newest year's, a handful of short periods; it may lack a worksheet.
MIN_REPORTS_FOR_SHEET_CHECK = 100
# The hospital-year tables (write_tables): each file's header and its rows from a year's hospital-year rows.
TABLES = {"hcris_wide.csv": (tidy.WIDE_COLUMNS, tidy.wide_rows), "hcris_long.csv": (tidy.LONG_COLUMNS, tidy.long_rows)}
REPORTS = "hcris_reports.csv"
OUTPUTS = (*TABLES, REPORTS)


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


def _csv_writer(stack, path, header):
    w = csv.writer(stack.enter_context(open(path, "w", newline="", encoding="ascii")), lineterminator="\n")
    w.writerow(header)
    return w


def write_tables(out_dir, years):
    """Writes `TABLES` to `out_dir` from `years`, an iterable of (year, hospital-year rows), each year's rows as soon
    as they come, so a caller that builds them lazily holds one year at a time. ({year: hospital-years},
    {file name: rows written})."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    by_year, by_file = {}, dict.fromkeys(TABLES, 0)
    with contextlib.ExitStack() as stack:
        writers = {name: (_csv_writer(stack, out_dir / name, header), to_rows)
                   for name, (header, to_rows) in TABLES.items()}
        for year, rows in years:
            for name, (w, to_rows) in writers.items():
                out = to_rows(rows)
                w.writerows(out)
                by_file[name] += len(out)
            by_year[year] = len(rows)
    return by_year, by_file


def run(zip_paths, out_dir):
    """Writes each year's rows as soon as they are built, so a run holds one year at a time. `sources.json` is written
    last, and removed first: a run that stops partway leaves tables with no `sources.json` claiming them."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "sources.json").unlink(missing_ok=True)
    sources = []
    with contextlib.ExitStack() as stack:
        reports_out = _csv_writer(stack, out_dir / REPORTS, REPORT_COLUMNS)

        def years():
            for path in sorted(zip_paths):
                digest, size = sha256(path)  # before parsing, so the pin is of the bytes read (and they are cached)
                year, reports, values = read_year(path)
                if any(s["year"] == year for s in sources):
                    raise tidy.HcrisError(f"two zips for FY{year}")
                rows = tidy.hospital_years(reports, values, year)
                reports_out.writerows(report_rows(year, reports))
                sources.append({"file": Path(path).name, "year": year, "bytes": size, "sha256": digest,
                                "reports": len(reports), "hospital_years": len(rows)})
                yield year, rows

        _, counts = write_tables(out_dir, years())
    counts[REPORTS] = sum(s["reports"] for s in sources)  # one row per report
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
