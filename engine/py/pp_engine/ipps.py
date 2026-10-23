"""Readers for the FY2026 IPPS final-rule files behind the HACRP dollar estimates, over text (the caller reads the
bytes and decodes them as Windows-1252, as CMS writes them). Every reader goes through `parse.table` or
`parse.rows`, so a layout change raises SchemaError rather than producing wrong values.

Column names are the data files' own headers, which differ from the impact file's README in places (the README says
`Wage Index`, the file `FY 2026 Wage Index`; README `UCP and IHS/PR Supplemental Payment Per Claim Amount`, file
`UCP Per Claim Amount`; and so on). They are matched exactly, year stamps included, so another year's file fails
instead of being read as this one.
"""
import math
import re

from pp_engine.parse import SchemaError, index_by_ccn, num, rows, squash, table, to_int

# --- Tables 1A-1E (standardized amounts) -------------------------------------------------------------------------------

# A rate pair is (labor, nonlabor) dollars. The four keys are the table's scenarios: quality data submitted or not,
# meaningful EHR user or not. `rate_key` maps a hospital's two flags to a key; `_scenario_key` reads a key off a
# table heading; these two functions are the only places the mapping is written.
RATE_KEYS = ("qe", "qn", "ne", "nn")  # q/n = quality data submitted / not; e/n = EHR user / not
TABLE_TITLE = re.compile(r"table (1[a-e])\b", re.I)


def rate_key(quality, ehr):
    """The scenario key for a hospital's Proxy Quality Reduction and Proxy EHR Reduction flags (1 = the update is
    reduced: quality data not submitted, not a meaningful EHR user): (0, 0) -> "qe", (0, 1) -> "qn", (1, 0) -> "ne",
    (1, 1) -> "nn". A missing or other value raises, since the hospital could not be priced."""
    if quality not in (0, 1) or ehr not in (0, 1):
        raise SchemaError(f"rate key: quality flag {quality!r} and EHR flag {ehr!r} are not both 0 or 1")
    return ("n" if quality else "q") + ("n" if ehr else "e")


def _scenario_key(text, label, quality_default):
    """The key a scenario header cell names. Table 1C's headings name the EHR status only (its 2.6 and 0.125 percent
    updates are 1A's quality-data-submitted ones), so `quality_default` stands in for the quality half there."""
    t = squash(text).lower()
    if "did not submit quality data" in t:
        quality = "n"
    elif "submitted quality data" in t:
        quality = "q"
    else:
        quality = quality_default
    if "not a meaningful ehr user" in t:
        ehr = "n"
    elif "a meaningful ehr user" in t:
        ehr = "e"
    else:
        ehr = None
    if quality is None or ehr is None:
        raise SchemaError(f"{label}: unrecognised scenario {squash(text)!r}")
    return quality + ehr


def _is(cell, *words):
    return squash(cell).lower() in words


def _rate(cell, label):
    v = num(cell)
    if v is None or not v > 0:
        raise SchemaError(f"{label}: no rate in {cell!r}")
    return v


def _sections(grid):
    """{'1A': [rows of Table 1A], ...}: each table's rows, from its 'TABLE 1x' title row to the next title row."""
    out, current = {}, None
    for row in grid:
        title = TABLE_TITLE.match(squash(row[0])) if row else None
        if title:
            name = title.group(1).upper()
            if name in out:
                raise SchemaError(f"Tables 1A-1E: Table {name} appears twice")
            current = out[name] = []
        if current is not None:
            current.append(row)
    return out


def _operating(section, name, quality_default):
    """{key: (labor, nonlabor)} from a Table 1A, 1B or 1C section: the row of labor/nonlabor headings, the scenario
    names on the row above it, the rates on the row below. A pair whose cells both say 'Not Applicable' is skipped."""
    label = f"Tables 1A-1E, Table {name}"
    heads = [i for i, row in enumerate(section) if any(_is(c, "labor-related", "labor") for c in row)]
    if len(heads) != 1 or heads[0] < 1 or heads[0] + 1 >= len(section):
        raise SchemaError(f"{label}: expected one row of labor/nonlabor headings with scenarios above and rates below")
    names, heads_row, values = section[heads[0] - 1], section[heads[0]], section[heads[0] + 1]
    out = {}
    for j, cell in enumerate(heads_row):
        if not _is(cell, "labor-related", "labor"):
            continue
        if j + 1 >= len(heads_row) or not _is(heads_row[j + 1], "nonlabor-related", "nonlabor"):
            raise SchemaError(f"{label}: a labor column without its nonlabor column")
        cells = [(values[k] if k < len(values) else "") for k in (j, j + 1)]
        if all(_is(c, "not applicable") for c in cells):
            continue
        key = _scenario_key(names[j] if j < len(names) else "", label, quality_default)
        if key in out:
            raise SchemaError(f"{label}: scenario {key!r} appears twice")
        out[key] = (_rate(cells[0], label), _rate(cells[1], label))
    return out


def _capital(section):
    label = "Tables 1A-1E, Table 1D"
    heads = [(i, j) for i, row in enumerate(section) for j, c in enumerate(row) if _is(c, "rate")]
    if len(heads) != 1 or heads[0][0] + 1 >= len(section):
        raise SchemaError(f"{label}: expected one 'Rate' heading with the rate on the row below")
    i, j = heads[0]
    row = section[i + 1]
    return _rate(row[j] if j < len(row) else "", label)


def read_rates(text):
    """Tables 1A-1E (tab-delimited, read as CSV: one scenario heading is a quoted cell with a line break) ->
    `{"operating": {"1A": {key: (labor, nonlabor)}, "1B": {...}, "1C": {...}}, "capital": rate}`.
    1A is for a wage index above 1 (66% labor), 1B for 1 or below (62%), 1C is Puerto Rico's. The keys (`RATE_KEYS`,
    chosen with `rate_key`) come from each scenario's heading text, not its position, so a reordered table still prices
    right. 1C has `qe` and `qn` only: the table lists the EHR split alone (and its wage-index-above-one columns say
    'Not Applicable'). Capital is Table 1D's single federal rate."""
    sections = _sections(rows(text, "\t"))
    for name in ("1A", "1B", "1C", "1D"):
        if name not in sections:
            raise SchemaError(f"Tables 1A-1E: Table {name} not found")
    operating = {"1A": _operating(sections["1A"], "1A", None), "1B": _operating(sections["1B"], "1B", None),
                 "1C": _operating(sections["1C"], "1C", "q")}
    for name in ("1A", "1B"):
        if sorted(operating[name]) != sorted(RATE_KEYS):
            raise SchemaError(f"Tables 1A-1E, Table {name}: expected the four scenarios, found {sorted(operating[name])}")
    if sorted(operating["1C"]) != ["qe", "qn"]:
        raise SchemaError(f"Tables 1A-1E, Table 1C: expected the EHR user and non-user scenarios, "
                          f"found {sorted(operating['1C'])}")
    return {"operating": operating, "capital": _capital(sections["1D"])}


# --- the impact file -------------------------------------------------------------------------------------------------

# Provider Type codes paid as sole community hospitals: 16 SCH, 17 SCH/RRC, and the essential access community
# hospitals, 21 EACH and 22 EACH/RRC. 42 CFR 412.109(a): "For payment purposes, CMS treats as a sole community
# hospital any hospital that is located in a rural area" and was designated an EACH; the impact file agrees (every
# row of type 22 carries an SCH hospital-specific rate, `HSP Rate`, which only SCHs have).
SCH_TYPES = frozenset({16, 17, 21, 22})
PUERTO_RICO = "40"  # state code, the CCN's first two digits

PAYMENT_COLUMNS = {
    "ccn": "Provider Number",
    "cases": "CASETA43",  # transfer-adjusted cases (grouper V43): these price B
    "cmi": "TACMIV43",  # transfer-adjusted case-mix index: prices B
    "bills": "Bills",  # Medicare cases, FY2024 MedPAR: per-stay and per-claim figures
    "cmi_hsp": "CMIV43",  # README: "generally applicable for SCH and MDH providers paid under their HSP rate"
    "wi": "FY 2026 Wage Index",
    "cola": "Cost of Living Adjustment",  # operating
    "quality": "Proxy Quality Reduction",  # 1 = reduced update (failed quality reporting)
    "ehr": "Proxy EHR Reduction",  # 1 = reduced update (not a meaningful EHR user)
    "ptype": "Provider Type",
    "mdh": "MDH Flag, CAA 2024",  # Y or blank
    "hsp": "HSP Rate",  # SCH hospital-specific rate, $/case
    "hsp_mdh": "HSP Rate for MDHs, FY 2025 extension",  # $/case
    "ime_op": "TCHOP",  # fractions
    "ime_cap": "TCHCP",
    "dsh_op": "DSHOPP",
    "dsh_cap": "DSHCPP",
    "ucp_per_claim": "UCP Per Claim Amount",  # $/claim (README: and the IHS/PR supplemental amount)
    "outlier_op": "OUTFACT_F",  # fractions of federal payments
    "outlier_cap": "COUTFACT_F",
    "gaf": "GAF",
    "low_volume": "Low-Volume Hospital Payment Adjustment, FY 2025 extension",  # multiplier; 1 = none
}
# The columns read as floats (a blank cell is None): all but the CCN, the integer counts and flags, and the Y/blank MDH
# flag, which `read_payment_inputs` reads on their own.
_FLOATS = tuple(k for k in PAYMENT_COLUMNS if k not in ("ccn", "bills", "quality", "ehr", "ptype", "mdh"))


def _finite(s):
    v = num(s)
    if v is not None and not math.isfinite(v):
        raise ValueError(f"{s!r} is not finite")
    return v


def _flag(s):
    v = to_int(s)
    if v not in (None, 0, 1):
        raise ValueError(f"flag {s!r} is not 0 or 1")
    return v


def read_payment_inputs(text):
    """The FY2026 final-rule IPPS impact file (tab-delimited) -> {ccn: inputs}, one dict per hospital with the keys of
    `PAYMENT_COLUMNS` (less `ccn`) plus the derived `sch` and `pr`. Numbers are floats (`bills`, `ptype`, `quality`
    and `ehr` ints); a blank cell is None, a zero stays 0. `quality` and `ehr` are the file's proxy flags, 1 = reduced
    update (`rate_key` turns them into a rate key). `mdh` is True for 'Y'. `sch` is `ptype in SCH_TYPES`, `pr` the
    CCN's state code being Puerto Rico's.

    Why the FY2025-extension columns: the law reinstated MDH status and the expanded low-volume tiers for all of
    FY2026, so `mdh`, `hsp_mdh` and `low_volume` read the columns the file stamps 'CAA 2024' / 'FY 2025 extension'.
    The column named for FY2026 (`Low Volume Hospital Adjustment`) models the tiers' expiry and is 1.0 for every
    hospital; it is not read."""
    label = "impact file"

    def build(r):
        try:
            out = {k: _finite(r[k]) for k in _FLOATS}
            out["bills"] = to_int(r["bills"])
            out["quality"], out["ehr"] = _flag(r["quality"]), _flag(r["ehr"])
            out["ptype"] = to_int(r["ptype"])
        except ValueError as e:
            raise SchemaError(f"{label}: unreadable value for {r['ccn']}: {e}") from None
        out["sch"] = out["ptype"] in SCH_TYPES
        out["mdh"] = r["mdh"].upper() == "Y"
        out["pr"] = r["ccn"][:2] == PUERTO_RICO
        return out
    return index_by_ccn(table(rows(text, "\t"), PAYMENT_COLUMNS["ccn"], PAYMENT_COLUMNS, label), build, label)


# --- the HRRP and VBP factor files -----------------------------------------------------------------------------------

def _factors(text, ccn_header, factor_header, label):
    def build(r):
        try:
            v = _finite(r["factor"])
        except ValueError:
            v = None
        if v is None or not v > 0:
            raise SchemaError(f"{label}: no usable factor for {r['ccn']} ({r['factor']!r})")
        return v
    return index_by_ccn(table(rows(text, "\t"), ccn_header, {"ccn": ccn_header, "factor": factor_header}, label),
                        build, label)


def read_hrrp_factors(text):
    """HRRP supplemental file `FR FY 2026.txt` (tab-delimited) -> {ccn: the FY2026 payment adjustment factor}, a
    multiplier of 1 or less (CMS's published figure: the reduction is 1 minus it). Footer rows are skipped."""
    return _factors(text, "Hospital CCN", "Payment adjustment factor", "HRRP supplemental file")


def read_vbp_factors(text):
    """Table 16B (tab-delimited) -> {ccn: the actual FY2026 hospital VBP adjustment factor}, a multiplier about 1
    (CMS's published figure; Table 16A's were proxies). The footnote rows are skipped."""
    return _factors(text, "CMS Certification Number (CCN)", "Actual FY 2026 Hospital VBP Adjustment Factor",
                    "Table 16B")
