"""Per-hospital PAF history (FY2013-FY2026) and the national trend series, over CSV text.

Ported from Thirty Day Readmissions (pipeline/hrrp/history.py at 33d1959). The readers take the file's text (the
caller reads the bytes) and raise SchemaError naming a missing column.
"""
import statistics

from pp_engine import parse
from pp_engine.parse import SchemaError


def _records(text, columns, label):
    """Dict records of a CSV text with a header row; every name in `columns` must be a header."""
    it = parse.rows(text, ",")
    header = next(it, None) or []
    missing = [c for c in columns if c not in header]
    if missing:
        raise SchemaError("%s: missing column %s" % (label, ", ".join(missing)))
    idx = {c: header.index(c) for c in columns}
    for row in it:
        if row:
            yield {c: (row[i] if i < len(row) else "") for c, i in idx.items()}


def load_paf_history(text, keep_ids, first_fy, last_fy):
    """{ccn: [paf or None per FY first_fy..last_fy]} for hospitals in keep_ids; out-of-scope rows (MD/PR/no data) → None."""
    years = list(range(first_fy, last_fy + 1))
    out = {}
    for r in _records(text, ("ccn", "fy", "paf", "scope_flag"), "HRRP history"):
        ccn = r["ccn"]
        if ccn not in keep_ids or r["scope_flag"]:
            continue
        fy = int(r["fy"])
        if first_fy <= fy <= last_fy:
            out.setdefault(ccn, [None] * len(years))[fy - first_fy] = round(float(r["paf"]), 4)
    return years, out


def summarize_fy(fy, pafs, cap_pct):
    """National summary for one FY from its PAFs (same definitions as the historical summary CSV)."""
    reds = [(1 - p) * 100 for p in pafs]
    pen = [r for r in reds if r > 1e-9]
    avg = lambda xs: sum(xs) / len(xs) if xs else 0  # noqa: E731
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


def load_national(text):
    """Comparable-population national series FY2013-FY2026 from the historical summary CSV."""
    rows = []
    for r in _records(text, _NATIONAL_COLUMNS, "HRRP history summary"):
        rows.append({
            "fy": int(r["fy"]),
            "n": int(r["n_hospitals_comparable"]),
            "nPen": int(r["n_penalized_comparable"]),
            "pctPen": float(r["pct_penalized_comparable"]),
            "meanRed": float(r["mean_reduction_pct_all_comparable"]),
            "meanRedPen": float(r["mean_reduction_pct_penalized"]),
            "medianRedPen": float(r["median_reduction_pct_penalized"]),
            "nMax": int(r["n_at_max"]),
            "cap": int(r["max_cap_pct"]),
            "perf": [r["performance_period_start"] or None, r["performance_period_end"] or None],
        })
    return rows
