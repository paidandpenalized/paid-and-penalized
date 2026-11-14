"""The builds the Thirty Day Readmissions checks compare against: the master built on the Care Compare file that site
used (`emit_hospital.HGI_PRIOR`), and which hospitals' Care Compare rows the newer file changed.

The site was built from the earlier Care Compare file, so the master's port of its rules is checked on that file: the
same inputs must give the site's values exactly. The master the pages use is built on the newer file, and may differ
from that build only where Care Compare itself changed a hospital's row.
"""
import functools

from pp_engine.parse import read_hgi
from pp_pipeline import emit_hospital
from pp_pipeline.files import read_pinned_bytes

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
    def read(pin):
        return read_hgi(read_pinned_bytes(pin).decode("utf-8"))
    before, now = read(emit_hospital.HGI_PRIOR), read(emit_hospital.HGI)
    return frozenset(c for c in before.keys() | now.keys() if before.get(c) != now.get(c))
