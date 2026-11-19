"""The TEAM file's body from parsed inputs: prices, each participant's episode estimate, target amount and quality
percentiles, the default hospital, a status for every master hospital, and the list CCNs the master lacks.

`build` takes the pins already parsed (pp_pipeline.emit_team reads them) and returns (body, notes); `notes` holds
counts for the build report, never written to the file.
"""
from collections import Counter

from pp_engine import geo
from pp_engine.team import episodes, quality, status

# The price workbook's census divisions 1-9 follow the Census Bureau's numbering, which is geo.DIVISIONS' order.
DIVISION_NUMBER = {name: i for i, name in enumerate(geo.DIVISIONS, start=1)}
# The workbook prices the territories with the Pacific division ("Pacific ... + other US Territories").
TERRITORIES = ("AS", "GU", "MP", "PR", "VI")
TERRITORY_DIVISION = DIVISION_NUMBER["Pacific"]
MEASURES = ("hybrid_hwr", "iscmr")
TRACK2_TYPES = ("SCH", "MDH", "EACH")  # special statuses that make a hospital eligible for Track 2 (§ 512.520(b)(4))
RURAL = "rural"
# The default hospital: the median target among mandatory, active participants with no Track 2 flag and episodes in at
# least this many categories (a hospital that shows most of the calculator).
DEFAULT_MIN_CATEGORIES = 4


def division_of(state):
    """The price workbook's census division (1-9) for a state or territory; an unknown code raises."""
    if state in TERRITORIES:
        return TERRITORY_DIVISION
    _, name = geo.region_of(state)
    if name is None:
        raise ValueError("a participant's state has no census division")
    return DIVISION_NUMBER[name]


def track2_flags(h):
    """The Track 2 eligibility the master shows: SCH, MDH, EACH from its special statuses, and `rural` when the impact
    file puts it outside an urban area. Safety-net status is not public, so an empty list does not rule Track 2 out."""
    flags = [t for t in TRACK2_TYPES if t in h["types"]]
    return flags + [RURAL] if h["urban"] is False else flags


def default_ccn(participants):
    """The lower median, by target then CCN, of mandatory active participants with no Track 2 flag and episodes in
    DEFAULT_MIN_CATEGORIES or more categories."""
    pool = sorted((r for r in participants
                   if r["participation"] == "mandatory" and r["active"] and not r["track2Flags"]
                   and sum(c["n"] > 0 for c in r["cats"].values()) >= DEFAULT_MIN_CATEGORIES),
                  key=lambda r: (r["target"], r["ccn"]))
    if not pool:
        raise ValueError("no participant fits the default-hospital rule")
    return pool[(len(pool) - 1) // 2]["ccn"]


def quality_tables(quality_values, hospitals):
    """{measure: (sorted cohort values, {ccn: percentile})}: the cohort is every IPPS master hospital with a value."""
    ipps = {h["ccn"] for h in hospitals if h["ipps"]}
    out = {}
    for m in MEASURES:
        cohort = {c: v for c, v in quality_values[m].items() if c in ipps}
        out[m] = (sorted(cohort.values()), quality.percentiles(cohort))
    return out


def participant_quality(ccn, quality_values, tables):
    out = {}
    for m in MEASURES:
        v = quality_values[m].get(ccn)
        if v is None:
            out[m] = None
            continue
        cohort, pcts = tables[m]
        out[m] = {"value": v, "pct": pcts[ccn] if ccn in pcts else quality.percentile(v, cohort, in_cohort=False)}
    return out


def participant(entry, h, ctx):
    """One participant's record. `ctx`: prices, averages, DRG categories, source DRGs, the two data years' cells,
    quality values and tables."""
    ccn = entry["ccn"]
    div = str(division_of(h["state"]))
    latest = episodes.allocate(ctx["latest"].get(ccn, {}), ctx["drg_category"])
    prior = episodes.allocate(ctx["prior"].get(ccn, {}), ctx["drg_category"])
    hidden = episodes.hidden_cells(ctx["latest"].get(ccn, {}), ctx["sources"])
    cats = {}
    for cat in episodes.CATEGORIES:
        alloc = latest.get(cat, {})
        n = episodes.episode_count(alloc)
        cats[cat] = {"n": n,
                     "price": episodes.category_price(alloc, ctx["prices"], div, ctx["avg"][cat][div]),
                     "hidden": hidden[cat],
                     "lowVolume": episodes.is_low_volume(episodes.episode_count(prior.get(cat, {})), n)}
    return {"ccn": ccn, "division": int(div), "participation": entry["participation"], "start": entry["start"],
            "end": entry["end"], "active": entry["end"] >= status.PY2_START, "track2Flags": track2_flags(h),
            "cats": cats, "quality": participant_quality(ccn, ctx["quality"], ctx["tables"]),
            "target": episodes.target_amount(latest, ctx["prices"], div)}


def build(participants, price_rows, cjrx, prior, latest, quality_values, hospitals, crosswalk, shapes):
    """(body, notes). `prior`, `latest`: the two data years' {ccn: {drg: discharges}}; `quality_values`:
    {measure: {ccn: value}}; `cjrx`: the CJR-X CCNs; `crosswalk`: [{fips, county, state, cbsa}]; `shapes`:
    geo.Counties or None."""
    prices, avg, drg_category = episodes.price_tables(price_rows)
    if set(avg) != set(episodes.CATEGORIES):
        raise ValueError("price pin: its categories are not the five TEAM categories")
    by_ccn = {h["ccn"]: h for h in hospitals}
    listed = {r["ccn"]: r for r in participants}
    ctx = {"prices": prices, "avg": avg, "drg_category": drg_category,
           "sources": episodes.source_drgs(drg_category), "prior": prior, "latest": latest,
           "quality": quality_values, "tables": quality_tables(quality_values, hospitals)}
    records = [participant(r, by_ccn[r["ccn"]], ctx) for r in participants if r["ccn"] in by_ccn]
    placed, routes = status.place_counties(hospitals, crosswalk, shapes)
    area = status.selected_area(participants, crosswalk, placed, {h["ccn"]: h["state"] for h in hospitals})
    codes = {h["ccn"]: status.status_of(h, listed.get(h["ccn"]), cjrx, placed, area) for h in hospitals}
    body = {
        "prices": {d: dict(sorted(v.items())) for d, v in sorted(prices.items())},
        "categoryAvg": {c: avg[c] for c in episodes.CATEGORIES},
        "drgCategory": dict(sorted(drg_category.items())),
        "participants": records,
        "status": codes,
        "defaultCcn": default_ccn(records),
        "a4": {"teamMissing": sorted(c for c in listed if c not in by_ccn),
               "cjrxMissing": len(set(cjrx) - set(by_ccn))},
    }
    notes = {"routes": Counter(routes.values()), "unplaced": len(hospitals) - len(placed),
             "codes": Counter(c for c, _ in codes.values()),
             "cjrx_reasons": Counter(a[0] for c, a in codes.values() if c == "cjrx")}
    return body, notes
