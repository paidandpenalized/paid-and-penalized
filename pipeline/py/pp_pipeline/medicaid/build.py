"""The Medicaid work-requirement scenarios, step by step: the state table (VIII shares, Urban's declines, each state's
class), one record per acute-care or critical access hospital (identity, measured base, class, each scenario's result)
and the roll-ups. `pp_pipeline.emit_medicaid` writes the result as `data/emitted/medicaid/fy2023/medicaid.json`.

Cost reports come from the HCRIS layer's emitted base year (`data/emitted/hcris/fy2023/hcris.json`, read through
pp_engine.hcris.reader); the master and the dollar estimates are the emitted files of the newest years; the state inputs
are pinned (`pp_pipeline.medicaid.inputs`).
"""
import hashlib
import json
from pathlib import Path

from pp_engine import geo
from pp_engine.hcris import reader, tidy
from pp_engine.medicaid import exposure, params, rollup, safety_net, shares
from pp_pipeline import emit_dollars, emit_hospital
from pp_pipeline.hcris import emit as emit_hcris

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
ALL_PAYER = "all_payer"          # in Urban's table, but HSCRC sets every payer's hospital rates and builds
#                                  uncompensated care into them, so a lost Medicaid dollar isn't the hospital's loss
ALL_PAYER_STATES = ("MD",)
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
            entry["class"] = (ALL_PAYER if code in ALL_PAYER_STATES else SCENARIO if s is not None else NO_VIII)
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


# The master's ownership field (`own`), mapped to the roll-up groups; Unknown and blank ownership are in no group.
OWNERSHIP = {"public": "Government", "nonprofit": "Nonprofit", "forprofit": "For-profit"}


def results(records, states):
    """(national, by state, sensitivities, groups) roll-ups, each {scenario id: roll-up}. Maryland's hospitals (class
    `all_payer`) are out of the national, sensitivity and group roll-ups, as they are out of the ranking; `by_state`
    still lists the state, with no dollars."""
    counted = [r for r in records if r["cls"] != ALL_PAYER]
    nat, by_state, sens = {}, {}, {}
    for sid in params.SCENARIO_IDS:
        nat[sid] = _clean(roll(counted, sid))
        for code, v in roll_by_state(records, sid).items():
            by_state.setdefault(code, {})[sid] = _clean(v)
        for label, kw in (("line2_5", {"line2_5": True}), ("share_next_year", {"share_key": "share_next_year"}),
                          ("share_net_of_dsh", {"share_key": "share_net_of_dsh"}),
                          (f"use_{params.USE_MIN}", {"use": params.USE_MIN}),
                          (f"use_{params.USE_MAX}", {"use": params.USE_MAX}), ("state_share_only", {"factor": 1.0})):
            sens.setdefault(label, {})[sid] = _clean(roll(counted, sid, states=states, **kw))
    groups = {}
    for label, where in (("critical_access", lambda r: r["kind"] == "critical_access"),
                         ("acute", lambda r: r["kind"] == "acute"),
                         ("rural", lambda r: r["kind"] == "critical_access" or r["urban"] is False),
                         ("urban", lambda r: r["kind"] != "critical_access" and r["urban"] is True),
                         ("expansion_states", lambda r: r["cls"] == SCENARIO),
                         ("safety_net", lambda r: bool(r["safety_net"])),
                         *((label, lambda r, own=own: r["own"] == own) for label, own in OWNERSHIP.items()),
                         ("beds_lt50", lambda r: r["beds"] is not None and r["beds"] < 50),
                         ("beds_300plus", lambda r: r["beds"] is not None and r["beds"] >= 300)):
        groups[label] = {sid: _clean(roll(counted, sid, where=where)) for sid in params.SCENARIO_IDS}
    return nat, by_state, sens, groups
