"""Conformance cases for the JS port of the exposure method (engine/js/medicaid/): `schemas/conformance/medicaid.vectors.json`.

    python3 -I pipeline/py/run.py medicaid conformance        (rewrites the file)

The cases come from the real FY2023 records, picked by property (no hospital is named or identified: hospitals are
numbered `h01`...), so they hold every class, the 200-day floor on both sides, both filing-error screens, margin
outliers, the lines 2 + 5 version and hospitals without a margin. Each case is one hospital under one scenario, use
rate and revenue base, with the Python engine's result (`pp_engine.medicaid.exposure.scenario`, snake_case keys); each
roll-up case is the roll-up (`rollup.roll_up`) of every hospital in the file for one scenario, use rate and revenue base.
The JS test (engine/js/test/medicaid/conformance.test.js) compares within 1e-6 relative. A Python test requires the
committed file to equal a fresh generation.
"""
import json
import sys
from pathlib import Path

from pp_engine.medicaid import exposure, params, rollup
from pp_pipeline import emit_medicaid
from pp_pipeline.files import REPO_ROOT
from pp_pipeline.medicaid import build

PATH = REPO_ROOT / "schemas" / "conformance" / "medicaid.vectors.json"
HOSPITALS = 60  # at least this many (every property's picks are kept; the rest is filled evenly)
USES = (params.USE_MIN, params.USE_DEFAULT, params.USE_MAX)
# The base fields the engines read (the emitted file's column names).
BASE_FIELDS = ("medicaid_net_revenue", "revenue_line2_5", "scored", "scored_line2_5", "cost_ratio", "cost_ratio_line2_5",
               "has_margin", "margin_outlier", "net_patient_revenue", "net_income_patients", "other_operating_income",
               "net_income", "other_income", "uncompensated_cost")


def _picks(records, k):
    """Up to k of `records` (in CCN order): the first, the last, then evenly between."""
    if len(records) <= k:
        return list(records)
    return [records[round(i * (len(records) - 1) / (k - 1))] for i in range(k)]


def _flag(name):
    return lambda r: name in r["base"]["flags"]


def _scenario(r):
    return r["cls"] == build.SCENARIO


def _into_red(r):
    return _scenario(r) and rollup.into_red(r["results"]["middle"])


def _falls_1pp(r):
    change = _scenario(r) and exposure.margin_change(r["results"]["middle"])
    return change is not None and change is not False and change <= -1


def _floor_edges(records):
    days = [(r["base"]["medicaid_days"][0], r) for r in records if _scenario(r) and r["base"]["medicaid_days"]]
    above = min((d for d in days if d[0] >= params.MIN_MEDICAID_DAYS), key=lambda d: d[0])
    below = max((d for d in days if d[0] < params.MIN_MEDICAID_DAYS), key=lambda d: d[0])
    return [above[1], below[1]]


def pick_hospitals(records):
    """The records the cases cover: a few of each property, then an even fill to HOSPITALS."""
    records = sorted((r for r in records if r["base"] is not None), key=lambda r: r["ccn"])
    chosen = {}

    def take(found):
        for r in found:
            chosen.setdefault(r["ccn"], r)

    for pred, k in (
            (lambda r: _scenario(r) and not r["base"]["flags"], 3),
            (lambda r: _scenario(r) and r["base"]["scored"] and r["base"]["has_margin"], 3),
            (lambda r: _scenario(r) and _flag("few_medicaid_days")(r), 3),
            (lambda r: _scenario(r) and _flag("no_medicaid_days")(r), 2),
            (lambda r: _scenario(r) and not r["base"]["scored"], 3),
            (lambda r: _scenario(r) and r["base"]["scored"] and not r["base"]["scored_line2_5"], 3),
            (lambda r: _scenario(r) and r["base"]["margin_outlier"], 3),
            (lambda r: _scenario(r) and not r["base"]["has_margin"], 3),
            (lambda r: _scenario(r) and r["base"]["scored_line2_5"]
             and r["base"]["revenue_line2_5"] != r["base"]["medicaid_net_revenue"], 3),
            (lambda r: _scenario(r) and _flag("cost_missing")(r), 2),
            (lambda r: _scenario(r) and _flag("cost_ratio_capped")(r), 2),
            (lambda r: _scenario(r) and _flag("no_medicaid_revenue")(r), 2),
            (lambda r: _scenario(r) and _flag("no_uncompensated_cost")(r), 2),
            (lambda r: _scenario(r) and _flag("negative_uncompensated_cost")(r), 2),
            (lambda r: r["base"]["has_margin"] and r["base"]["net_income"] is None, 2),
            (_into_red, 3), (_falls_1pp, 2),
            (lambda r: _scenario(r) and r["kind"] == "critical_access", 2),
            (lambda r: r["cls"] == build.NOT_EXPANSION, 2), (lambda r: r["cls"] == build.NO_VIII, 2),
            (lambda r: r["cls"] == build.ALL_PAYER, 2)):
        take(_picks([r for r in records if pred(r)], k))
    take(_floor_edges(records))
    rest = [r for r in records if r["ccn"] not in chosen and _scenario(r)]
    take(_picks(rest, max(HOSPITALS - len(chosen), 0)))
    return sorted(chosen.values(), key=lambda r: r["ccn"])


def cases(records=None, states=None):
    """The cases document, from the real records (read from the pins unless given)."""
    if records is None:
        *_, states, records = emit_medicaid.records_from_pins()
    picked = pick_hospitals(records)
    hospitals = [{"id": f"h{i + 1:02d}", "cls": r["cls"], "kind": r["kind"], "share": r["share"],
                  "declines": {sid: (states.get(r["state"], {}).get("declines") or {}).get(sid, 0.0)
                               for sid in params.SCENARIO_IDS},
                  "base": {k: r["base"][k] for k in BASE_FIELDS}} for i, r in enumerate(picked)]

    def run(r, sid, use, line2_5):
        return build.score(r, states.get(r["state"], {}), sid, r["share_factor"], use=use, line2_5=line2_5)

    scenario_cases = []
    for sid in params.SCENARIO_IDS:
        for use in USES:
            for line2_5 in (False, True) if use == params.USE_DEFAULT else (False,):
                for h, r in zip(hospitals, picked):
                    scenario_cases.append({"hospital": h["id"], "scenario": sid, "use": use, "line2_5": line2_5,
                                           "expected": run(r, sid, use, line2_5)})
    rollup_cases = []
    for sid in params.SCENARIO_IDS:
        for use in USES:
            for line2_5 in (False, True) if use == params.USE_DEFAULT else (False,):
                pairs = [(r["base"], run(r, sid, use, line2_5)) for r in picked]
                rollup_cases.append({"scenario": sid, "use": use, "line2_5": line2_5,
                                     "expected": rollup.roll_up(pairs, line2_5)})
    return {"description": "Cases for engine/js/medicaid (the JS port of pp_engine.medicaid.exposure.scenario and "
                           "rollup.roll_up), generated from the real FY2023 records by pp_pipeline.medicaid.conformance. "
                           "A scenario case runs one hospital's base, share and the scenario's decline; a roll-up case "
                           "rolls up all the hospitals for one scenario, use rate and revenue base. Expected keys are "
                           "Python's (snake_case). Compare within 1e-6 relative (absolute when the expected value is "
                           "0); null must match exactly.",
            "hospitals": hospitals, "cases": scenario_cases, "rollups": rollup_cases}


def dumps(doc):
    """The file's text: one line per hospital and per case, keys in order, floats as repr (JavaScript parses them back
    to the same doubles)."""
    parts = [f'  "description": {json.dumps(doc["description"])}']
    for key in ("hospitals", "cases", "rollups"):
        lines = ",\n".join("    " + json.dumps(item, separators=(", ", ": ")) for item in doc[key])
        parts.append(f'  "{key}": [\n{lines}\n  ]')
    return "{\n" + ",\n".join(parts) + "\n}\n"


def main(path=PATH):
    try:
        doc = cases()
    except (ValueError, KeyError, OSError) as err:
        print(f"medicaid conformance: not written: {err}", file=sys.stderr)
        return 1
    Path(path).write_text(dumps(doc), encoding="utf-8")
    print(f"wrote {Path(path).relative_to(REPO_ROOT)}: {len(doc['hospitals'])} hospitals, {len(doc['cases'])} "
          f"scenario cases, {len(doc['rollups'])} roll-ups")
    return 0
