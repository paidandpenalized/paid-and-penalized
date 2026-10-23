"""The back-test (pp_pipeline.backtest_dollars): the comparison set's rules on synthetic reports, the cost report's
arithmetic, the checks, and on the pins: the counts, the signs of the program lines over the whole file, and the
committed `bands` being a fresh run's. Counts on the pins are facts of the pinned bytes; no hospital is named."""
import csv
import io
import math
import statistics
import unittest

from pp_engine import bands
from pp_engine.parse import SchemaError
from pp_pipeline import backtest_dollars as bt
from pp_pipeline.emit_dollars import committed_path
from pp_pipeline.files import read_json, read_pinned_bytes
from pp_pipeline.hcris_extract import CELLS, COLUMNS


def report(ccn, begin="2023-10-01", end="2024-09-30", part_a="Y", parhm="N", status="1", **cells):
    """An extract row (strings, as csv.DictReader gives them); cells by line number, column 1: l07099=61000."""
    row = {"rpt_rec_num": "1", "ccn": ccn, "status": status, "fy_begin": begin, "fy_end": end, "part_a": part_a,
           "parhm": parhm, **dict.fromkeys(CELLS, "")}
    for key, value in cells.items():
        row[f"{key}_c00100"] = str(value)
    return row


def model_row(status="estimated", cut=False, fed=1000, hrrp=-10, hvbp=5, at_stake=50, stratum="100-299/other"):
    hac = -at_stake if cut else 0
    return {"status": status, "cut": cut, "fed": fed, "hrrp": hrrp, "hvbp": hvbp, "at_stake": at_stake, "hac": hac,
            "net": hrrp + hvbp + hac, "stratum": stratum}


class CostReportArithmetic(unittest.TestCase):
    def test_lines_sum_their_two_columns_and_blank_is_zero(self):
        rep = report("990001", l00101=100, l00102=900, l07094=-30, l07091=-5, l07093=12, l07090=-2, l07099=70)
        rep["l00102_c00101"] = "50"
        self.assertEqual(bt.line(rep, "00102"), 950)
        self.assertEqual(bt.line(rep, "05400"), 0)
        self.assertEqual(bt.actuals(rep), {"fed": 1050, "hrrp": -35, "hvbp": 10, "hac": 70, "net": -35 + 10 - 70})

    def test_the_extract_reads_by_column_name_and_a_missing_column_stops_the_build(self):
        text = ",".join(COLUMNS) + "\n" + ",".join(f"v{i}" for i, _ in enumerate(COLUMNS)) + "\n"
        self.assertEqual(bt.read_reports(text), [{name: f"v{i}" for i, name in enumerate(COLUMNS)}])
        with self.assertRaisesRegex(SchemaError, "expected one column 'part_a'"):
            bt.read_reports(text.replace("part_a", "partA", 1))

    def test_the_models_figures(self):
        self.assertEqual(bt.modeled(model_row(cut=True)), {"fed": 1000, "hrrp": -10, "hvbp": 5, "hac": 50, "net": -55})


class ComparisonSet(unittest.TestCase):
    def setUp(self):
        self.rows = {"990001": model_row(), "990002": model_row(cut=True), "990003": model_row(status="no-inputs"),
                     "990004": model_row()}

    def run_set(self, reports):
        return bt.comparison_set(reports, self.rows)

    def test_each_report_is_left_out_by_the_first_rule_it_fails(self):
        reports = [
            report("990001", begin="2023-07-01", end="2024-06-30", part_a="N"),  # outside the window (and no Part A)
            report("990001", part_a="N"),
            report("21Z999"), report("40Z999", parhm="Y"), report("99Z998", parhm="Y"),
            report("990009"),  # not in the HACRP file
            report("990003"),  # in it, with no estimate
            report("990001", l07099=0), report("990002", status="5", l07099=61),
        ]
        members, excluded = self.run_set(reports)
        self.assertEqual(excluded, {"outside_window": 1, "no_part_a": 1, "maryland": 1, "puerto_rico": 1, "parhm": 1,
                                    "not_in_hacrp": 1, "not_estimated": 1})
        self.assertEqual([(m["ccn"], m["status"], m["cut"], m["stratum"]) for m in members],
                         [("990001", "1", False, "100-299/other"), ("990002", "5", True, "100-299/other")])
        self.assertEqual(members[1]["actual"]["hac"], 61)

    def test_two_reports_in_the_window_for_one_hospital_stop_the_build(self):
        with self.assertRaisesRegex(ValueError, "two cost reports"):
            self.run_set([report("990001"), report("990001")])

    def test_an_unknown_status_code_stops_the_build(self):
        with self.assertRaisesRegex(ValueError, "status"):
            self.run_set([report("990001", status="7")])

    def test_the_hac_cut_is_tested_on_cut_hospitals_and_every_pair_is_counted(self):
        members = [{"ccn": f"99{i:04d}", "status": "1", "stratum": "100-299/other", "cut": i % 2 == 0,
                    "model": {"hac": 100, "net": -50, "hrrp": 0, "hvbp": 5, "fed": 1000},
                    "actual": {"hac": 0 if i == 0 else 90 + i % 7, "net": -45, "hrrp": 0 if i < 40 else -3,
                               "hvbp": -5 if i == 1 else 5, "fed": 1000}}
                   for i in range(80)]
        hac = bt.measure_stats(bt.classify(members, "hac"))
        self.assertEqual(hac["pairs"], {"compared": 39, "sign_mismatch": 0, "zero_actual": 1, "zero_model": 0,
                                        "both_zero": 0})
        self.assertEqual(hac["overall"]["n"], 39)
        self.assertEqual(bt.measure_stats(bt.classify(members, "hvbp"))["pairs"],
                         {"compared": 79, "sign_mismatch": 1, "zero_actual": 0, "zero_model": 0, "both_zero": 0})
        # The model has no readmissions dollars for any of them: nothing to compare, so no band, and the build stops
        with self.assertRaisesRegex(ValueError, "too few"):
            bt.measure_stats(bt.classify(members, "hrrp"))


class Diagnostics(unittest.TestCase):
    def member(self, ccn, cut, stratum, ime_ma, total, at_stake, **cells):
        """A comparison-set member as `comparison_set` makes one; the model's DRG payments equal the report's."""
        rep = report(ccn, **cells)
        return {"ccn": ccn, "cut": cut, "stratum": stratum,
                "model": {"hac": at_stake, "fed": bt.line(rep, "00101") + bt.line(rep, "00102")},
                "actual": {"hac": bt.line(rep, "07099"), "fed": bt.line(rep, "00101") + bt.line(rep, "00102")},
                "row": {"ime_ma": ime_ma, "total": total}, "report": rep}

    def test_the_arithmetic(self):
        members = [
            # cut, other, with line 29.01: HAC error log(110/100), total error log(11000/10000): 0 beyond volume
            self.member("990001", True, "100-299/other", 80, 11000, 110, l02901=100, l04900=9000, l05000=1000,
                        l07099=100, l00102=8000, l05400=8),
            # cut, other, no line 29.01: HAC error log(90/100), total error 0
            self.member("990002", True, "300-plus/other", 0, 10000, 90, l04900=9500, l05000=500, l07099=100,
                        l00102=2000),
            # cut but SCH/MDH: left out of the base checks; the model's MA IME with no line
            self.member("990003", True, "under-100/sch-mdh", 5, 100, 1, l04900=100, l07099=1, l00102=1000),
        ]
        d = bt.diagnostics(members)
        self.assertEqual(d["ma_ime"], {"n": 1, "weighted": 0.8, "median": 0.8, "line_only": 0, "model_only": 1,
                                       "add_on": {"n": 0, "median": None}, "no_add_on": {"n": 1, "median": 0.8}})
        self.assertAlmostEqual(d["ntap"], 8 / 11000)
        self.assertEqual(d["hac_base"], {"n": 2, "median": 0.01})
        # The model's DRG payments are the cost report's in both (`member`), so less their error is the HAC error itself
        self.assertEqual(d["after_volume"], {
            "with_ma_ime": {"n": 1, "vs_total": 0.0, "vs_drg": round(math.log(1.1), 4)},
            "without": {"n": 1, "vs_total": round(math.log(0.9), 4), "vs_drg": round(math.log(0.9), 4)}})


class Checks(unittest.TestCase):
    def bands_with(self, median, hospitals, cut_n):
        return {"measures": {"hac": {"overall": {"median": median, "n": cut_n}}},
                "comparison": {"hospitals": hospitals, "reports": 6000, "cut": cut_n + 3}}

    def test_thresholds(self):
        self.assertEqual((bt.HAC_MEDIAN_MAX, bt.MIN_HOSPITALS, bt.MIN_CUT), (0.25, 180, 90))
        ok = bt.checks(self.bands_with(0.1, 180, 90))
        self.assertTrue(all(c["pass"] for c in ok))
        self.assertEqual([c["id"] for c in ok], ["backtest_hac_median", "backtest_hospitals", "backtest_cut"])
        for args, failing in (((0.2501, 500, 100), "backtest_hac_median"), ((-0.26, 500, 100), "backtest_hac_median"),
                              ((None, 500, 100), "backtest_hac_median"), ((0.0, 179, 100), "backtest_hospitals"),
                              ((0.0, 500, 89), "backtest_cut")):
            got = {c["id"]: c["pass"] for c in bt.checks(self.bands_with(*args))}
            self.assertEqual([k for k, v in got.items() if not v], [failing], args)


class OnThePins(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = bt.run()
        cls.bands = bt.bands_json()
        cls.reports = cls.result["reports"]
        cls.diagnostics = bt.diagnostics(cls.result["members"])

    def test_the_reports_are_the_extracts_rows_as_written(self):
        text = read_pinned_bytes(bt.HCRIS).decode("ascii")  # read here with the csv module, apart from the back-test's
        self.assertEqual(self.reports, list(csv.DictReader(io.StringIO(text))))

    def test_the_committed_bands_are_a_fresh_run(self):
        self.assertEqual(read_json(committed_path())["bands"], self.bands)

    def test_the_model_prices_the_fy2024_hacrp_file(self):
        statuses = [r["status"] for r in self.result["rows"].values()]
        self.assertEqual(len(statuses), 3129)
        self.assertEqual({s: statuses.count(s) for s in set(statuses)}, {"estimated": 3058, "maryland": 44,
                                                                         "no-inputs": 27})

    def test_the_comparison_set_and_its_exclusions(self):
        c = self.bands["comparison"]
        self.assertEqual(c["reports"], len(self.reports))
        self.assertEqual(c["reports"], 6113)
        self.assertEqual(c["excluded"], {"outsideWindow": 5249, "noPartA": 358, "maryland": 0, "puertoRico": 2,
                                         "parhm": 0, "notInHacrp": 3, "notEstimated": 3})
        self.assertEqual(c["reports"] - sum(c["excluded"].values()), c["hospitals"])
        self.assertEqual((c["hospitals"], c["cut"]), (498, 134))
        self.assertEqual(sum(c["statusCodes"].values()), c["hospitals"])
        self.assertEqual(c["hospitals"], len({m["ccn"] for m in self.result["members"]}))

    def test_the_program_lines_signs_over_every_report(self):
        # The chapter's line 71 adds 70.90 to 70.94 and subtracts 70.99: the readmissions lines are reductions,
        # value-based purchasing goes both ways, the HAC line is a positive amount. A handful of reports disagree.
        self.assertEqual(bt.sign_counts(self.reports), {"07090": (45, 34), "07091": (0, 74), "07093": (1246, 1286),
                                                        "07094": (10, 2452), "07099": (866, 3)})

    def test_the_hac_line_is_one_percent_of_the_operating_and_capital_payment(self):
        # Line 70.99 over line 49 (operating) + line 50 (capital), for the compared cut hospitals: 1% at the median,
        # which is what the program takes (Exhibit 5's base adds a few smaller items)
        shares = [m["actual"]["hac"] / (bt.line(m["report"], "04900") + bt.line(m["report"], "05000"))
                  for m in self.result["members"] if m["cut"] and m["actual"]["hac"] > 0]
        self.assertAlmostEqual(statistics.median(shares), 0.01, delta=0.0005)
        self.assertEqual(self.diagnostics["hac_base"], {"n": 98, "median": 0.0099})

    def test_the_model_runs_below_the_cost_reports_on_medicare_advantage_teaching_payments(self):
        # The model's IME on Medicare Advantage stays, from the impact file's FY2022 claims, against line 29.01: below
        # it, dollar-weighted and at the median. The HAC cut's errors carry the gap.
        ma = self.diagnostics["ma_ime"]
        self.assertEqual((ma["n"], ma["line_only"], ma["model_only"]), (179, 22, 5))
        self.assertLess(ma["weighted"], 1)
        self.assertLess(ma["median"], 1)
        # Those whose line 29.01 includes a section 422 add-on (line 28.01) run no lower than the rest: no sign the
        # add-on is missing from the model's IME factor
        self.assertEqual(ma["add_on"]["n"] + ma["no_add_on"]["n"], ma["n"])
        self.assertGreaterEqual(ma["add_on"]["median"], ma["no_add_on"]["median"])

    def test_after_volume_the_hac_cut_matches_its_base(self):
        # For the compared cut hospitals neither SCH nor MDH (METHODS-LOG, dollars methods_version 3): the HAC error
        # less the total payment's error is about zero with and without line 29.01, so the cut is figured on the cost
        # report's base; less the DRG payments' error, those with line 29.01 still run low, the model's Medicare
        # Advantage teaching payments being short
        av = self.diagnostics["after_volume"]
        self.assertEqual(av, {"with_ma_ime": {"n": 42, "vs_total": -0.0006, "vs_drg": -0.0389},
                              "without": {"n": 56, "vs_total": -0.0002, "vs_drg": -0.0091}})
        self.assertLess(av["with_ma_ime"]["vs_drg"], av["without"]["vs_drg"])
        self.assertLess(self.diagnostics["ntap"], 0.001)  # new-technology payments: under 0.1% of DRG payments

    def test_each_measure_counts_every_pair_and_the_points_are_the_hac_comparisons(self):
        members = self.result["members"]
        for key, m in self.bands["measures"].items():
            tested = sum(x["cut"] for x in members) if key == "hac" else len(members)
            self.assertEqual(sum(m["pairs"].values()), tested, key)
            self.assertEqual(m["overall"]["n"], m["pairs"]["compared"], key)
            self.assertEqual(sum(s["n"] for s in m["strata"]), m["pairs"]["compared"], key)
            for s in m["strata"]:
                self.assertEqual((s["low"], s["high"]), bands.multipliers(s["p10"], s["p90"]), (key, s["stratum"]))
                self.assertGreaterEqual(s["poolN"], bands.MIN_STRATUM, (key, s["stratum"]))
        self.assertEqual(len(self.bands["points"]), self.bands["measures"]["hac"]["pairs"]["compared"])
        self.assertTrue(all(p["model"] > 0 and p["actual"] > 0 for p in self.bands["points"]))
        self.assertEqual(self.bands["national"]["n"], len(self.bands["points"]))


if __name__ == "__main__":
    unittest.main()
