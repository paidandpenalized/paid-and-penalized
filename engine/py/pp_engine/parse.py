"""Readers for the CMS files behind the hospital master, over text (the caller reads the bytes).

Ported from Thirty Day Readmissions (pipeline/hrrp/parse.py at 80f3659). Every reader goes through `table`, which
finds the header row by its first cell (not by line number) and raises SchemaError when an expected column is
missing, so a CMS layout change cannot silently produce wrong values. CCNs stay text.
"""
import csv
import io
import re

MISSING = {"", ".", "n/a", "na", "too few to report", "not available", "--"}

# Provider of Services termination codes (PGM_TRMNTN_CD) with plain-words reasons for the codes that end Medicare
# participation (01-07); None for the ones that don't. Meanings from CMS's POS record layout for this dataset.
POS_TERMINATION = {
    "00": None,  # ACTIVE PROVIDER
    "01": "merger or closure",  # VOLUNTARY-MERGER, CLOSURE
    "02": "left Medicare, dissatisfied with payment",  # VOLUNTARY-DISSATISFACTION WITH REIMBURSEMENT
    "03": "left Medicare at risk of being terminated",  # VOLUNTARY-RISK OF INVOLUNTARY TERMINATION
    "04": "left Medicare for another reason",  # VOLUNTARY-OTHER REASON FOR WITHDRAWAL
    "05": "terminated for failing health and safety requirements",  # INVOLUNTARY-FAILURE TO MEET HEALTH/SAFETY REQ
    "06": "terminated for failing its Medicare agreement",  # INVOLUNTARY-FAILURE TO MEET AGREEMENT
    "07": "change in provider status",  # OTHER-PROVIDER STATUS CHANGE
    "80": None,  # AWAITING STATE APPROVAL: not a termination
}


class SchemaError(Exception):
    pass


def num(s):
    """A CMS-formatted number ('"1,110"', '0.04%', '"$4,519.68 "') as a float; None when missing."""
    if s is None:
        return None
    t = str(s).strip().strip('"').strip()
    if t.lower() in MISSING:
        return None
    t = t.replace(",", "").replace("$", "").replace("%", "").strip()
    return float(t) if t else None


def to_int(s):
    v = num(s)
    return None if v is None else int(round(v))


def squash(s):
    """Runs of whitespace collapsed to one space, ends trimmed."""
    return " ".join(s.split())


def zip5(s):
    """The 5-digit ZIP of a ZIP or ZIP+4, leading zeros restored; '' when missing."""
    return s[:5].zfill(5) if s else ""


def _norm(h):
    return squash(str(h).replace("\ufeff", "")).lower()


def rows(text, delimiter):
    """CSV rows of `text`; a leading byte-order mark is dropped (left in, it would unquote a quoted first cell)."""
    return csv.reader(io.StringIO(text[1:] if text.startswith("\ufeff") else text), delimiter=delimiter)


def table(rows_, anchor, columns, label):
    """Records (dicts keyed by `columns` keys, stripped strings) from the table whose header row starts with `anchor`.
    `columns` maps output key -> header text, matched case- and space-insensitively; a header text starting with '*'
    matches the one header that ends with the rest (year-stamped names like 'FY 2025 CBSA'), and two such headers
    raise rather than pick a year. `label` names the file in errors."""
    target = _norm(anchor)
    it = iter(rows_)
    for row in it:
        if row and _norm(row[0]) == target:
            header = [_norm(h) for h in row]
            idx = {}
            for key, name in columns.items():
                n = _norm(name)
                hits = [j for j, h in enumerate(header) if (h.endswith(n[1:]) if n.startswith("*") else h == n)]
                if len(hits) != 1:
                    raise SchemaError(f"{label}: expected one column {name!r}, found {len(hits)}")
                idx[key] = hits[0]
            return [{k: (r[j] if j < len(r) else "").strip() for k, j in idx.items()} for r in it if r and r[0].strip()]
    raise SchemaError(f"{label}: header row starting with {anchor!r} not found")


def _is_ccn(s):
    return len(s) == 6 and s[:2].isdigit()


def index_by_ccn(records, build, label):
    """{ccn: build(record)}. Footnote rows (no CCN) are skipped; a numeric cell that isn't a 6-character CCN raises."""
    out = {}
    for r in records:
        ccn = r["ccn"]
        if not _is_ccn(ccn):
            if ccn.isdigit():
                raise SchemaError(f"{label}: malformed CCN {ccn!r} (expected 6 characters)")
            continue
        if ccn in out:
            raise SchemaError(f"{label}: duplicate CCN {ccn}")
        out[ccn] = build(r)
    return out


def read_hgi(text):
    """Care Compare Hospital General Information CSV -> {ccn: {name, street, city, state, zip, county, type,
    ownership}}."""
    columns = {"ccn": "Facility ID", "name": "Facility Name", "street": "Address", "city": "City/Town", "state": "State",
               "zip": "ZIP Code", "county": "County/Parish", "type": "Hospital Type", "ownership": "Hospital Ownership"}

    def build(r):
        return {"name": r["name"], "street": squash(r["street"]), "city": r["city"], "state": r["state"],
                "zip": zip5(r["zip"]), "county": r["county"], "type": r["type"], "ownership": r["ownership"]}
    return index_by_ccn(table(rows(text, ","), "Facility ID", columns, "HGI"), build, "HGI")


def impact_fy(text):
    """The impact file's fiscal year, from the single 'FY <year> Wage Index' column of its header row."""
    header = next((r for r in rows(text, "\t") if r and _norm(r[0]) == "provider number"), [])
    years = {m.group(1) for m in (re.fullmatch(r"FY (\d{4}) Wage Index", squash(h), re.ASCII) for h in header) if m}
    if len(years) != 1:
        raise SchemaError(f"impact file: expected one 'FY <year> Wage Index' column, found {sorted(years) or 'none'}")
    return int(years.pop())


def read_impact(text):
    """IPPS impact file (tab-delimited) -> {ccn: {name, urgeo, irb, beds, own, ptype, mdh, fips, cbsa_geo}}. `fips` is
    the 5-digit county code (None when blank); `cbsa_geo` the geographic labor market area as written."""
    columns = {"ccn": "Provider Number", "name": "Name", "urgeo": "URGEO", "irb": "Resident to Bed Ratio", "beds": "Beds",
               "own": "Ownership Control Type", "ptype": "Provider Type", "mdh": "MDH Flag",
               "fips": "FIPS County Code", "cbsa_geo": "Geographic Labor Market Area"}

    def build(r):
        return {"name": r["name"], "urgeo": r["urgeo"], "irb": num(r["irb"]) or 0.0, "beds": to_int(r["beds"]),
                "own": r["own"] or None, "ptype": to_int(r["ptype"]), "mdh": r["mdh"].upper() == "Y",
                "fips": r["fips"].zfill(5) if r["fips"] else None, "cbsa_geo": r["cbsa_geo"]}
    label = "impact file"
    return index_by_ccn(table(rows(text, "\t"), "Provider Number", columns, label), build, label)


def read_pos(text):
    """The committed POS extract -> {ccn: {name, street, city, state, zip, beds, term, termDate}}. `beds` is the
    certified bed count (None when absent or zero); `term` the termination code (see POS_TERMINATION)."""
    columns = {"ccn": "PRVDR_NUM", "name": "FAC_NAME", "street": "ST_ADR", "city": "CITY_NAME", "state": "STATE_CD",
               "zip": "ZIP_CD", "beds": "CRTFD_BED_CNT", "term": "PGM_TRMNTN_CD", "date": "TRMNTN_EXPRTN_DT"}

    def build(r):
        if r["term"] not in POS_TERMINATION:
            raise SchemaError(f"POS: unknown termination code {r['term']!r} for {r['ccn']}")
        d = r["date"]
        if d and not (len(d) == 8 and d.isdigit()):
            raise SchemaError(f"POS: malformed termination date {d!r} for {r['ccn']}")
        return {"name": r["name"], "street": squash(r["street"]), "city": r["city"], "state": r["state"],
                "zip": zip5(r["zip"]), "beds": to_int(r["beds"]) or None, "term": r["term"],
                "termDate": f"{d[:4]}-{d[4:6]}-{d[6:]}" if d else None}
    return index_by_ccn(table(rows(text, ","), "PRVDR_NUM", columns, "POS"), build, "POS")


def _latlon(lat, lon, label):
    """(lat, lon) as floats; SchemaError unless both are finite and in range."""
    try:
        pt = (float(lat), float(lon))
    except ValueError:
        raise SchemaError(f"{label}: malformed coordinate") from None
    if not (-90 <= pt[0] <= 90 and -180 <= pt[1] <= 180):  # also refuses nan; inf is out of range
        raise SchemaError(f"{label}: coordinate out of range")
    return pt


def read_zcta(text):
    """Census ZCTA gazetteer (tab-delimited) -> {zip5: (lat, lon)}: each ZIP code tabulation area's internal point."""
    label = "ZCTA gazetteer"
    recs = table(rows(text, "\t"), "GEOID", {"zip": "GEOID", "lat": "INTPTLAT", "lon": "INTPTLONG"}, label)
    return {r["zip"]: _latlon(r["lat"], r["lon"], f"{label} {r['zip']}") for r in recs}


def read_cbsa_names(text):
    """CMS county-to-CBSA crosswalk (tab-delimited) -> {cbsa code: CBSA name}; rural codes without a name are left out."""
    recs = table(rows(text, "\t"), "FIPS County Code", {"code": "*cbsa", "name": "*cbsa name"}, "CBSA crosswalk")
    return {r["code"]: r["name"].strip('"') for r in recs if r["code"] and r["name"]}


def read_points(text):
    """A street-address points CSV (ccn,lat,lon,match,source) -> {ccn: (lat, lon)}. Unlike the CMS readers, which
    skip footnote rows, a non-blank first cell that isn't a CCN, a repeated CCN, or a bad coordinate raises
    SchemaError (rows with a blank first cell are skipped, as `table` does everywhere)."""
    out = {}
    for r in table(rows(text, ","), "ccn", {"ccn": "ccn", "lat": "lat", "lon": "lon"}, "points"):
        if not _is_ccn(r["ccn"]) or r["ccn"] in out:
            raise SchemaError(f"points: malformed or repeated CCN {r['ccn']!r}")
        out[r["ccn"]] = _latlon(r["lat"], r["lon"], f"points {r['ccn']}")
    return out
