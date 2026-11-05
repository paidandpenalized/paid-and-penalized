"""The HCRIS layer's rules (pp_engine.hcris): the long-year rule, status labels, scope, the early flag, the pinned cells
table and the reader. Invented CCNs and report numbers only."""
import datetime
import unittest
from decimal import Decimal

from pp_engine.hcris import cells, reader, tidy
from pp_engine.hcris.tidy import HcrisError, collect, hospital_years, parse_reports
from pp_engine.tests.hcris.test_tidy import cell, report


def build(report_rows, number_rows, year=2024, **kw):
    reports = parse_reports(report_rows, year)
    return {r["ccn"]: r for r in hospital_years(reports, collect(number_rows, reports), year, **kw)}


# A change of fiscal year: a 9-month period, then a 12-month one, both beginning in FY2024 (639 days in all).
LONG = [report("1", "990003", "10/01/2023", "06/30/2024", status="2"),
        report("2", "990003", "07/01/2024", "06/30/2025", status="1")]
LONG_CELLS = [cell("1", "net_income", "90"), cell("2", "net_income", "100"), cell("1", "beds", "30"),
              cell("2", "beds", "32"), cell("1", "days_total", "900")]


class LongYears(unittest.TestCase):
    def test_a_long_year_keeps_the_fullest_report_alone(self):
        r = build(LONG, LONG_CELLS)["990003"]
        self.assertEqual((r["shape"], r["basis"], r["n_reports"], r["reports"], r["status"]),
                         ("long", "fullest", 2, "2", "1"))
        self.assertEqual((r["period_begin"], r["period_end"], r["period_days"]), ("2024-07-01", "2025-06-30", 365))
        self.assertEqual((r["net_income"], r["beds"], r["days_total"]), (Decimal("100"), Decimal("32"), None))
        self.assertEqual(r["status_label"], "as filed")

    def test_the_raw_sum_is_still_available(self):
        r = build(LONG, LONG_CELLS, long_rule="sum")["990003"]
        self.assertEqual((r["basis"], r["reports"], r["period_days"], r["period_begin"]), ("sum", "1 2", 639,
                                                                                          "2023-10-01"))
        self.assertEqual((r["net_income"], r["days_total"]), (Decimal("190"), Decimal("900")))
        with self.assertRaises(ValueError):
            build(LONG, LONG_CELLS, long_rule="annualize")

    def test_overlaps_and_long_gaps_keep_the_fullest_short_gaps_and_splits_add_up(self):
        cases = {
            ("overlap", "fullest", "6"): [report("5", "990005", "10/01/2023", "03/31/2024"),
                                          report("6", "990005", "03/01/2024", "09/30/2024")],
            ("gap", "sum", "3 4"): [report("3", "990004", "10/01/2023", "12/31/2023"),
                                    report("4", "990004", "03/01/2024", "09/30/2024")],
            ("gap", "fullest", "8"): [report("7", "990006", "10/01/2023", "11/30/2023"),
                                      report("8", "990006", "01/01/2024", "12/31/2024")],
            ("split", "sum", "9 10"): [report("9", "990007", "10/01/2023", "03/31/2024"),
                                       report("10", "990007", "04/01/2024", "09/30/2024")],
        }
        for (shape, basis, used), reps in cases.items():
            with self.subTest(shape=shape, basis=basis):
                r = next(iter(build(reps, []).values()))
                self.assertEqual((r["shape"], r["basis"], r["reports"]), (shape, basis, used))

    def test_ties_go_to_the_later_period(self):
        reps = [report("3", "990008", "10/01/2023", "03/31/2024"), report("4", "990008", "04/01/2024", "09/29/2024"),
                report("5", "990008", "09/30/2024", "03/31/2025")]
        r = build(reps, [])["990008"]
        self.assertEqual((r["shape"], r["basis"]), ("long", "fullest"))
        self.assertEqual(r["reports"], "5")  # 183 days each for 3 and 5: the later one


class Labels(unittest.TestCase):
    def test_two_reader_labels(self):
        self.assertEqual({c: tidy.status_label([c]) for c in "12345"},
                         {"1": "as filed", "2": "settled", "3": "settled", "4": "settled", "5": "as filed"})
        self.assertEqual(tidy.status_label(["2", "1"]), "as filed")  # every report behind a value must be settled
        self.assertEqual(tidy.status_label([]), "as filed")

    def test_scope_by_ccn_range(self):
        for ccn, kind in (("990001", "acute"), ("990879", "acute"), ("990880", None), ("991300", "critical_access"),
                          ("991399", "critical_access"), ("992000", None), ("994001", None), ("99S001", None),
                          ("990000", None)):
            with self.subTest(ccn=ccn):
                self.assertEqual(tidy.kind_of(ccn), kind)
        r = build([report("7", "991301")], [])["991301"]
        self.assertEqual(r["kind"], "critical_access")

    def test_year_summary_and_the_early_flag(self):
        rows = [{"status_label": s} for s in ["settled"] * 4 + ["as filed"]]
        self.assertEqual(tidy.year_summary(rows), {"hospital_years": 5, "settled": 4,
                                                   "settled_share": Decimal("0.8000"), "early": False})
        self.assertTrue(tidy.year_summary(rows + [{"status_label": "as filed"}])["early"])  # 4 of 6
        self.assertTrue(tidy.year_summary([])["early"])

    def test_filing_due_by(self):
        # A period beginning 2024-09-30 ends 2025-09-29, not a month's last day: due 150 days later.
        self.assertEqual(tidy.filing_due_by(2024), datetime.date(2026, 2, 26))


class PinnedTable(unittest.TestCase):
    def test_round_trip(self):
        reports = parse_reports([report("7", "990001", status="3"), report("8", "991300")], 2024)
        values = collect([cell("7", "net_income", "-25.50"), cell("7", "s10_ccr", "0.2125"),
                          cell("8", "beds", "12")], reports)
        rows = tidy.pin_rows(reports, values)
        self.assertEqual(rows[0], list(tidy.PIN_COLUMNS))
        self.assertEqual(rows[1][:8], ["7", "990001", "3", "2023-10-01", "2024-09-30", "2", "F", ""])
        back_reports, back_values = tidy.from_pin_rows(rows, 2024)
        self.assertEqual(back_reports, reports)
        self.assertEqual(back_values, values)

    def test_refuses(self):
        good = tidy.pin_rows(parse_reports([report("7", "990001")], 2024), {})
        broken = [
            [good[0][:-1]] + good[1:],  # an older header
            good + [good[1]],  # a report twice
            good[:1] + [good[1][:-1]],  # a short row
            good[:1] + [[*good[1][:3], "2023-09-30", *good[1][4:]]],  # a period beginning in FY2023
            good[:1] + [[*good[1][:3], "10/01/2023", *good[1][4:]]],  # not ISO
            good[:1] + [[*good[1][:4], "2024-02-30", *good[1][5:]]],  # no such day
            good[:1] + [[*good[1][:8], "1,200", *good[1][9:]]],  # not a number
        ]
        for rows in broken:
            with self.subTest(rows=rows[-1][:4]), self.assertRaises(HcrisError):
                tidy.from_pin_rows(rows, 2024)


def doc(year, rows, early=False):
    columns = [c for c in tidy.WIDE_COLUMNS if c != "year"]
    return {"fy": year, "columns": columns, "early": early, "settledShare": 0.5, "stillFiling": False,
            "methods_version": 1,
            "hospitals": [[r.get(c) for c in columns] for r in rows]}


class Reader(unittest.TestCase):
    def setUp(self):
        base = {"status_label": "settled", "period_begin": "2022-10-01", "period_end": "2023-09-30"}
        self.y23 = doc(2023, [{**base, "ccn": "990001", "net_income": 5, "uncompensated_cost": 7}])
        self.y24 = doc(2024, [{**base, "ccn": "990001", "net_income": 6, "status_label": "as filed",
                               "period_begin": "2023-10-01", "period_end": "2024-09-30"},
                              {**base, "ccn": "990002"}], early=True)

    def test_label(self):
        self.assertEqual(reader.label(2024), "cost reports beginning in FY2024")

    def test_values_carry_period_status_and_early(self):
        y = reader.Year(self.y24)
        v = y.value("990001", "net_income")
        self.assertEqual((v.year, v.value, v.status_label, v.period_begin, v.early), (2024, 6, "as filed",
                                                                                      "2023-10-01", False))
        self.assertTrue(y.value("990001", "uncompensated_cost").early)  # an S-10 metric in an early year
        self.assertTrue(y.value("990001", "medicaid_revenue_share").early)  # a ratio over an S-10 cell
        self.assertIsNone(y.value("990001", "uncompensated_cost").value)  # blank: zero or not reported
        self.assertIsNone(y.value("990009", "net_income"))  # no report this year
        with self.assertRaises(KeyError):
            y.value("990001", "net_incom")

    def test_series(self):
        p = reader.Panel([self.y24, self.y23])
        self.assertEqual([(v.year, v.value) for v in p.series("990001", "net_income")], [(2023, 5), (2024, 6)])
        self.assertEqual(p.year(2024).row("990002")["year"], 2024)
        with self.assertRaises(ValueError):
            reader.Panel([self.y24, self.y24])
        with self.assertRaises(ValueError):  # a row that doesn't match the columns
            reader.Year({**self.y24, "hospitals": [self.y24["hospitals"][0][:-1]]})

    def test_every_column_has_a_unit(self):
        self.assertEqual(set(cells.UNITS), set(tidy.VALUE_COLUMNS))
        self.assertLessEqual(set(cells.UNITS.values()), {"dollars", "days", "discharges", "beds", "fte", "ratio"})
        self.assertLessEqual(cells.S10_METRICS, set(cells.UNITS))


if __name__ == "__main__":
    unittest.main()
