"""Build the hospital master from the pinned inputs and write data/emitted/hospital/fy<YYYY>/hospital_master.json.

`python3 -I pipeline/py/run.py emit` (or `make emit`). A rebuild that changes nothing keeps the committed built_at,
so git stays clean.
"""
import functools
import json
from datetime import datetime, timezone

from pp_engine import geo
from pp_engine.contract import format_emitted, keep_built_at
from pp_engine.master import build_master
from pp_engine.parse import (SchemaError, impact_fy, index_by_ccn, read_cbsa_names, read_hgi, read_impact, read_points,
                             read_pos, read_zcta, rows, table)
from pp_engine.schema import validate
from pp_pipeline.files import EMITTED_DIR, REPO_ROOT, load_schemas, read_json, read_manifest, read_pinned_bytes, read_zip_member

HGI, IMPACT, POS, HACRP, TDR = "hgi-2026-07", "ipps-impact-fy2027", "pos-q2-2026", "yq43-i98g", "tdr-hrrp-fy2027"
ZCTA, COUNTIES, CBSA, TDR_POINTS = "zcta-2024", "us-atlas-counties-3.0.1", "county-cbsa-fy2027", "tdr-geocodes"
ZCTA_MEMBER = "2024_Gaz_zcta_national.txt"
CBSA_MEMBER = "FY 2027 FR County to CBSA Crosswalk.txt"  # CMS text: Windows-1252
SOURCES = (HGI, IMPACT, POS, HACRP, TDR)
# The final rule's correction-notice values, the file Thirty Day Readmissions builds from. CMS writes it in
# Windows-1252.
IMPACT_MEMBER = "FY 2027 IPPS Impact File - Correction Notice.txt"
SCHEMA = "hospital.schema.json"


def hacrp_program():
    label = "HACRP file"
    records = table(rows(read_pinned_bytes(HACRP).decode("utf-8"), ","), "Facility Name",
                    {"ccn": "Facility ID", "name": "Facility Name", "fy": "Fiscal Year"}, label)
    by_ccn = index_by_ccn(records, lambda r: r, label)
    years = {r["fy"] for r in by_ccn.values()}
    if len(years) != 1:
        raise SchemaError(f"{label}: expected one fiscal year, found {sorted(years)}")
    return {"fy": int(years.pop()), "names": {c: r["name"] for c, r in by_ccn.items()}}


@functools.lru_cache(maxsize=None)
def tdr_data():
    return json.loads(read_pinned_bytes(TDR))


def hrrp_program():
    data = tdr_data()
    return {"fy": data["meta"]["fy"], "names": {h["id"]: h["name"] for h in data["hospitals"]}}


@functools.lru_cache(maxsize=None)
def impact_text():
    return read_zip_member(IMPACT, IMPACT_MEMBER).decode("cp1252")


@functools.lru_cache(maxsize=None)
def zcta():
    return read_zcta(read_zip_member(ZCTA, ZCTA_MEMBER).decode("utf-8"))


@functools.lru_cache(maxsize=None)
def counties():
    return geo.read_counties(json.loads(read_pinned_bytes(COUNTIES)))


@functools.lru_cache(maxsize=None)
def cbsa_names():
    return read_cbsa_names(read_zip_member(CBSA, CBSA_MEMBER).decode("cp1252"))


@functools.lru_cache(maxsize=None)
def tables():
    """The parsed CMS tables the master joins: HGI, the impact file, POS, and each program's listing."""
    return {"hgi": read_hgi(read_pinned_bytes(HGI).decode("utf-8")), "impact": read_impact(impact_text()),
            "pos": read_pos(read_pinned_bytes(POS).decode("utf-8")),
            "programs": {"hacrp": hacrp_program(), "hrrp": hrrp_program()}}


def tdr_points():
    return read_points(read_pinned_bytes(TDR_POINTS).decode("utf-8"))


def build_from_pins(built_at):
    t = tables()
    return build_master(
        hgi=t["hgi"],
        impact=t["impact"],
        pos=t["pos"],
        programs=t["programs"],
        fy=impact_fy(impact_text()),
        manifest=read_manifest(),
        sources=list(SOURCES),
        built_at=built_at,
    )


def emitted_path(fy):
    return EMITTED_DIR / "hospital" / f"fy{fy}" / "hospital_master.json"


def committed_path():
    """Where the master for the pinned impact file's year lives."""
    return emitted_path(impact_fy(impact_text()))


def main():
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    fresh = build_from_pins(now)
    path = emitted_path(fresh["fy"])
    out = keep_built_at(read_json(path) if path.exists() else None, fresh)
    schemas = load_schemas()
    errors = validate(schemas[SCHEMA], out, schemas)
    if errors:
        raise ValueError(f"{path.name} fails {SCHEMA}:\n" + "\n".join(errors[:20]))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(format_emitted(out), encoding="utf-8")
    print(f"wrote {path.relative_to(REPO_ROOT)}: {len(out['hospitals'])} hospitals, built_at {out['built_at']}")
    return 0
