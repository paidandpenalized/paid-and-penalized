"""The builds the Thirty Day Readmissions checks compare against: the master built on the Care Compare file that site
used (`emit_hospital.HGI_PRIOR`), and which hospitals' Care Compare rows the newer file changed.

The site was built from the earlier Care Compare file, so the master's port of its rules is checked on that file: the
same inputs must give the site's values exactly. The master the pages use is built on the newer file, and may differ
from that build only where Care Compare itself changed a hospital's row.
"""
import functools

from pp_pipeline import emit_hospital, emit_hrrp

# Master fields that come from a hospital's Care Compare row, directly or through its address (the map point, where it
# came from, the county), its state (region, division) or its type (kind, and each program's reason), and so may move
# when Care Compare changes the row.
CARE_COMPARE_FIELDS = ("name", "alias", "street", "city", "state", "zip", "county", "fips", "lat", "lon", "geo",
                       "region", "division", "own", "ownDetail", "kind")


@functools.lru_cache(maxsize=None)
def july_master():
    """{ccn: record}: the master built on the Care Compare file Thirty Day Readmissions used."""
    built = emit_hospital.build_from_pins("2000-01-01T00:00:00Z", hgi=emit_hospital.HGI_PRIOR)
    return {h["ccn"]: h for h in built["hospitals"]}


@functools.lru_cache(maxsize=None)
def care_compare_changed():
    """The CCNs whose Care Compare row differs between the two files (the columns the master reads, and the star
    rating), or that only one file lists."""
    t = emit_hospital.tables()
    before, now = t["hgi_prior"], t["hgi"]
    stars_before, stars_now = (emit_hrrp.care_compare_stars((pin,))
                               for pin in (emit_hospital.HGI_PRIOR, emit_hospital.HGI))
    return frozenset(c for c in before.keys() | now.keys()
                     if before.get(c) != now.get(c) or stars_before.get(c) != stars_now.get(c))


def _without_reasons(record):
    """A master record with each program's reason left out (a reason follows from the hospital's type; whether it is in
    the program comes from the program's file)."""
    if "programs" not in record:
        return record
    return {**record, "programs": {p: {k: v for k, v in e.items() if k != "reason"}
                                   for p, e in record["programs"].items()}}


def unexplained(now, then, fields):
    """['<id> <field>: then -> now'] for each field that differs between two builds' records ({id: record}, every id
    of `now` in `then` or skipped), unless the hospital's Care Compare row changed and the field is one of `fields`
    (or is a program's reason, and the hospital's kind or state changed)."""
    changed = care_compare_changed()
    out = []
    for c, h in sorted(now.items()):
        if c not in then:
            continue
        # A program's reason may move only with what it is decided from: the hospital's kind (its Care Compare type) or
        # state (Maryland).
        retyped = c in changed and any(h.get(k) != then[c].get(k) for k in ("kind", "state"))
        a, b = (_without_reasons(h), _without_reasons(then[c])) if retyped else (h, then[c])
        out += [f"{c} {k}: {b.get(k)!r} -> {a.get(k)!r}" for k in sorted(a.keys() | b.keys())
                if a.get(k) != b.get(k) and not (c in changed and k in fields)]
    return out
