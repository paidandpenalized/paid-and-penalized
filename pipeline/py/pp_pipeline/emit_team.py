"""Build the TEAM file, data/emitted/team/fy2027/team.json, from the six TEAM pins (data/pinned/team-py2/), OMB's
July 2023 CBSA delineation (data/pinned/omb-delineation-2023/), the county-to-CBSA crosswalk and county shapes, and the
repo's emitted hospital master.

    python3 -I pipeline/py/run.py emit        (runs every emitter; this one last)

The method is pp_engine.team (episodes, quality, status, build); this module reads the pins and lays the result out.
The file holds, for the lookup, the calculator and the hub band: CMS's preliminary performance year 2 target prices by
DRG and census division, the category averages, each participant's episode estimate, target amount and quality
percentiles, the default hospital, a status for every master hospital, and the list CCNs the master lacks (`a4`).

`fy` is 2027: performance year 2 is calendar 2027, priced with FY2027 MS-DRGs (the repo's emitted files sit at
<site>/fy<YYYY>/). A new pin or methods version in the hospital master makes this file stale (`require_current`).
"""
import sys
from datetime import datetime, timezone

from pp_engine.contract import envelope
from pp_engine.parse import SchemaError, rows, table
from pp_engine.team import build
from pp_pipeline import emit_hospital
from pp_pipeline.files import (EMITTED_DIR, REPO_ROOT, manifest_entry, read_json, read_manifest, read_pinned_csv,
                               read_zip_text_cp1252, require_current, write_emitted)

SCHEMA_VERSION, METHODS_VERSION = 1, 1
SCHEMA = "team.schema.json"
FY = 2027  # performance year 2 (calendar 2027), FY2027 MS-DRGs

PARTICIPANTS, PRICES, CJRX, QUALITY = "team-participants", "team-prices", "cjrx-participants", "team-quality"
DELINEATION = "omb-delineation-2023"  # OMB's July 2023 CBSA delineation, by county (pp_pipeline.team.derive)
MUP = {"team-mup-dy2023": 2023, "team-mup-dy2024": 2024}  # the prior and the latest data year, in that order
PINS = (PARTICIPANTS, PRICES, CJRX, *MUP, QUALITY, DELINEATION, emit_hospital.CBSA, emit_hospital.COUNTIES)


class Inputs:
    """The pins parsed: participants, price rows, the CJR-X CCNs, the two data years' cells, quality values, the
    master and its hospitals, the crosswalk, the delineation and the county shapes."""

    def __init__(self, manifest):
        self.manifest = manifest
        self.participants = read_pinned_csv(PARTICIPANTS)
        self.price_rows = read_pinned_csv(PRICES)
        self.cjrx = {r["ccn"] for r in read_pinned_csv(CJRX)}
        self.prior, self.latest = (_mup(pin) for pin in MUP)
        self.quality = _quality(read_pinned_csv(QUALITY))
        self.master = read_json(emit_hospital.committed_path())
        require_current(self.master, manifest, "the hospital master")
        self.hospitals = self.master["hospitals"]
        self.crosswalk = read_crosswalk()
        self.delineation = read_pinned_csv(DELINEATION)
        self.shapes = emit_hospital.counties()


def _mup(pin_id):
    """{ccn: {drg: discharges}} from a Medicare inpatient pin."""
    out = {}
    for r in read_pinned_csv(pin_id):
        out.setdefault(r["ccn"], {})[r["drg"]] = int(r["discharges"])
    return out


def _quality(rows_):
    """{measure: {ccn: value}}; a hospital with two values for one measure is refused."""
    out = {m: {} for m in build.MEASURES}
    for r in rows_:
        if r["ccn"] in out[r["measure"]]:
            raise ValueError("quality pin: a hospital has two values for one measure")
        out[r["measure"]][r["ccn"]] = float(r["value"])
    return out


def read_crosswalk():
    """[{fips, county, state, cbsa}] from CMS's county-to-CBSA crosswalk; `cbsa` is its FY2025 CBSA column (blank for a
    rural county, a metropolitan division's code for a county in a divided metro)."""
    text = read_zip_text_cp1252(emit_hospital.CBSA, emit_hospital.CBSA_MEMBER)
    columns = {"fips": "FIPS County Code", "county": "County Name", "state": "State", "cbsa": "*cbsa"}
    return table(rows(text, "\t"), "FIPS County Code", columns, "county-CBSA crosswalk")


def meta(manifest):
    """Source dates from the manifest entries, the data years from MUP."""
    def entry(pin):
        return manifest_entry(pin, manifest)
    return {"listAsOf": entry(PARTICIPANTS)["asOf"], "cjrxAsOf": entry(CJRX)["asOf"],
            "pricesDated": entry(PRICES)["asOf"], "mupYears": list(MUP.values()),
            "qualityReleased": entry(QUALITY)["pdcReleased"], "methods_version": METHODS_VERSION}


def build_with_notes(built_at):
    p = Inputs(read_manifest())
    body, notes = build.build(p.participants, p.price_rows, p.cjrx, p.prior, p.latest, p.quality, p.hospitals,
                              p.crosswalk, p.delineation, p.shapes)
    sources = list(dict.fromkeys([*PINS, *p.master["sources"]]))
    doc = {**envelope(SCHEMA_VERSION, METHODS_VERSION, sources, p.manifest, built_at, FY), "meta": meta(p.manifest),
           **body}
    return doc, notes


def emitted_path():
    return EMITTED_DIR / "team" / f"fy{FY}" / "team.json"


def main():
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    path = emitted_path()
    try:
        fresh, notes = build_with_notes(now)
        out = write_emitted(path, fresh, SCHEMA)
    except (ValueError, KeyError, OSError, SchemaError) as err:
        print(f"team: not written: {err}", file=sys.stderr)
        return 1
    print(f"wrote {path.relative_to(REPO_ROOT)}: {len(out['participants'])} participants, {len(out['status'])} "
          f"statuses {dict(sorted(notes['codes'].items()))}, CJR-X reasons {dict(sorted(notes['cjrx_reasons'].items()))}, "
          f"counties placed by {dict(sorted(notes['routes'].items()))}, {notes['unplaced']} unplaced, "
          f"{notes['cbsa_mismatches']} mandatory participant(s) placed outside their list CBSA, "
          f"{len(out['a4']['teamMissing'])} list CCN(s) not in the master, {path.stat().st_size} bytes, "
          f"built_at {out['built_at']}")
    return 0
