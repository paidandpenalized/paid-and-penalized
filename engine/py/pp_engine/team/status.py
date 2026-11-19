"""Each hospital's TEAM status: on CMS's participant list, or the first rule that explains why not.

TEAM is mandatory for acute care hospitals paid under the IPPS in the core-based statistical areas (CBSAs) CMS selected
(42 CFR 512.515), except Maryland's and Indian Health Service or tribal hospitals; others joined voluntarily. CMS
publishes the list, not the reasons, so a hospital off the list is explained here from public data, rule by rule:
Maryland; its county outside every selected area; in an area but not an acute IPPS hospital; IHS or tribal; and
otherwise unlisted (CMS's list leaves out a hospital the rules would include; it may have opened, closed or converted
since). A hospital on the CJR-X list (Medicare's comprehensive joint replacement expanded model) carries that too.

Status codes, each [code, arg]:
  in [participation]     on the list and active in performance year 2 ('mandatory' or 'voluntary')
  in27 [start]           on the list, starting on or after performance year 2 begins (ISO date)
  ended [end]            on the list, participation ended before performance year 2 (ISO date)
  maryland               Maryland hospital (paid under the state's all-payer model)
  outside [kind]         county in no selected area (the hospital master's kind)
  in_area_kind [kind]    in a selected area, but not an acute care hospital paid under the IPPS
  ihs                    in a selected area, Indian Health Service or tribal
  unlisted               in a selected area, acute and IPPS, yet not on the list
  area_unknown           its county could not be placed, in a state that has a selected area
  cjrx [[code, arg]]     on the CJR-X list; the inner pair is the reason above
"""
from collections import defaultdict, namedtuple

from pp_engine import geo

# Performance year 2 is calendar 2027 (§ 512.505, "performance year"); the file describes it.
PY2_START = "2027-01-01"
MARYLAND = "MD"
TRIBAL = "Tribal"  # Care Compare's ownership value for a tribally owned hospital (the master's ownDetail)
STATE_FIPS_PREFIX = {abbr: fips for abbr, fips, _ in geo.STATES}

# The selected areas as counties: `counties`, FIPS codes in a selected CBSA; `states`, the states holding any of them.
Area = namedtuple("Area", "counties states")


def place_counties(hospitals, crosswalk, shapes):
    """({ccn: county FIPS}, {ccn: how it was placed}) for every hospital the rules can place, in this order:
    `fips`, the master's own (the IPPS impact file's); `name`, the master's county name matched in its state against
    the crosswalk; `point`, the master's map point inside a county shape (`shapes`, geo.Counties, or None) whose FIPS
    the crosswalk has; `city`, the county every other placed hospital in the same city and state shares. A county the
    crosswalk does not have (Connecticut's old counties, renamed Alaska areas) is not a placement."""
    in_crosswalk = {r["fips"] for r in crosswalk}
    by_name = defaultdict(set)
    for r in crosswalk:
        by_name[geo.county_key(r["state"], r["county"])].add(r["fips"])
    placed, routes = {}, {}

    def put(ccn, fips, route):
        placed[ccn], routes[ccn] = fips, route

    for h in hospitals:
        st = h["state"]
        if h.get("fips") in in_crosswalk:
            put(h["ccn"], h["fips"], "fips")
            continue
        if h.get("county"):
            key = geo.county_key(st, h["county"])
            hits = by_name.get(key) or by_name.get(geo.city_stem(key)) or set()
            if len(hits) == 1:
                put(h["ccn"], next(iter(hits)), "name")
                continue
        fips = _point_county(h, shapes, in_crosswalk)
        if fips:
            put(h["ccn"], fips, "point")
    by_city = defaultdict(set)
    for h in hospitals:
        if h["ccn"] in placed and h.get("city"):
            by_city[(h["state"], h["city"].lower())].add(placed[h["ccn"]])
    for h in hospitals:
        if h["ccn"] not in placed and h.get("city"):
            hits = by_city.get((h["state"], h["city"].lower()), set())
            if len(hits) == 1:
                put(h["ccn"], next(iter(hits)), "city")
    return placed, routes


def _point_county(h, shapes, in_crosswalk):
    """The crosswalk county whose shape holds the hospital's map point, or None."""
    if shapes is None or h.get("lat") is None or h.get("lon") is None:
        return None
    prefix = STATE_FIPS_PREFIX.get(h["state"])
    hits = [f for f, polys in shapes.shape.items()
            if f[:2] == prefix and f in in_crosswalk and geo.km_outside(h["lat"], h["lon"], polys) == 0]
    return hits[0] if len(hits) == 1 else None


def selected_area(participants, crosswalk, placed, state_of):
    """The selected areas as counties. A selected CBSA is one that holds a mandatory participant (voluntary ones may
    sit anywhere). A county is in one when the crosswalk's CBSA code for it is a selected CBSA, when a mandatory
    participant sits in it, or when it shares its crosswalk code with a county where a mandatory participant sits:
    the crosswalk gives large metros' metropolitan divisions in place of their CBSA and leaves micropolitan counties
    blank. A code reached that way must belong to one selected CBSA only. `placed` is place_counties' map, `state_of`
    {ccn: state}."""
    mandatory = [r for r in participants if r["participation"] == "mandatory"]
    selected = {r["cbsa"] for r in mandatory}
    code = {r["fips"]: r["cbsa"] for r in crosswalk}
    sites = {placed[r["ccn"]]: r for r in mandatory if r["ccn"] in placed}
    parent = defaultdict(set)
    for fips, r in sites.items():
        if code.get(fips) and code[fips] not in selected:
            parent[code[fips]].add(r["cbsa"])
    split = sorted(c for c, ps in parent.items() if len(ps) > 1)
    if split:
        raise ValueError(f"county-CBSA crosswalk: {len(split)} code(s) hold participants of more than one CBSA")
    reach = selected | set(parent)
    counties = {f for f, c in code.items() if c in reach} | set(sites)
    state_by_fips = {r["fips"]: r["state"] for r in crosswalk}
    states = {state_by_fips[f] for f in counties if f in state_by_fips}
    states |= {state_of[r["ccn"]] for r in mandatory if r["ccn"] in state_of}
    return Area(counties, states)


def listed_code(entry):
    """[code, arg] for a hospital on the TEAM list."""
    if entry["end"] < PY2_START:
        return ["ended", entry["end"]]
    if entry["start"] >= PY2_START:
        return ["in27", entry["start"]]
    return ["in", entry["participation"]]


def reason_code(h, placed, area):
    """[code, arg] for a hospital off the TEAM list: the first rule that explains why."""
    if h["state"] == MARYLAND:
        return ["maryland", None]
    fips = placed.get(h["ccn"])
    if fips is None:
        return ["outside", h["kind"]] if h["state"] not in area.states else ["area_unknown", None]
    if fips not in area.counties:
        return ["outside", h["kind"]]
    if not (h["kind"] == "acute" and h["ipps"]):
        return ["in_area_kind", h["kind"]]
    if "IHS" in h["types"] or h.get("ownDetail") == TRIBAL:
        return ["ihs", None]
    return ["unlisted", None]


def status_of(h, listed, cjrx, placed, area):
    """[code, arg] for master hospital `h`: `listed`, its TEAM list row or None; `cjrx`, the CJR-X CCNs."""
    if listed is not None:
        return listed_code(listed)
    reason = reason_code(h, placed, area)
    return ["cjrx", reason] if h["ccn"] in cjrx else reason
