"""The builds the Thirty Day Readmissions checks compare against: the master built on the Care Compare file that site
used (`emit_hospital.HGI_PRIOR`), and which hospitals' Care Compare rows the newer file changed.

The site was built from the earlier Care Compare file, so the master's port of its rules is checked on that file: the
same inputs must give the site's values exactly. The master the pages use is built on the newer file, and may differ
from that build only where Care Compare itself changed a hospital's row.
"""
import functools

from pp_pipeline import emit_hospital

# Master fields that come from a hospital's Care Compare row, directly or through its ZIP or county (the map point,
# where it came from, and the county), and so may move when Care Compare changes the row.
CARE_COMPARE_FIELDS = ("name", "alias", "street", "city", "zip", "county", "fips", "lat", "lon", "geo", "own",
                       "ownDetail")


@functools.lru_cache(maxsize=None)
def july_master():
    """{ccn: record}: the master built on the Care Compare file Thirty Day Readmissions used."""
    built = emit_hospital.build_from_pins("2000-01-01T00:00:00Z", hgi=emit_hospital.HGI_PRIOR)
    return {h["ccn"]: h for h in built["hospitals"]}


@functools.lru_cache(maxsize=None)
def care_compare_changed():
    """The CCNs whose Care Compare row differs between the two files (the columns the master reads), or that only one
    file lists."""
    t = emit_hospital.tables()
    before, now = t["hgi_prior"], t["hgi"]
    return frozenset(c for c in before.keys() | now.keys() if before.get(c) != now.get(c))


def unexplained(now, then, fields):
    """['<id> <field>: then -> now'] for each field that differs between two builds' records ({id: record}, every id
    of `now` in `then` or skipped), unless the hospital's Care Compare row changed and the field is one of `fields`."""
    changed = care_compare_changed()
    return [f"{c} {k}: {then[c].get(k)!r} -> {h.get(k)!r}" for c, h in sorted(now.items()) if c in then
            for k in sorted(h.keys() | then[c].keys())
            if h.get(k) != then[c].get(k) and not (c in changed and k in fields)]
