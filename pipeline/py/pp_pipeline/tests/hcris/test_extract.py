"""The HCRIS extract and cross-check (pp_pipeline.hcris) on a synthetic zip. Invented CCNs and report numbers only."""
import csv
import io
import json
import tempfile
import unittest
import unittest.mock
import zipfile
from pathlib import Path

from pp_engine.hcris import cells, tidy
from pp_engine.tests.hcris.test_tidy import cell, report
from pp_pipeline.hcris import crosscheck, extract


def csv_bytes(rows):
    out = io.StringIO()
    csv.writer(out, lineterminator="\r\n").writerows(rows)
    return out.getvalue().encode("ascii")


def write_zip(path, year, reports, numbers):
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr(f"HOSP10_{year}_rpt.csv", csv_bytes(reports))
        zf.writestr(f"HOSP10_{year}_nmrc.csv", csv_bytes(numbers))
        zf.writestr(f"HOSP10_{year}_alpha.csv", b"")


class Extract(unittest.TestCase):
    def test_run_writes_the_three_tables_and_the_sources(self):
        with tempfile.TemporaryDirectory() as tmp:
            z = Path(tmp) / "HOSP10FY2024.ZIP"
            write_zip(z, 2024, [report("7", "990001"), report("8", "990002")],
                      [cell("7", "days_total", "1000"), cell("7", "net_income", "-25"), cell("8", "beds", "12")])
            sources, outputs = extract.run([z], Path(tmp) / "out")
            with open(Path(tmp) / "out" / "hcris_wide.csv", newline="") as f:
                wide = list(csv.DictReader(f))
            with open(Path(tmp) / "out" / "hcris_long.csv", newline="") as f:
                long_ = list(csv.reader(f))
            meta = json.loads((Path(tmp) / "out" / "sources.json").read_text())
        self.assertEqual([r["ccn"] for r in wide], ["990001", "990002"])
        self.assertEqual((wide[0]["days_total"], wide[0]["net_income"], wide[0]["beds"]), ("1000", "-25", ""))
        self.assertEqual(long_[1:], [["990001", "2024", "days_total", "1000"], ["990001", "2024", "net_income", "-25"],
                                     ["990002", "2024", "beds", "12"]])
        self.assertEqual((sources[0]["year"], sources[0]["reports"], sources[0]["hospital_years"]), (2024, 2, 2))
        self.assertEqual(meta["outputs"]["hcris_wide.csv"]["rows"], 2)
        self.assertEqual(len(meta["sources"][0]["sha256"]), 64)

    def test_refuses_a_zip_that_is_not_hcris(self):
        with tempfile.TemporaryDirectory() as tmp:
            z = Path(tmp) / "other.zip"
            with zipfile.ZipFile(z, "w") as zf:
                zf.writestr("readme.txt", b"")
            with self.assertRaises(tidy.HcrisError):
                extract.read_year(z)

    def test_refuses_a_full_year_with_a_worksheet_missing(self):
        reports = [report(str(n), f"99{n:04d}") for n in range(1, 102)]
        numbers = [cell("1", "days_total", "1")]  # S-3 only: G-3 and S-10 read nothing
        with tempfile.TemporaryDirectory() as tmp:
            z = Path(tmp) / "HOSP10FY2024.ZIP"
            write_zip(z, 2024, reports, numbers)
            with self.assertRaisesRegex(tidy.HcrisError, "no cells read"):
                extract.read_year(z)

    def test_refuses_two_zips_for_one_year_and_leaves_no_sources_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            for name in ("a", "b"):
                (Path(tmp) / name).mkdir()
                write_zip(Path(tmp) / name / "HOSP10FY2024.ZIP", 2024, [report("7", "990001")], [])
            out = Path(tmp) / "out"
            out.mkdir()
            (out / "sources.json").write_text("{}")
            with self.assertRaisesRegex(tidy.HcrisError, "two zips"):
                extract.run([Path(tmp) / "a" / "HOSP10FY2024.ZIP", Path(tmp) / "b" / "HOSP10FY2024.ZIP"], out)
            self.assertFalse((out / "sources.json").exists())

    def test_crosscheck_main_reports_bad_input(self):
        with tempfile.TemporaryDirectory() as tmp:
            wide = Path(tmp) / "w.csv"
            wide.write_text("ccn,year,shape,period_begin,period_end\n990001,2024,one,2023-10-01,2024-09-30\n")
            ref = Path(tmp) / "r.csv"
            ref.write_text("prvdr_num,fy_bgn_dt,fy_end_dt\n990001,not a date,2024-09-30\n")
            with unittest.mock.patch("builtins.print"):
                self.assertEqual(crosscheck.main([str(wide), "2024", "nber", str(ref)]), 1)
                self.assertEqual(crosscheck.main([str(wide), "FY2024", "nber", str(ref)]), 1)

    def test_main_reports_errors_without_a_traceback(self):
        with tempfile.TemporaryDirectory() as tmp:
            z = Path(tmp) / "HOSP10FY2024.ZIP"
            write_zip(z, 2024, [report("7", "990001", begin="10/01/2022", end="09/30/2023")], [])
            with unittest.mock.patch("builtins.print"):
                self.assertEqual(extract.main(["--out", str(Path(tmp) / "o"), str(z)]), 1)
                self.assertEqual(extract.main([]), 2)


class Crosscheck(unittest.TestCase):
    def test_verdicts(self):
        D = crosscheck._num
        self.assertEqual(crosscheck.verdict(D("100"), D("100.4")), "equal")
        self.assertEqual(crosscheck.verdict(None, D("0")), "equal")
        self.assertEqual(crosscheck.verdict(D("100"), D("100.9")), "close")
        self.assertEqual(crosscheck.verdict(D("100"), D("150")), "differ")
        self.assertEqual(crosscheck.verdict(None, D("150")), "one_blank")
        self.assertEqual(crosscheck.verdict(D("0.21"), D("0.62")), "differ")  # ratios: a tight tolerance
        self.assertEqual(crosscheck.verdict(D("0.21254"), D("0.2125")), "equal")

    def test_compare_matches_on_ccn_and_period_not_report_number(self):
        ours = [{"ccn": "990001", "shape": "one", "period_begin": "2023-10-01", "period_end": "2024-09-30",
                 "patient_revenue_gross": "5000", "days_medicaid_managed": ""},
                {"ccn": "990002", "shape": "split", "period_begin": "2023-10-01", "period_end": "2024-09-30",
                 "patient_revenue_gross": "1", "days_medicaid_managed": ""}]
        ref = [{"prvdr_num": "990001", "fy_bgn_dt": "2023-10-01", "fy_end_dt": "2024-09-30", "g3_c1_1": "5000",
                "s3_1_c7_2": "40", "rpt_rec_num": "999"}]
        result, counts = crosscheck.compare(ours, ref, "nber")
        self.assertEqual(counts, {"ours": 2, "single_report": 1, "reference": 1, "matched": 1})
        self.assertEqual(result, {"patient_revenue_gross": {"equal": 1}, "days_medicaid_managed": {"one_blank": 1}})

    def test_master_join(self):
        master = {"hospitals": [{"ccn": "990001", "kind": "acute"}, {"ccn": "991300", "kind": "critical_access"}]}
        out = crosscheck.master_join([{"ccn": "990001"}, {"ccn": "992000"}], master)
        self.assertEqual((out["in_master"], out["hcris_not_in_master_by_range"]), (1, {"long-term care": 1}))
        self.assertEqual(out["master_by_kind"]["critical_access"], {"master": 1, "with_report": 0})

    def test_every_reference_column_maps_a_metric(self):
        for ref in crosscheck.REFERENCES.values():
            self.assertLessEqual(set(ref["columns"]), set(tidy.VALUE_COLUMNS))


if __name__ == "__main__":
    unittest.main()
