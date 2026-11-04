"""Per-hospital PAF history (FY2013-FY2026) and the national trend series, over CSV text.

Ported from Thirty Day Readmissions (pipeline/hrrp/history.py at 33d1959). The readers take the file's text (the
caller reads the bytes) and raise SchemaError naming a missing column.
"""
import statistics

from pp_engine import parse
from pp_engine.parse import SchemaError


def load_paf_history(text, keep_ids, first_fy, last_fy):
    """(years, {ccn: [paf or None per FY first_fy..last_fy]}) for hospitals in keep_ids; out-of-scope rows (MD/PR/no
    data) → None. SchemaError naming the hospital and year for an in-scope row with a blank or non-numeric PAF or FY,
    or for a hospital-year given twice."""
    years = list(range(first_fy, last_fy + 1))
    out = {}
    columns = {"fy": "fy", "ccn": "ccn", "paf": "paf", "scope": "scope_flag"}
    for r in parse.table(parse.rows(text, ","), "fy", columns, "HRRP history"):
        ccn = r["ccn"]
        if ccn not in keep_ids or r["scope"]:
            continue
        try:
            fy = int(r["fy"])
        except ValueError:
            raise SchemaError("HRRP history: %s has a non-numeric fy %r" % (ccn, r["fy"])) from None
        if not first_fy <= fy <= last_fy:
            continue
        try:
            paf = round(float(r["paf"]), 4)
        except ValueError:
            raise SchemaError("HRRP history: %s FY%d has a blank or non-numeric paf %r" % (ccn, fy, r["paf"])) from None
        slot = out.setdefault(ccn, [None] * len(years))
        if slot[fy - first_fy] is not None:
            raise SchemaError("HRRP history: %s FY%d appears twice" % (ccn, fy))
        slot[fy - first_fy] = paf
    return years, out


def summarize_fy(fy, pafs, cap_pct):
    """National summary for one FY from its PAFs (same definitions as the historical summary CSV)."""
    reds = [(1 - p) * 100 for p in pafs]
    pen = [r for r in reds if r > 1e-9]

    def avg(xs):
        return sum(xs) / len(xs) if xs else 0

    return {
        "fy": fy, "n": len(reds), "nPen": len(pen),
        "pctPen": round(100 * len(pen) / len(reds), 2) if reds else 0,
        "meanRed": round(avg(reds), 4),
        "meanRedPen": round(avg(pen), 4),
        "medianRedPen": round(statistics.median(pen), 4) if pen else 0,
        "nMax": sum(1 for r in reds if r >= cap_pct - 1e-6), "cap": cap_pct,
    }


_NATIONAL_COLUMNS = (
    "fy", "n_hospitals_comparable", "n_penalized_comparable", "pct_penalized_comparable",
    "mean_reduction_pct_all_comparable", "mean_reduction_pct_penalized", "median_reduction_pct_penalized",
    "n_at_max", "max_cap_pct", "performance_period_start", "performance_period_end")


_NATIONAL_FIELDS = (  # output key, column, reader
    ("n", "n_hospitals_comparable", int), ("nPen", "n_penalized_comparable", int),
    ("pctPen", "pct_penalized_comparable", float), ("meanRed", "mean_reduction_pct_all_comparable", float),
    ("meanRedPen", "mean_reduction_pct_penalized", float), ("medianRedPen", "median_reduction_pct_penalized", float),
    ("nMax", "n_at_max", int), ("cap", "max_cap_pct", int))


def load_national(text):
    """Comparable-population national series FY2013-FY2026 from the historical summary CSV. SchemaError naming the
    year and column for a non-numeric value."""
    columns = {"fy": "fy", **{k: col for k, col, _ in _NATIONAL_FIELDS},
               "start": "performance_period_start", "end": "performance_period_end"}
    out = []
    for r in parse.table(parse.rows(text, ","), "fy", columns, "HRRP history summary"):
        def read(key, col, reader):
            try:
                return reader(r[key])
            except ValueError:
                raise SchemaError("HRRP history summary: FY%s has a non-numeric %s %r" % (r["fy"], col, r[key])) from None
        row = {"fy": read("fy", "fy", int)}
        row.update({k: read(k, col, reader) for k, col, reader in _NATIONAL_FIELDS})
        row["perf"] = [r["start"] or None, r["end"] or None]
        out.append(row)
    return out
