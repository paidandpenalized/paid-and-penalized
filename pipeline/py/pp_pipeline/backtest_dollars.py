"""The back-test behind the likely ranges on the dollar estimates: the same estimate (pp_engine.dollars, the same
assumptions: new-technology payments left out, the year's rates, the volume of the year's impact file) run on the
FY2024 final rule's files and the FY2024 HACRP decisions, and set beside what each hospital's FY2024 Medicare cost
report says Medicare paid and adjusted. pp_engine.bands turns the errors into ranges; emit_dollars writes them into
dollars.json as `bands`.

`python3 -I pipeline/py/run.py backtest` prints the comparison set, its exclusions and the statistics.

The comparison set: the HCRIS FY2024 file's cost reports for exactly the federal fiscal year (2023-10-01 to
2024-09-30), so the program lines hold FY2024's factors only; with a Worksheet E Part A; not Maryland's (paid under
the state's own model) or Puerto Rico's; without the Pennsylvania Rural Health Model's worksheet; and for a hospital in
the FY2024 HACRP file that the estimate prices (status estimated). The file holds one report per hospital and period,
the most advanced CMS has (as filed, amended, settled); a hospital with two reports in the window stops the build.
Every report left out is counted by the first rule it fails (`EXCLUSIONS`).

What the cost report says (Worksheet E Part A, PRM-II ch. 40, 4030.1; pp_pipeline.hcris_extract quotes each line):
    fed    lines 1.01 + 1.02, the federal DRG payments. The model's figure is `fed`, not B: an MDH's add-on is not on
           these lines (it is in line 49)
    hrrp   line 70.94 + 70.91 (the MDH part); both negative
    hvbp   line 70.93 + 70.90 (the MDH part); signed
    hac    line 70.99, positive, which line 71 subtracts; the model's figure is the dollars at stake, for the
           hospitals CMS cut
    net    70.93 + 70.94 + 70.90 + 70.91 - 70.99, against the model's hrrp + hvbp + hac
Each line sums columns 1 and 1.01 (the second where the hospital's status changed in the period).

Known gaps between the two (the errors carry them; the ranges are as wide as they make them): the impact file's
volume is FY2022 claims, the cost report FY2024's; new-technology add-on payments (line 54) are in the cost report's
payments, not the model's; the FY2024 impact file's wage index predates the rule's correction notice (CMS-1785-CN,
which corrected the wage index tables for some hospitals but posted no new impact file); the hospital-specific-rate
comparisons are made once on the year's totals, not claim by claim.
"""
import csv
import functools
import io
import sys

from pp_engine import bands, dollars
from pp_engine.parse import MARYLAND
from pp_pipeline import hcris_extract
from pp_pipeline.emit_hospital import read_hacrp
from pp_pipeline.files import read_pinned_bytes
from pp_pipeline.ipps_pins import BACKTEST_FY, hrrp_factors, payment_inputs, pin_ids, rates, vbp_factors

FY = BACKTEST_FY
HACRP = f"hacrp-fy{FY}"
HCRIS = hcris_extract.PIN_ID
SOURCES = (HACRP, *pin_ids(FY), HCRIS)
WINDOW = ("2023-10-01", "2024-09-30")  # the federal fiscal year FY2024
# The claims year of the FY2024 impact file's volume (its README: "MARCH 2023 UPDATE OF FY 2022 MEDPAR"), two years
# before the rule's, as FY2026's file's is FY2024 (emit_dollars.VOLUME_FY).
VOLUME_FY = 2022
STATE_CODES = {"21": MARYLAND, "40": "PR"}  # a CCN's first two digits: Maryland, Puerto Rico
# CMS publishes no Pennsylvania Rural Health Model participant file with CCNs (as for FY2026, emit_dollars.PARHM); the
# back-test leaves participants out by the model's own cost-report worksheet instead.
PARHM = frozenset()
# The HCRIS report status codes (RPT_STUS_CD) the file uses: 1 as submitted, 2 settled without audit, 3 settled with
# audit, 4 reopened, 5 amended.
STATUS_CODES = ("1", "2", "3", "4", "5")
EXCLUSIONS = ("outside_window", "no_part_a", "maryland", "puerto_rico", "parhm", "not_in_hacrp", "not_estimated")
MEASURES = ("hac", "net", "hrrp", "hvbp", "fed")

# The checks the back-test must pass before dollars.json is written. Both were set before any error was computed.
# The HAC median: the known gaps (claims two years old, NTAP left out at about 1% of payments, case-mix drift, the
# hospital-specific comparisons made on totals) should each be well under 10%; a median error of more than 0.25 (a
# factor of 1.28) would point to a structural mistake (a wrong line, base or join), not drift.
HAC_MEDIAN_MAX = 0.25
# The comparison set: enough hospitals for each of the six strata to hold its own band (6 x MIN_STRATUM) and enough
# cut hospitals for each of the three bed bands to hold its own HAC band (3 x MIN_STRATUM).
MIN_HOSPITALS = len(bands.STRATA) * bands.MIN_STRATUM
MIN_CUT = len(bands.BED_BANDS) * bands.MIN_STRATUM


def line(report, number):
    """A Worksheet E Part A line's value: columns 1 and 1.01 summed, 0 where the file stores none."""
    return sum(int(report[f"l{number}_c{col}"] or 0) for col in hcris_extract.COLUMNS_READ)


def actuals(report):
    """The cost report's figures for the measures (see the module docstring), whole dollars."""
    hrrp = line(report, "07094") + line(report, "07091")
    hvbp = line(report, "07093") + line(report, "07090")
    hac = line(report, "07099")
    return {"fed": line(report, "00101") + line(report, "00102"), "hrrp": hrrp, "hvbp": hvbp, "hac": hac,
            "net": hrrp + hvbp - hac}


def modeled(row):
    """The model's figures for the measures, from its whole-dollar `hospital_row`."""
    return {"fed": row["fed"], "hrrp": row["hrrp"], "hvbp": row["hvbp"], "hac": row["at_stake"], "net": row["net"]}


def read_reports(text):
    return list(csv.DictReader(io.StringIO(text)))


def comparison_set(reports, records, rows, inputs):
    """(members, excluded). `reports`: the HCRIS extract's rows; `records`: the FY2024 HACRP file's (read_hacrp);
    `rows`: the model's hospital_row for each record, by CCN; `inputs`: the FY2024 impact file's, by CCN. `excluded`
    counts each report left out by the first of EXCLUSIONS it meets; each member is {ccn, status, stratum, cut,
    model, actual}."""
    hacrp = {r["ccn"]: r for r in records}
    excluded = dict.fromkeys(EXCLUSIONS, 0)
    members, seen = [], set()
    for rep in reports:
        ccn = rep["ccn"]
        reason = ("outside_window" if (rep["fy_begin"], rep["fy_end"]) != WINDOW else
                  "no_part_a" if rep["part_a"] != "Y" else
                  "maryland" if STATE_CODES.get(ccn[:2]) == MARYLAND else
                  "puerto_rico" if ccn[:2] in STATE_CODES else
                  "parhm" if rep["parhm"] == "Y" else
                  "not_in_hacrp" if ccn not in hacrp else
                  "not_estimated" if rows[ccn]["status"] != "estimated" else None)
        if reason:
            excluded[reason] += 1
            continue
        if ccn in seen:
            raise ValueError(f"two cost reports in the window for one hospital ({ccn[:2]}xxxx)")
        if rep["status"] not in STATUS_CODES:
            raise ValueError(f"a cost report with status {rep['status']!r}, not one of {STATUS_CODES}")
        seen.add(ccn)
        h = inputs[ccn]
        members.append({"ccn": ccn, "status": rep["status"], "stratum": bands.stratum(h["beds"], h["sch"], h["mdh"]),
                        "cut": rows[ccn]["cut"], "model": modeled(rows[ccn]), "actual": actuals(rep)})
    if any(m["stratum"] is None for m in members):
        raise ValueError("a comparison-set hospital has no bed count in the impact file")
    return members, excluded


def measure_pairs(members, measure):
    """The members a measure is tested on: the cut hospitals for the HAC cut, everyone for the rest."""
    return [m for m in members if m["cut"]] if measure == "hac" else members


def measure_stats(members, measure):
    """{pairs: {kind: count}, strata, overall} for one measure (pp_engine.bands.stratum_bands)."""
    kinds = dict.fromkeys(bands.PAIR_KINDS, 0)
    errors = {}
    for m in measure_pairs(members, measure):
        model, actual = m["model"][measure], m["actual"][measure]
        kind = bands.pair_kind(model, actual)
        kinds[kind] += 1
        if kind == "compared":
            errors.setdefault(m["stratum"], []).append(bands.log_ratio(model, actual))
    strata, overall = bands.stratum_bands(errors)
    return {"pairs": kinds, "strata": strata, "overall": overall}


@functools.lru_cache(maxsize=None)
def run():
    """The back-test on the pins: {records, rows, members, excluded, reports, measures, national}. Cached; callers must
    not modify it."""
    hacrp = read_hacrp(read_pinned_bytes(HACRP).decode("utf-8"))
    if hacrp["fy"] != FY:
        raise ValueError(f"the back-test's HACRP file is for FY{hacrp['fy']}, not FY{FY}")
    inputs, table, hrrp, vbp = payment_inputs(FY), rates(FY), hrrp_factors(FY), vbp_factors(FY)
    rows = {r["ccn"]: dollars.hospital_row(r["ccn"], r["state"], inputs.get(r["ccn"]), table, hrrp=hrrp.get(r["ccn"]),
                                           vbp=vbp.get(r["ccn"]), cut=r["cut"], parhm=PARHM)
            for r in hacrp["records"]}
    reports = read_reports(read_pinned_bytes(HCRIS).decode("ascii"))
    members, excluded = comparison_set(reports, hacrp["records"], rows, inputs)
    measures = {k: measure_stats(members, k) for k in MEASURES}
    cut_pairs = [(m["model"]["hac"], m["actual"]["hac"]) for m in measure_pairs(members, "hac")
                 if bands.pair_kind(m["model"]["hac"], m["actual"]["hac"]) == "compared"]
    return {"records": hacrp["records"], "rows": rows, "members": members, "excluded": excluded, "reports": len(reports),
            "measures": measures, "national": bands.bootstrap_ratio(cut_pairs)}


def _camel_pairs(kinds):
    return {"compared": kinds["compared"], "signMismatch": kinds["sign_mismatch"], "zeroActual": kinds["zero_actual"],
            "zeroModel": kinds["zero_model"], "bothZero": kinds["both_zero"]}


def bands_json(result=None):
    """The `bands` object dollars.json carries (schemas/dollars.schema.json, $defs/bands)."""
    r = result or run()
    members = r["members"]
    excluded = {"outsideWindow": r["excluded"]["outside_window"], "noPartA": r["excluded"]["no_part_a"],
                "maryland": r["excluded"]["maryland"], "puertoRico": r["excluded"]["puerto_rico"],
                "parhm": r["excluded"]["parhm"], "notInHacrp": r["excluded"]["not_in_hacrp"],
                "notEstimated": r["excluded"]["not_estimated"]}
    hac = [m for m in measure_pairs(members, "hac") if bands.pair_kind(m["model"]["hac"], m["actual"]["hac"]) == "compared"]
    return {
        "fy": FY,
        "volumeFy": VOLUME_FY,
        "sources": list(SOURCES),
        "window": list(WINDOW),
        "minStratum": bands.MIN_STRATUM,
        "lowPct": bands.LOW_PCT,
        "highPct": bands.HIGH_PCT,
        "strata": [{"id": s, "band": bands.band_of(s), "bedsMin": low, "bedsMax": high, "schMdh": s.endswith("/sch-mdh")}
                   for s in bands.STRATA for band, low, high in bands.BED_BANDS if band == bands.band_of(s)],
        "comparison": {
            "reports": r["reports"], "excluded": excluded, "hospitals": len(members),
            "cut": sum(m["cut"] for m in members),
            "statusCodes": {code: sum(m["status"] == code for m in members) for code in STATUS_CODES},
        },
        "measures": {k: {"pairs": _camel_pairs(v["pairs"]), "overall": v["overall"], "strata": v["strata"]}
                     for k, v in r["measures"].items()},
        "national": r["national"],
        "points": [{"ccn": m["ccn"], "stratum": m["stratum"], "model": m["model"]["hac"], "actual": m["actual"]["hac"]}
                   for m in sorted(hac, key=lambda m: m["ccn"])],
    }


def checks(b):
    """The back-test's checks, in dollars.checks' shape: the HAC cut's median error, the comparison set's size and its
    cut hospitals' (the thresholds above)."""
    median = b["measures"]["hac"]["overall"]["median"]
    return [
        {"id": "backtest_hac_median", "value": median, "low": -HAC_MEDIAN_MAX, "high": HAC_MEDIAN_MAX,
         "pass": median is not None and -HAC_MEDIAN_MAX <= median <= HAC_MEDIAN_MAX},
        {"id": "backtest_hospitals", "value": b["comparison"]["hospitals"], "low": MIN_HOSPITALS,
         "high": b["comparison"]["reports"], "pass": b["comparison"]["hospitals"] >= MIN_HOSPITALS},
        {"id": "backtest_cut", "value": b["measures"]["hac"]["overall"]["n"], "low": MIN_CUT,
         "high": b["comparison"]["cut"], "pass": b["measures"]["hac"]["overall"]["n"] >= MIN_CUT},
    ]


def sign_counts(reports):
    """{line: (positive, negative)} over every report in the extract, for the program lines: the signs the module
    docstring states (70.94 and 70.91 negative, 70.99 positive, 70.93 and 70.90 either)."""
    out = {}
    for number in ("07090", "07091", "07093", "07094", "07099"):
        values = [line(rep, number) for rep in reports]
        out[number] = (sum(v > 0 for v in values), sum(v < 0 for v in values))
    return out


def main():
    """Print the back-test: the set, the exclusions, each measure's statistics by stratum, the national ratio, the
    checks. Returns 1 if a check fails."""
    r = run()
    b = bands_json(r)
    c = b["comparison"]
    print(f"HCRIS FY{FY} reports: {c['reports']}; comparison set {c['hospitals']} hospitals ({c['cut']} cut by CMS)")
    print("  excluded: " + ", ".join(f"{k} {v}" for k, v in c["excluded"].items()))
    print("  report status codes: " + ", ".join(f"{k}: {v}" for k, v in c["statusCodes"].items()))
    for k, v in b["measures"].items():
        o = v["overall"]
        print(f"{k}: n {o['n']}, median {o['median']}, p10 {o['p10']}, p90 {o['p90']}; "
              + ", ".join(f"{p} {n}" for p, n in v["pairs"].items()))
        for s in v["strata"]:
            print(f"    {s['stratum']:<20} n {s['n']:>4}  median {s['median']!s:>8}  from {s['pool']:<7} "
                  f"(n {s['poolN']:>4})  p10 {s['p10']:>8}  p90 {s['p90']:>8}  x{s['low']} to x{s['high']}")
    n = b["national"]
    print(f"national: sum(actual)/sum(model) {n['ratio']} over {n['n']} cut hospitals; bootstrap p10 {n['p10']}, "
          f"p90 {n['p90']} ({n['draws']} draws)")
    reports = read_reports(read_pinned_bytes(HCRIS).decode("ascii"))
    print("signs over every report (positive, negative): "
          + ", ".join(f"{k} {v}" for k, v in sign_counts(reports).items()))
    failed = [x for x in checks(b) if not x["pass"]]
    for x in checks(b):
        print(f"check {x['id']}: {x['value']} in {x['low']} to {x['high']}: {'pass' if x['pass'] else 'FAIL'}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
