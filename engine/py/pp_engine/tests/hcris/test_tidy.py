"""The HCRIS hospital-year table (pp_engine.hcris.tidy) on synthetic report and numeric rows. Invented CCNs and report
numbers only."""
import unittest
from decimal import Decimal

from pp_engine.hcris import cells, tidy
from pp_engine.hcris.tidy import HcrisError, collect, hospital_years, parse_reports


def report(rpt, ccn, begin="10/01/2023", end="09/30/2024", status="2"):
    """An 18-field report row in HCRIS's order; invented values in the fields not read."""
    return [rpt, "2", ccn, "", status, begin, end, "01/15/2025", "N", "Y", "T", "99999", "4", "01/02/2025", "F",
            "", "", "01/01/2025"]


def cell(rpt, metric, value):
    c = next(c for c in cells.CELLS if c.metric == metric)
    return [rpt, c.sheet, c.line, c.column, value]


class Reports(unittest.TestCase):
    def test_parse(self):
        r = parse_reports([report("7", "990001", status="5")], 2024)["7"]
        self.assertEqual((r.ccn, r.status, r.begin.isoformat(), r.end.isoformat(), r.npr), ("990001", "5",
                         "2023-10-01", "2024-09-30", None))

    def test_the_file_year_is_the_federal_fiscal_year_the_period_begins_in(self):
        self.assertEqual(tidy.federal_fy(tidy._date("10/01/2023", "", "")), 2024)
        self.assertEqual(tidy.federal_fy(tidy._date("09/30/2024", "", "")), 2024)
        with self.assertRaises(HcrisError):
            parse_reports([report("7", "990001", begin="09/30/2023", end="06/30/2024")], 2024)

    def test_refuses_malformed_rows(self):
        bad = [
            [report("7", "990001")[:-1]],  # short row
            [report("7", "990001"), report("7", "990002")],  # repeated report number
            [report("7", "99-001")],  # malformed CCN
            [report("7", "990001", status="9")],  # unknown status
            [report("7", "990001", begin="2023-10-01")],  # date format
            [report("7", "990001", begin="10/05/2023", end="10/01/2023")],  # ends before it begins
        ]
        for rows in bad:
            with self.subTest(rows=rows), self.assertRaises(HcrisError):
                parse_reports(rows, 2024)


class Collect(unittest.TestCase):
    def setUp(self):
        self.reports = parse_reports([report("7", "990001")], 2024)

    def test_reads_only_the_cells_named(self):
        rows = [cell("7", "days_total", "1200"), cell("7", "s10_ccr", "0.2125"),
                ["7", cells.S3, "01400", "00900", "3"],  # a column not read
                ["7", "A000000", "00100", "00200", "5"]]  # a worksheet not read
        self.assertEqual(collect(rows, self.reports), {"7": {"days_total": Decimal("1200"),
                                                             "s10_ccr": Decimal("0.2125")}})

    def test_line_and_column_codes_are_read_trimmed(self):
        c = next(c for c in cells.CELLS if c.metric == "days_total")
        self.assertEqual(collect([["7", c.sheet, f" {c.line}", f"{c.column} ", "9"]], self.reports),
                         {"7": {"days_total": Decimal("9")}})

    def test_the_old_s10_code_reads_as_part_one(self):
        c = next(c for c in cells.CELLS if c.metric == "uncompensated_cost")
        self.assertEqual(collect([["7", cells.S10_BEFORE_PARTS, c.line, c.column, "500"]], self.reports),
                         {"7": {"uncompensated_cost": Decimal("500")}})

    def test_refuses(self):
        bad = [
            [cell("8", "days_total", "1")],  # a report not in the report file
            [cell("7", "days_total", "12a")],  # not a number
            [cell("7", "days_total", "1"), cell("7", "days_total", "2")],  # twice
            [cell("7", "uncompensated_cost", "1"),  # the same cell under the old and the new code
             ["7", cells.S10_BEFORE_PARTS, "03000", "00100", "1"]],
            [["7", cells.S3, "01400"]],  # short row
        ]
        for rows in bad:
            with self.subTest(rows=rows), self.assertRaises(HcrisError):
                collect(rows, self.reports)


class HospitalYears(unittest.TestCase):
    def build(self, report_rows, number_rows, year=2024):
        reports = parse_reports(report_rows, year)
        return {r["ccn"]: r for r in hospital_years(reports, collect(number_rows, reports), year)}

    def test_one_report(self):
        rows = self.build([report("7", "990001")], [
            cell("7", "days_total", "1000"), cell("7", "days_medicaid", "150"), cell("7", "days_medicaid_managed", "50"),
            cell("7", "net_patient_revenue", "2000"), cell("7", "net_income_patients", "-100"),
            cell("7", "other_income", "500"), cell("7", "net_income", "125"), cell("7", "bed_days_available", "0")])
        r = rows["990001"]
        self.assertEqual((r["shape"], r["n_reports"], r["period_days"], r["reports"]), ("one", 1, 366, "7"))
        self.assertEqual(r["medicaid_days_all"], Decimal("200"))
        self.assertEqual(r["medicaid_day_share"], Decimal("0.2000"))
        self.assertEqual(r["operating_margin"], Decimal("-0.0500"))
        self.assertEqual(r["total_margin"], Decimal("0.0500"))
        self.assertIsNone(r["occupancy"])  # a zero denominator
        self.assertIsNone(r["medicaid_payment_to_cost"])  # a missing denominator
        self.assertIsNone(r["uncompensated_cost"])  # not stored: zero or not reported

    def test_a_split_year_adds_flows_and_takes_stocks_from_the_last_period(self):
        rows = self.build([report("8", "990002", end="03/31/2024"), report("9", "990002", "04/01/2024", "09/30/2024")],
                          [cell("8", "days_total", "400"), cell("9", "days_total", "600"),
                           cell("8", "beds", "50"), cell("9", "beds", "40"), cell("8", "fte_employees", "100.5")])
        r = rows["990002"]
        self.assertEqual((r["shape"], r["n_reports"], r["reports"], r["period_begin"], r["period_end"]),
                         ("split", 2, "8 9", "2023-10-01", "2024-09-30"))
        self.assertEqual(r["days_total"], Decimal("1000"))
        self.assertEqual(r["beds"], Decimal("40"))
        self.assertEqual(r["fte_employees"], Decimal("100.5"))  # a stock the last period lacks: the earlier one's

    def test_shapes(self):
        cases = {
            "long": [report("1", "990003", "10/01/2023", "06/30/2024"), report("2", "990003", "07/01/2024", "06/30/2025")],
            "gap": [report("3", "990004", "10/01/2023", "12/31/2023"), report("4", "990004", "03/01/2024", "09/30/2024")],
            "overlap": [report("5", "990005", "10/01/2023", "03/31/2024"),
                        report("6", "990005", "03/01/2024", "09/30/2024")],
        }
        for shape, reps in cases.items():
            with self.subTest(shape=shape):
                self.assertEqual(next(iter(self.build(reps, []).values()))["shape"], shape)


class Text(unittest.TestCase):
    def test_writes_plain_decimals(self):
        for value, want in ((None, ""), (Decimal("1200"), "1200"), (Decimal("0.2500"), "0.25"), (Decimal("1E+3"), "1000"),
                            (Decimal("-0.0000"), "0"), (Decimal("12.0"), "12"), (3, "3")):
            with self.subTest(value=value):
                self.assertEqual(tidy.text(value), want)

    def test_long_rows_skip_blanks(self):
        rows = [{"ccn": "990001", "year": 2024, **{m: None for m in tidy.VALUE_COLUMNS}, "beds": Decimal("12")}]
        self.assertEqual(tidy.long_rows(rows), [["990001", "2024", "beds", "12"]])


class Cells(unittest.TestCase):
    def test_each_cell_once_and_well_formed(self):
        self.assertEqual(len({(c.sheet, c.line, c.column) for c in cells.CELLS}), len(cells.CELLS))
        self.assertEqual(len(set(cells.METRICS)), len(cells.METRICS))
        for c in cells.CELLS:
            with self.subTest(metric=c.metric):
                self.assertRegex(c.line + c.column, r"^\d{10}$")
                self.assertIn(c.kind, ("flow", "stock"))
        self.assertFalse(set(cells.METRICS) & {name for name, _ in cells.DERIVED})
        self.assertEqual([name for name, _ in cells.DERIVED], list(tidy.FORMULAS))
        self.assertEqual(cells.sheets_expected(2022), {cells.S3, cells.G3, cells.S10})
        self.assertEqual(cells.sheets_expected(2023), {cells.S3, cells.G3, cells.S10, cells.S10_HOSPITAL})


if __name__ == "__main__":
    unittest.main()
