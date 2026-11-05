"""Derive the HCRIS layer's pinned inputs: one per-report cells table per HCRIS year, from CMS's zip.

    python3 -I pipeline/py/pp_pipeline/hcris/cli.py pin <HOSP10FY<YYYY>.ZIP> ...
    python3 -I pipeline/py/pp_pipeline/hcris/cli.py pin --entries <entries.json> <zip> ...

A year's zip (136 MB, 820 MB unzipped) is far over the repo's 10 MiB limit, so the repo pins what the layer reads from
it: `data/pinned/hcris-fy<YYYY>/hcris_fy<YYYY>_cells.csv`, one row per report from an acute or critical access
hospital (`tidy.kind_of`), with its identity and every cell in `cells.CELLS` (`tidy.PIN_COLUMNS`). The manifest
entry (`hcris-fy<YYYY>-cells`) records the zip in `derivedFrom`: size, SHA-256, CMS URL, Last-Modified, and its
content address in the R2 archive (archive.py). Anyone with that zip gets the same bytes.

With a manifest entry, `pin` writes the table only when it is the entry's bytes (files.write_derived_pin). With
`--entries`, it writes the tables and the manifest entries they need to `<entries.json>`, for a first pin or a new
posting; the entries then go into data/pinned/manifest.json.
"""
import csv
import hashlib
import io
import json
import zipfile
from pathlib import Path

from pp_engine.hcris import tidy
from pp_pipeline.files import read_manifest, write_derived_pin
from pp_pipeline.hcris.extract import members, read_year, sha256

FORM_PAGE = "https://www.cms.gov/data-research/statistics-trends-and-reports/cost-reports/hospital-2552-2010-form"
DOWNLOAD = "https://downloads.cms.gov/FILES/HCRIS/HOSP10FY{year}.ZIP"
BUCKET = "pp-sources"  # ARCH-17 option (c): content-addressed objects, `sha256/<hex>`
DERIVED_BY = "pipeline/py/pp_pipeline/hcris/pins.py"


def pin_id(year):
    return f"hcris-fy{year}-cells"


def pin_path(year):
    return f"hcris-fy{year}/hcris_fy{year}_cells.csv"


def archive_key(digest):
    return f"sha256/{digest}"


def table_bytes(reports, values):
    """The cells table for the reports in scope, as the repo pins it: CSV, '\\n' line ends, ASCII."""
    scoped = {k: r for k, r in reports.items() if tidy.kind_of(r.ccn)}
    out = io.StringIO()
    csv.writer(out, lineterminator="\n").writerows(tidy.pin_rows(scoped, values))
    return out.getvalue().encode("ascii")


def derive(zip_path):
    """(year, table bytes, the zip's `derivedFrom` facts) from one zip."""
    digest, size = sha256(zip_path)
    with zipfile.ZipFile(zip_path) as zf:
        names, _ = members(zf)
    year, reports, values = read_year(zip_path)
    source = {"file": Path(zip_path).name, "bytes": size, "sha256": digest, "members": [names["rpt"], names["nmrc"]],
              "downloadUrl": DOWNLOAD.format(year=year), "archive": f"r2://{BUCKET}/{archive_key(digest)}"}
    return year, table_bytes(reports, values), source


def new_entry(year, data, source, last_modified, retrieved):
    """The manifest entry for a newly derived table. `last_modified`: CMS's Last-Modified for the zip (its posting)."""
    return {
        "id": pin_id(year),
        "title": f"Medicare hospital cost reports (HCRIS, Form CMS-2552-10), FY{year} file: every report from an "
                 "acute or critical access hospital, with the cells the HCRIS layer reads",
        "path": pin_path(year), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
        "derivedFrom": {**source, "lastModified": last_modified,
                        "note": "CMS regenerates the HCRIS zips as reports are filed and settled; this SHA-256 is of "
                                f"the copy retrieved on {retrieved}, and a later download of the same URL may "
                                "differ. The archive copy is the R2 object named in `archive`."},
        "derivedBy": DERIVED_BY, "landingPage": FORM_PAGE, "retrieved": retrieved,
    }


def main(argv):
    entries_out = None
    if argv[:1] == ["--entries"] and len(argv) >= 6 and argv[2] == "--posted" and argv[4] == "--retrieved":
        entries_out, posted, retrieved, zips = argv[1], argv[3], argv[5], argv[6:]
    elif argv and argv[0] != "--entries":
        zips = argv
    else:
        print(__doc__.strip() + "\n\n    (--entries <file> --posted <YYYY-MM-DD> --retrieved <YYYY-MM-DD> <zip> ...)")
        return 2
    by_id = {e["id"]: e for e in read_manifest()}
    worst, entries = 0, []
    for z in sorted(zips):
        try:
            year, data, source = derive(z)
        except (tidy.HcrisError, zipfile.BadZipFile, UnicodeDecodeError, csv.Error, OSError) as err:
            print(f"{z}: {err}")
            worst = 1
            continue
        if entries_out:
            entry = new_entry(year, data, source, posted, retrieved)
            entries.append(entry)
            worst = max(worst, write_derived_pin(entry, data))
            continue
        entry = by_id.get(pin_id(year))
        if entry is None:
            print(f"{z}: no manifest entry {pin_id(year)}; run with --entries to make one")
            worst = 1
        elif (source["bytes"], source["sha256"]) != (entry["derivedFrom"]["bytes"], entry["derivedFrom"]["sha256"]):
            print(f"{z}: not the zip {pin_id(year)} names (sha256 {entry['derivedFrom']['sha256']}); a new posting "
                  "needs --entries")
            worst = 1
        else:
            worst = max(worst, write_derived_pin(entry, data))
    if entries_out:
        Path(entries_out).write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {len(entries)} manifest entries to {entries_out}")
    return worst
