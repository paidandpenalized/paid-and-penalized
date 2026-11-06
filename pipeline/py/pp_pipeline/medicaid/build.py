"""Run the exposure scenarios for every active acute-care and critical access hospital in the hospital master and write
the results.

    python3 -I pipeline/py/pp_pipeline/medicaid/cli.py build --out <dir>
        [--hcris <hcris.json>] [--master <hospital_master.json>] [--dollars <dollars.json>]

Cost reports come from the HCRIS layer's emitted base year (`data/emitted/hcris/fy2023/hcris.json`, read through
pp_engine.hcris.reader; `--hcris` names another copy). The master and the dollar estimates default to the newest
emitted years. Writes to `<dir>`: `hospitals.csv` (one row per
hospital), `hospitals.json` (the same records, with the inputs the explorer recomputes from), and `results.json`
(state and national roll-ups for each scenario, the sensitivities, the state inputs and their pins).
"""
import argparse
import csv
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

from pp_engine import geo
from pp_engine.hcris import reader, tidy
from pp_engine.medicaid import exposure, params, rollup, safety_net, shares
from pp_pipeline import emit_dollars, emit_hospital
from pp_pipeline.files import REPO_ROOT, read_json
from pp_pipeline.hcris import emit as emit_hcris
from pp_pipeline.medicaid import inputs
from pp_pipeline.medicaid.safety_net import read_cuts

MASTER_FY = 2027   # the hospital master's year (names, states, kinds)
DOLLARS_FY = 2026  # the Medicare penalty estimates' year (the cross-program view)
MASTER = emit_hospital.emitted_path(MASTER_FY)
DOLLARS = emit_dollars.emitted_path(DOLLARS_FY)
KINDS = tuple(kind for kind, _, _ in tidy.KINDS)  # the HCRIS layer's facility kinds: acute and critical access
# CMS-64's state names that differ from pp_engine.geo's.
CMS64_NAMES = {"Dist. Of Col.": "DC"}
CODE_OF_NAME = {name: code for code, _, name in geo.STATES}

# A state's class, which every hospital in it carries.
SCENARIO = "scenario"            # in Urban's table, with a VIII group in CMS-64
NO_VIII = "no_viii_group"        # in Urban's table, without a VIII group (Wisconsin's waiver adults)
NOT_EXPANSION = "not_expansion"  # not in Urban's table: did not expand Medicaid (or a territory)
NO_REPORT = "no_cost_report"     # a hospital without a base-year cost report


def code_of(cms64_name):
    return CMS64_NAMES.get(cms64_name) or CODE_OF_NAME.get(cms64_name)


def state_table(viii_rows, urban_rows, fmr_rows, fy=params.BASE_YEAR):
    """{state code: inputs}: the VIII share for the base year (and the next year, and net of DSH, as sensitivities),
    Urban's three declines as fractions and their enrollment counts, and the state's class."""
    both = {code_of(n): s for n, s in shares.state_shares(viii_rows, fy, fy + 1).items() if code_of(n)}
    base = {code: s[0] for code, s in both.items()}
    later = {code: s[1] for code, s in both.items()}
    fmr = {r["state"]: r for r in fmr_rows}
    urban = {r["state"]: r for r in urban_rows}
    out = {}
    for code in sorted(set(base) | set(urban)):
        s, u = base.get(code), urban.get(code)
        entry = {"name": geo.STATE_NAMES.get(code, code), "share": None, "basis": None}
        if s is not None:
            entry.update(share=s.share, basis=s.basis, first=s.first, last=s.last, viii=s.viii, total=s.total)
            nxt = later.get(code)
            entry["share_next_year"] = nxt.share if nxt else None
            f = fmr.get(code)
            if f is None:
                entry["share_net_of_dsh"] = s.share
            else:
                dsh = float(f["dsh_inpatient_hospital"] or 0) + float(f["dsh_mental_health_facility"] or 0)
                entry["share_net_of_dsh"] = shares.net_of(s, dsh, fy)
                # The CMS-64 file's total over the FMR's, a vintage check (states revise for about two years).
                entry["total_vs_fmr"] = (s.total / float(f["map_total_net_expenditures"]) if s.basis == f"ffy{fy}"
                                         else None)
        if u is None:
            entry["class"] = NOT_EXPANSION
        else:
            entry["declines"] = {sid: -int(u[col + "_pct"]) / 100 for sid, col in params.SCENARIOS}
            entry["urban_thousands"] = {sid: -int(u[col + "_thousands"]) for sid, col in params.SCENARIOS}
            entry["class"] = SCENARIO if s is not None else NO_VIII
        out[code] = entry
    return out


def read_hcris(path=None, year=params.BASE_YEAR):
    """(the HCRIS layer's year as a reader.Year: its rows, settled share and early flag; the file's SHA-256), from the
    emitted file, read once."""
    path = Path(path) if path else emit_hcris.emitted_path(year)
    data = path.read_bytes()
    y = reader.Year(json.loads(data))
    if y.year != year:
        raise ValueError(f"{path}: FY{y.year}, not the base year FY{year}")
    return y, hashlib.sha256(data).hexdigest()


def program_dollars(dollars):
    """{ccn: the other programs' FY estimates this site already computes} from the dollar estimates file."""
    out = {}
    for h in dollars["hospitals"]:
        if h.get("status") != "estimated":
            continue
        out[h["ccn"]] = {"medicare": h["total"], "hrrp": h["hrrp"], "hac": h["hac"], "hvbp": h["hvbp"], "net": h["net"],
                         "hrrp_factor": h["hrrpFactor"], "hac_cut": h["cut"]}
    return out


def _r(value, places=0):
    if value is None:
        return None
    v = round(value, places)
    return int(v) if places == 0 else v


def share_for(rec, st, factor, share_key="share"):
    """The expansion share a record is scored with, for a hospital in a scenario state only: its state's VIII share
    scaled by `factor` (exposure.hospital_share): the record's own `share_factor`, or 1 for the state's share unchanged
    (the method before 2026-11-05, kept as a sensitivity)."""
    if rec["cls"] != SCENARIO:
        return None
    return exposure.hospital_share(st.get(share_key), factor)


def score(rec, st, scenario_id, factor, share_key="share", use=params.USE_DEFAULT, line2_5=False):
    """Steps 1 to 4 for one record under its state's inputs `st`, its state share scaled by `factor`."""
    return exposure.scenario(rec["base"], share_for(rec, st, factor, share_key),
                             (st.get("declines") or {}).get(scenario_id, 0.0), use, line2_5)


def hospital_records(master, hcris, states, programs, cuts, fence=None):
    """One record per active acute-care or critical access hospital: identity, base, class, each scenario's result.
    `hcris`: {ccn: HCRIS layer row} for the base year. `cuts`: the safety-net flag's MIUR cut by state.
    `fence`: the operating-margin outlier range (default: exposure.margin_fence over these hospitals' bases).
    Each record's `share_factor` comes from its state's non-maternity day ratio, over the state's hospitals here."""
    out = []
    for h in master["hospitals"]:
        if h["kind"] not in KINDS or h["inactive"] is not None:
            continue
        row = hcris.get(h["ccn"])
        rec = {"ccn": h["ccn"], "name": h["name"], "city": h["city"], "state": h["state"], "kind": h["kind"],
               "urban": h["urban"], "beds": h["beds"], "own": h["own"], "lat": h["lat"], "lon": h["lon"],
               "programs": programs.get(h["ccn"]), "base": None, "results": None, "share": None,
               "state_share": None, "state_ratio": None, "share_factor": None, "safety_net": None,
               "cls": NO_REPORT if row is None else states.get(h["state"], {}).get("class", NOT_EXPANSION)}
        if row is not None:
            b = rec["base"] = exposure.hospital_base(row)
            rec["safety_net"] = safety_net.reasons(b["miur"], cuts.get(h["state"]), safety_net.low_income_share(b))
        out.append(rec)
    exposure.flag_margin_outliers((r["base"] for r in out if r["base"]), fence)
    ratios = state_ratios(out)
    for rec in out:
        if rec["base"] is not None:
            rec["state_ratio"] = ratios.get(rec["state"])
            factor = rec["share_factor"] = exposure.share_factor(rec["base"], rec["state_ratio"])
            st = states.get(rec["state"], {})
            rec["share"] = share_for(rec, st, factor)
            rec["state_share"] = share_for(rec, st, 1.0)
            rec["results"] = {sid: score(rec, st, sid, factor) for sid in params.SCENARIO_IDS}
    return out


def state_ratios(records):
    """{state: Medicaid-days-weighted non-maternity share} over each state's records with a base."""
    by = {}
    for r in records:
        if r["base"] is not None:
            by.setdefault(r["state"], []).append(r["base"])
    return {code: exposure.nonmaternity_ratio(bases) for code, bases in by.items()}


def roll(records, scenario_id, states=None, where=None, **override):
    """The roll-up for one scenario over the records with a base that `where` keeps. `override` (factor, share_key,
    use, line2_5) reruns steps 1 to 4 for a sensitivity, each record at its own factor unless `factor` is given;
    without it the stored results stand."""
    states, pairs = states or {}, []
    for r in records:
        if r["base"] is None or (where and not where(r)):
            continue
        res = (score(r, states.get(r["state"], {}), scenario_id, **{"factor": r["share_factor"], **override})
               if override else r["results"][scenario_id])
        pairs.append((r["base"], res))
    return rollup.roll_up(pairs, line2_5=override.get("line2_5", False))


def roll_by_state(records, scenario_id):
    """{state: the roll-up of its records' stored results for one scenario}, in state order."""
    groups = {}
    for r in records:
        if r["base"] is not None:
            groups.setdefault(r["state"], []).append((r["base"], r["results"][scenario_id]))
    return {s: rollup.roll_up(p) for s, p in sorted(groups.items())}


def _clean(d, places=6):
    return {k: (round(v, places) if isinstance(v, float) else v) for k, v in d.items()}


def results(records, states):
    nat, by_state, sens = {}, {}, {}
    for sid in params.SCENARIO_IDS:
        nat[sid] = _clean(roll(records, sid))
        for code, v in roll_by_state(records, sid).items():
            by_state.setdefault(code, {})[sid] = _clean(v)
        for label, kw in (("line2_5", {"line2_5": True}), ("share_next_year", {"share_key": "share_next_year"}),
                          ("share_net_of_dsh", {"share_key": "share_net_of_dsh"}),
                          (f"use_{params.USE_MIN}", {"use": params.USE_MIN}),
                          (f"use_{params.USE_MAX}", {"use": params.USE_MAX}), ("state_share_only", {"factor": 1.0})):
            sens.setdefault(label, {})[sid] = _clean(roll(records, sid, states=states, **kw))
    groups = {}
    for label, where in (("critical_access", lambda r: r["kind"] == "critical_access"),
                         ("acute", lambda r: r["kind"] == "acute"),
                         ("rural", lambda r: r["kind"] == "critical_access" or r["urban"] is False),
                         ("urban", lambda r: r["kind"] != "critical_access" and r["urban"] is True),
                         ("expansion_states", lambda r: r["cls"] == SCENARIO),
                         ("safety_net", lambda r: bool(r["safety_net"]))):
        groups[label] = {sid: _clean(roll(records, sid, where=where)) for sid in params.SCENARIO_IDS}
    return nat, by_state, sens, groups


SCENARIO_COLUMNS = ("lost", "added_uncompensated", "uncompensated_change", "operating_margin_after",
                    "total_margin_after")
HOSPITAL_COLUMNS = ("ccn", "name", "city", "state", "kind", "cls", "status", "period_begin", "period_end",
                    "period_days", "flags", "safety_net", "state_share", "share_factor", "share",
                    "medicaid_net_revenue", "medicaid_supplemental", "medicaid_cost", "cost_ratio",
                    "net_patient_revenue", "net_income_patients", "other_operating_income", "net_income",
                    "other_income", "uncompensated_cost")


def hospital_rows(records):
    """Flat rows for hospitals.csv: identity, base, the margins as filed and, per scenario, SCENARIO_COLUMNS."""
    cols = list(HOSPITAL_COLUMNS) + ["patient_margin", "operating_margin", "total_margin"] + [
        f"{sid}_{k}" for sid in params.SCENARIO_IDS for k in SCENARIO_COLUMNS]
    rows = []
    for r in records:
        b, res = r["base"] or {}, r["results"] or {}
        flat = {**b, **{k: r[k] for k in ("ccn", "name", "city", "state", "kind", "cls", "share", "share_factor")},
                "flags": " ".join(b.get("flags", [])), "safety_net": " ".join(r["safety_net"] or ()),
                "state_share": r["state_share"]}
        if res:
            flat["operating_margin"] = res["middle"]["operating_margin"]
            flat["total_margin"] = res["middle"]["total_margin"]
            flat.update({f"{sid}_{k}": v[k] for sid, v in res.items() for k in SCENARIO_COLUMNS})
        rows.append([("" if flat.get(c) is None else (round(flat[c], 6) if isinstance(flat[c], float) else flat[c]))
                     for c in cols])
    return cols, rows


def explorer_record(r):
    """The compact record the explorer recomputes from: its inputs, not its results (the page reruns steps 1 to 4).
    Days: `md` and `dt` are the MIUR's (S-3 I lines 14 + 2 col 7, line 14 col 8); `ma` is the day-count floor's and
    the maternity share's (exposure.medicaid_days: lines 14 + 2 + 32 col 7; null when the hospital keeps its state's
    share for want of days), so few_medicaid_days is `ma` below params.MIN_MEDICAID_DAYS."""
    b = r["base"]
    out = {"c": r["ccn"], "n": r["name"], "ci": r["city"], "s": r["state"], "k": "C" if r["kind"] == "critical_access"
           else "A", "u": r["urban"], "bd": r["beds"], "o": r["own"], "cl": r["cls"],
           "la": r["lat"], "lo": r["lon"], "p": r["programs"]}
    if b is not None:
        days = b["medicaid_days"]
        out.update(st=b["status"], pb=b["period_begin"], pe=b["period_end"], pd=b["period_days"],
                   fl=b["flags"], m2=_r(b["medicaid_net_revenue"]), m5=_r(b["medicaid_supplemental"]),
                   mc=_r(b["medicaid_cost"]), cr=_r(b["cost_ratio"], 4), cr5=_r(b["cost_ratio_line2_5"], 4),
                   npr=_r(b["net_patient_revenue"]), nip=_r(b["net_income_patients"]),
                   oo=_r(b["other_operating_income"]), ni=_r(b["net_income"]), oi=_r(b["other_income"]),
                   uc=_r(b["uncompensated_cost"]), md=_r(b["medicaid_days_all"]), dt=_r(b["days_total"]),
                   ma=None if days is None else _r(days[0]),
                   mt=None if days is None else _r(1 - days[1] / days[0], 4), af=_r(r["share_factor"], 6),
                   sn=list(r["safety_net"]), hm=b["has_margin"], sc=b["scored"], mo=b["margin_outlier"])
    return out


def _shown(path):
    """A path as the results record it: repo-relative when inside the repo, else its file name."""
    p = Path(path).resolve()
    return str(p.relative_to(REPO_ROOT)) if REPO_ROOT in p.parents else p.name


def main(argv):
    ap = argparse.ArgumentParser(prog="medicaid build")
    ap.add_argument("--hcris", default=str(emit_hcris.emitted_path(params.BASE_YEAR)),
                    help="the HCRIS layer's base-year file (default: data/emitted/hcris/fy<base year>/hcris.json)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--master", default=str(MASTER))
    ap.add_argument("--dollars", default=str(DOLLARS))
    a = ap.parse_args(argv)
    pins = inputs.sources()  # sources.json, read once
    states = state_table(*(inputs.read_csv(p, pins=pins) for p in (inputs.VIII, inputs.URBAN, inputs.FMR)))
    master, dollars = read_json(a.master), read_json(a.dollars)
    year, hcris_sha256 = read_hcris(a.hcris)
    hcris = {r["ccn"]: r for r in year.rows}
    if not hcris:
        print(f"medicaid: no FY{params.BASE_YEAR} rows in the HCRIS layer", file=sys.stderr)
        return 1
    records = hospital_records(master, hcris, states, program_dollars(dollars),
                               read_cuts(inputs.read_csv(inputs.STATE_MIUR, pins=pins)))
    for r in records:  # each state's ratio, as hospital_records set it, on its existing entry
        if r["state"] in states and r["state_ratio"] is not None:
            states[r["state"]]["nonmaternity_ratio"] = r["state_ratio"]
    nat, by_state, sens, groups = results(records, states)
    counts = dict(Counter(r["cls"] for r in records))
    flags = dict(Counter(fl for r in records if r["base"] for fl in r["base"]["flags"]))
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    cols, rows = hospital_rows(records)
    with open(out / "hospitals.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(cols)
        w.writerows(rows)
    (out / "hospitals.json").write_text(json.dumps([explorer_record(r) for r in records], separators=(",", ":")),
                                        encoding="utf-8")
    meta = {"base_year": params.BASE_YEAR, "settled_share": year.settled_share, "early": year.early,
            "params": {"uninsured_share": params.UNINSURED_SHARE, "care_still_used": params.CARE_STILL_USED,
                       "use_min": params.USE_MIN, "use_default": params.USE_DEFAULT, "use_max": params.USE_MAX,
                       "max_cost_ratio": params.MAX_COST_RATIO, "min_medicaid_days": params.MIN_MEDICAID_DAYS,
                       "scenarios": dict(params.SCENARIOS)},
            "counts": counts, "flags": flags,
            "inputs": {"pinned": pins,
                       "hcris": {"path": _shown(a.hcris), "sha256": hcris_sha256,
                                 "methods_version": year.methods_version},
                       "master": {"path": _shown(a.master), "fy": master["fy"], "built_at": master["built_at"]},
                       "dollars": {"path": _shown(a.dollars), "fy": dollars["fy"], "built_at": dollars["built_at"]}}}
    (out / "results.json").write_text(json.dumps({"meta": meta, "states": states, "national": nat,
                                                  "by_state": by_state, "sensitivities": sens, "groups": groups},
                                                 indent=1, sort_keys=True), encoding="utf-8")
    print(f"medicaid: {len(records)} hospitals ({counts}); wrote {out}")
    return 0
