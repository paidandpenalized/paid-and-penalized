"""Readers for the HRRP files (the supplemental file and Table 15), over rows or text (the caller reads the bytes).

Ported from Thirty Day Readmissions (pipeline/hrrp/parse.py at 33d1959). They go through `parse.table`, so a CMS layout
change raises SchemaError instead of producing wrong values.
"""
from pp_engine.parse import index_by_ccn, num, rows, table, to_int

# Condition key -> label used in CMS supplemental file headers (order = display order). Ported from Thirty Day
# Readmissions (pipeline/hrrp/parse.py at 33d1959).
SUPP_LABELS = {"AMI": "ami", "COPD": "copd", "HF": "hf", "PN": "pneumonia", "CABG": "cabg", "THA_TKA": "tha/tka"}
CONDITIONS = tuple(SUPP_LABELS)


def read_supplemental(rows_, label):
    """HRRP supplemental file -> {ccn: {paf, dual, peer, nm, c: {COND: {n, err, med, flag, ratio}}}}.

    `rows_` are the rows of CMS's Excel sheet (`xlsx.sheet_rows`, full precision) or of its tab-delimited export
    (`rows(text, "\t")`, rounded to 4 decimals). Ported from Thirty Day Readmissions (pipeline/hrrp/parse.py at 33d1959).
    """
    fields = {"n": "Number of eligible discharges for {}", "err": "ERR for {}", "med": "Peer group median ERR for {}",
              "flag": "Penalty indicator for {}", "ratio": "DRG payment ratio for {}"}
    columns = {"ccn": "Hospital CCN", "paf": "Payment adjustment factor", "dual": "Dual proportion",
               "peer": "Peer group assignment", "nm": "Neutrality modifier"}
    columns.update({f"{k}.{f}": t.format(lab) for k, lab in SUPP_LABELS.items() for f, t in fields.items()})

    def build(r):
        return {
            "paf": num(r["paf"]), "dual": num(r["dual"]), "peer": to_int(r["peer"]), "nm": num(r["nm"]),
            "c": {k: {"n": to_int(r[f"{k}.n"]), "err": num(r[f"{k}.err"]), "med": num(r[f"{k}.med"]),
                      "flag": 1 if r[f"{k}.flag"].upper() == "Y" else 0, "ratio": num(r[f"{k}.ratio"])}
                  for k in CONDITIONS},
        }
    return index_by_ccn(table(rows_, "Hospital CCN", columns, label), build, label)


def read_table15(text, fy):
    """Table 15 (508 text version, tab-delimited) -> {ccn: paf}. Ported from Thirty Day Readmissions
    (pipeline/hrrp/parse.py at 33d1959)."""
    columns = {"ccn": "Hospital CMS Certification Number (CCN)", "paf": f"FY {fy} Payment Adjustment Factor"}
    label = f"HRRP Table 15 FY {fy}"
    return index_by_ccn(table(rows(text, "\t"), columns["ccn"], columns, label), lambda r: num(r["paf"]), label)


def read_hgi_stars(text):
    """Care Compare Hospital General Information CSV -> {ccn: overall star rating as an int, None when not a number
    ("Not Available")}. Reads only `Facility ID` and `Hospital overall rating`, so the hospital master's read of the
    same file does not depend on the rating column."""
    columns = {"ccn": "Facility ID", "star": "Hospital overall rating"}
    return index_by_ccn(table(rows(text, ","), "Facility ID", columns, "HGI"),
                        lambda r: int(r["star"]) if r["star"].isdigit() else None, "HGI")
