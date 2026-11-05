"""Derive the HCRIS layer's pinned inputs: one per-report cells table per HCRIS year, from CMS's zip.

    python3 -I pipeline/py/pp_pipeline/hcris/cli.py pin <HOSP10FY<YYYY>.ZIP> ...
    python3 -I pipeline/py/pp_pipeline/hcris/cli.py pin --entries <entries.json> <zip> ...

A year's zip (136 MB, 820 MB unzipped) is far over the repo's 10 MiB limit, so the repo pins what the layer reads from
it, two tables per year, both for the reports from acute and critical access hospitals (`tidy.kind_of`):
- `data/pinned/hcris-fy<YYYY>/hcris_fy<YYYY>_cells.csv` (`hcris-fy<YYYY>-cells`): one row per report, with its identity
  and every cell in `cells.CELLS` (`tidy.PIN_COLUMNS`);
- `data/pinned/hcris-fy<YYYY>/hcris_fy<YYYY>_g3_line24.csv` (`hcris-fy<YYYY>-g3-line24`): G-3 line 24 and its
  subscripts 24.01 to 24.49, one row per entry with an amount: the report, the line, the hospital's label (the
  alphanumeric file) and the amount (`other_income.PIN_COLUMNS`), sorted by report number and line.
Each manifest entry records the zip in `derivedFrom`: size, SHA-256, CMS URL, Last-Modified, and its content address in
the R2 archive (archive.py). Anyone with that zip gets the same bytes.

With a manifest entry, `pin` writes the table only when it is the entry's bytes (files.write_derived_pin). With
`--entries`, it writes the tables and the manifest entries they need to `<entries.json>`, for a first pin or a new
posting; the entries then go into data/pinned/manifest.json.
"""
import argparse
import csv
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path

from pp_engine.hcris import other_income, tidy
from pp_engine.hcris.cells import G3
from pp_pipeline.files import read_manifest, write_derived_pin
from pp_pipeline.hcris.extract import members, read_year, sha256

FORM_PAGE = "https://www.cms.gov/data-research/statistics-trends-and-reports/cost-reports/hospital-2552-2010-form"
DOWNLOAD = "https://downloads.cms.gov/FILES/HCRIS/HOSP10FY{year}.ZIP"
BUCKET = "pp-sources"  # ARCH-17 option (c): content-addressed objects, `sha256/<hex>`
DERIVED_BY = "pipeline/py/pp_pipeline/hcris/pins.py"


PIN_ID = re.compile(r"hcris-fy(\d{4})-cells")
ALPHA_FIELDS = 5
LABEL_COLUMN = "00000"  # the alphanumeric file's column for a line's label


def pin_id(year):
    return f"hcris-fy{year}-cells"


def line24_pin_id(year):
    return f"hcris-fy{year}-g3-line24"


def pinned_years(manifest):
    """{year: manifest entry} for every pinned cells table."""
    return {int(m.group(1)): e for e in manifest for m in [PIN_ID.fullmatch(e["id"])] if m}


def pin_path(year):
    return f"hcris-fy{year}/hcris_fy{year}_cells.csv"


def line24_pin_path(year):
    return f"hcris-fy{year}/hcris_fy{year}_g3_line24.csv"


def archive_key(digest):
    return f"sha256/{digest}"


def _csv_bytes(rows):
    out = io.StringIO()
    csv.writer(out, lineterminator="\n").writerows(rows)
    return out.getvalue().encode("ascii")


def in_scope(reports):
    """The reports from acute and critical access hospitals (tidy.kind_of)."""
    return {k: r for k, r in reports.items() if tidy.kind_of(r.ccn)}


def labels(alpha_rows, scoped):
    """{(report number, line code): label} for G-3 line 24 and its subscripts, from the alphanumeric file's rows, for
    the reports in `scoped`. A label that isn't printable ASCII, or a second label for one line, stops the pin."""
    out = {}
    for r in alpha_rows:
        if len(r) != ALPHA_FIELDS:
            raise tidy.HcrisError(f"alphanumeric file: a row of {len(r)} fields, not {ALPHA_FIELDS}")
        if r[1] != G3 or r[3].strip() != LABEL_COLUMN or not other_income.is_line24(r[2].strip()):
            continue
        rpt, line, label = r[0].strip(), r[2].strip(), r[4].strip()
        if rpt in scoped:
            if not (label.isascii() and label.isprintable()) or (rpt, line) in out:
                raise tidy.HcrisError(f"alphanumeric file: report {rpt}, G-3 line {line}: a label that isn't ASCII, "
                                      "or a second label")
            out[(rpt, line)] = label
    return out


def line24_bytes(scoped, amounts, names):
    """The line-24 table for the reports in `scoped` (in_scope): one row per entry with an amount (`amounts`,
    {(report, line): text}), its label from `names` ("" when the hospital wrote none)."""
    keys = sorted((k for k in amounts if k[0] in scoped), key=lambda k: (int(k[0]), k[1]))
    return _csv_bytes([other_income.PIN_COLUMNS, *([*k, names.get(k, ""), amounts[k]] for k in keys)])


def _alpha_rows(zf, member):
    """The alphanumeric member's rows. Read as Latin-1, so a stray byte in a worksheet the layer doesn't read can't
    stop the pin; `labels` holds the labels it keeps to ASCII."""
    with zf.open(member) as raw:
        yield from csv.reader(io.TextIOWrapper(raw, encoding="latin-1", newline=""))


def derive(zip_path):
    """(year, {pin id: table bytes}, the zip's `derivedFrom` facts) from one zip: the cells table and the line-24
    table, from one read of each member."""
    digest, size = sha256(zip_path)
    amounts = {}
    year, reports, values = read_year(zip_path, line24=amounts)
    with zipfile.ZipFile(zip_path) as zf:
        names, _ = members(zf)
        if "alpha" not in names:
            raise tidy.HcrisError(f"{Path(zip_path).name}: no alphanumeric member (G-3 line 24's labels)")
        scoped = in_scope(reports)
        line_names = labels(_alpha_rows(zf, names["alpha"]), scoped)
    source = {"file": Path(zip_path).name, "bytes": size, "sha256": digest,
              "members": [names["rpt"], names["nmrc"], names["alpha"]],
              "downloadUrl": DOWNLOAD.format(year=year), "archive": f"r2://{BUCKET}/{archive_key(digest)}"}
    return year, {pin_id(year): _csv_bytes(tidy.pin_rows(scoped, values)),  # the cells table
                  line24_pin_id(year): line24_bytes(scoped, amounts, line_names)}, source


def new_entry(year, data, source, last_modified, retrieved, line24=False):
    """The manifest entry for a newly derived table (`line24`: the line-24 table, else the cells table).
    `last_modified`: CMS's Last-Modified for the zip (its posting)."""
    members_used = source["members"] if line24 else source["members"][:2]
    what = ("G-3 line 24 \"other (specify)\" entries (line 24 and 24.01 to 24.49: label and amount) from every report "
            "of an acute or critical access hospital" if line24 else
            "every report from an acute or critical access hospital, with the cells the HCRIS layer reads")
    return {
        "id": line24_pin_id(year) if line24 else pin_id(year),
        "title": f"Medicare hospital cost reports (HCRIS, Form CMS-2552-10), FY{year} file: {what}",
        "path": line24_pin_path(year) if line24 else pin_path(year), "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "derivedFrom": {**source, "members": members_used, "lastModified": last_modified,
                        "note": "CMS regenerates the HCRIS zips as reports are filed and settled; this SHA-256 is of "
                                f"the copy retrieved on {retrieved}, and a later download of the same URL may "
                                "differ. The archive copy is the R2 object named in `archive`."},
        "derivedBy": DERIVED_BY, "landingPage": FORM_PAGE, "retrieved": retrieved,
    }


def _parse(argv):
    parser = argparse.ArgumentParser(prog="cli.py pin", description="Derive the HCRIS layer's pinned cells tables.")
    parser.add_argument("--entries", help="write new manifest entries here (a first pin or a new posting)")
    parser.add_argument("--posted", help="CMS's Last-Modified date for the zips (YYYY-MM-DD); with --entries. One "
                                         "posting per run: CMS posts every year's zip at once, so run each "
                                         "posting's zips separately")
    parser.add_argument("--retrieved", help="the date the zips were downloaded (YYYY-MM-DD); with --entries")
    parser.add_argument("zips", nargs="+")
    args = parser.parse_args(argv)
    if args.entries and not (args.posted and args.retrieved):
        parser.error("--entries needs --posted and --retrieved")
    return args


def _pin_existing(z, pid, data, source, entry):
    if entry is None:
        print(f"{z}: no manifest entry {pid}; run with --entries to make one")
        return 1
    if (source["bytes"], source["sha256"]) != (entry["derivedFrom"]["bytes"], entry["derivedFrom"]["sha256"]):
        print(f"{z}: not the zip {pid} names (sha256 {entry['derivedFrom']['sha256']}); a new posting "
              "needs --entries")
        return 1
    return write_derived_pin(entry, data)


def main(argv):
    try:
        args = _parse(argv)
    except SystemExit as stop:  # argparse's usage error (2) or --help (0)
        return stop.code
    by_id = {e["id"]: e for e in read_manifest()}
    worst, entries = 0, []
    for z in sorted(args.zips):
        try:
            year, tables, source = derive(z)
        except (tidy.HcrisError, zipfile.BadZipFile, UnicodeDecodeError, csv.Error, OSError) as err:
            print(f"{z}: {err}")
            worst = 1
            continue
        for pid, data in tables.items():
            if args.entries:
                entry = new_entry(year, data, source, args.posted, args.retrieved, line24=pid == line24_pin_id(year))
                entries.append(entry)
                worst = max(worst, write_derived_pin(entry, data))
            else:
                worst = max(worst, _pin_existing(z, pid, data, source, by_id.get(pid)))
    if args.entries:
        Path(args.entries).write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {len(entries)} manifest entries to {args.entries}")
    return worst
