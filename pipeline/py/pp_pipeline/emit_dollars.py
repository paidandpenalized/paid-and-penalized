"""Build the dollars dataset from the pinned inputs and write data/emitted/dollars/fy<YYYY>/dollars.json.

`python3 -I pipeline/py/run.py emit` (or `make emit`) runs this after the hospital master. A rebuild that changes
nothing keeps the committed built_at, so git stays clean.

The file holds, for every hospital in the HACRP file, the estimate pp_engine.dollars makes of what Medicare pays it for
the year and how much HRRP, HVBP and the HAC Reduction Program move that (a model, not a bill: see the engine's
docstring and docs/METHODS-LOG.md, `dollars`), then the national sums, the sums over the hospitals the HACRP site
counts in its headline, the checks that hold the sums against what CMS publishes, and `bands` (null until the
back-test, milestone 3). It lives at the family level because more than one site reads it.
"""
import re
from datetime import datetime, timezone

from pp_engine import dollars
from pp_engine.contract import envelope, format_emitted, keep_built_at
from pp_engine.parse import SchemaError, index_by_ccn, rows, table
from pp_engine.schema import validate
from pp_pipeline.emit_hospital import ADJUSTED, EXEMPT, HACRP
from pp_pipeline.files import EMITTED_DIR, REPO_ROOT, load_schemas, read_json, read_manifest, read_pinned_bytes
from pp_pipeline.ipps_pins import HRRP, IMPACT, RATES, VBP, hrrp_factors, payment_inputs, rates, vbp_factors

SCHEMA_VERSION, METHODS_VERSION = 1, 1
SOURCES = (HACRP, IMPACT, RATES, HRRP, VBP)
SCHEMA = "dollars.schema.json"

# The years the estimate is built on. The rates (Tables 1A-1E) and the impact file are the FY2026 final rule's, and the
# program year of the HACRP file must equal it; the impact file's cases and case-mix are FY2024 MedPAR claims.
RATES_FY = 2026
VOLUME_FY = 2024
# The last day of the extension of Medicare-dependent hospital status and of the expanded low-volume-hospital tiers
# (Consolidated Appropriations Act, 2026; CMS's MLN Matters MM14415). The impact file's FY2025-extension columns,
# which the estimate reads, model both in force for the whole year.
MDH_END = "2026-12-31"
LOW_VOLUME_END = "2026-12-31"
NTAP = "excluded"  # new-technology add-on payments are in no figure (dollars.py, the ASSUMPTION at the federal payment)

# Pennsylvania Rural Health Model participants. CMS publishes no FY2026 participant file with CCNs, so no hospital gets
# the `parhm` status yet; a published list would be a pinned input and replace this.
PARHM = frozenset()

# Hospitals that take adjustment factor 1 because a program file does not list them. Hospitals outside HVBP are common
# and legitimate (too few measures to score, new hospitals), so neither count is an error by itself; each is capped so a
# later file with more is looked at before it ships. Both counts are over estimated hospitals, on the pinned FY2026 files
# (2026-10-22): 43 with no row in the HRRP supplemental file (38 of them not cut, 5 cut) and 524 with no row in Table 16B.
HRRP_UNLISTED_MAX = 43
VBP_UNLISTED_MAX = 524

PARTS = ("fed", "mdh_addon", "ime", "dsh", "outlier_op", "sch_diff", "low_volume", "capital", "uc")  # the JSON's `parts`
_SCORE = re.compile(r"^-?\d+(\.\d+)?$")  # a Total HAC Score CMS published, as the HACRP site reads it


def camel(key):
    """`at_stake` -> `atStake`: the repo's JSON keys are camelCase."""
    head, *tail = key.split("_")
    return head + "".join(word.capitalize() for word in tail)


def read_hacrp(text=None):
    """(fiscal year, [{ccn, state, cut, scored, decided}]) from the HACRP file (the pinned one unless `text` is given),
    in the file's order. `cut`: Payment Reduction is Yes. `decided`: it is Yes or No. `scored`: Total HAC Score is a
    number (N/A or blank is not). The headline counts the hospitals that are scored and decided. A Payment Reduction
    that is neither Yes, No nor Maryland's N/A raises, as does a score that is neither a number nor N/A or blank."""
    label = "HACRP file"
    records = table(rows(text if text is not None else read_pinned_bytes(HACRP).decode("utf-8"), ","), "Facility Name",
                    {"ccn": "Facility ID", "state": "State", "fy": "Fiscal Year", "pay": "Payment Reduction",
                     "score": "Total HAC Score"}, label)
    by_ccn = index_by_ccn(records, lambda r: r, label)
    years = {r["fy"] for r in by_ccn.values()}
    if len(years) != 1:
        raise SchemaError(f"{label}: expected one fiscal year, found {sorted(years)}")
    odd = sorted(c for c, r in by_ccn.items() if r["pay"] not in ADJUSTED and (r["pay"], r["state"]) != (EXEMPT, "MD"))
    if odd:
        raise SchemaError(f"{label}: Payment Reduction neither Yes/No nor Maryland's N/A for {odd[:5]}")
    unreadable = sorted(c for c, r in by_ccn.items() if r["score"] not in ("", "N/A") and not _SCORE.match(r["score"]))
    if unreadable:
        raise SchemaError(f"{label}: Total HAC Score is not a number for {unreadable[:5]}")
    return int(years.pop()), [{"ccn": c, "state": r["state"], "cut": r["pay"] == "Yes",
                               "scored": bool(_SCORE.match(r["score"])), "decided": r["pay"] in ADJUSTED}
                              for c, r in by_ccn.items()]


def unlisted_counts(hospital_rows):
    """(estimated hospitals with no HRRP row, estimated hospitals with no Table 16B row), over `hospital_row`s."""
    estimated = [r for r in hospital_rows if r["status"] == "estimated"]
    return (sum(not r["hrrp_listed"] for r in estimated), sum(not r["vbp_listed"] for r in estimated))


def enforce_caps(hospital_rows):
    """Raise unless both `unlisted_counts` are within their caps (HRRP_UNLISTED_MAX, VBP_UNLISTED_MAX)."""
    no_hrrp, no_vbp = unlisted_counts(hospital_rows)
    for count, cap, where in ((no_hrrp, HRRP_UNLISTED_MAX, "the HRRP supplemental file"),
                              (no_vbp, VBP_UNLISTED_MAX, "Table 16B")):
        if count > cap:
            raise ValueError(f"{count} estimated hospitals are not in {where} (at most {cap} on the pinned files): "
                             "look at the new ones before raising the cap")


def hospital_json(row, inp, hrrp, vbp):
    """One hospital's JSON: `{ccn, status, cut, hrrpListed, vbpListed}`, and for an "estimated" row also its cases,
    Medicare bills, the two factors it took (1 where the program file does not list it), the whole-dollar figures and
    `parts`, in that order. `row` is a `hospital_row`; `inp`, `hrrp` and `vbp` are what it was built from."""
    if row["status"] != "estimated":
        return {"ccn": row["ccn"], "status": row["status"], "cut": row["cut"], "hrrpListed": row["hrrp_listed"],
                "vbpListed": row["vbp_listed"]}
    return {"ccn": row["ccn"], "status": row["status"], "cut": row["cut"], "cases": inp["cases"], "bills": inp["bills"],
            "base": row["base"], "total": row["total"], "hrrpFactor": 1.0 if hrrp is None else hrrp,
            "vbpFactor": 1.0 if vbp is None else vbp, "hrrpListed": row["hrrp_listed"], "vbpListed": row["vbp_listed"],
            "hrrp": row["hrrp"], "hvbp": row["hvbp"], "after": row["after"], "atStake": row["at_stake"],
            "hac": row["hac"], "net": row["net"], "parts": {camel(k): row[k] for k in PARTS}}


def totals_json(hospital_rows):
    """`dollars.national` over the rows, camelCase, plus `parts`: the sum of each part over the estimated rows."""
    nat = {camel(k): v for k, v in dollars.national(hospital_rows).items()}
    nat["parts"] = {camel(k): sum(r[k] for r in hospital_rows if r["status"] == "estimated") for k in PARTS}
    return nat


def build_from_pins(built_at):
    fy, records = read_hacrp()
    if fy != RATES_FY:
        raise ValueError(f"the HACRP file is for FY{fy}, the rates and impact file for FY{RATES_FY}")
    inputs, table_, hrrp, vbp = payment_inputs(), rates(), hrrp_factors(), vbp_factors()
    built = [dollars.hospital_row(r["ccn"], r["state"], inputs.get(r["ccn"]), table_, hrrp=hrrp.get(r["ccn"]),
                                  vbp=vbp.get(r["ccn"]), cut=r["cut"], parhm=PARHM) for r in records]
    enforce_caps(built)
    headline = [row for row, r in zip(built, records) if r["scored"] and r["decided"]]
    checks = dollars.checks(dollars.national(built), hacrp_yes=sum(r["cut"] for r in records))
    return {
        **envelope(SCHEMA_VERSION, METHODS_VERSION, SOURCES, read_manifest(), built_at, fy),
        "assumptions": {"ratesFy": RATES_FY, "volumeFy": VOLUME_FY, "mdhEnd": MDH_END, "lowVolumeEnd": LOW_VOLUME_END,
                        "ntap": NTAP},
        "national": totals_json(built),
        "headline": totals_json(headline),
        "checks": checks,
        "hospitals": [hospital_json(row, inputs.get(row["ccn"]), hrrp.get(row["ccn"]), vbp.get(row["ccn"]))
                      for row in built],
        "bands": None,
    }


def emitted_path(fy):
    return EMITTED_DIR / "dollars" / f"fy{fy}" / "dollars.json"


def committed_path():
    """Where the dollars for the HACRP file's year live."""
    return emitted_path(read_hacrp()[0])


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
    failed = [c["id"] for c in out["checks"] if not c["pass"]]
    print(f"wrote {path.relative_to(REPO_ROOT)}: {len(out['hospitals'])} hospitals, built_at {out['built_at']}; "
          f"checks failing: {failed or 'none'}")
    return 1 if failed else 0
