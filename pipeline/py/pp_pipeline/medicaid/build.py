"""Run the exposure scenarios for every active acute-care and critical access hospital in the hospital master and write
the results.

    python3 -I pipeline/py/pp_pipeline/medicaid/cli.py build --hcris <hcris_wide.csv> --out <dir>
        [--master <hospital_master.json>] [--dollars <dollars.json>]

`--hcris` is the HCRIS layer's wide table (pp_pipeline.hcris.extract); only the base year's rows are read. The master
and the dollar estimates default to the newest emitted years. Writes to `<dir>`: `hospitals.csv` (one row per
hospital), `hospitals.json` (the same records, with the inputs the explorer recomputes from), and `results.json`
(state and national roll-ups for each scenario, the sensitivities, the state inputs and their pins).
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path

from pp_engine import geo
from pp_engine.medicaid import exposure, params, rollup, shares
from pp_pipeline.medicaid import inputs

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
    base = {code_of(n): s for n, s in shares.state_shares(viii_rows, fy).items() if code_of(n)}
    later = {code_of(n): s for n, s in shares.state_shares(viii_rows, fy + 1).items() if code_of(n)}
    dsh = {r["state"]: float(r["dsh_inpatient_hospital"] or 0) + float(r["dsh_mental_health_facility"] or 0)
           for r in fmr_rows}
    fmr_total = {r["state"]: float(r["map_total_net_expenditures"]) for r in fmr_rows}
    urban = {r["state"]: r for r in urban_rows}
    out = {}
    for code in sorted(set(base) | set(urban)):
        s, u = base.get(code), urban.get(code)
        entry = {"name": geo.STATE_NAMES.get(code, code), "share": None, "basis": None}
        if s is not None:
            entry.update(share=s.share, basis=s.basis, first=s.first, last=s.last, viii=s.viii, total=s.total)
            nxt = later.get(code)
            entry["share_next_year"] = nxt.share if nxt else None
            # Net of DSH only where the FMR covers the same year; elsewhere the base share stands in.
            entry["share_net_of_dsh"] = (s.viii / (s.total - dsh[code]) if s.basis == f"ffy{fy}" and code in dsh
                                         else s.share)
            if code in fmr_total:
                entry["total_vs_fmr"] = s.total / fmr_total[code] if s.basis == f"ffy{fy}" else None
        if u is None:
            entry["class"] = NOT_EXPANSION
        else:
            entry["declines"] = {sid: -int(u[col + "_pct"]) / 100 for sid, col in params.SCENARIOS}
            entry["urban_thousands"] = {sid: -int(u[col + "_thousands"]) for sid, col in params.SCENARIOS}
            entry["class"] = SCENARIO if s is not None else NO_VIII
        out[code] = entry
    return out


def read_hcris(path, year=params.BASE_YEAR):
    """{ccn: row} for the year's rows of the HCRIS wide table."""
    with open(path, newline="", encoding="utf-8") as f:
        return {r["ccn"]: r for r in csv.DictReader(f) if r["year"] == str(year)}


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


def _operating_margin(row):
    """A raw row's operating margin (G-3 line 5 over line 3), for the outlier fence; None without one."""
    if row is None or not row.get("net_patient_revenue") or not row.get("net_income_patients"):
        return None
    npr = float(row["net_patient_revenue"])
    return float(row["net_income_patients"]) / npr if npr > 0 else None


def hospital_records(master, hcris, states, programs, fence=None):
    """One record per active acute-care or critical access hospital: identity, base, class, each scenario's result.
    `fence`: the operating-margin outlier range (default: exposure.margin_fence over these hospitals)."""
    universe = [h for h in master["hospitals"] if h["kind"] in KINDS and h["inactive"] is None]
    fence = fence or exposure.margin_fence(_operating_margin(hcris.get(h["ccn"])) for h in universe)
    out = []
    for h in universe:
        st = states.get(h["state"], {"class": NOT_EXPANSION, "share": None})
        rec = {"ccn": h["ccn"], "name": h["name"], "city": h["city"], "state": h["state"], "kind": h["kind"],
               "urban": h["urban"], "beds": h["beds"], "own": h["own"], "teach": h["teach"], "lat": h["lat"],
               "lon": h["lon"], "programs": programs.get(h["ccn"])}
        row = hcris.get(h["ccn"])
        if row is None:
            rec.update(cls=NO_REPORT, base=None, results=None)
            out.append(rec)
            continue
        base = exposure.hospital_base(row)
        margin = _operating_margin(row)
        if margin is not None and base["has_margin"] and not fence[0] <= margin <= fence[1]:
            base["margin_outlier"] = True
            base["flags"].append("margin_outlier")
        share = st["share"] if st["class"] == SCENARIO else None
        declines = st.get("declines") or {}
        rec.update(cls=st["class"], base=base, share=share,
                   results={sid: exposure.scenario(base, share, declines.get(sid, 0.0)) for sid in params.SCENARIO_IDS})
        out.append(rec)
    return out


def settled_share(records):
    with_base = [r for r in records if r["base"] is not None]
    return sum(r["base"]["status"] == "settled" for r in with_base) / len(with_base)


def roll(records, scenario_id, share_key="share", line2_5=False, use=params.USE_DEFAULT, states=None, where=None):
    """National (and by-state) roll-ups for one scenario, optionally with another share, revenue base or use multiple,
    over the records `where` keeps."""
    pairs, by_state = [], {}
    for r in records:
        if r["base"] is None or (where and not where(r)):
            continue
        if share_key == "share" and not line2_5 and use == params.USE_DEFAULT:
            res = r["results"][scenario_id]
        else:
            st = states[r["state"]] if r["state"] in states else {}
            share = st.get(share_key) if r["cls"] == SCENARIO else None
            res = exposure.scenario(r["base"], share, (st.get("declines") or {}).get(scenario_id, 0.0), use, line2_5)
        pairs.append((r["base"], res))
        by_state.setdefault(r["state"], []).append((r["base"], res))
    return rollup.roll_up(pairs), {s: rollup.roll_up(p) for s, p in sorted(by_state.items())}


def _clean(d, places=6):
    return {k: (round(v, places) if isinstance(v, float) else v) for k, v in d.items()}


def results(records, states):
    nat, by_state, sens = {}, {}, {}
    for sid in params.SCENARIO_IDS:
        n, s = roll(records, sid)
        nat[sid] = _clean(n)
        for code, v in s.items():
            by_state.setdefault(code, {})[sid] = _clean(v)
        for label, kw in (("line2_5", {"line2_5": True}), ("share_next_year", {"share_key": "share_next_year"}),
                          ("share_net_of_dsh", {"share_key": "share_net_of_dsh"}), ("use_0.75", {"use": params.USE_MIN}),
                          ("use_1.25", {"use": params.USE_MAX})):
            sens.setdefault(label, {})[sid] = _clean(roll(records, sid, states=states, **kw)[0])
    groups = {}
    for label, where in (("critical_access", lambda r: r["kind"] == "critical_access"),
                         ("acute", lambda r: r["kind"] == "acute"),
                         ("rural", lambda r: r["kind"] == "critical_access" or r["urban"] is False),
                         ("urban", lambda r: r["kind"] != "critical_access" and r["urban"] is True),
                         ("expansion_states", lambda r: r["cls"] == SCENARIO)):
        groups[label] = {sid: _clean(roll(records, sid, where=where)[0]) for sid in params.SCENARIO_IDS}
    return nat, by_state, sens, groups


HOSPITAL_COLUMNS = ("ccn", "name", "city", "state", "kind", "cls", "status", "period_begin", "period_end",
                    "period_days", "factor", "flags", "share", "medicaid_net_revenue", "medicaid_supplemental",
                    "medicaid_cost", "cost_ratio", "net_patient_revenue", "net_income_patients", "net_income",
                    "other_income", "uncompensated_cost")


def hospital_rows(records):
    """Flat rows for hospitals.csv: identity, base and, per scenario, revenue lost, added uncompensated care and the
    margins after."""
    cols = list(HOSPITAL_COLUMNS)
    for sid in params.SCENARIO_IDS:
        cols += [f"{sid}_{k}" for k in ("lost", "added_uncompensated", "uncompensated_change", "operating_margin_after",
                                        "total_margin_after")]
    cols += ["operating_margin", "total_margin"]
    rows = []
    for r in records:
        b, res = r["base"] or {}, r["results"] or {}
        flat = {"ccn": r["ccn"], "name": r["name"], "city": r["city"], "state": r["state"], "kind": r["kind"],
                "cls": r["cls"], "share": r.get("share"), "flags": " ".join(b.get("flags", []))}
        for k in HOSPITAL_COLUMNS:
            if k not in flat:
                flat[k] = b.get(k)
        for sid, v in res.items():
            for k in ("lost", "added_uncompensated", "uncompensated_change", "operating_margin_after",
                      "total_margin_after"):
                flat[f"{sid}_{k}"] = v[k]
            flat["operating_margin"], flat["total_margin"] = v["operating_margin"], v["total_margin"]
        rows.append([("" if flat.get(c) is None else (round(flat[c], 6) if isinstance(flat[c], float) else flat[c]))
                     for c in cols])
    return cols, rows


def explorer_record(r):
    """The compact record the explorer recomputes from: its inputs, not its results (the page reruns steps 1 to 4)."""
    b = r["base"]
    out = {"c": r["ccn"], "n": r["name"], "ci": r["city"], "s": r["state"], "k": "C" if r["kind"] == "critical_access"
           else "A", "u": r["urban"], "bd": r["beds"], "o": r["own"], "t": r["teach"], "cl": r["cls"],
           "la": r["lat"], "lo": r["lon"], "p": r["programs"]}
    if b is not None:
        out.update(st=b["status"], pb=b["period_begin"], pe=b["period_end"], pd=b["period_days"], f=_r(b["factor"], 4),
                   fl=b["flags"], m2=_r(b["medicaid_net_revenue"]), m5=_r(b["medicaid_supplemental"]),
                   mc=_r(b["medicaid_cost"]), cr=_r(b["cost_ratio"], 4), cr5=_r(b["cost_ratio_line2_5"], 4),
                   npr=_r(b["net_patient_revenue"]), nip=_r(b["net_income_patients"]), ni=_r(b["net_income"]),
                   oi=_r(b["other_income"]), uc=_r(b["uncompensated_cost"]), md=_r(b["medicaid_days_all"]),
                   dt=_r(b["days_total"]), sf=_r(b["medicaid_shortfall"]), hm=b["has_margin"],
                   sc=b["scored"], mo=b["margin_outlier"])
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
    ap.add_argument("--hcris", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--master", default=str(MASTER))
    ap.add_argument("--dollars", default=str(DOLLARS))
    a = ap.parse_args(argv)
    states = state_table(inputs.read_csv(inputs.VIII), inputs.read_csv(inputs.URBAN), inputs.read_csv(inputs.FMR))
    master = json.loads(Path(a.master).read_text(encoding="utf-8"))
    dollars = json.loads(Path(a.dollars).read_text(encoding="utf-8"))
    records = hospital_records(master, read_hcris(a.hcris), states, program_dollars(dollars))
    nat, by_state, sens, groups = results(records, states)
    settled = settled_share(records)
    counts = {}
    for r in records:
        counts[r["cls"]] = counts.get(r["cls"], 0) + 1
    flags = {}
    for r in records:
        for fl in (r["base"] or {}).get("flags", []):
            flags[fl] = flags.get(fl, 0) + 1
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    cols, rows = hospital_rows(records)
    with open(out / "hospitals.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(cols)
        w.writerows(rows)
    (out / "hospitals.json").write_text(json.dumps([explorer_record(r) for r in records], separators=(",", ":")),
                                        encoding="utf-8")
    meta = {"base_year": params.BASE_YEAR, "settled_share": round(settled, 4),
            "early": settled < params.EARLY_SETTLED_SHARE,
            "params": {"uninsured_share": params.UNINSURED_SHARE, "care_still_used": params.CARE_STILL_USED,
                       "use_min": params.USE_MIN, "use_default": params.USE_DEFAULT, "use_max": params.USE_MAX,
                       "max_cost_ratio": params.MAX_COST_RATIO, "scenarios": dict(params.SCENARIOS)},
            "counts": counts, "flags": flags,
            "inputs": {"pinned": inputs.sources(),
                       "hcris_wide": {"path": Path(a.hcris).name, "sha256": sha256_of(a.hcris)},
                       "master": {"path": _shown(a.master), "fy": master["fy"], "built_at": master["built_at"]},
                       "dollars": {"path": _shown(a.dollars), "fy": dollars["fy"], "built_at": dollars["built_at"]}}}
    (out / "results.json").write_text(json.dumps({"meta": meta, "states": states, "national": nat,
                                                  "by_state": by_state, "sensitivities": sens, "groups": groups},
                                                 indent=1, sort_keys=True), encoding="utf-8")
    print(f"medicaid: {len(records)} hospitals ({counts}); wrote {out}")
    return 0
