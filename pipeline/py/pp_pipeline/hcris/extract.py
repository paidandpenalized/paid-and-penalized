"""Read CMS's HCRIS hospital zips (`HOSP10FY<YYYY>.ZIP`) and write the tidy hospital-by-year table.

    python3 -I pipeline/py/pp_pipeline/hcris/cli.py extract --out <dir> <zip> [<zip> ...]

Each zip's report and numeric members are read as streams, never unzipped to disk (the numeric file is ~670 MB a
year). Writes to `<dir>`: `hcris_wide.csv` (one row per hospital-year, a column per metric), `hcris_long.csv` (one
row per hospital, year and metric), `hcris_reports.csv` (one row per cost report: identity, status and period) and
`sources.json` (each zip's size and SHA-256, and each output's size and row count). The zips are CMS's and change as
reports are filed and settled; `sources.json` is what pins a run.
"""
import csv
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path

from pp_engine.hcris import tidy
from pp_engine.hcris.cells import S10_HOSPITAL, SHEET_OF, SHEETS

S10_HOSPITAL_FROM = 2023  # S-10 Part II starts with periods beginning 2022-10-01, the FY2023 file

MEMBER = re.compile(r"HOSP10_(\d{4})_(rpt|nmrc|alpha)\.csv", re.IGNORECASE)
REPORT_COLUMNS = ("rpt_rec_num", "ccn", "year", "status", "period_begin", "period_end", "control", "util", "npr_date")


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
    return found, years.pop()


def _rows(zf, member):
    with zf.open(member) as raw:
        yield from csv.reader(io.TextIOWrapper(raw, encoding="ascii", newline=""))


def sha256(path):
    digest, size = hashlib.sha256(), 0
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
            size += len(block)
    return digest.hexdigest(), size


def read_year(zip_path):
    """(year, reports, values) from one zip. Refuses a year in which a worksheet read yields no cell at all (a layout
    change, such as padded codes, would otherwise drop it silently)."""
    with zipfile.ZipFile(zip_path) as zf:
        names, year = members(zf)
        reports = tidy.parse_reports(_rows(zf, names["rpt"]), year)
        values = tidy.collect(_rows(zf, names["nmrc"]), reports)
    seen = {SHEET_OF[m] for v in values.values() for m in v}
    expected = SHEETS - ({S10_HOSPITAL} if year < S10_HOSPITAL_FROM else set())
    if len(reports) > 100 and seen != expected:  # the newest year's file can hold a handful of reports
        raise tidy.HcrisError(f"FY{year}: no cells read from {sorted(expected - seen)}")
    return year, reports, values


def report_rows(year, reports):
    return [[r.rpt, r.ccn, str(year), r.status, r.begin.isoformat(), r.end.isoformat(), r.control, r.util,
             r.npr.isoformat() if r.npr else ""] for r in sorted(reports.values(), key=lambda r: int(r.rpt))]


def write_csv(path, header, rows):
    with open(path, "w", newline="", encoding="ascii") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)
    return {"bytes": path.stat().st_size, "rows": len(rows)}


def run(zip_paths, out_dir):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    wide, long_, reps, sources = [], [], [], []
    for path in sorted(zip_paths):
        year, reports, values = read_year(path)
        rows = tidy.hospital_years(reports, values, year)
        wide += tidy.wide_rows(rows)
        long_ += tidy.long_rows(rows)
        reps += report_rows(year, reports)
        digest, size = sha256(path)
        sources.append({"file": Path(path).name, "year": year, "bytes": size, "sha256": digest,
                        "reports": len(reports), "hospital_years": len(rows)})
    outputs = {
        "hcris_wide.csv": write_csv(out_dir / "hcris_wide.csv", tidy.WIDE_COLUMNS, wide),
        "hcris_long.csv": write_csv(out_dir / "hcris_long.csv", ("ccn", "year", "metric", "value"), long_),
        "hcris_reports.csv": write_csv(out_dir / "hcris_reports.csv", REPORT_COLUMNS, reps),
    }
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
