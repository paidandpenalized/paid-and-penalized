"""Build the HCRIS layer from its pins and write data/emitted/hcris/fy<YYYY>/hcris.json, one file per HCRIS year.

    python3 -I pipeline/py/pp_pipeline/hcris/cli.py emit
    python3 -I pipeline/py/pp_pipeline/hcris/cli.py downloads <dir>

`emit` rebuilds every year whose cells table is pinned (manifest ids `hcris-fy<YYYY>-cells`, pins.py), with the
year's line-24 table (`hcris-fy<YYYY>-g3-line24`) sorted by the rules in `other_income_rules.csv` (other_income.py),
whose path and SHA-256 each file records (`otherIncomeRules`). Each file is the data contract's envelope, the year's facts (CMS's label, the posting, whether CMS is still receiving the year's
reports, the settled share and the "early" flag) and the hospital-year table as `columns` plus one array per hospital
(`hospitals`, one line each, so a refresh's diff shows each hospital that moved). A rebuild that changes nothing keeps
the committed built_at. A file of 10 MiB or more is refused (the repo's limit).

`downloads` writes the build-time download files to <dir> (never committed): `hcris_wide.csv` (every year, a column
per metric) and `hcris_long.csv` (one row per hospital, year and metric, with its period and status). Sites that read
the layer use pp_engine.hcris.reader on `load_years()`.
"""
import csv
import datetime
import hashlib
from datetime import timezone
from decimal import Decimal
from pathlib import Path

from pp_engine.contract import envelope, format_emitted
from pp_engine.hcris import other_income, reader, tidy
from pp_pipeline.files import EMITTED_DIR, REPO_ROOT, read_json, read_manifest, read_pinned_bytes, write_emitted
from pp_pipeline.hcris.pins import line24_pin_id, pinned_years

SCHEMA_VERSION, METHODS_VERSION = 3, 3
SCHEMA = "hcris.schema.json"
MAX_BYTES = 10 * 1024 * 1024  # CLAUDE.md: a file of 10 MiB or more never goes in git
LONG_RULE = "fullest"
# The JSON's columns: the table's, less `year` (the file's `fy`).
COLUMNS = tuple(c for c in tidy.WIDE_COLUMNS if c != "year")
RULES_PATH = Path(__file__).with_name("other_income_rules.csv")


def rules_bytes():
    return RULES_PATH.read_bytes()


def rules():
    return other_income.parse_rules(csv.reader(rules_bytes().decode("ascii").splitlines()))


def _pinned_rows(pid):
    return csv.reader(read_pinned_bytes(pid).decode("ascii").splitlines())


def line24_entries(year):
    """The year's pinned line-24 entries (other_income.from_pin_rows)."""
    return other_income.from_pin_rows(_pinned_rows(line24_pin_id(year)))


def year_rows(entry, year, rule_set=None):
    """The year's hospital-year rows from its pinned cells table and line-24 table, the line-24 entries summed by the
    class their label sorts into."""
    reports, values = tidy.from_pin_rows(_pinned_rows(entry["id"]), year)
    for rpt, sums in other_income.report_sums(line24_entries(year), rule_set or rules()).items():
        if rpt not in reports:
            raise tidy.HcrisError(f"FY{year} line-24 table: report {rpt} is not in the cells table")
        values.setdefault(rpt, {}).update(sums)
    return tidy.hospital_years(reports, values, year, long_rule=LONG_RULE)


def _json(value):
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    return value


def build(year, manifest, built_at, rows=None):
    entry = pinned_years(manifest)[year]
    rows = year_rows(entry, year) if rows is None else rows
    summary = tidy.year_summary(rows)
    posted = entry["derivedFrom"]["lastModified"]
    due = tidy.filing_due_by(year)
    return {
        **envelope(SCHEMA_VERSION, METHODS_VERSION, [entry["id"], line24_pin_id(year)], manifest, built_at, year),
        "label": reader.label(year),
        "periodsBegin": [f"{year - 1}-10-01", f"{year}-09-30"],
        "posted": posted,
        "filingDueBy": due.isoformat(),
        "stillFiling": datetime.date.fromisoformat(posted) <= due,
        "kinds": [name for name, _, _ in tidy.KINDS],
        "longRule": LONG_RULE,
        "settledShare": float(summary["settled_share"]),
        "earlyBelow": float(tidy.EARLY_BELOW),
        "early": summary["early"],
        "otherIncomeRules": {"path": RULES_PATH.relative_to(REPO_ROOT).as_posix(),
                             "sha256": hashlib.sha256(rules_bytes()).hexdigest()},
        "columns": list(COLUMNS),
        "hospitals": [[_json(r[c]) for c in COLUMNS] for r in rows],
    }


def emitted_path(year):
    return EMITTED_DIR / "hcris" / f"fy{year}" / "hcris.json"


def check(doc):
    """Problems the schema can't state: a row of the wrong length, a repeated CCN, a CCN outside the scope, or a file
    at the size limit."""
    width, problems, seen = len(doc["columns"]), [], set()
    kind = doc["columns"].index("kind")
    for row in doc["hospitals"]:
        if len(row) != width:
            problems.append(f"{row[0]}: {len(row)} values, not {width}")
        if row[0] in seen:
            problems.append(f"{row[0]}: twice")
        seen.add(row[0])
        if row[kind] not in doc["kinds"]:
            problems.append(f"{row[0]}: kind {row[kind]!r} is outside the layer's scope")
    size = len(format_emitted(doc).encode("utf-8"))
    if size >= MAX_BYTES:
        problems.append(f"{size} bytes: at or over the 10 MiB limit")
    return problems


def main():
    built_at = datetime.datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    manifest = read_manifest()
    years = pinned_years(manifest)
    if not years:
        print("hcris emit: no pinned cells tables (hcris-fy<YYYY>-cells) in the manifest")
        return 1
    worst = 0
    for year in sorted(years):
        fresh = build(year, manifest, built_at)
        problems = check(fresh)
        path = emitted_path(year)
        if problems:
            print(f"not written ({path.relative_to(REPO_ROOT)}): " + "; ".join(problems[:5]))
            worst = 1
            continue
        out = write_emitted(path, fresh, SCHEMA)
        print(f"wrote {path.relative_to(REPO_ROOT)}: {len(out['hospitals'])} hospitals, "
              f"{path.stat().st_size} bytes, settled {out['settledShare']:.1%}{', early' if out['early'] else ''}"
              f"{', still filing' if out['stillFiling'] else ''}")
    return worst


def load_years():
    """Every emitted year's parsed file, oldest first (for pp_engine.hcris.reader.Panel)."""
    return [read_json(p) for p in sorted((EMITTED_DIR / "hcris").glob("fy*/hcris.json"))]


def write_downloads(out_dir):
    """The download files, from the pins (the same rows as the emitted files)."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    counts = {}
    with open(out_dir / "hcris_wide.csv", "w", newline="", encoding="ascii") as fw, \
            open(out_dir / "hcris_long.csv", "w", newline="", encoding="ascii") as fl:
        wide, long_ = csv.writer(fw, lineterminator="\n"), csv.writer(fl, lineterminator="\n")
        wide.writerow(tidy.WIDE_COLUMNS)
        long_.writerow(tidy.LONG_COLUMNS)
        rule_set = rules()
        for year, entry in sorted(pinned_years(read_manifest()).items()):
            rows = year_rows(entry, year, rule_set)
            wide.writerows(tidy.wide_rows(rows))
            long_.writerows(tidy.long_rows(rows))
            counts[year] = len(rows)
    return counts
