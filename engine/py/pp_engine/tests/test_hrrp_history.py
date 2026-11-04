"""The HRRP history readers, on synthetic CSV text (synthetic CCNs)."""
import unittest

from pp_engine import hrrp_history as h
from pp_engine.parse import SchemaError

HIST = "fy,ccn,paf,scope_flag\n"
SUMM_HEAD = ("fy,n_hospitals_comparable,n_penalized_comparable,pct_penalized_comparable,"
             "mean_reduction_pct_all_comparable,mean_reduction_pct_penalized,median_reduction_pct_penalized,"
             "n_at_max,max_cap_pct,performance_period_start,performance_period_end\n")


class LoadPafHistory(unittest.TestCase):
    def test_keeps_wanted_ccns_in_range_and_rounds(self):
        text = HIST + "2013,A1,0.987654321,\n2015,A1,1.0,\n2012,A1,0.5,\n2017,A1,0.5,\n2014,B2,0.9,\n"
        years, out = h.load_paf_history(text, {"A1"}, 2013, 2015)
        self.assertEqual(years, [2013, 2014, 2015])
        self.assertEqual(out, {"A1": [0.9877, None, 1.0]})

    def test_scope_flagged_rows_are_skipped(self):
        years, out = h.load_paf_history(HIST + "2013,A1,0.9,MD\n2014,A1,0.8,\n", {"A1"}, 2013, 2014)
        self.assertEqual(out, {"A1": [None, 0.8]})

    def test_all_flagged_hospital_is_absent(self):
        self.assertEqual(h.load_paf_history(HIST + "2013,A1,0.9,PR\n", {"A1"}, 2013, 2013)[1], {})

    def test_bom_is_dropped(self):
        self.assertEqual(h.load_paf_history("﻿" + HIST + "2013,A1,0.9,\n", {"A1"}, 2013, 2013)[1],
                         {"A1": [0.9]})

    def test_missing_column_names_it(self):
        with self.assertRaisesRegex(SchemaError, "scope_flag"):
            h.load_paf_history("fy,ccn,paf\n2013,A1,0.9\n", {"A1"}, 2013, 2013)

    def test_headers_match_case_and_space_insensitively(self):
        self.assertEqual(h.load_paf_history(" FY ,CCN,Paf,Scope_Flag\n2013,A1,0.9,\n", {"A1"}, 2013, 2013)[1],
                         {"A1": [0.9]})

    def test_a_blank_or_non_numeric_paf_in_scope_names_ccn_and_fy(self):
        for bad in ("", "N/A"):
            with self.subTest(bad), self.assertRaisesRegex(SchemaError, "A1.*2014"):
                h.load_paf_history(HIST + "2013,A1,0.9,\n2014,A1,%s,\n" % bad, {"A1"}, 2013, 2014)

    def test_a_bad_paf_out_of_scope_or_for_another_hospital_is_ignored(self):
        text = HIST + "2013,A1,,MD\n2013,B2,x,\n2020,A1,x,\n2013,A1,0.9,\n"
        self.assertEqual(h.load_paf_history(text, {"A1"}, 2013, 2014)[1], {"A1": [0.9, None]})

    def test_a_repeated_hospital_year_is_a_schema_error(self):
        with self.assertRaisesRegex(SchemaError, "A1.*2013"):
            h.load_paf_history(HIST + "2013,A1,0.9,\n2013,A1,0.8,\n", {"A1"}, 2013, 2013)

    def test_a_non_numeric_fy_names_the_ccn(self):
        with self.assertRaisesRegex(SchemaError, "A1"):
            h.load_paf_history(HIST + "abc,A1,0.9,\n", {"A1"}, 2013, 2013)


class SummarizeFy(unittest.TestCase):
    def test_empty(self):
        s = h.summarize_fy(2020, [], 3)
        self.assertEqual((s["n"], s["nPen"], s["pctPen"], s["meanRed"], s["meanRedPen"], s["medianRedPen"],
                          s["nMax"], s["cap"]), (0, 0, 0, 0, 0, 0, 0, 3))

    def test_counts_and_cap(self):
        s = h.summarize_fy(2020, [1.0, 0.99, 0.97, 0.97], 3)
        self.assertEqual((s["fy"], s["n"], s["nPen"], s["pctPen"]), (2020, 4, 3, 75.0))
        self.assertEqual(s["nMax"], 2)
        self.assertEqual(s["meanRed"], 1.75)
        self.assertEqual(s["meanRedPen"], 2.3333)
        self.assertEqual(s["medianRedPen"], 3.0)


class LoadNational(unittest.TestCase):
    def test_maps_fields_and_perf(self):
        text = SUMM_HEAD + "2013,100,60,60.0,0.25,0.4,0.3,5,1,2008-07-01,2011-06-30\n2014,90,50,55.5,0.3,0.5,0.4,6,2,,\n"
        rows = h.load_national(text)
        self.assertEqual(rows[0], {"fy": 2013, "n": 100, "nPen": 60, "pctPen": 60.0, "meanRed": 0.25,
                                   "meanRedPen": 0.4, "medianRedPen": 0.3, "nMax": 5, "cap": 1,
                                   "perf": ["2008-07-01", "2011-06-30"]})
        self.assertEqual(rows[1]["perf"], [None, None])

    def test_a_non_numeric_field_names_fy_and_field(self):
        for field, col in (("n", 1), ("pctPen", 3), ("cap", 8)):
            cells = ["2013", "100", "60", "60.0", "0.25", "0.4", "0.3", "5", "1", "", ""]
            cells[col] = "n/a"
            with self.subTest(field), self.assertRaisesRegex(SchemaError, "2013.*" + SUMM_HEAD.split(",")[col]):
                h.load_national(SUMM_HEAD + ",".join(cells) + "\n")

    def test_missing_column_names_it(self):
        with self.assertRaisesRegex(SchemaError, "n_hospitals_comparable"):
            h.load_national("fy\n2013\n")


if __name__ == "__main__":
    unittest.main()
