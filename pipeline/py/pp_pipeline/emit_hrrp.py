"""Build the Readmissions (HRRP) data from the pinned inputs and write data/emitted/hrrp/fy<YYYY>/hrrp.json.

`python3 -I pipeline/py/run.py emit` (or `make emit`) runs this after the hospital master, whose committed file it
reads (names, locations, beds, teaching, ownership, provider types and Medicare status come from the master by CCN).
A rebuild that changes nothing keeps the committed built_at, so git stays clean. Ported from Thirty Day Readmissions
(pipeline/build_data.py at 33d1959): the same gates, in the same order, and the same body under the same keys, so the
emitted file equals that site's own output (`data/pinned/tdr/hrrp.json`) on meta (less sources and whatsNew),
conditions, hospitals and history. Fails, writing nothing, on: a Table 15 disagreement, a payment adjustment factor
out of range, a workbook value that does not round to the tab export's, a value shared by a peer group that is not
shared, stored values that no longer reproduce every factor, a malformed dollar check, a hospital the master lacks,
or a master built from older pins.
"""
import json
import sys
from datetime import datetime, timezone

from pp_engine import geo, hrrp, hrrp_history
from pp_engine.contract import envelope
from pp_engine.hrrp_read import CONDITIONS, read_supplemental, read_table15
from pp_engine.ipps import read_estimate_inputs, read_operating_rates
from pp_engine.parse import impact_fy, read_hgi, rows
from pp_engine.xlsx import sheet_rows
from pp_pipeline import emit_hospital
from pp_pipeline.files import (EMITTED_DIR, REPO_ROOT, manifest_entry, read_json, read_manifest, read_pinned_bytes,
                               read_zip_member, read_zip_text_cp1252, require_current, write_emitted)

SUPPLEMENTAL, TABLE15, RATES = "hrrp-supplemental-fy2027", "hrrp-table15-fy2027", "ipps-rates-fy2027"
HISTORY, SUMMARY, TOTALS, DOLLAR_CHECK = ("hrrp-history-fy2013-2026", "hrrp-history-summary-fy2013-2026",
                                          "hrrp-annual-totals", "hrrp-dollar-check-fy2027")
PROVENANCE = "hrrp-history-provenance"  # how the history was built and checked: not read, but cited with it
# The method's own inputs, then the hospital master's (its fields are copied in, so a re-pin of any of them moves
# this file's source_manifest too).
OWN_SOURCES = (SUPPLEMENTAL, TABLE15, emit_hospital.IMPACT, RATES, emit_hospital.HGI, HISTORY, SUMMARY, PROVENANCE,
               TOTALS, DOLLAR_CHECK)
SOURCES = OWN_SOURCES + tuple(s for s in emit_hospital.SOURCES if s not in OWN_SOURCES)
SCHEMA_VERSION, METHODS_VERSION = 1, 1
SCHEMA = "hrrp.schema.json"

SUPP_XLSX = "FY2027_HRRP_Supplemental_File.xlsx"
SUPP_SHEET = "FR FY 2027"  # the workbook sheet that SUPP_TAB is the tab-delimited export of
SUPP_TAB = "FY2027_HRRP_Supplemental_File - FR FY 2027 Tab.txt"
TABLE15_MEMBER = "Section 508 version of FY2027_HRRP_Table_15.txt"
RATES_MEMBER = "CMS-1849-CN Tables 1A - 1E.txt"
# Everything else that changes when the next fiscal year's files arrive (the fiscal year itself is the impact file's).
GROUPER = 44  # MS-DRG grouper version of the FY2027 impact file's CASETA44/TACMIV44 columns (a missing one fails)
FILE_DATE = "2026-10-07"  # the date CMS's zip records for the supplemental file's members (its final, corrected files)
PERF = ["2023-07-01", "2025-06-30"]  # the FY2027 performance period (CMS's supplemental file, variable description)
HIST_FIRST_FY = 2013
GEOCODER_SOURCE = {"name": "U.S. Census Bureau Geocoder, Public_AR_Current benchmark (hospital street addresses)",
                   "url": "https://geocoding.geo.census.gov/geocoder/"}
CONDITION_INFO = {
    "AMI": ("Heart attack", "Acute myocardial infarction (AMI)"),
    "COPD": ("COPD", "Chronic obstructive pulmonary disease (COPD)"),
    "HF": ("Heart failure", "Heart failure (HF)"),
    "PN": ("Pneumonia", "Pneumonia (PN)"),
    "CABG": ("Bypass surgery", "Coronary artery bypass graft surgery (CABG)"),
    "THA_TKA": ("Hip/knee replacement", "Elective total hip or knee arthroplasty (THA/TKA)"),
}
assert tuple(CONDITION_INFO) == CONDITIONS
# The master's fields copied into each hospital record, renamed as the record names them. Left out when None:
# most hospitals have no alias, certified beds ("cr" marks the cost-report fallback) and an active Medicare agreement.
MASTER_FIELDS = (("name", "name"), ("alias", "alias"), ("city", "city"), ("state", "st"), ("county", "county"),
                 ("zip", "zip"), ("lat", "lat"), ("lon", "lon"), ("geo", "geo"), ("cbsa", "cbsa"),
                 ("cbsaName", "cbsaName"), ("urban", "urban"), ("region", "region"), ("division", "division"),
                 ("beds", "beds"), ("teach", "teach"), ("own", "own"), ("ownDetail", "ownDetail"), ("types", "types"),
                 ("inactive", "inactive"))
OPTIONAL = ("alias", "bedsSrc", "inactive")


def committed_master():
    """The committed hospital master, refused unless it was built from the pins as the manifest has them now."""
    master = read_json(emit_hospital.committed_path())
    require_current(master, read_manifest(), "the hospital master (data/emitted/hospital/)")
    return {h["ccn"]: h for h in master["hospitals"]}


def master_fields(ccn, m):
    """One hospital's master fields under the record's names; `bedsSrc` is "cr" for the cost-report fallback."""
    out = {name: m[key] for key, name in MASTER_FIELDS}
    out["bedsSrc"] = "cr" if m["bedsSource"] == "cr" else None
    return out


def read_inputs():
    """The pinned files, parsed: {supp, pub, t15, impact, rates, hgi, fy}."""
    impact_text = read_zip_text_cp1252(emit_hospital.IMPACT, emit_hospital.IMPACT_MEMBER)
    fy = impact_fy(impact_text)
    workbook = read_zip_member(SUPPLEMENTAL, SUPP_XLSX)
    return {
        "fy": fy,
        "supp": read_supplemental(sheet_rows(workbook, SUPP_SHEET, SUPP_XLSX), SUPP_XLSX),
        "pub": read_supplemental(rows(read_zip_text_cp1252(SUPPLEMENTAL, SUPP_TAB), "\t"), SUPP_TAB),
        "t15": read_table15(read_zip_text_cp1252(TABLE15, TABLE15_MEMBER), fy),
        "impact": read_estimate_inputs(impact_text, fy, GROUPER),
        "rates": read_operating_rates(read_zip_text_cp1252(RATES, RATES_MEMBER)),
        "hgi": read_hgi(read_pinned_bytes(emit_hospital.HGI).decode("utf-8")),
    }


def gates(supp, pub, t15):
    """TDR's input gates, in its order: Table 15 agrees, every factor in range, the workbook rounds to the export."""
    mismatch = hrrp.table15_mismatches(t15, supp)
    if mismatch:
        raise hrrp.HrrpError(f"Table 15 and the supplemental file disagree for {len(mismatch)} hospitals: {mismatch[:10]}")
    bad = hrrp.out_of_range(supp)
    if bad:
        raise hrrp.HrrpError(f"payment adjustment factor out of range for {bad[:10]}")
    drift = hrrp.precision_mismatches(supp, pub)
    if drift:
        raise hrrp.HrrpError(f"Excel workbook and tab-delimited file disagree on {len(drift)} values: {drift[:10]}")


def stored_values(supp, pub, ties):
    """(nm, peer cutoffs, peer medians, {ccn: as_stored record}), then the replication gate."""
    nm = hrrp.stored_constant(list(supp), lambda c: supp[c]["nm"], lambda c: pub[c]["nm"], "neutrality modifier", ties)
    peer_cut, peer_med = [], {}
    for p in range(1, 6):
        grp = [c for c in supp if supp[c]["peer"] == p]
        peer_cut.append([hrrp.rnd(f(supp[c]["dual"] for c in grp), 4, half_up=True) for f in (min, max)])
        peer_med[str(p)] = {k: hrrp.stored_constant(grp, lambda c, k=k: supp[c]["c"][k]["med"],
                                                    lambda c, k=k: pub[c]["c"][k]["med"], f"peer {p} {k} median", ties)
                            for k in CONDITIONS}
    kept = {c: hrrp.as_stored(c, s, pub[c], nm, peer_med, ties) for c, s in supp.items()}
    hrrp.replication_gate(kept)
    return nm, peer_cut, peer_med, kept


def hospital_records(kept, inputs, master, mdh_share):
    """(records sorted by CCN, {ccn: MDH add-on triple}); HrrpError naming any CCN the master does not have."""
    missing = sorted(c for c in kept if c not in master)
    if missing:
        raise hrrp.HrrpError(f"{len(missing)} hospitals in the supplemental file are not in the hospital master: "
                             f"{missing[:10]}; run `make emit`")
    records, addons = [], {}
    for ccn in sorted(kept):
        fields, addon = hrrp.program_fields(kept[ccn], inputs["impact"].get(ccn) or {}, master[ccn]["types"],
                                            inputs["rates"], mdh_share)
        if addon is not None:
            addons[ccn] = addon
        rec = {"id": ccn, **master_fields(ccn, master[ccn]), "star": (inputs["hgi"].get(ccn) or {}).get("star"),
               **fields}
        records.append({k: v for k, v in rec.items() if v is not None or k not in OPTIONAL})
    return records, addons


def history_body(supp, fy):
    """{years, paf, national}: the pinned FY2013 to prior-year history, this year's national row from its factors, and
    the published annual totals joined by fiscal year."""
    years, paf = hrrp_history.load_paf_history(read_pinned_bytes(HISTORY).decode("utf-8"), set(supp), HIST_FIRST_FY,
                                               fy - 1)
    national = hrrp_history.load_national(read_pinned_bytes(SUMMARY).decode("utf-8"))
    national.append({**hrrp_history.summarize_fy(fy, [s["paf"] for s in supp.values()], round(hrrp.CAP * 100)),
                     "perf": PERF})
    totals = {t["fy"]: t for t in json.loads(read_pinned_bytes(TOTALS))}
    for row in national:
        row["totalEst"] = totals.get(row["fy"], {}).get("totalEst")
        row["totalSrc"] = totals.get(row["fy"], {}).get("src")
    return {"years": years, "paf": paf, "national": national}


def dollar_check(fy):
    try:
        return hrrp.check_dollar_check(json.loads(read_pinned_bytes(DOLLAR_CHECK)), fy)
    except hrrp.HrrpError as e:
        raise hrrp.HrrpError(f"{manifest_entry(DOLLAR_CHECK)['path']}: {e}") from None


def meta_sources(manifest):
    """Each pinned input as Methods lists it, then the geocoder the master's street-address points came from."""
    def url(e):
        return e.get("downloadUrl") or e.get("landingPage") or e["derivedFrom"]["downloadUrl"]
    return [{"id": s, "name": manifest_entry(s, manifest)["title"], "url": url(manifest_entry(s, manifest))}
            for s in SOURCES] + [GEOCODER_SOURCE]


def build_from_pins(built_at, report=None):
    """The emitted file. `report`, a dict, collects what the build report prints (ties, add-ons, the MDH share)."""
    report = {} if report is None else report
    inputs = read_inputs()
    supp, pub, fy = inputs["supp"], inputs["pub"], inputs["fy"]
    gates(supp, pub, inputs["t15"])
    ties = []
    nm, peer_cut, peer_med, kept = stored_values(supp, pub, ties)
    mdh_share = hrrp.year_share(fy, hrrp.MDH_END)
    hospitals, addons = hospital_records(kept, inputs, committed_master(), mdh_share)
    shortfall = hrrp.mdh_shortfall(addons)
    history = history_body(supp, fy)
    states = {st: geo.STATE_NAMES[st] for st in sorted({h["st"] for h in hospitals if h["st"]})}
    manifest = read_manifest()
    report.update(ties=ties, addons=addons, mdh_share=mdh_share, shortfall=shortfall, hospitals=hospitals,
                  extra=hrrp.extra_places(hospitals, peer_med, nm))
    return {
        **envelope(SCHEMA_VERSION, METHODS_VERSION, SOURCES, manifest, built_at, fy),
        "meta": {
            "fy": fy, "fileDate": FILE_DATE, "perf": PERF, "nm": nm,
            "peerCutoffs": peer_cut, "peerMedians": peer_med,
            "rates": {t: {k: list(v) for k, v in r.items()} for t, r in inputs["rates"].items()},
            "totals": {"modelBase": sum(h["base"] or 0 for h in hospitals),
                       "modelPen": sum(h["pen"] or 0 for h in hospitals),
                       "cmsEst": history["national"][-1]["totalEst"], "cmsSrc": history["national"][-1]["totalSrc"]},
            "replication": {"exact": sum(1 for s in supp.values() if hrrp.replication_status(s) == "exact"),
                            "total": len(supp)},
            "mdh": {"endDate": hrrp.MDH_END, "maxShortfall": round(max(shortfall.values(), default=0))},
            "dollarCheck": dollar_check(fy),
            "geocode": {k: sum(1 for h in hospitals if h["geo"] == (None if k == "none" else k))
                        for k in ("address", "zip", "county", "none")},
            "states": states,
            "divisions": [{"name": d, "region": r, "states": [s for s in sts if s in states]}
                          for d, (r, sts) in geo.DIVISIONS.items()],
            "sources": meta_sources(manifest),
        },
        "conditions": [{"key": k, "short": short, "label": label} for k, (short, label) in CONDITION_INFO.items()],
        "hospitals": hospitals,
        "history": history,
    }


def emitted_path(fy):
    return EMITTED_DIR / "hrrp" / f"fy{fy}" / "hrrp.json"


def committed_path():
    """Where the file for the pinned impact file's year lives."""
    return emitted_path(impact_fy(emit_hospital.impact_text()))


def print_report(report):
    """TDR's build report: values stored with extra decimals, ties moved, and the MDH add-on."""
    n_extra, n_shown = report["extra"]
    print(f"stored with more than {hrrp.DECIMALS} decimals so the site prints CMS's 4-decimal value: {n_extra} of {n_shown}")
    print(f"moved one unit of the last decimal off an exact tie ({len(report['ties'])}): "
          + ("; ".join(f"{label} {v!r} -> {s!r}" for label, v, s in report["ties"]) or "none"))
    paf = {h["id"]: h["paf"] for h in report["hospitals"]}
    got = {c: (fed, a, a * (1 - paf[c])) for c, (fed, a, _) in report["addons"].items() if fed and a > 0}
    print(f"MDH add-on ({report['mdh_share']:.4f} of the year): {len(got)} of {len(report['addons'])} MDHs, "
          f"base +${sum(v[1] for v in got.values()) / 1e6:.1f}M, "
          f"estimated penalty +${sum(v[2] for v in got.values()) / 1e6:.2f}M")
    if report["shortfall"]:
        c = max(report["shortfall"], key=report["shortfall"].get)
        print(f"  a full year of MDH status would leave estimates up to {report['shortfall'][c]:.1f}% short ({c})")


def main():
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    report = {}
    try:
        fresh = build_from_pins(now, report)
        path = emitted_path(fresh["fy"])
        out = write_emitted(path, fresh, SCHEMA)  # a build that fails its schema raises and writes nothing
    except (hrrp.HrrpError, ValueError) as e:
        print(f"hrrp: not written; {e}", file=sys.stderr)
        return 1
    print_report(report)
    rep = out["meta"]["replication"]
    print(f"wrote {path.relative_to(REPO_ROOT)}: {len(out['hospitals'])} hospitals, "
          f"factor replication {rep['exact']} of {rep['total']} exact, built_at {out['built_at']}")
    return 0
