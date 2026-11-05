"""G-3 line 24 sorted by label (pp_engine.hcris.other_income), and its place in the hospital-year row. Invented CCNs,
report numbers and rules only."""
import unittest
from decimal import Decimal

from pp_engine.hcris import cells, other_income as oi, tidy
from pp_engine.hcris.tidy import HcrisError, collect, hospital_years, parse_reports
from pp_engine.tests.hcris.test_tidy import cell, report

HEADER = ["family", "class", "pattern", "why"]
RULES = oi.parse_rules([HEADER,
                        ["investment", "non_operating", "INTEREST", "interest"],
                        ["investment", "non_operating", "GAINS?", ""],
                        ["pharmacy", "operating", "PHAR\\w*", "pharmacy"],
                        ["pharmacy", "operating", "340 ?B", ""],
                        ["generic", "unclassified", "OPERATING", "too generic"]])


class Rules(unittest.TestCase):
    def test_normalize(self):
        self.assertEqual(oi.normalize(" 340(b) contract-pharm/retail "), "340 B CONTRACT PHARM RETAIL")

    def test_first_match_wins_and_matches_whole_words(self):
        cases = {"Interest income - pharmacy": ("investment", "non_operating"),
                 "340B contract pharmacy": ("pharmacy", "operating"),
                 "Other operating revenue": ("generic", "unclassified"),
                 "Interested parties": ("other", "unclassified"),  # INTEREST is a whole word only
                 "   ": ("unlabeled", "unclassified"),
                 "Vending": ("other", "unclassified")}
        for label, want in cases.items():
            with self.subTest(label=label):
                self.assertEqual(oi.classify(label, RULES), want)

    def test_refuses_a_bad_rules_file(self):
        good = ["a", "operating", "X", "why"]
        bad = [
            [["family", "class", "pattern"], good],  # header
            [HEADER, ["a", "operating", "X{1", "2}", "why"]],  # an unquoted comma splits the row
            [HEADER, ["a", "operatingish", "X", "why"]],  # class
            [HEADER, good, ["a", "non_operating", "Y", ""]],  # one family, two classes
            [HEADER, good, ["a", "operating", "Y", "again"]],  # `why` twice
            [HEADER, ["a", "operating", "X", ""]],  # no `why` on the first row
            [HEADER, ["a", "operating", " ", "why"]],  # blank pattern
            [HEADER, ["a", "operating", "X(", "why"]],  # doesn't compile
            [HEADER, ["other", "operating", "X", "why"]],  # the classifier's own family
        ]
        for rows in bad:
            with self.subTest(rows=rows), self.assertRaises(oi.RulesError):
                oi.parse_rules(rows)

    def test_line_codes(self):
        self.assertTrue(oi.is_line24("02400") and oi.is_line24("02449"))
        self.assertFalse(oi.is_line24("02450") or oi.is_line24("02399") or oi.is_line24("2401"))


class Table(unittest.TestCase):
    ROWS = [oi.PIN_COLUMNS, ["7", "02400", "Other operating revenue", "100"], ["7", "02401", "340B", "250.5"],
            ["7", "02402", "Unrealized gains", "-40"], ["7", "02403", "Retail pharmacy", "49.5"],
            ["8", "02400", "", "9"]]

    def test_sums_by_class(self):
        sums = oi.report_sums(oi.from_pin_rows(self.ROWS), RULES)
        self.assertEqual(sums, {"7": {"line24_unclassified": Decimal("100"), "line24_operating": Decimal("300.0"),
                                      "line24_non_operating": Decimal("-40")},
                                "8": {"line24_unclassified": Decimal("9")}})

    def test_refuses_a_bad_table(self):
        bad = [[["rpt", "line", "label", "amount"]],
               [oi.PIN_COLUMNS, ["7", "02450", "COVID", "1"]],  # 24.50 is not read here
               [oi.PIN_COLUMNS, ["7", "02401", "x", "1a"]],
               [oi.PIN_COLUMNS, ["7", "02401", "x", "1"], ["7", "02401", "y", "2"]],
               [oi.PIN_COLUMNS, ["7", "02401", "x"]]]
        for rows in bad:
            with self.subTest(rows=rows), self.assertRaises(oi.TableError):
                oi.from_pin_rows(rows)


class InTheRow(unittest.TestCase):
    def test_collect_takes_line_24_in_the_same_pass(self):
        reports = parse_reports([report("7", "990001")], 2024)
        amounts = {}
        values = collect([cell("7", "income_other_specified", "100"), ["7", cells.G3, "02401", "00100", "250"],
                          ["7", cells.G3, "02450", "00100", "5"],  # COVID-19 funding: a cell, not line 24's table
                          ["7", cells.G3, "02402", "00200", "1"]], reports, amounts)  # another column
        self.assertEqual(amounts, {("7", "02400"): "100", ("7", "02401"): "250"})
        self.assertEqual(values["7"]["income_other_specified"], Decimal("100"))
        with self.assertRaises(HcrisError):
            collect([["8", cells.G3, "02401", "00100", "1"]], reports, {})  # a report not in the file

    def test_operating_line_24_counts_in_the_operating_margin_and_split_years_add_up(self):
        reports = parse_reports([report("8", "990002", end="03/31/2024"),
                                 report("9", "990002", "04/01/2024", "09/30/2024")], 2024)
        values = collect([cell("8", "net_patient_revenue", "600"), cell("9", "net_patient_revenue", "400"),
                          cell("8", "net_income_patients", "-150"), cell("9", "income_parking", "20")], reports)
        line24 = {"8": {"line24_operating": Decimal("50"), "line24_unclassified": Decimal("70")},
                  "9": {"line24_operating": Decimal("30"), "line24_non_operating": Decimal("900")}}
        r = hospital_years(reports, values, 2024, line24=line24)[0]
        self.assertEqual((r["line24_operating"], r["line24_non_operating"], r["line24_unclassified"]),
                         (Decimal("80"), Decimal("900"), Decimal("70")))
        self.assertEqual(r["other_operating_income"], Decimal("100"))  # line 12's 20 + line 24's operating 80
        self.assertEqual(r["operating_margin"], Decimal("-0.0455"))  # (-150 + 100) / (1000 + 100)
        self.assertEqual(r["patient_margin"], Decimal("-0.1500"))
        self.assertIn("line24_operating", tidy.VALUE_COLUMNS)
        self.assertNotIn("line24_operating", tidy.PIN_COLUMNS)  # from the line-24 table, not the cells table
        self.assertEqual(cells.UNITS["line24_unclassified"], "dollars")


if __name__ == "__main__":
    unittest.main()
