"""Build the hospital master from the pinned inputs and write data/emitted/hospital/fy<YYYY>/hospital_master.json.

`python3 -I pipeline/py/run.py emit` (or `make emit`). A rebuild that changes nothing keeps the committed built_at,
so git stays clean.
"""
import functools
import json
import re
from datetime import datetime, timezone

from pp_engine import geo, location
from pp_engine.master import Place, build_master
from pp_engine.parse import (MARYLAND, SchemaError, impact_fy, index_by_ccn, read_cbsa_names, read_hgi, read_impact,
                             read_points, read_pos, read_zcta, rows, table)
from pp_pipeline.files import (EMITTED_DIR, REPO_ROOT, read_manifest, read_pinned_bytes, read_zip_member,
                               read_zip_text_cp1252, write_emitted)

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
_SCORE = re.compile(r"^-?\d+(\.\d+)?$")  # a Total HAC Score CMS published, as the HACRP site reads it


def read_hacrp(text=None):
    """The HACRP file (the pinned one, read once and shared, unless `text` is given; callers must not modify it) as
    `{fy, records}`: one record per hospital, in the file's order, `{ccn, name, state, pay, cut, decided, scored}`.
    `pay` is Payment Reduction as CMS wrote it; `cut`: it is Yes; `decided`: it is Yes or No (the hospital is subject to
    the adjustment); `scored`: Total HAC Score is a number (N/A or blank is not). The HACRP site's headline counts the
    hospitals that are scored and decided. A Payment Reduction that is neither Yes, No nor Maryland's N/A raises (an N/A
    elsewhere would be a kind of exemption the master's reason codes don't have), as does a score that is neither a
    number nor N/A or blank, or a file of more than one fiscal year."""
    return _parse_hacrp(text) if text is not None else _pinned_hacrp()


@functools.lru_cache(maxsize=None)
def _pinned_hacrp():
    return _parse_hacrp(read_pinned_bytes(HACRP).decode("utf-8"))


def _parse_hacrp(text):
    label = "HACRP file"
    records = table(rows(text, ","), "Facility Name",
                    {"ccn": "Facility ID", "name": "Facility Name", "state": "State", "fy": "Fiscal Year",
                     "pay": "Payment Reduction", "score": "Total HAC Score"}, label)
    by_ccn = index_by_ccn(records, lambda r: r, label)
    years = {r["fy"] for r in by_ccn.values()}
    if len(years) != 1:
        raise SchemaError(f"{label}: expected one fiscal year, found {sorted(years)}")
    odd = sorted(c for c, r in by_ccn.items()
                 if r["pay"] not in ADJUSTED and (r["pay"], r["state"]) != (EXEMPT, MARYLAND))
    if odd:
        raise SchemaError(f"{label}: Payment Reduction neither Yes/No nor Maryland's N/A for {odd[:5]}")
    unreadable = sorted(c for c, r in by_ccn.items() if r["score"] not in ("", "N/A") and not _SCORE.match(r["score"]))
    if unreadable:
        raise SchemaError(f"{label}: Total HAC Score is not a number for {unreadable[:5]}")
    return {"fy": int(years.pop()),
            "records": [{"ccn": c, "name": r["name"], "state": r["state"], "pay": r["pay"], "cut": r["pay"] == "Yes",
                         "decided": r["pay"] in ADJUSTED, "scored": bool(_SCORE.match(r["score"]))}
                        for c, r in by_ccn.items()]}


def hacrp_program(text=None):
    """{fy, names, subject} from the HACRP file: every hospital it lists, and the ones subject to the adjustment (Yes or
    No; Maryland's N/A rows are listed, not subject)."""
    hacrp = read_hacrp(text)
    return {"fy": hacrp["fy"], "names": {r["ccn"]: r["name"] for r in hacrp["records"]},
            "subject": {r["ccn"] for r in hacrp["records"] if r["decided"]}}


@functools.lru_cache(maxsize=None)
def tdr_data():
    return json.loads(read_pinned_bytes(TDR))


def hrrp_program():
    data = tdr_data()
    names = {h["id"]: h["name"] for h in data["hospitals"]}
    return {"fy": data["meta"]["fy"], "names": names, "subject": set(names)}  # TDR lists only adjusted hospitals


@functools.lru_cache(maxsize=None)
def impact_text():
    return read_zip_text_cp1252(IMPACT, IMPACT_MEMBER)


@functools.lru_cache(maxsize=None)
def zcta():
    return read_zcta(read_zip_member(ZCTA, ZCTA_MEMBER).decode("utf-8"))


@functools.lru_cache(maxsize=None)
def counties():
    return geo.read_counties(json.loads(read_pinned_bytes(COUNTIES)))


@functools.lru_cache(maxsize=None)
def cbsa_names():
    return read_cbsa_names(read_zip_text_cp1252(CBSA, CBSA_MEMBER))


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
    out = write_emitted(path, fresh, SCHEMA)
    print(f"wrote {path.relative_to(REPO_ROOT)}: {len(out['hospitals'])} hospitals, built_at {out['built_at']}")
    return 0
