"""The hospital master: one record per CCN across Care Compare (HGI), the IPPS impact file and the program files,
with each program's in/out flag and, when out, a reason code a page can render.

Attribute rules are Thirty Day Readmissions' (pipeline/build_data.py at 80f3659): Care Compare first, the impact
file and the Provider of Services file as fallbacks. Location fields (coordinates, county, CBSA) come in
methods_version 2.
"""
from pp_engine import names
from pp_engine.contract import envelope
from pp_engine.parse import POS_TERMINATION, SchemaError

SCHEMA_VERSION = 1
METHODS_VERSION = 1

# Care Compare's "Hospital Type" -> kind. An unlisted type fails the build rather than guessing.
KINDS = {
    "Acute Care Hospitals": "acute",
    "Critical Access Hospitals": "critical_access",
    "Psychiatric": "psychiatric",
    "Childrens": "childrens",
    "Long-term": "long_term",
    "Rural Emergency Hospital": "rural_emergency",
    "Acute Care - Veterans Administration": "va",
    "Acute Care - Department of Defense": "dod",
}
# Kinds not paid under the inpatient prospective payment system, so outside the IPPS penalty programs; the reason
# code a page renders for each.
NOT_IPPS = {"critical_access": "critical_access", "psychiatric": "psychiatric", "childrens": "childrens",
            "long_term": "long_term", "rural_emergency": "rural_emergency", "va": "federal", "dod": "federal"}
# Why a hospital isn't in a program's file, in the order the rules are tried (see reason_for).
REASONS = ("critical_access", "psychiatric", "childrens", "long_term", "rural_emergency", "federal", "maryland",
           "inactive", "not_listed")

# Impact-file provider types -> special statuses (TDR's PTYPES); MDH also comes from the MDH flag.
PTYPES = {7: ["RRC"], 8: ["IHS"], 14: ["MDH"], 15: ["MDH", "RRC"], 16: ["SCH"], 17: ["SCH", "RRC"], 21: ["EACH"],
          22: ["EACH", "RRC"]}
OWN = {"G": "Government", "P": "For-profit", "V": "Nonprofit", "X": "Unknown"}
OWN_PREFIX = (("Government", "Government"), ("Voluntary", "Nonprofit"), ("Proprietary", "For-profit"),
              ("Physician", "For-profit"), ("Tribal", "Government"), ("Veterans", "Government"))
MAJOR_TEACHING = 0.25  # resident-to-bed ratio at or above which a hospital counts as a major teaching hospital

RECORD_KEYS = ("ccn", "name", "alias", "street", "city", "state", "zip", "kind", "ipps", "types", "teach", "urban",
               "beds", "bedsSource", "own", "ownDetail", "inactive", "programs")


def kind_of(hgi, in_impact):
    """The hospital's kind from Care Compare's type; without a Care Compare row, `acute` if the impact file lists it
    (an IPPS hospital), else `unknown`."""
    if hgi is None:
        return "acute" if in_impact else "unknown"
    if hgi["type"] not in KINDS:
        raise SchemaError(f"HGI: unknown hospital type {hgi['type']!r}")
    return KINDS[hgi["type"]]


def reason_for(listed, kind, state, inactive):
    """None when the program's file lists the hospital; otherwise the first rule that explains why it doesn't:
    a kind not paid under IPPS, Maryland (paid under the state's own model), ended Medicare participation, or
    `not_listed` (CMS's file leaves it out without saying why)."""
    if listed:
        return None
    if kind in NOT_IPPS:
        return NOT_IPPS[kind]
    if state == "MD":
        return "maryland"
    return "inactive" if inactive else "not_listed"


def _ownership(detail, own_code):
    """Broad ownership class: Care Compare's current value first, the cost-report code as fallback."""
    for prefix, label in OWN_PREFIX:
        if (detail or "").startswith(prefix):
            return label
    return OWN.get(own_code)


def _first(*values):
    return next((v for v in values if v), None)


def build_record(ccn, hgi, impact, pos, listed, program_names=()):
    """One hospital's record from its HGI, impact and POS rows (each a dict or None), `listed` (program id -> whether
    that program's file lists the CCN) and `program_names` (names those files give it, a last-resort name)."""
    g, imp, p = hgi or {}, impact or {}, pos or {}
    name = (names.display_name(g.get("name"), imp.get("name")) or names.smart_title(p.get("name"))
            or _first(*(names.display_name(n, None) for n in program_names))
            or f"Hospital {ccn} (name not in CMS files)")  # TDR's wording for a CCN no file names
    ipps = impact is not None
    kind = kind_of(hgi, ipps)
    state = _first(g.get("state"), p.get("state"))
    term_reason = POS_TERMINATION.get(p.get("term"))
    inactive = {"date": p.get("termDate"), "reason": term_reason} if term_reason else None
    beds, beds_source = (p["beds"], "pos") if p.get("beds") else (imp["beds"], "cr") if imp.get("beds") else (None, None)
    types, teach, urban = [], None, None  # IPPS attributes, for hospitals in the impact file only
    if ipps:
        types = sorted(set(PTYPES.get(imp["ptype"], [])) | ({"MDH"} if imp["mdh"] else set()))
        teach = "major" if imp["irb"] >= MAJOR_TEACHING else "minor" if imp["irb"] else "none"
        urban = imp["urgeo"] in ("LURBAN", "OURBAN")
    return {
        "ccn": ccn,
        "name": name,
        "alias": names.alias(name, imp.get("name")),
        "street": _first(g.get("street"), p.get("street")),
        "city": names.smart_title(_first(g.get("city"), p.get("city"))),
        "state": state,
        "zip": _first(g.get("zip"), p.get("zip")),
        "kind": kind,
        "ipps": ipps,
        "types": types,
        "teach": teach,
        "urban": urban,
        "beds": beds,
        "bedsSource": beds_source,
        "own": _ownership(g.get("ownership"), imp.get("own")),
        "ownDetail": g.get("ownership") or None,
        "inactive": inactive,
        "programs": {pid: {"inProgram": on, "reason": reason_for(on, kind, state, inactive is not None)}
                     for pid, on in listed.items()},
    }


def build_master(hgi, impact, pos, programs, fy, manifest, sources, built_at):
    """The master: envelope, each program's file year, and one record per CCN in HGI, the impact file or any
    program's file, sorted by CCN. `programs` maps program id -> {"fy": int, "names": {ccn: the file's name}}. A CCN
    only in POS isn't added (POS lists every certified hospital, open or closed, with no program link)."""
    ccns = set(hgi) | set(impact)
    for prog in programs.values():
        ccns |= set(prog["names"])
    order = sorted(programs)
    hospitals = [build_record(c, hgi.get(c), impact.get(c), pos.get(c),
                              {pid: c in programs[pid]["names"] for pid in order},
                              [programs[pid]["names"][c] for pid in order if c in programs[pid]["names"]])
                 for c in sorted(ccns)]
    return {
        **envelope(SCHEMA_VERSION, METHODS_VERSION, sources, manifest, built_at, fy),
        "programYears": {pid: prog["fy"] for pid, prog in sorted(programs.items())},
        "hospitals": hospitals,
    }
