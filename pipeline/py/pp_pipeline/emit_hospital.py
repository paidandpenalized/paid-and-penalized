"""Build the hospital master from the pinned inputs and write data/emitted/hospital/fy<YYYY>/hospital_master.json.

`python3 -I pipeline/py/run.py emit` (or `make emit`). A rebuild that changes nothing keeps the committed built_at,
so git stays clean.
"""
import functools
import json
from datetime import datetime, timezone

from pp_engine import geo, location
from pp_engine.contract import format_emitted, keep_built_at
from pp_engine.master import Place, build_master
from pp_engine.parse import (SchemaError, impact_fy, index_by_ccn, read_cbsa_names, read_hgi, read_impact, read_points,
                             read_pos, read_zcta, rows, table)
from pp_engine.schema import validate
from pp_pipeline.files import EMITTED_DIR, REPO_ROOT, load_schemas, read_json, read_manifest, read_pinned_bytes, read_zip_member

HGI, IMPACT, POS, HACRP, TDR = "hgi-2026-07", "ipps-impact-fy2027", "pos-q2-2026", "yq43-i98g", "tdr-hrrp-fy2027"
ZCTA, COUNTIES, CBSA, TDR_POINTS = "zcta-2024", "us-atlas-counties-3.0.1", "county-cbsa-fy2027", "tdr-geocodes"
CENSUS_POINTS = "census-geocodes-2026-10"
ZCTA_MEMBER = "2024_Gaz_zcta_national.txt"
CBSA_MEMBER = "FY 2027 FR County to CBSA Crosswalk.txt"  # CMS text: Windows-1252
SOURCES = (HGI, IMPACT, POS, HACRP, TDR, ZCTA, COUNTIES, CBSA, TDR_POINTS, CENSUS_POINTS)
# Counties the location rules can't check (location.county_label's doubt) across the whole master; more fails the
# build so a new spelling is looked at before it ships. `make emit` prints them.
MAX_UNCHECKED_COUNTIES = 37  # the 2026-10-20 build (73 listed; the rest have no Care Compare county or no atlas)
# The final rule's correction-notice values, the file Thirty Day Readmissions builds from. CMS writes it in
# Windows-1252.
IMPACT_MEMBER = "FY 2027 IPPS Impact File - Correction Notice.txt"
SCHEMA = "hospital.schema.json"


# HACRP's Payment Reduction: Yes or No for a hospital subject to the adjustment; N/A for Maryland's hospitals, which
# the file lists but the state's own payment model covers.
ADJUSTED, EXEMPT = ("Yes", "No"), "N/A"


def hacrp_program(text=None):
    """{fy, names, subject} from the HACRP file (the pinned one unless `text` is given). An N/A row outside Maryland
    raises: it would be a kind of exemption the reason codes don't have."""
    label = "HACRP file"
    records = table(rows(text if text is not None else read_pinned_bytes(HACRP).decode("utf-8"), ","), "Facility Name",
                    {"ccn": "Facility ID", "name": "Facility Name", "state": "State", "fy": "Fiscal Year",
                     "pay": "Payment Reduction"}, label)
    by_ccn = index_by_ccn(records, lambda r: r, label)
    years = {r["fy"] for r in by_ccn.values()}
    if len(years) != 1:
        raise SchemaError(f"{label}: expected one fiscal year, found {sorted(years)}")
    odd = sorted(c for c, r in by_ccn.items() if r["pay"] not in ADJUSTED and (r["pay"], r["state"]) != (EXEMPT, "MD"))
    if odd:
        raise SchemaError(f"{label}: Payment Reduction neither Yes/No nor Maryland's N/A for {odd[:5]}")
    return {"fy": int(years.pop()), "names": {c: r["name"] for c, r in by_ccn.items()},
            "subject": {c for c, r in by_ccn.items() if r["pay"] in ADJUSTED}}


@functools.lru_cache(maxsize=None)
def tdr_data():
    return json.loads(read_pinned_bytes(TDR))


def hrrp_program():
    data = tdr_data()
    names = {h["id"]: h["name"] for h in data["hospitals"]}
    return {"fy": data["meta"]["fy"], "names": names, "subject": set(names)}  # TDR lists only adjusted hospitals


def cp1252(data, label):
    """CMS text as Windows-1252; a byte that encoding leaves undefined is a SchemaError, not a crash."""
    try:
        return data.decode("cp1252")
    except UnicodeDecodeError as e:
        raise SchemaError(f"{label}: not Windows-1252 text ({e.reason} at byte {e.start})") from None


@functools.lru_cache(maxsize=None)
def impact_text():
    return cp1252(read_zip_member(IMPACT, IMPACT_MEMBER), IMPACT_MEMBER)


@functools.lru_cache(maxsize=None)
def zcta():
    return read_zcta(read_zip_member(ZCTA, ZCTA_MEMBER).decode("utf-8"))


@functools.lru_cache(maxsize=None)
def counties():
    return geo.read_counties(json.loads(read_pinned_bytes(COUNTIES)))


@functools.lru_cache(maxsize=None)
def cbsa_names():
    return read_cbsa_names(cp1252(read_zip_member(CBSA, CBSA_MEMBER), CBSA_MEMBER))


@functools.lru_cache(maxsize=None)
def tables():
    """The parsed CMS tables the master joins: HGI, the impact file, POS, and each program's listing."""
    return {"hgi": read_hgi(read_pinned_bytes(HGI).decode("utf-8")), "impact": read_impact(impact_text()),
            "pos": read_pos(read_pinned_bytes(POS).decode("utf-8")),
            "programs": {"hacrp": hacrp_program(), "hrrp": hrrp_program()}}


def tdr_points():
    return read_points(read_pinned_bytes(TDR_POINTS).decode("utf-8"))


def points():
    """Street-address points: TDR's, then this project's Census call for the rest (a CCN in both raises)."""
    return location.merge_points(tdr_points(), read_points(read_pinned_bytes(CENSUS_POINTS).decode("utf-8")))


def new_ref():
    return location.Ref(zcta(), counties(), points(), [], [])


def build_from_pins(built_at, ref=None):
    """The master from the pins. `ref` (a location.Ref) collects the location report; the county gate runs here, so
    the golden test fails too when there are more unchecked counties than allowed."""
    ref = ref or new_ref()
    t = tables()
    master = build_master(
        hgi=t["hgi"],
        impact=t["impact"],
        pos=t["pos"],
        programs=t["programs"],
        fy=impact_fy(impact_text()),
        manifest=read_manifest(),
        sources=list(SOURCES),
        built_at=built_at,
        place=Place(ref, cbsa_names()),
    )
    location.county_gate(ref.unchecked, MAX_UNCHECKED_COUNTIES, atlas_states(master))
    return master


def atlas_states(master):
    """CCN -> whether the hospital's state is one the county atlas covers (the states, DC and Puerto Rico)."""
    return {h["ccn"]: h["state"] in geo.STATE_NAMES for h in master["hospitals"]}


def emitted_path(fy):
    return EMITTED_DIR / "hospital" / f"fy{fy}" / "hospital_master.json"


def committed_path():
    """Where the master for the pinned impact file's year lives."""
    return emitted_path(impact_fy(impact_text()))


def report(master, ref):
    """The location report TDR's build prints: geo sources, counties moved, points set aside, unchecked counties."""
    hs = master["hospitals"]
    print("geo", {k: sum(1 for h in hs if h["geo"] == k) for k in ("address", "zip", "county", None)})
    for src, what in (("county", f"moved to the impact-file county centroid (point > {location.STRAY_KM} km outside it)"),
                      ("address", "street address inside the impact-file county, not Care Compare's")):
        hits = [f"{c} {old} -> {new}" for c, old, new, s in ref.moved if s == src]
        print(f"{what} ({len(hits)}): " + ("; ".join(hits) or "none"))
    set_aside = [h["ccn"] for h in hs if h["ccn"] in ref.points and h["geo"] != "address"]
    print(f"street-address points {len(ref.points)}; set aside (> {location.STRAY_KM} km outside): {set_aside}")
    lines = location.describe_unchecked(ref.unchecked)
    counted = location.gated(ref.unchecked, {c for c, ok in atlas_states(master).items() if ok})
    print(f"county names the rules cannot check ({len(lines)}; {len(counted)} gated, at most {MAX_UNCHECKED_COUNTIES}): "
          + ("; ".join(lines) or "none"))


def main():
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    ref = new_ref()
    fresh = build_from_pins(now, ref)
    report(fresh, ref)
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
