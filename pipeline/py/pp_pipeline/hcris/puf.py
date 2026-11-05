"""The HCRIS layer against CMS's Hospital Provider Cost Report public use file (PUF), report by report (DATA-B-01: raw
HCRIS is the base, the PUF the check).

    python3 -I pipeline/py/pp_pipeline/hcris/cli.py puf-check <CostReport_<YYYY>_Final.csv> ...
    python3 -I pipeline/py/pp_pipeline/hcris/cli.py puf-sample <out.csv> <CostReport_<YYYY>_Final.csv> ...

CMS builds the PUF (data.cms.gov, one file per HCRIS year) from HCRIS, so for a report the two share (the same
`rpt_rec_num`, so the same version of the report), every compared cell must be equal (crosscheck.verdict: within 0.5,
or 0.0001 for a ratio). A report the PUF has under another number was replaced since the PUF's snapshot (settled or
amended): it is counted as `replaced`, matched on CCN and period, and not held to equality.

`puf-check` compares whole PUF files with the pinned cells tables and prints the counts. `puf-sample` writes the small
extract the offline test reads (`hcris-puf-sample` in the manifest): every in-scope PUF report whose record number is
a multiple of SAMPLE_EVERY, with only the key and the compared columns (no names or addresses).
"""
import csv
import io
import json
import re
import sys
from pathlib import Path

from pp_engine.hcris import tidy
from pp_pipeline.files import read_manifest, read_pinned_bytes
from pp_pipeline.hcris.crosscheck import REFERENCES, parse_date, parse_num, verdict
from pp_pipeline.hcris.pins import pinned_years

SPEC = REFERENCES["puf"]
METRICS = tuple(SPEC["columns"])
SAMPLE_EVERY = 50
SAMPLE_COLUMNS = ("year", "rpt_rec_num", "ccn", "period_begin", "period_end", *METRICS)
SAMPLE_PIN = "hcris-puf-sample"
FILE = re.compile(r"CostReport_(\d{4})_Final\.csv")


def puf_records(rows, year):
    """The PUF's rows in the layer's scope as SAMPLE_COLUMNS dicts (values as the PUF wrote them, trimmed)."""
    k_ccn, k_begin, k_end = SPEC["key"]
    out = []
    for r in rows:
        ccn = r[k_ccn].strip()
        if not tidy.kind_of(ccn):
            continue
        out.append({"year": str(year), "rpt_rec_num": r["rpt_rec_num"].strip(), "ccn": ccn,
                    "period_begin": parse_date(r[k_begin], SPEC["date"]), "period_end": parse_date(r[k_end], SPEC["date"]),
                    **{m: (r[col] or "").strip() for m, col in SPEC["columns"].items()}})
    return out


def compare(reports, values, records):
    """Counts for one year: `same_report` (the PUF's report number is in the cells table), `equal` (of those, every
    metric equal), `replaced` (another number, same CCN and period), `unmatched`, and `differences` (report, metric,
    ours, theirs) for same-report cells that are not equal."""
    by_key = {(r.ccn, r.begin.isoformat(), r.end.isoformat()) for r in reports.values()}
    out = {"puf_reports": len(records), "same_report": 0, "equal": 0, "replaced": 0, "unmatched": 0,
           "differences": []}
    for rec in records:
        rpt = rec["rpt_rec_num"]
        if rpt in reports:
            out["same_report"] += 1
            ours = values.get(rpt, {})
            bad = [(rpt, m, str(ours.get(m, "")), rec[m]) for m in METRICS
                   if verdict(ours.get(m), parse_num(rec[m])) != "equal"]
            out["equal"] += not bad
            out["differences"] += bad
        elif (rec["ccn"], rec["period_begin"], rec["period_end"]) in by_key:
            out["replaced"] += 1
        else:
            out["unmatched"] += 1
    return out


def pinned_reports(year):
    entry = pinned_years(read_manifest())[year]
    return tidy.from_pin_rows(csv.reader(read_pinned_bytes(entry["id"]).decode("ascii").splitlines()), year)


def read_puf(path):
    m = FILE.fullmatch(Path(path).name)
    if not m:
        raise ValueError(f"{path}: not named CostReport_<YYYY>_Final.csv")
    with open(path, newline="", encoding="latin-1") as f:
        return int(m.group(1)), list(csv.DictReader(f))


def sample_bytes(records):
    out = io.StringIO()
    w = csv.DictWriter(out, SAMPLE_COLUMNS, lineterminator="\n")
    w.writeheader()
    w.writerows(sorted((r for r in records if int(r["rpt_rec_num"]) % SAMPLE_EVERY == 0),
                       key=lambda r: (int(r["year"]), int(r["rpt_rec_num"]))))
    return out.getvalue().encode("ascii")


def sample_by_year(data):
    """{year: [record]} from the pinned sample's bytes."""
    out = {}
    for r in csv.DictReader(io.StringIO(data.decode("ascii"))):
        out.setdefault(int(r["year"]), []).append(r)
    return out


def pinned_sample():
    return sample_by_year(read_pinned_bytes(SAMPLE_PIN))


def main_check(paths):
    worst, report = 0, {}
    for path in sorted(paths):
        try:
            year, rows = read_puf(path)
            reports, values = pinned_reports(year)
        except (OSError, KeyError, ValueError, csv.Error) as err:
            print(f"puf-check: {path}: {err!r}")
            return 1
        result = compare(reports, values, puf_records(rows, year))
        worst = max(worst, 1 if result["differences"] else 0)
        report[year] = {**result, "differences": result["differences"][:20]}
    json.dump(report, sys.stdout, indent=2)
    print()
    return worst


def main_sample(out, paths):
    records = []
    for path in paths:
        year, rows = read_puf(path)
        records += puf_records(rows, year)
    data = sample_bytes(records)
    Path(out).write_bytes(data)
    lines = data.count(b"\n") - 1
    print(f"wrote {out}: {lines} reports, {len(data)} bytes")
    return 0
