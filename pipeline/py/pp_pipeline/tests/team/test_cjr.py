"""CJR's spread, the calculator band's evidence (pp_engine.team.cjr, pp_pipeline.team.cjr): the count's rules on
synthetic rows with invented CCNs, the derivation on a synthetic workbook, the two pins against their manifest entries,
and the TEAM file's `method.cjrSpread` recounted here from the pins. Failure messages name no hospital or CCN.

To check the reconciliation pin against CMS's raw workbook too, set PP_CJR_RECON_XLSX to the workbook's path."""
import os
import re
import unittest
from collections import Counter
from pathlib import Path
from unittest import mock

from pp_engine.team import cjr
from pp_engine.tests.test_xlsx import make_xlsx
from pp_pipeline import emit_team
from pp_pipeline.files import REPO_ROOT, manifest_entry, read_pinned_bytes, read_pinned_csv
from pp_pipeline.team import cjr as derive_cjr
from pp_pipeline.tests.team.helpers import fresh

TARGETS = {"1": 1000, "4": 1000, "6": 2000, "7": 1000}


def row(py, episodes, amount, quality="Good"):
    return {"py": py, "quality": quality, "episodes": episodes, "amount": amount}


class Spread(unittest.TestCase):
    def test_spending_vs_target_turns_the_amount_per_episode_into_a_share_over_target(self):
        # Medicare paid the hospital 50 per episode on a 1,000 target: 5% under target.
        self.assertAlmostEqual(cjr.spending_vs_target(1000.0, 20, 1000), -0.05)
        self.assertAlmostEqual(cjr.spending_vs_target(-3000.0, 20, 1000), 0.15)

    def test_counts_the_pool_years_rows_at_or_over_the_floor_and_each_width_inclusive(self):
        floor = cjr.MIN_EPISODES
        rows = [
            row("4", floor, floor * 50.0),        # exactly 5% under: within both widths
            row("6", floor, -floor * 150.0),      # 7.5% over (a 2,000 target): within the wider only
            row("7", floor * 3, -floor * 3 * 120.0),  # 12% over: within neither
            row("4", floor - 1, 0.5),             # under the floor
            row("5.1", floor, 0.0),               # not a pool year
            row("4", 0, 0.0),                     # no episode: not a row of the year
        ]
        s = cjr.spread(rows, TARGETS)
        self.assertEqual((s["rows"], s["censored"], s["small"], s["n"]), (4, 0, 1, 3))
        self.assertEqual([w["n"] for w in s["within"]], [1, 2])
        self.assertEqual([w["width"] for w in s["within"]], list(cjr.WIDTHS))
        self.assertEqual(s["years"], list(cjr.POOL_YEARS))
        self.assertEqual(s["eucYear"], cjr.EUC_YEAR)
        self.assertNotIn(cjr.EUC_YEAR, cjr.POOL_YEARS)
        self.assertEqual(s["targets"], {py: TARGETS[py] for py in cjr.POOL_YEARS})
        self.assertEqual(s["minEpisodes"], floor)

    def test_a_zero_that_hides_the_result_is_left_out_and_any_other_zero_counts(self):
        floor = cjr.MIN_EPISODES
        self.assertTrue(cjr.censored(row("4", floor, 0.0, cjr.BELOW_ACCEPTABLE)))
        self.assertTrue(cjr.censored(row("1", floor, 0.0)))  # no repayment that year
        self.assertFalse(cjr.censored(row("4", floor, 0.0)))  # a hospital exactly on target
        self.assertFalse(cjr.censored(row("4", floor, -10.0, cjr.BELOW_ACCEPTABLE)))  # it still repaid
        self.assertTrue(cjr.censored(row("6", floor, 0.0, "")))  # no quality category: perhaps never reconciled
        self.assertFalse(cjr.censored(row("6", floor, -10.0, "")))
        s = cjr.spread([row("4", floor, 0.0, cjr.BELOW_ACCEPTABLE), row("6", floor, 0.0)], TARGETS)
        self.assertEqual((s["rows"], s["censored"], s["n"]), (2, 1, 1))
        self.assertEqual([w["n"] for w in s["within"]], [1, 1])

    def test_a_pool_year_without_a_target_and_an_empty_count_are_refused(self):
        with self.assertRaisesRegex(ValueError, "no average target price"):
            cjr.spread([row("4", 30, 1.0)], {"4": 1000, "6": 1000})
        with self.assertRaisesRegex(ValueError, "no row to count"):
            cjr.spread([row("4", 1, 1.0)], TARGETS)

    def test_the_narrower_width_is_the_calculators_default_band(self):
        # Read from engine/js/team/params.js itself; sites/team/web/band.js also refuses a file without the default band.
        text = (REPO_ROOT / "engine" / "js" / "team" / "params.js").read_text(encoding="utf-8")
        found = re.findall(r"^export const BAND_DEFAULT = ([0-9.]+);$", text, re.M)
        self.assertEqual(len(found), 1, "params.js: one BAND_DEFAULT line")
        self.assertEqual(cjr.WIDTHS[0], float(found[0]))
        self.assertEqual(cjr.WIDTHS[1], 2 * cjr.WIDTHS[0])


HEADERS = {
    "1": ["CCN", "HOSP_NAME", "PY1 Initial Quality Performance Category", "PY1 Final Quality Performance Category",
          "PY1 Initial CJR Episode Count (as of March 1, 2017)*", "PY1 Final CJR Episode Count (as of March 1, 2018)*",
          "PY1 Initial Reconciliation amount ", "PY1 Final Reconciliation Amount"],
    "6": ["CCN", "HOSP_NAME", "PY6 Quality Performance Category", "PY6 CJR Episode Count*",
          "Number of PY6 Episodes capped under a policy*", "PY6 Reconciliation Amount Earned or Owed"],
}


class Derivation(unittest.TestCase):
    TOTALS6 = ["Totals row", "blank cell", "TOTALS", "65", "2", "-1134.5"]

    def workbook(self, extra6=(), totals6=TOTALS6):
        return make_xlsx({
            "PY1 CJRREC": [["Table 1"], ["A note"], HEADERS["1"],
                           ["99001", "Invented One", "Good", "Below Acceptable", "90", "93", "500.5", "0"],
                           ["Totals row", "", "", "", "90", "93", "500.5", "0"],
                           ["*A note under the table"], ["End of worksheet"]],
            "PY6 CJRREC": [["Table 7"], HEADERS["6"],
                           ["990003", "Invented Three", "Excellent", "40", "2", "-1234.5"],
                           ["990002", "Invented Two", "Good", "25", "0", "100"],
                           *([totals6] if totals6 else []), *extra6]})

    def test_each_years_final_columns_are_read_whatever_their_header_says(self):
        with mock.patch.object(derive_cjr, "YEARS", ("1", "6")):
            text, counts = derive_cjr.reconciliation(self.workbook())
        self.assertEqual(text.splitlines(), ["py,ccn,quality,episodes,amount", "1,099001,Below Acceptable,93,0.0",
                                             "6,990002,Good,25,100.0", "6,990003,Excellent,40,-1234.5"])
        self.assertEqual(counts, {"rows": 3, "byYear": {"1": 1, "6": 2}})

    def test_an_unknown_quality_category_or_a_fractional_count_is_refused(self):
        with mock.patch.object(derive_cjr, "YEARS", ("1", "6")):
            with self.assertRaisesRegex(ValueError, "quality category"):
                derive_cjr.reconciliation(self.workbook([["990004", "Invented Four", "Superb", "25", "0", "1"]]))
            with self.assertRaisesRegex(ValueError, "whole count"):
                derive_cjr.reconciliation(self.workbook([["990004", "Invented Four", "Good", "25.5", "0", "1"]]))

    def test_the_summary_rows_are_checked_and_any_other_non_ccn_row_with_figures_is_refused(self):
        totals = self.TOTALS6
        average = ["Average row", "blank cell", "blank cell", "-17.45", "blank cell", "blank cell"]
        with mock.patch.object(derive_cjr, "YEARS", ("6",)):
            text, _ = derive_cjr.reconciliation(self.workbook([average, ["*A note"], ["", "", "", "", "", ""]]))
            self.assertEqual(len(text.splitlines()), 3, "the two hospital rows, the summary rows and notes skipped")
            off = [*totals[:3], "64", *totals[4:]]
            with self.assertRaisesRegex(ValueError, "PY6 CJRREC: the hospital rows do not add up to its Totals row"):
                derive_cjr.reconciliation(self.workbook(totals6=off))
            off = [*totals[:5], "-1134.6"]
            with self.assertRaisesRegex(ValueError, "do not add up"):
                derive_cjr.reconciliation(self.workbook(totals6=off))
            # No Totals row, or two: nothing to check the rows against, so refused.
            with self.assertRaisesRegex(ValueError, "expected one Totals row to check the hospital rows against, found 0"):
                derive_cjr.reconciliation(self.workbook(totals6=None))
            with self.assertRaisesRegex(ValueError, "found 2"):
                derive_cjr.reconciliation(self.workbook([totals]))
            # A CCN stored as a number, and one with a letter: refused, never skipped as a note.
            for first in ("990004.0", "99000A"):
                with self.subTest(first=first), self.assertRaisesRegex(
                        ValueError, r"PY6 CJRREC: row 4 under the header has an episode count, an amount or a quality "
                                    r"category but its first cell is not a CCN"):
                    derive_cjr.reconciliation(self.workbook([[first, "Invented Four", "Good", "25", "0", "1"]]))
            with self.assertRaisesRegex(ValueError, "not a CCN"):
                derive_cjr.reconciliation(self.workbook([["A note", "", "", "", "", "12.5"]]))
            # A hospital row whose CCN is mis-stored and whose figures are blank still carries its quality category.
            with self.assertRaisesRegex(ValueError, "not a CCN"):
                derive_cjr.reconciliation(self.workbook([["990004.0", "Invented Four", "Good", "", "", ""]]))

    def test_a_sheet_with_two_of_a_column_is_refused(self):
        two = make_xlsx({"PY6 CJRREC": [HEADERS["6"] + ["PY6 Final CJR Episode Count*"], ["990002", "x", "Good", "25", "0", "1"]]})
        with mock.patch.object(derive_cjr, "YEARS", ("6",)), self.assertRaisesRegex(ValueError, "expected one column"):
            derive_cjr.reconciliation(two)

    @unittest.skipUnless(os.environ.get("PP_CJR_RECON_XLSX"), "set PP_CJR_RECON_XLSX to CMS's raw workbook to rederive")
    def test_the_pin_is_the_workbooks_derivation(self):
        text, counts = derive_cjr.reconciliation(Path(os.environ["PP_CJR_RECON_XLSX"]).read_bytes())
        self.assertEqual(text.encode("utf-8"), read_pinned_bytes(derive_cjr.PIN_ID))
        self.assertEqual(counts, manifest_entry(derive_cjr.PIN_ID)["counts"])


class Pins(unittest.TestCase):
    def test_the_reconciliation_pin_matches_its_recorded_counts(self):
        entry = manifest_entry(derive_cjr.PIN_ID)
        rows = read_pinned_csv(derive_cjr.PIN_ID)
        self.assertEqual(list(rows[0]), list(derive_cjr.COLUMNS))
        self.assertEqual(len(rows), entry["counts"]["rows"])
        self.assertEqual(dict(Counter(r["py"] for r in rows)), entry["counts"]["byYear"])
        self.assertEqual(list(entry["counts"]["byYear"]), list(derive_cjr.YEARS))
        # Performance year 5, left out of the count, is the pin's two parts of it.
        self.assertEqual([py for py in derive_cjr.YEARS if py.split(".")[0] == cjr.EUC_YEAR],
                         [f"{cjr.EUC_YEAR}.1", f"{cjr.EUC_YEAR}.2"])
        self.assertEqual(entry["derivedBy"], "pipeline/py/pp_pipeline/team/cjr.py")
        self.assertEqual(entry["derivedFrom"]["downloadUrl"], derive_cjr.SOURCE["downloadUrl"])
        for r in rows:
            self.assertRegex(r["ccn"], r"^[0-9]{6}$")
            self.assertIn(r["quality"], derive_cjr.QUALITY)
            self.assertGreaterEqual(int(r["episodes"]), 0)
            float(r["amount"])

    def test_the_transcribed_targets_cover_every_year_in_whole_dollars_and_name_their_report(self):
        entry = manifest_entry(derive_cjr.TARGETS_ID)
        targets = emit_team.cjr_targets(read_pinned_csv(derive_cjr.TARGETS_ID))
        self.assertEqual(list(targets), list(derive_cjr.YEARS))
        self.assertTrue(all(v > 0 for v in targets.values()))
        self.assertTrue(entry["derivedBy"].startswith("transcription of "))
        src = entry["derivedFrom"]
        self.assertRegex(src["sha256"], r"^[0-9a-f]{64}$")
        self.assertTrue(src["downloadUrl"].startswith("https://www.cms.gov/"))
        self.assertIn("not stored in the repo", src["note"])
        # The landing page is a page about the model, not the report's own address (which serves the PDF).
        self.assertTrue(entry["landingPage"].startswith("https://www.cms.gov/"))
        self.assertNotEqual(entry["landingPage"], src["downloadUrl"])


class Emitted(unittest.TestCase):
    def test_the_files_count_is_the_pins_recounted_here(self):
        s = fresh()["method"]["cjrSpread"]
        targets = emit_team.cjr_targets(read_pinned_csv(derive_cjr.TARGETS_ID))
        counted = []
        for r in read_pinned_csv(derive_cjr.PIN_ID):
            episodes, amount = int(r["episodes"]), float(r["amount"])
            hidden = amount == 0 and (r["quality"] in ("Below Acceptable", "") or r["py"] == "1")
            if r["py"] in s["years"] and episodes >= s["minEpisodes"] and not hidden:
                counted.append(abs(amount / episodes / targets[r["py"]]))
        self.assertEqual(s["n"], len(counted))
        self.assertEqual([w["n"] for w in s["within"]], [sum(x <= w["width"] for x in counted) for w in s["within"]])
        self.assertEqual(s["rows"] - s["censored"] - s["small"], s["n"])
        self.assertTrue(0 < s["within"][0]["n"] < s["within"][1]["n"] < s["n"])
        # Methods calls every zero left out in the counted years a below-acceptable hospital's: hold the pin to that.
        hidden = {r["quality"] for r in read_pinned_csv(derive_cjr.PIN_ID) if r["py"] in s["years"]
                  and int(r["episodes"]) > 0 and cjr.censored({**r, "amount": float(r["amount"])})}
        self.assertLessEqual(hidden, {"Below Acceptable"}, "a hidden zero of another kind: reword Methods bandPool too")


if __name__ == "__main__":
    unittest.main()
