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
import functools
import sys

from pp_engine import bands, dollars, ipps
from pp_engine.contract import camel
from pp_engine.parse import rows, table
from pp_pipeline import hcris_extract
from pp_pipeline.emit_hospital import read_hacrp
from pp_pipeline.files import read_pinned_bytes
from pp_pipeline.ipps_pins import BACKTEST_FY, pin_ids, priced_rows

FY = BACKTEST_FY
HACRP = f"hacrp-fy{FY}"
HCRIS = hcris_extract.PIN_ID
SOURCES = (HACRP, *pin_ids(FY), HCRIS)
WINDOW = (f"{FY - 1}-10-01", f"{FY}-09-30")  # the federal fiscal year, October through September
# The claims year of the impact file's volume, two years before the rule's (FY2024's file: "MARCH 2023 UPDATE OF FY 2022
# MEDPAR"; FY2026's, emit_dollars.VOLUME_FY, is FY2024).
VOLUME_FY = FY - 2
MARYLAND_CODE = "21"  # Maryland's CCNs begin with 21, Puerto Rico's (ipps.PUERTO_RICO) with 40
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
    """The HCRIS extract (pp_pipeline.hcris_extract) as a list of rows, each a dict of its columns' text."""
    return table(rows(text, ","), hcris_extract.COLUMNS[0], {name: name for name in hcris_extract.COLUMNS},
                 "HCRIS extract")


def comparison_set(reports, priced):
    """(members, excluded). `reports`: the HCRIS extract's rows; `priced`: the model's priced row (ipps_pins.priced_rows)
    for each hospital in the FY2024 HACRP file, by CCN. `excluded` counts each report left out by the first of
    EXCLUSIONS it meets; each member is {ccn, status, stratum, cut, model, actual}."""
    excluded = dict.fromkeys(EXCLUSIONS, 0)
    members, seen = [], set()
    for rep in reports:
        ccn = rep["ccn"]
        reason = ("outside_window" if (rep["fy_begin"], rep["fy_end"]) != WINDOW else
                  "no_part_a" if rep["part_a"] != "Y" else
                  "maryland" if ccn[:2] == MARYLAND_CODE else
                  "puerto_rico" if ccn[:2] == ipps.PUERTO_RICO else
                  "parhm" if rep["parhm"] == "Y" else
                  "not_in_hacrp" if ccn not in priced else
                  "not_estimated" if priced[ccn]["status"] != "estimated" else None)
        if reason:
            excluded[reason] += 1
            continue
        if ccn in seen:
            raise ValueError(f"two cost reports in the window for one hospital ({ccn[:2]}xxxx)")
        if rep["status"] not in STATUS_CODES:
            raise ValueError(f"a cost report with status {rep['status']!r}, not one of {STATUS_CODES}")
        seen.add(ccn)
        row = priced[ccn]
        members.append({"ccn": ccn, "status": rep["status"], "stratum": row["stratum"], "cut": row["cut"],
                        "model": modeled(row), "actual": actuals(rep)})
    return members, excluded


def classify(members, measure):
    """[(member, model, actual, kind)] for the members a measure is tested on, the cut hospitals for the HAC cut and
    everyone for the rest: the model's and the cost report's figures, and which of bands.PAIR_KINDS they are."""
    tested = [m for m in members if m["cut"]] if measure == "hac" else members
    return [(m, m["model"][measure], m["actual"][measure], bands.pair_kind(m["model"][measure], m["actual"][measure]))
            for m in tested]


def measure_stats(tested):
    """{pairs: {kind: count}, strata, overall} for one measure, from its `classify` (pp_engine.bands.stratum_bands)."""
    kinds = dict.fromkeys(bands.PAIR_KINDS, 0)
    errors = {}
    for m, model, actual, kind in tested:
        kinds[kind] += 1
        if kind == "compared":
            errors.setdefault(m["stratum"], []).append(bands.log_ratio(model, actual))
    strata, overall = bands.stratum_bands(errors)
    return {"pairs": kinds, "strata": strata, "overall": overall}


@functools.lru_cache(maxsize=None)
def run():
    """The back-test on the pins: {rows, members, excluded, reports, measures, national, points}. `rows`: the model's
    priced row for each hospital in the FY2024 HACRP file, by CCN; `reports`: the HCRIS extract's rows; `points`: the
    HAC cut's compared pairs, by CCN. Cached; callers must not modify it."""
    hacrp = read_hacrp(read_pinned_bytes(HACRP).decode("utf-8"))
    if hacrp["fy"] != FY:
        raise ValueError(f"the back-test's HACRP file is for FY{hacrp['fy']}, not FY{FY}")
    priced = {row["ccn"]: row for row in priced_rows(hacrp["records"], FY)}
    reports = read_reports(read_pinned_bytes(HCRIS).decode("ascii"))
    members, excluded = comparison_set(reports, priced)
    tested = {k: classify(members, k) for k in MEASURES}
    compared = [(m, model, actual) for m, model, actual, kind in tested["hac"] if kind == "compared"]
    return {"rows": priced, "members": members, "excluded": excluded, "reports": reports,
            "measures": {k: measure_stats(t) for k, t in tested.items()},
            "national": bands.bootstrap_ratio([(model, actual) for _, model, actual in compared]),
            "points": [{"ccn": m["ccn"], "stratum": m["stratum"], "model": model, "actual": actual}
                       for m, model, actual in sorted(compared, key=lambda c: c[0]["ccn"])]}


def bands_json():
    """The `bands` object dollars.json carries (schemas/dollars.schema.json, $defs/bands)."""
    r = run()
    members = r["members"]
    return {
        "fy": FY,
        "volumeFy": VOLUME_FY,
        "sources": list(SOURCES),
        "window": list(WINDOW),
        "minStratum": bands.MIN_STRATUM,
        "lowPct": bands.LOW_PCT,
        "highPct": bands.HIGH_PCT,
        "strata": [{"id": bands.stratum_id(band, kind), "band": band, "bedsMin": low, "bedsMax": high,
                    "schMdh": kind == bands.SCH_MDH}
                   for band, low, high in bands.BED_BANDS for kind in bands.KINDS],
        "comparison": {
            "reports": len(r["reports"]), "excluded": {camel(k): r["excluded"][k] for k in EXCLUSIONS},
            "hospitals": len(members),
            "cut": sum(m["cut"] for m in members),
            "statusCodes": {code: sum(m["status"] == code for m in members) for code in STATUS_CODES},
        },
        "measures": {k: {"pairs": {camel(kind): v["pairs"][kind] for kind in bands.PAIR_KINDS},
                         "overall": v["overall"], "strata": v["strata"]}
                     for k, v in r["measures"].items()},
        "national": r["national"],
        "points": r["points"],
    }


def checks(b):
    """The back-test's checks, in dollars.checks' shape: the HAC cut's median error, the comparison set's size and its
    cut hospitals' (the thresholds above)."""
    hac = b["measures"]["hac"]["overall"]
    return [
        dollars.result("backtest_hac_median", hac["median"], -HAC_MEDIAN_MAX, HAC_MEDIAN_MAX),
        dollars.result("backtest_hospitals", b["comparison"]["hospitals"], MIN_HOSPITALS, b["comparison"]["reports"]),
        dollars.result("backtest_cut", hac["n"], MIN_CUT, b["comparison"]["cut"]),
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
    b = bands_json()
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
    print("signs over every report (positive, negative): "
          + ", ".join(f"{k} {v}" for k, v in sign_counts(r["reports"]).items()))
    results = checks(b)
    for x in results:
        print(f"check {x['id']}: {x['value']} in {x['low']} to {x['high']}: {'pass' if x['pass'] else 'FAIL'}")
    return 0 if all(x["pass"] for x in results) else 1


if __name__ == "__main__":
    sys.exit(main())
