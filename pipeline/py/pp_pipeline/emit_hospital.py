"""Build the hospital master from the pinned inputs and write data/emitted/hospital/fy<YYYY>/hospital_master.json.

`python3 -I pipeline/py/run.py emit` (or `make emit`). A rebuild that changes nothing keeps the committed built_at,
so git stays clean.
"""
import csv
import io
import json
from datetime import datetime, timezone

from pp_engine.contract import format_emitted, keep_built_at
from pp_engine.master import build_master
from pp_engine.parse import impact_fy, read_hgi, read_impact, read_pos
from pp_engine.schema import validate
from pp_pipeline.files import EMITTED_DIR, load_schemas, read_json, read_manifest, read_pinned_bytes, read_zip_member

HGI, IMPACT, POS, HACRP, TDR = "hgi-2026-07", "ipps-impact-fy2027", "pos-q2-2026", "yq43-i98g", "tdr-hrrp-fy2027"
SOURCES = (HGI, IMPACT, POS, HACRP, TDR)
# The final rule's correction-notice values, the file Thirty Day Readmissions builds from. CMS writes it in
# Windows-1252.
IMPACT_MEMBER = "FY 2027 IPPS Impact File - Correction Notice.txt"
SCHEMA = "hospital.schema.json"


def hacrp_program():
    rows = list(csv.DictReader(io.StringIO(read_pinned_bytes(HACRP).decode("utf-8-sig"))))
    years = {r["Fiscal Year"] for r in rows}
    if len(years) != 1:
        raise ValueError(f"HACRP file: expected one fiscal year, found {sorted(years)}")
    return {"fy": int(years.pop()), "names": {r["Facility ID"]: r["Facility Name"] for r in rows}}


def hrrp_program():
    data = json.loads(read_pinned_bytes(TDR))
    return {"fy": data["meta"]["fy"], "names": {h["id"]: h["name"] for h in data["hospitals"]}}


def build_from_pins(built_at):
    impact_text = read_zip_member(IMPACT, IMPACT_MEMBER).decode("cp1252")
    return build_master(
        hgi=read_hgi(read_pinned_bytes(HGI).decode("utf-8")),
        impact=read_impact(impact_text),
        pos=read_pos(read_pinned_bytes(POS).decode("utf-8")),
        programs={"hacrp": hacrp_program(), "hrrp": hrrp_program()},
        fy=impact_fy(impact_text),
        manifest=read_manifest(),
        sources=list(SOURCES),
        built_at=built_at,
    )


def emitted_path(fy):
    return EMITTED_DIR / "hospital" / f"fy{fy}" / "hospital_master.json"


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
    print(f"wrote {path.relative_to(EMITTED_DIR.parent.parent)}: {len(out['hospitals'])} hospitals, built_at {out['built_at']}")
    return 0
