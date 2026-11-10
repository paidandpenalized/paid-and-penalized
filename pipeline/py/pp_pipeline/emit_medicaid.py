"""Build the Medicaid work-requirement scenario file, data/emitted/medicaid/fy2023/medicaid.json, from the pinned state
inputs (CMS-64 VIII spending, Urban's enrollment declines, the FMR check, the state MIUR cuts) and the repo's emitted
HCRIS layer (FY2023), hospital master and dollar estimates.

    python3 -I pipeline/py/run.py medicaid build        (`run.py emit` runs it too)

The method is pp_engine.medicaid (exposure.py: steps 1 to 4; rollup.py) and pp_pipeline.medicaid.build (the state table,
the hospital records, the roll-ups); this module only lays the result out. The file holds, for the page and the hospital
band: the three scenarios and the method's parameters; each state's class, VIII share, Urban declines and roll-ups;
the national, group and sensitivity roll-ups for each scenario; and one array per hospital (`columns` order) with
everything the browser needs to rerun steps 1 to 4 for any scenario and use rate, plus the middle scenario's results
for the figures drawn at build time. Rounding: dollars to whole dollars, ratios and shares to 6 places; roll-ups are
computed from the unrounded values and rounded to 6 places.

`fy` is the HCRIS base year (the cost reports the scenario is built on), not the program year.

Upstream changes re-emit this file: a new pin or methods version in the HCRIS layer, the hospital master or the dollar
estimates makes it stale (`require_current`), and the rebuild needs a `medicaid` heading in docs/METHODS-LOG.md under
the change gate, even though this module is untouched. Re-pinning the FY2023 HCRIS cells also means re-deriving the
state MIUR pin (`pipeline/py/pp_pipeline/medicaid/cli.py safety-net-pin`); a test compares the two pins' source zips.
"""
import sys
from datetime import datetime, timezone

from pp_engine.contract import envelope
from pp_engine.medicaid import params
from pp_pipeline.files import EMITTED_DIR, REPO_ROOT, read_json, read_manifest, require_current, write_emitted
from pp_pipeline.hcris import emit as emit_hcris
from pp_pipeline.medicaid import build, inputs
from pp_pipeline.medicaid.safety_net import read_cuts

SCHEMA_VERSION, METHODS_VERSION = 1, 1
SCHEMA = "medicaid.schema.json"
FY = params.BASE_YEAR

# The state inputs this file adds to the pins its upstream emitted files were built from.
STATE_PINS = (inputs.VIII, inputs.FMR, inputs.URBAN, inputs.STATE_MIUR)

# Base fields (exposure.hospital_base) and what the JS engine reads, in column order; a hospital without a cost report
# has none of them. Dollars are rounded to whole dollars, ratios to 6 places.
DOLLAR_FIELDS = ("medicaid_net_revenue", "medicaid_supplemental", "medicaid_cost", "net_patient_revenue",
                 "net_income_patients", "other_operating_income", "net_income", "other_income",
                 "uncompensated_cost", "revenue_line2_5")
RATIO_FIELDS = ("cost_ratio", "cost_ratio_line2_5", "miur")
FLAG_FIELDS = ("has_margin", "scored", "scored_line2_5", "margin_outlier")
IDENTITY = ("ccn", "name", "city", "state", "kind", "urban", "beds", "own", "lat", "lon")
# The middle scenario's results, for server-drawn figures (a hospital in a scenario state only).
MIDDLE = ("lost", "added_uncompensated", "operating_margin", "operating_margin_after", "total_margin",
          "total_margin_after", "uncompensated_change")
COLUMNS = (*IDENTITY, "cls", "status", "period_begin", "period_end", "period_days", "flags", *DOLLAR_FIELDS,
           *RATIO_FIELDS, "medicaid_days_all", "days_total", "medicaid_days_every", "medicaid_days_nonmaternity",
           *FLAG_FIELDS, "share", "state_share", "share_factor", "safety_net", "hrrp", "hac", "net",
           *(f"middle_{k}" for k in MIDDLE))


def _round(value, places):
    if value is None:
        return None
    v = round(value, places)
    return int(v) if places == 0 else v


def hospital_row(rec):
    """One hospital as an array in COLUMNS order."""
    b, res = rec["base"], rec["results"]
    row = {k: rec[k] for k in IDENTITY}
    row.update(cls=rec["cls"], share=_round(rec["share"], 6), state_share=_round(rec["state_share"], 6),
               share_factor=_round(rec["share_factor"], 6) if rec["cls"] == build.SCENARIO else None)
    programs = rec["programs"] or {}
    row.update(hrrp=_round(programs.get("hrrp"), 0), hac=_round(programs.get("hac"), 0),
               net=_round(programs.get("net"), 0))
    if b is not None:
        days = b["medicaid_days"]
        row.update(status=b["status"], period_begin=b["period_begin"], period_end=b["period_end"],
                   period_days=b["period_days"], flags=list(b["flags"]), safety_net=list(rec["safety_net"] or ()),
                   medicaid_days_all=_round(b["medicaid_days_all"], 0), days_total=_round(b["days_total"], 0),
                   medicaid_days_every=None if days is None else _round(days[0], 0),
                   medicaid_days_nonmaternity=None if days is None else _round(days[1], 0))
        row.update({k: _round(b[k], 0) for k in DOLLAR_FIELDS})
        row.update({k: _round(b[k], 6) for k in RATIO_FIELDS})
        row.update({k: b[k] for k in FLAG_FIELDS})
        if rec["cls"] == build.SCENARIO:
            row.update({f"middle_{k}": _round(res["middle"][k], 0 if k in ("lost", "added_uncompensated") else 6)
                        for k in MIDDLE})
    return [row.get(c) for c in COLUMNS]


def state_json(code, entry, by_state):
    """A state's inputs and roll-ups. `declines`: Urban's three declines as fractions, and `rollup`, the roll-up of its
    hospitals' stored results, each by scenario id; null unless the state has a scenario (no dollars for the others)."""
    out = {"name": entry["name"], "cls": entry["class"], "viii_share": _round(entry["share"], 6),
           "viii_basis": entry["basis"],
           "viii_share_next_year": _round(entry.get("share_next_year"), 6),
           "viii_share_net_of_dsh": _round(entry.get("share_net_of_dsh"), 6),
           "nonmaternity_ratio": _round(entry.get("nonmaternity_ratio"), 6),
           "declines": entry.get("declines"), "urban_thousands": entry.get("urban_thousands"),
           "rollup": by_state.get(code) if entry["class"] == build.SCENARIO else None}
    return out


def scenarios_json(states):
    """The three scenarios (low to high losses): the Urban column each reads, `decline_enrollment`, Urban's national
    total decline in expansion enrollment (every row of its Table A.2), and `decline_enrollment_scenario_states`, the
    part in the states with a scenario, both in thousands of people."""
    rows = [s["urban_thousands"] for s in states.values() if s.get("urban_thousands")]
    modeled = [s["urban_thousands"] for s in states.values() if s["class"] == build.SCENARIO]
    return [{"id": sid, "urban": col, "decline_enrollment": sum(r[sid] for r in rows),
             "decline_enrollment_scenario_states": sum(r[sid] for r in modeled)} for sid, col in params.SCENARIOS]


def params_json():
    return {"base_year": params.BASE_YEAR, "uninsured_share": params.UNINSURED_SHARE,
            "care_still_used": params.CARE_STILL_USED, "use_min": params.USE_MIN, "use_default": params.USE_DEFAULT,
            "use_max": params.USE_MAX, "max_cost_ratio": params.MAX_COST_RATIO,
            "min_medicaid_days": params.MIN_MEDICAID_DAYS, "part_year_days": params.PART_YEAR_DAYS,
            "margin_fence_iqr": params.MARGIN_FENCE_IQR, "miur_sds": params.MIUR_SDS,
            "low_income_share": params.LOW_INCOME_SHARE}


def _unique(ids):
    return list(dict.fromkeys(ids))


def read_upstream(manifest):
    """(HCRIS base year, its file, master, dollars) as the repo's emitted files, each refused unless built from the
    current pins."""
    year, hcris_doc = build.read_hcris(emit_hcris.emitted_path(FY))
    master, dollars = read_json(build.MASTER), read_json(build.DOLLARS)
    for doc, label in ((hcris_doc, "the HCRIS layer's FY2023 file"), (master, "the hospital master"),
                       (dollars, "the dollar estimates")):
        require_current(doc, manifest, label)
    return year, hcris_doc, master, dollars


def records_from_pins():
    """(manifest, HCRIS year, HCRIS file, master, dollars, states, hospital records) from the pins and the upstream
    emitted files; each state's non-maternity ratio is set on its entry."""
    manifest = read_manifest()
    year, hcris_doc, master, dollars = read_upstream(manifest)
    states = build.state_table(*(inputs.read_csv(p) for p in (inputs.VIII, inputs.URBAN, inputs.FMR)),
                               codes={h["state"] for h in master["hospitals"]})
    hcris = {r["ccn"]: r for r in year.rows}
    if not hcris:
        raise ValueError(f"no FY{FY} rows in the HCRIS layer")
    records = build.hospital_records(master, hcris, states, build.program_dollars(dollars),
                                     read_cuts(inputs.read_csv(inputs.STATE_MIUR)))
    for r in records:  # each state's ratio, as hospital_records set it, on its entry
        if r["state"] in states and r["state_ratio"] is not None:
            states[r["state"]]["nonmaternity_ratio"] = r["state_ratio"]
    return manifest, year, hcris_doc, master, dollars, states, records


def build_from_pins(built_at):
    manifest, year, hcris_doc, master, dollars, states, records = records_from_pins()
    national, by_state, sensitivities, groups = build.results(records, states)
    # The pins this file depends on: the state inputs, then those the upstream emitted files were built from, so a
    # re-pin of any of them makes this file stale (require_current).
    sources = _unique([*STATE_PINS, *hcris_doc["sources"], *master["sources"], *dollars["sources"]])
    return {
        **envelope(SCHEMA_VERSION, METHODS_VERSION, sources, manifest, built_at, FY),
        "scenarios": scenarios_json(states),
        "params": params_json(),
        "hcris": {"settled_share": _round(year.settled_share, 6), "early": year.early,
                  "methods_version": year.methods_version, "master_fy": master["fy"], "dollars_fy": dollars["fy"]},
        "states": {code: state_json(code, entry, by_state) for code, entry in sorted(states.items())},
        "national": national,
        "groups": groups,
        "sensitivities": sensitivities,
        "columns": list(COLUMNS),
        "hospitals": [hospital_row(r) for r in records],
    }


def emitted_path(fy):
    return EMITTED_DIR / "medicaid" / f"fy{fy}" / "medicaid.json"


def main():
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        fresh = build_from_pins(now)
        path = emitted_path(FY)
        out = write_emitted(path, fresh, SCHEMA)
    except (ValueError, KeyError, OSError) as err:
        print(f"medicaid: not written: {err}", file=sys.stderr)
        return 1
    print(f"wrote {path.relative_to(REPO_ROOT)}: {len(out['hospitals'])} hospitals, {path.stat().st_size} bytes, "
          f"built_at {out['built_at']}")
    return 0
