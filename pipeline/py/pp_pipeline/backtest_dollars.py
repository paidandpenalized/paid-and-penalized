"""The back-test behind the likely ranges on the dollar estimates: the same estimate (pp_engine.dollars, the same
assumptions: new-technology payments left out, the year's rates, the volume of the year's impact file) run on the
FY2024 final rule's files and the FY2024 HACRP decisions, and set beside what each hospital's FY2024 Medicare cost
report says Medicare paid and adjusted. pp_engine.bands turns the errors into ranges; emit_dollars writes them into
dollars.json as `bands`.

`python3 -I pipeline/py/run.py backtest` prints the comparison set, its exclusions and the statistics.

The comparison set: the HCRIS FY2024 file's cost reports for exactly the federal fiscal year (2023-10-01 to
2024-09-30), so the program lines hold FY2024's factors only; with a Worksheet E Part A; not Maryland's (paid under
the state's own model) or Puerto Rico's; without the Pennsylvania Rural Health Model's worksheet; and for a hospital in
the FY2024 HACRP file that the estimate prices (status estimated), with a bed count in the impact file (a hospital
without one has no stratum to test; on the pages its ranges take the whole set's). The file holds one report per
hospital and period, the most advanced CMS has (as filed, amended, settled); a hospital with two reports in the window
stops the build.
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
EXCLUSIONS = ("outside_window", "no_part_a", "maryland", "puerto_rico", "parhm", "not_in_hacrp", "not_estimated",
              "no_beds")
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
    EXCLUSIONS it meets; each member is {ccn, status, stratum, cut, model, actual, row, report}: `model` and `actual`
    the measures' figures (`modeled`, `actuals`); `row` and `report` the priced row and the cost report behind them."""
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
                  "not_estimated" if priced[ccn]["status"] != "estimated" else
                  "no_beds" if priced[ccn]["stratum"] == bands.ALL else None)
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
                        "model": modeled(row), "actual": actuals(rep), "row": row, "report": rep})
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


# The comparison set's strata of hospitals that are neither sole community nor Medicare-dependent: line 49 is their
# line 47 plus line 29.01, with no hospital-specific comparison in it.
OTHER_STRATA = frozenset(bands.stratum_id(band, bands.OTHER) for band, _, _ in bands.BED_BANDS)


def _rounded(x):
    return None if x is None else round(x, bands.DECIMALS)


def _median(values):
    return _rounded(bands.percentile(values, 0.5)) if values else None


def diagnostics(members):
    """What `main` prints beside the statistics to explain the HAC cut's misses, from the extract's second group of
    lines, over the comparison set (`run()["members"]`):
      ma_ime        the model's IME on Medicare Advantage stays (`ime_ma`) against line 29.01, over the hospitals with
                    both: n, the dollar-weighted ratio (sum over sum) and the median ratio; how many have only one;
                    and the median ratio apart for those whose line 29.01 includes a section 422 add-on (line 28.01),
                    `add_on`, and the rest, `no_add_on` (the model takes the add-on to be in the IME factor)
      ntap          line 54 (new-technology add-on payments, which the model leaves out) over lines 1.01 + 1.02,
                    summed over every hospital
      hac_base      the median of line 70.99 over lines 49 + 50 for the compared cut hospitals that are neither SCH nor
                    MDH: the HAC line as a share of the operating and capital payment
      after_volume  for those same hospitals, split by whether their cost report has line 29.01 (`with_ma_ime`,
                    `without`): n, and the median of the HAC cut's error (a log) less another error. `vs_total`: less
                    the error of the model's total payment against lines 49 + 50. Both include the teaching payments
                    on Medicare Advantage stays, so this asks whether the cut is figured on the cost report's base, all
                    else (volume, and how well each part is modeled) moving both alike. `vs_drg`: less the error of
                    the DRG payments (`fed`, lines 1.01 + 1.02), so what is left is how the rest of the base is
                    modeled, the Medicare Advantage teaching payments among it.
    Ratios are rounded to bands.DECIMALS, except `ntap`, a share well under 1%."""
    ma = [(m["row"]["ime_ma"], line(m["report"], "02901"), line(m["report"], "02801") > 0) for m in members]
    both = [(model, actual) for model, actual, _ in ma if model > 0 and actual > 0]
    by_add_on = {flag: [model / actual for model, actual, f in ma if model > 0 and actual > 0 and f == flag]
                 for flag in (True, False)}
    paid = lambda m: line(m["report"], "04900") + line(m["report"], "05000")  # noqa: E731 (operating + capital)
    cut = [(m, paid(m)) for m in members if m["cut"] and m["stratum"] in OTHER_STRATA and paid(m) > 0
           and bands.pair_kind(m["model"]["hac"], m["actual"]["hac"]) == "compared"]
    beyond = {True: ([], []), False: ([], [])}
    for m, p in cut:
        hac = bands.log_ratio(m["model"]["hac"], m["actual"]["hac"])
        vs_total, vs_drg = beyond[line(m["report"], "02901") > 0]
        vs_total.append(hac - bands.log_ratio(m["row"]["total"], p))
        vs_drg.append(hac - bands.log_ratio(m["model"]["fed"], m["actual"]["fed"]))
    return {
        "ma_ime": {"n": len(both),
                   "weighted": _rounded(sum(m for m, _ in both) / sum(a for _, a in both)) if both else None,
                   "median": _median([m / a for m, a in both]),
                   "line_only": sum(model == 0 and actual > 0 for model, actual, _ in ma),
                   "model_only": sum(model > 0 and actual == 0 for model, actual, _ in ma),
                   **{key: {"n": len(by_add_on[flag]), "median": _median(by_add_on[flag])}
                      for key, flag in (("add_on", True), ("no_add_on", False))}},
        "ntap": sum(line(m["report"], "05400") for m in members) / sum(m["actual"]["fed"] for m in members),
        "hac_base": {"n": len(cut), "median": _median([m["actual"]["hac"] / p for m, p in cut])},
        "after_volume": {key: {"n": len(vs_total), "vs_total": _median(vs_total), "vs_drg": _median(vs_drg)}
                         for key, (vs_total, vs_drg) in (("with_ma_ime", beyond[True]), ("without", beyond[False]))},
    }


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
    d = diagnostics(r["members"])
    ma, base, av = d["ma_ime"], d["hac_base"], d["after_volume"]
    print(f"diagnostics: the model's IME on Medicare Advantage stays / line 29.01, over {ma['n']} hospitals with both: "
          f"{ma['weighted']} dollar-weighted, {ma['median']} median ({ma['line_only']} with the line only, "
          f"{ma['model_only']} with the model's only); median {ma['add_on']['median']} for the {ma['add_on']['n']} "
          f"with a section 422 add-on (line 28.01), {ma['no_add_on']['median']} for the {ma['no_add_on']['n']} without")
    print(f"  line 54 (new technology) / lines 1.01 + 1.02, dollar-weighted: {d['ntap']:.3%}")
    print(f"  line 70.99 / (line 49 + line 50), median over {base['n']} compared cut hospitals neither SCH nor MDH: "
          f"{base['median']}")
    for key, words in (("with_ma_ime", "with line 29.01"), ("without", "without it")):
        print(f"  the same hospitals {words} (n {av[key]['n']}): median HAC error less the total payment's error "
              f"(vs lines 49 + 50) {av[key]['vs_total']}, less the DRG payments' error {av[key]['vs_drg']}")
    results = checks(b)
    for x in results:
        print(f"check {x['id']}: {x['value']} in {x['low']} to {x['high']}: {'pass' if x['pass'] else 'FAIL'}")
    return 0 if all(x["pass"] for x in results) else 1


if __name__ == "__main__":
    sys.exit(main())
