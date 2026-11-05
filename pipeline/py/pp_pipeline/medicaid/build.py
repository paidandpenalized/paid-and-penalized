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
from pp_engine.hcris import reader
from pp_engine.medicaid import exposure, params, rollup, safety_net, shares
from pp_pipeline.files import read_json
from pp_pipeline.hcris.emit import emitted_path
from pp_pipeline.medicaid import inputs
from pp_pipeline.medicaid.safety_net import read_cuts

REPO_ROOT = Path(__file__).resolve().parents[4]
MASTER = REPO_ROOT / "data/emitted/hospital/fy2027/hospital_master.json"
DOLLARS = REPO_ROOT / "data/emitted/dollars/fy2026/dollars.json"
KINDS = ("acute", "critical_access")
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
    """The HCRIS layer's year (a reader.Year: rows by CCN, the year's settled share and early flag), from its emitted
    file."""
    y = reader.Year(read_json(Path(path) if path else emitted_path(year)))
    if y.year != year:
        raise ValueError(f"{path}: FY{y.year}, not the base year FY{year}")
    return y


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


def share_for(rec, st, share_key="share", state_only=False):
    """The expansion share a record is scored with, for a hospital in a scenario state only: its state's VIII share
    scaled by its own factor (exposure.hospital_share), or, with `state_only`, the state's share unchanged (the
    method before 2026-11-05, kept as a sensitivity)."""
    if rec["cls"] != SCENARIO:
        return None
    return exposure.hospital_share(st.get(share_key), 1.0 if state_only else rec["base"]["share_factor"])


def score(rec, st, scenario_id, share_key="share", use=params.USE_DEFAULT, line2_5=False, state_only=False):
    """Steps 1 to 4 for one record under its state's inputs `st`."""
    return exposure.scenario(rec["base"], share_for(rec, st, share_key, state_only),
                             (st.get("declines") or {}).get(scenario_id, 0.0), use, line2_5)


def hospital_records(master, hcris, states, programs, cuts, fence=None):
    """One record per active acute-care or critical access hospital: identity, base, class, each scenario's result.
    `hcris`: {ccn: HCRIS layer row} for the base year. `cuts`: the safety-net flag's MIUR cut by CMS state code.
    `fence`: the operating-margin outlier range (default: exposure.margin_fence over these hospitals' bases).
    Each base's `share_factor` is set from its state's non-maternity day ratio, over the state's hospitals here."""
    out = []
    for h in master["hospitals"]:
        if h["kind"] not in KINDS or h["inactive"] is not None:
            continue
        row = hcris.get(h["ccn"])
        rec = {"ccn": h["ccn"], "name": h["name"], "city": h["city"], "state": h["state"], "kind": h["kind"],
               "urban": h["urban"], "beds": h["beds"], "own": h["own"], "lat": h["lat"], "lon": h["lon"],
               "programs": programs.get(h["ccn"]), "base": None, "results": None, "share": None,
               "state_share": None, "state_ratio": None, "safety_net": None,
               "cls": NO_REPORT if row is None else states.get(h["state"], {}).get("class", NOT_EXPANSION)}
        if row is not None:
            b = rec["base"] = exposure.hospital_base(row)
            rec["safety_net"] = safety_net.reasons(b["miur"], cuts.get(h["ccn"][:2]), safety_net.low_income_share(b))
        out.append(rec)
    exposure.flag_margin_outliers((r["base"] for r in out if r["base"]), fence)
    ratios = state_ratios(out)
    for rec in out:
        if rec["base"] is not None:
            rec["state_ratio"] = ratios.get(rec["state"])
            rec["base"]["share_factor"] = exposure.share_factor(rec["base"], rec["state_ratio"])
            st = states.get(rec["state"], {})
            rec["share"] = share_for(rec, st)
            rec["state_share"] = share_for(rec, st, state_only=True)
            rec["results"] = {sid: score(rec, st, sid) for sid in params.SCENARIO_IDS}
    return out


def state_ratios(records):
    """{state: Medicaid-days-weighted non-maternity share} over each state's records with a base."""
    by = {}
    for r in records:
        if r["base"] is not None:
            by.setdefault(r["state"], []).append(r["base"])
    return {code: exposure.nonmaternity_ratio(bases) for code, bases in by.items()}


def roll(records, scenario_id, states=None, where=None, by_state=False, **override):
    """The national roll-up for one scenario over the records `where` keeps (and by state, with `by_state`).
    `override` (share_key, use, line2_5, state_only) reruns steps 1 to 4 for a sensitivity; without it the stored results stand."""
    pairs, groups, states = [], {}, states or {}
    for r in records:
        if r["base"] is None or (where and not where(r)):
            continue
        res = score(r, states.get(r["state"], {}), scenario_id, **override) if override else r["results"][scenario_id]
        pairs.append((r["base"], res))
        if by_state:
            groups.setdefault(r["state"], []).append((r["base"], res))
    return rollup.roll_up(pairs), {s: rollup.roll_up(p) for s, p in sorted(groups.items())}


def _clean(d, places=6):
    return {k: (round(v, places) if isinstance(v, float) else v) for k, v in d.items()}


def results(records, states):
    nat, by_state, sens = {}, {}, {}
    for sid in params.SCENARIO_IDS:
        n, s = roll(records, sid, by_state=True)
        nat[sid] = _clean(n)
        for code, v in s.items():
            by_state.setdefault(code, {})[sid] = _clean(v)
        for label, kw in (("line2_5", {"line2_5": True}), ("share_next_year", {"share_key": "share_next_year"}),
                          ("share_net_of_dsh", {"share_key": "share_net_of_dsh"}), ("use_0.75", {"use": params.USE_MIN}),
                          ("use_1.25", {"use": params.USE_MAX}), ("state_share_only", {"state_only": True})):
            sens.setdefault(label, {})[sid] = _clean(roll(records, sid, states=states, **kw)[0])
    groups = {}
    for label, where in (("critical_access", lambda r: r["kind"] == "critical_access"),
                         ("acute", lambda r: r["kind"] == "acute"),
                         ("rural", lambda r: r["kind"] == "critical_access" or r["urban"] is False),
                         ("urban", lambda r: r["kind"] != "critical_access" and r["urban"] is True),
                         ("expansion_states", lambda r: r["cls"] == SCENARIO),
                         ("safety_net", lambda r: bool(r["safety_net"]))):
        groups[label] = {sid: _clean(roll(records, sid, where=where)[0]) for sid in params.SCENARIO_IDS}
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
        flat = {**b, **{k: r[k] for k in ("ccn", "name", "city", "state", "kind", "cls", "share")},
                "flags": " ".join(b.get("flags", [])), "safety_net": " ".join(r["safety_net"] or ()),
                "state_share": r["state_share"]}
        if b:
            flat["patient_margin"] = exposure.patient_margin(b)
        if res:
            flat["operating_margin"] = res["middle"]["operating_margin"]
            flat["total_margin"] = res["middle"]["total_margin"]
            flat.update({f"{sid}_{k}": v[k] for sid, v in res.items() for k in SCENARIO_COLUMNS})
        rows.append([("" if flat.get(c) is None else (round(flat[c], 6) if isinstance(flat[c], float) else flat[c]))
                     for c in cols])
    return cols, rows


def explorer_record(r):
    """The compact record the explorer recomputes from: its inputs, not its results (the page reruns steps 1 to 4)."""
    b = r["base"]
    out = {"c": r["ccn"], "n": r["name"], "ci": r["city"], "s": r["state"], "k": "C" if r["kind"] == "critical_access"
           else "A", "u": r["urban"], "bd": r["beds"], "o": r["own"], "cl": r["cls"],
           "la": r["lat"], "lo": r["lon"], "p": r["programs"]}
    if b is not None:
        days = exposure.medicaid_days(b)
        out.update(st=b["status"], pb=b["period_begin"], pe=b["period_end"], pd=b["period_days"],
                   fl=b["flags"], m2=_r(b["medicaid_net_revenue"]), m5=_r(b["medicaid_supplemental"]),
                   mc=_r(b["medicaid_cost"]), cr=_r(b["cost_ratio"], 4), cr5=_r(b["cost_ratio_line2_5"], 4),
                   npr=_r(b["net_patient_revenue"]), nip=_r(b["net_income_patients"]),
                   oo=_r(b["other_operating_income"]), ni=_r(b["net_income"]), oi=_r(b["other_income"]),
                   uc=_r(b["uncompensated_cost"]), md=_r(b["medicaid_days_all"]), dt=_r(b["days_total"]),
                   mt=None if days is None else _r(1 - days[1] / days[0], 4), af=_r(b["share_factor"], 6),
                   sn=list(r["safety_net"]), hm=b["has_margin"], sc=b["scored"], mo=b["margin_outlier"])
    return out


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _shown(path):
    """A path as the results record it: repo-relative when inside the repo, else its file name."""
    p = Path(path).resolve()
    return str(p.relative_to(REPO_ROOT)) if REPO_ROOT in p.parents else p.name


def main(argv):
    ap = argparse.ArgumentParser(prog="medicaid build")
    ap.add_argument("--hcris", help="the HCRIS layer's base-year file (default: data/emitted/hcris/fy2023/hcris.json)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--master", default=str(MASTER))
    ap.add_argument("--dollars", default=str(DOLLARS))
    a = ap.parse_args(argv)
    states = state_table(inputs.read_csv(inputs.VIII), inputs.read_csv(inputs.URBAN), inputs.read_csv(inputs.FMR))
    master = json.loads(Path(a.master).read_text(encoding="utf-8"))
    dollars = json.loads(Path(a.dollars).read_text(encoding="utf-8"))
    year = read_hcris(a.hcris)
    hcris = {r["ccn"]: r for r in year.rows}
    if not hcris:
        print(f"medicaid: no FY{params.BASE_YEAR} rows in the HCRIS layer", file=sys.stderr)
        return 1
    records = hospital_records(master, hcris, states, program_dollars(dollars),
                               read_cuts(inputs.read_csv(inputs.STATE_MIUR)))
    for code, ratio in state_ratios(records).items():
        states.setdefault(code, {"name": geo.STATE_NAMES.get(code, code), "share": None, "basis": None,
                                 "class": NOT_EXPANSION})["nonmaternity_ratio"] = ratio
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
    hcris_path = Path(a.hcris) if a.hcris else emitted_path(params.BASE_YEAR)
    meta = {"base_year": params.BASE_YEAR, "settled_share": year.settled_share, "early": year.early,
            "params": {"uninsured_share": params.UNINSURED_SHARE, "care_still_used": params.CARE_STILL_USED,
                       "use_min": params.USE_MIN, "use_default": params.USE_DEFAULT, "use_max": params.USE_MAX,
                       "max_cost_ratio": params.MAX_COST_RATIO, "scenarios": dict(params.SCENARIOS)},
            "counts": counts, "flags": flags,
            "inputs": {"pinned": inputs.sources(),
                       "hcris": {"path": _shown(hcris_path), "sha256": sha256_of(hcris_path),
                                 "methods_version": year.methods_version},
                       "master": {"path": _shown(a.master), "fy": master["fy"], "built_at": master["built_at"]},
                       "dollars": {"path": _shown(a.dollars), "fy": dollars["fy"], "built_at": dollars["built_at"]}}}
    (out / "results.json").write_text(json.dumps({"meta": meta, "states": states, "national": nat,
                                                  "by_state": by_state, "sensitivities": sens, "groups": groups},
                                                 indent=1, sort_keys=True), encoding="utf-8")
    print(f"medicaid: {len(records)} hospitals ({counts}); wrote {out}")
    return 0
