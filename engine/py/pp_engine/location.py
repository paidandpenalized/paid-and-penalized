"""Where a hospital is: its map point and the county (or independent city) it is in.

Ported from Thirty Day Readmissions (`locate`, `named_city`, `place_name`, `county_label` and `place_hospital` in
pipeline/build_data.py at 80f3659), so the master places every hospital as that site does. `g` is the hospital's
{"zip", "county"} (Care Compare's county name), `imp` its {"fips"} (the impact file's county).
"""
import re
from collections import namedtuple

from pp_engine import geo, names
from pp_engine.parse import SchemaError

STRAY_KM = 40  # a ZIP/county point farther than this outside the impact-file county is replaced by that county's centroid



def locate(g, imp, st, zcta, counties, point=None):
    """(lat, lon, source, county label or None): geocoded street address, else ZIP centroid, else Care Compare
    county, else impact-file county.

    An address point more than STRAY_KM outside the impact-file county is set aside; one inside it overrides a
    Care Compare county that names somewhere else (the label is then that county's atlas name; Virginia's
    "Richmond City" and the atlas's "Richmond" count as the same). A ZIP or Care Compare county point more than
    STRAY_KM outside falls back to the impact-file county's centroid and atlas name. Counties absent from the atlas
    are not checked.
    """
    fips = imp.get("fips")
    key = geo.county_key(st, g.get("county"))
    if point:
        out = geo.km_outside(*point, counties.shape[fips]) if fips in counties.shape else None
        if out is None or out <= STRAY_KM:
            same = out != 0 or geo.city_stem(key) == geo.city_stem(geo.county_key(st, counties.name[fips]))
            return (*point, "address", None if same else counties.name[fips])
    if g.get("zip") in zcta:
        pt, src = zcta[g["zip"]], "zip"
    elif key in counties.by_name:
        pt, src = counties.by_name[key], "county"
    else:
        pt, src = None, None
    if pt and fips in counties.shape and geo.km_outside(*pt, counties.shape[fips]) > STRAY_KM:
        return (*counties.centroid[fips], "county", counties.name[fips])
    if pt:
        return (*pt, src, None)
    if fips in counties.centroid:
        return (*counties.centroid[fips], "county", None)
    return None, None, None, None


CITY_STATES = ("MD", "MO", "NV", "VA")  # states with independent cities: FIPS county codes 500 and up
# Alaska's boroughs and census areas, the District, Puerto Rico's municipios, and the other territories' islands and
# districts (TDR has only the first three: its hospitals are all in the states and DC)
NO_SUFFIX = ("AK", "DC", "PR", "AS", "GU", "MP", "VI")


def independent_city(fips):
    """True for an independent city's FIPS code: county code 500 and up in MD, MO, NV, or VA."""
    return bool(fips) and geo.STATE_FIPS.get(fips[:2]) in CITY_STATES and int(fips[2:]) >= 500


def atlas_fips(st, key, counties):
    """The FIPS codes of the atlas places in state `st` whose name has this geo.county_key."""
    return sorted(f for f, n in counties.name.items() if geo.STATE_FIPS.get(f[:2]) == st and geo.county_key(st, n) == key)


def named_city(key, says, st, fips, point, counties):
    """(city, settled) for Care Compare's county name, normalized (`key`, "X City" without its "City"): city is True for
    an independent city, and None in any state for an "X City" that names no atlas place, which may be either; settled
    is False when the evidence conflicts or runs out, and the caller lists it. `says` is Care Compare's own word, "city"
    ("RICHMOND CITY") or "county" ("ST. LOUIS COUNTY"), else None; a bare name is the county by Care Compare's style.
    Only MD, MO, NV, and VA have independent cities. A name the atlas has once goes by that place ("James City" is a
    county; "Carson City" and "Salem" are cities). Where a county and a city share it ("Fairfax", "St. Louis"), Care
    Compare's word (a bare name's county included) decides when the impact-file county (fips) agrees, so an address
    point just over the line cannot override both; else the one holding the street-address point decides, then Care
    Compare's word, then the impact-file county if it is either. With no address to decide, a bare name the impact file
    puts in the city, or one nothing decides, is unsettled."""
    claim = {"city": True, "county": False}.get(says)
    if claim and key not in counties.by_name:
        return None, False
    if st not in CITY_STATES:
        return False, True
    same = atlas_fips(st, key, counties)
    if not same:
        return False, True
    if len(same) == 1:
        city = independent_city(same[0])
        return city, claim in (None, city)
    by_fips = independent_city(fips) if fips in same else None
    if by_fips is not None and by_fips == bool(claim):
        return by_fips, True
    inside = [f for f in same if point and f in counties.shape and geo.km_outside(*point, counties.shape[f]) == 0]
    if inside:
        city = independent_city(inside[0])
        return city, claim in (None, city)
    if claim is not None:
        return claim, by_fips is None
    return bool(by_fips), False


def place_name(name, st, city):
    """`name` with its legal suffix, as the hospital page shows it: "Butte County", "East Baton Rouge Parish", an
    independent city (`city`) as "Richmond City" (Care Compare's style), and no suffix in AK, DC, and PR, on a name
    that already ends in County or Parish, or when county or city is unknown (`city` None)."""
    if not name or city is None or st in NO_SUFFIX or re.search(r"[\W_](county|parish)\W*$", name, re.I):
        return name
    if st == "LA":
        return f"{name} Parish"
    if city:
        return name if re.search(r"\scity$", name, re.I) else f"{name} City"
    return f"{name} County"


def county_label(g, st, fips, counties, point=None, moved=None):
    """(label, doubt): the hospital's county or independent city with its legal suffix (place_name), and why the rules
    could not check it, or None. The label is Care Compare's name in the atlas's spelling when the atlas knows it for
    that state ("DE KALB" is "DeKalb"), a city when named_city() says so (point: the street-address point, if the map
    kept it). Care Compare's "X City" for an atlas X is the independent city X in the states that have them
    ("RICHMOND CITY"), and elsewhere the county X when the impact file puts the hospital there ("SALT LAKE CITY"; not
    "SIOUX CITY", which is in Woodbury County). Otherwise (typos such as "E. BATON ROUGE", or "THE DISTRICT"), or when
    locate() moved the hospital to the impact-file county (`moved`: its source, "address" for a street address inside
    that county, "county" for a ZIP or county point far outside it), the label is that county's atlas name, a city
    when its FIPS code is one. Doubts: Care Compare's name is missing or unknown; named_city() could not settle county
    or city; or a far-off point, not a street address, moved a hospital from the place Care Compare names."""
    raw = g.get("county")
    key = geo.county_key(st, raw)
    stem = geo.city_stem(key)
    ends_city = key not in counties.by_name and stem != key  # "RICHMOND CITY", which the atlas has as "Richmond"
    base = stem if ends_city else key  # Care Compare's name without the "City" it ends in
    says = "city" if ends_city else "county" if "county" in geo.drop_suffixes((raw or "").lower())[1] else None
    if ends_city and stem in counties.by_name:
        places = atlas_fips(st, stem, counties)
        known = any(map(independent_city, places)) if st in CITY_STATES else fips in places
    else:
        known = key in counties.by_name
    if moved or (not known and counties.name.get(fips)):
        label = place_name(counties.name[fips], st, independent_city(fips))
        if not known:
            return label, "unknown county; the impact-file county's name"
        if moved == "county":  # a far-off point, not an address: is the impact-file county the place Care Compare names?
            if fips not in atlas_fips(st, base, counties):
                return label, "Care Compare names another place and no street address settles it; took the impact file's"
            city, settled = named_city(base, says, st, fips, None, counties)
            if not settled or city != independent_city(fips):
                return label, "county or city? Care Compare and the impact file disagree and no street address settles it; took the impact file's"
        return label, None
    name = counties.named.get(base) or re.sub(r"[^\w)\]]+$", "", names.smart_title(raw) or "")  # "Narnia County." loses its "."
    city, settled = named_city(base, says, st, fips, point, counties)
    if not known:
        doubt = f"unknown {'county or city' if city is None else 'county'}; Care Compare's name alone" if name else "no county"
    elif not settled:
        doubt = f"county or city? Care Compare, the street address, and the impact file do not settle it; took the {'city' if city else 'county'}"
    else:
        doubt = None
    return place_name(name, st, city) or None, doubt


# Lookups shared by every hospital record: `zcta`, {zip5: (lat, lon)}; `counties`, geo.Counties; `points`, {ccn:
# (lat, lon)} street-address points. Collected for the build report: `moved`, (ccn, Care Compare county, impact-file
# county, geo source) where the impact-file county replaced Care Compare's; `unchecked`, (ccn, Care Compare county,
# label, doubt) for each county the rules could not check (county_label).
Ref = namedtuple("Ref", "zcta counties points moved unchecked")


def place_hospital(ccn, g, imp, st, ref):
    """(lat, lon, geo source, county label) for one hospital: locate()'s map point, then county_label() with the street
    address as evidence only when the map kept it, and the move when locate() replaced Care Compare's county. Records
    the move in ref.moved and an unchecked county in ref.unchecked."""
    point = ref.points.get(ccn)
    lat, lon, gsrc, fips_county = locate(g, imp, st, ref.zcta, ref.counties, point)
    if fips_county:
        ref.moved.append((ccn, g.get("county"), fips_county, gsrc))
    county, doubt = county_label(g, st, imp.get("fips"), ref.counties, point if gsrc == "address" else None,
                                 gsrc if fips_county else None)
    if doubt:
        ref.unchecked.append((ccn, g.get("county"), county, doubt))
    return lat, lon, gsrc, county


def merge_points(*sources):
    """One {ccn: (lat, lon)} from several point files; a CCN in two of them raises rather than one silently winning."""
    out = {}
    for points in sources:
        both = sorted(out.keys() & points.keys())
        if both:
            raise SchemaError(f"street-address points: {len(both)} CCNs in two point files, e.g. {both[:5]}")
        out.update(points)
    return out


def county_gate(unchecked, limit):
    """Report lines for every county the rules could not check ((ccn, Care Compare's county, label, doubt)); raises
    SchemaError when there are more than `limit`, so a new spelling is looked at before it ships."""
    lines = [f"{c} {raw!r} -> {label} ({doubt})" for c, raw, label, doubt in unchecked]
    if len(unchecked) > limit:
        raise SchemaError(f"{len(unchecked)} county names the rules cannot check, more than {limit}: "
                          + "; ".join(lines) + ". Teach geo.county_key or county_label the new spelling, or raise the limit.")
    return lines
