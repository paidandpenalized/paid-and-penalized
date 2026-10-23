"""The IPPS readers, on synthetic text in the FY2026 and FY2024 files' real layouts (invented numbers, synthetic
CCNs)."""
import csv
import io
import re
import unittest

from pp_engine.ipps import (IMPACT_YEARS, MDH_TYPES, SCH_TYPES, rate_key, rates_year, read_hrrp_factors,
                            read_payment_inputs, read_rates, read_vbp_factors)
from pp_engine.parse import SchemaError

PAYMENT_COLUMNS = IMPACT_YEARS[2026].columns

# --- Tables 1A-1E ----------------------------------------------------------------------------------------------------

# Scenario headers as CMS words them (the fourth carries a line break inside its quoted cell).
SCENARIO = {
    "qe": "Hospital Submitted Quality Data and is a Meaningful EHR User (Update = 2.6 Percent)",
    "qn": "Hospital Submitted Quality Data and is NOT a Meaningful EHR User (Update = 0.125 Percent)",
    "ne": "Hospital Did NOT Submit Quality Data and is a Meaningful EHR User (Update = 1.775 Percent)",
    "nn": "Hospital Did NOT Submit Quality Data and is NOT a Meaningful EHR User\n (Update = -0.7 Percent)",
}
FULL = {"qe": 1000.00, "qn": 960.00, "ne": 990.00, "nn": 950.00}  # invented full standardized amounts, one per scenario
LABOR_SHARE = {"1A": 0.66, "1B": 0.62, "1C": 0.62}
CAPITAL = 262.08  # invented
DEFAULT_ORDER = ("qe", "qn", "ne", "nn")


def money(x):
    return f"${x:,.2f} "


def pair(table, key):
    labor = round(FULL[key] * LABOR_SHARE[table], 2)
    return labor, round(FULL[key] - labor, 2)


def operating_table(table, title, order):
    cells = [c for k in order for c in (SCENARIO[k], "")]
    values = [money(v) for k in order for v in pair(table, k)]
    return [[title] + [""] * 7, cells, ["Labor-related", "Nonlabor-related"] * 4, values, [""] * 8]


def puerto_rico_table():
    return [["TABLE 1C.  ADJUSTED OPERATING STANDARDIZED AMOUNTS FOR HOSPITALS IN PUERTO RICO"] + [""] * 7,
            ["", "Rates if Wage Index Greater Than 1", "",
             "Hospital is a Meaningful EHR User and Wage Index Less Than or Equal to 1 (Update = 2.6 Percent)", "",
             "Hospital is NOT a Meaningful EHR User and Wage Index Less Than or Equal to 1 (Update = 0.125 Percent)",
             "", ""],
            ["", "Labor", "Nonlabor", "Labor", "Nonlabor", "Labor", "Nonlabor", ""],
            ["National1", "Not Applicable", "Not Applicable"] + [money(v) for k in ("qe", "qn") for v in pair("1C", k)]
            + [""],
            ["1For FY 2024, there are no CBSAs in Puerto Rico with a national wage index greater than 1."] + [""] * 7,
            [""] * 8]


def rates_text(order_a=DEFAULT_ORDER, order_b=DEFAULT_ORDER, with_1c=True):
    rows_ = [["FY 2026 FINAL RULE- Tables 1A-1E"] + [""] * 7]
    rows_ += operating_table("1A", "TABLE 1A.  NATIONAL ADJUSTED OPERATING STANDARDIZED AMOUNTS; LABOR/NONLABOR "
                             "(66.0 PERCENT LABOR SHARE/34.0 PERCENT NONLABOR SHARE IF WAGE INDEX GREATER THAN 1)",
                             order_a)
    rows_ += operating_table("1B", "TABLE 1B.  NATIONAL ADJUSTED OPERATING STANDARDIZED AMOUNTS, LABOR/NONLABOR "
                             "(62 PERCENT LABOR SHARE/38 PERCENT NONLABOR SHARE IF WAGE INDEX LESS THAN OR EQUAL TO 1)",
                             order_b)
    if with_1c:
        rows_ += puerto_rico_table()
    rows_ += [["TABLE 1D. -  CAPITAL STANDARD FEDERAL PAYMENT RATE"] + [""] * 7, ["", "Rate"] + [""] * 6,
              ["National", money(CAPITAL)] + [""] * 6, [""] * 8,
              ["TABLE 1E-  LTCH PPS STANDARD FEDERAL PAYMENT RATE\n\n"] + [""] * 7,
              ["", "", "", "", "Full Update (2.7 Percent)", "Reduced Update* (0.7 Percent)", "", ""],
              ["Standard Federal Rate*", "", "", "", money(50000.0), money(49000.0), "", ""],
              ["* For LTCHs that fail to submit quality reporting data, the update is reduced."] + [""] * 7]
    return tsv(rows_)


def tsv(rows_):
    out = io.StringIO()
    csv.writer(out, delimiter="\t", lineterminator="\r\n").writerows(rows_)
    return out.getvalue()


def read_inputs(text, fy=2026):
    """`read_payment_inputs` for the rule of year `fy`: the impact file is read by the year of the rates, so the test
    reads the year's rates (`rates_text` stands in for both years' tables, as the 2024 tests already do)."""
    return read_payment_inputs(text, read_rates(rates_text(), fy))


class Rates(unittest.TestCase):
    def test_rates_pairs_sum_to_the_full_rate(self):
        got = read_rates(rates_text())["operating"]
        for table, share in (("1A", 0.66), ("1B", 0.62)):
            self.assertEqual(sorted(got[table]), ["ne", "nn", "qe", "qn"])
            for key, (labor, nonlabor) in got[table].items():
                self.assertAlmostEqual(labor + nonlabor, FULL[key], places=2, msg=(table, key))
                self.assertAlmostEqual(labor / (labor + nonlabor), share, places=3, msg=(table, key))

    def test_values_come_out_as_numbers_whatever_the_dollar_formatting(self):
        got = read_rates(rates_text())
        self.assertEqual(got["operating"]["1A"]["qe"], (660.00, 340.00))
        self.assertEqual(got["operating"]["1B"]["nn"], (589.00, 361.00))
        self.assertEqual(got["capital"], CAPITAL)
        self.assertEqual(set(got), {"operating", "capital", "mdh_factor", "uc_pool", "year"})
        self.assertIs(got["year"], IMPACT_YEARS[2026])  # the year record the rates were read for, named once
        self.assertEqual(sorted(got["operating"]), ["1A", "1B"])  # Table 1C (Puerto Rico's) is not read

    def test_the_mdh_factor_is_the_update_and_budget_neutrality_where_the_files_rate_is_the_year_before_s(self):
        # Each scenario's update is read from its heading as a percent: "(Update = 2.6 Percent)" -> 2.6; the fourth
        # heading wraps a line and its update is negative
        updates = {"qe": 2.6, "qn": 0.125, "ne": 1.775, "nn": -0.7}
        # FY2026's MDH column is the FY2025 rate: it takes the update and, as the rule adjusts every hospital-specific
        # rate, the MS-DRG reclassification and recalibration factor 0.998580 and the 10% cap factor 0.999897
        self.assertTrue(IMPACT_YEARS[2026].mdh_rate_prior_year)
        self.assertEqual(IMPACT_YEARS[2026].hsp_budget_neutrality, (0.998580, 0.999897))
        got = read_rates(rates_text())["mdh_factor"]
        self.assertEqual(sorted(got), sorted(updates))
        for key, percent in updates.items():
            self.assertAlmostEqual(got[key], (1 + percent / 100) * 0.998580 * 0.999897, places=12, msg=key)
        self.assertAlmostEqual(got["qe"], 1.0244376, places=7)  # what CMS's FY2027 file implies (ipps.ImpactYear)
        # FY2024's file gives the rate already updated: nothing more
        self.assertEqual(read_rates(rates_text(), fy=2024)["mdh_factor"], dict.fromkeys(updates, 1.0))
        with self.assertRaisesRegex(SchemaError, "FY2025"):
            read_rates(rates_text(), fy=2025)

    def test_the_uncompensated_care_pool_is_the_years_factor_1_times_factor_2(self):
        # FY2026: "$12,412,500,000 * 0.6214 = $ 7,713,127,500";
        # FY2024: "$10,015,191,021.88 * 0.5929 = $5,938,006,756.87"
        self.assertEqual(read_rates(rates_text())["uc_pool"], 7_713_127_500.0)
        self.assertEqual(read_rates(rates_text(), fy=2024)["uc_pool"], 5_938_006_756.87)
        self.assertAlmostEqual(12_412_500_000 * 0.6214, IMPACT_YEARS[2026].uc_pool, places=2)
        self.assertAlmostEqual(10_015_191_021.88 * 0.5929, IMPACT_YEARS[2024].uc_pool, delta=0.01)

    def test_a_scenario_with_no_update_or_a_table_that_disagrees_raises(self):
        # a heading with no "(Update = ... Percent)"
        with self.assertRaisesRegex(SchemaError, "update"):
            read_rates(rates_text().replace(" (Update = 2.6 Percent)", "", 1))
        # Table 1B states a different update for a scenario than Table 1A: the MDH rate could not be updated one way
        text = rates_text()
        first = text.index("(Update = 1.775 Percent)")
        second = text.index("(Update = 1.775 Percent)", first + 1)
        with self.assertRaisesRegex(SchemaError, "update"):
            read_rates(text[:second] + "(Update = 1.8 Percent)" + text[second + len("(Update = 1.775 Percent)"):])

    def test_table_1c_is_neither_required_nor_read(self):
        # No program applies in Puerto Rico, so nothing is priced on its table: the file without it reads the same, and
        # a Table 1C that states another update or has an unreadable rate raises nothing
        self.assertEqual(read_rates(rates_text(with_1c=False)), read_rates(rates_text()))
        text = rates_text().replace("Equal to 1 (Update = 0.125 Percent)", "Equal to 1 (Update = 0.2 Percent)", 1)
        self.assertNotEqual(text, rates_text())
        self.assertEqual(read_rates(text), read_rates(rates_text()))
        head, rest = rates_text().split("TABLE 1C", 1)
        table_1c, tail = rest.split("TABLE 1D", 1)
        self.assertIn(money(pair("1C", "qe")[0]), table_1c)
        text = head + "TABLE 1C" + table_1c.replace(money(pair("1C", "qe")[0]), "n/a") + "TABLE 1D" + tail
        self.assertEqual(read_rates(text), read_rates(rates_text()))

    def test_columns_follow_the_scenario_labels_not_their_position(self):
        shuffled = read_rates(rates_text(order_a=("nn", "ne", "qn", "qe"), order_b=("ne", "qe", "nn", "qn")))
        self.assertEqual(shuffled, read_rates(rates_text()))

    def test_an_unrecognised_or_repeated_scenario_raises(self):
        bad = rates_text().replace("is NOT a Meaningful EHR User (Update = 0.125", "is a Possibly EHR User (Update = 0.125", 1)
        with self.assertRaisesRegex(SchemaError, "scenario"):
            read_rates(bad)
        with self.assertRaisesRegex(SchemaError, "1A"):
            read_rates(rates_text(order_a=("qe", "qe", "ne", "nn")))

    def test_the_rate_key_names_the_quality_and_ehr_status(self):
        # Proxy flags: 1 = the update is reduced (quality data not submitted / not a meaningful EHR user).
        self.assertEqual({(q, e): rate_key(q, e) for q in (0, 1) for e in (0, 1)},
                         {(0, 0): "qe", (0, 1): "qn", (1, 0): "ne", (1, 1): "nn"})
        for bad in ((None, 0), (0, None), (2, 0), (0, -1)):
            with self.assertRaises(SchemaError):
                rate_key(*bad)

    def test_a_missing_table_or_rate_raises(self):
        for gone in ("TABLE 1A.", "TABLE 1D."):
            text = rates_text().replace(gone, "TABLE 9Z.", 1)
            with self.assertRaisesRegex(SchemaError, "Table 1[AD]"):
                read_rates(text)
        no_rate = rates_text().replace(money(CAPITAL), "", 1)
        with self.assertRaisesRegex(SchemaError, "Table 1D"):
            read_rates(no_rate)

    def test_an_update_written_without_the_word_percent_reads_the_same(self):
        # a heading that ends "(Update = 3.1)"; the number is the update all the same
        text = rates_text().replace("(Update = 2.6 Percent)", "(Update = 2.6)", 1)
        self.assertNotEqual(text, rates_text())
        self.assertEqual(read_rates(text), read_rates(rates_text()))
        with self.assertRaisesRegex(SchemaError, "update"):  # a number with another word after it is still no update
            read_rates(rates_text().replace("(Update = 2.6 Percent)", "(Update = 2.6 Points)", 1))


# --- the impact file -------------------------------------------------------------------------------------------------

# A header in the real file's shape: the columns the reader needs, among others it ignores and the FY2026-named
# low-volume column it must not read.
IMPACT_HEADER = ["Provider Number", "Name", "FY 2026 Wage Index", "Cost of Living Adjustment", "TCHOP", "TCHCP",
                 "DSHOPP", "DSHCPP", "UCP_ADJ", "UCP Per Claim Amount", "Provider Type", "HSP Rate", "Bills",
                 "CASETA43",
                 "CMIV43", "TACMIV43", "GAF", "OUTFACT_F", "COUTFACT_F", "Proxy Readmission Adjustment Factor",
                 "Proxy Quality Reduction", "Proxy EHR Reduction", "MDH Flag, CAA 2024",
                 "HSP Rate for MDHs, FY 2025 extension", "Low Volume Hospital Adjustment",
                 "Low-Volume Hospital Payment Adjustment, FY 2025 extension", "Beds", "IME_CASETA43", "IME_TACMIV43"]
GOOD = {"Provider Number": "990001", "Name": "INVENTED A", "FY 2026 Wage Index": "1.0512",
        "Cost of Living Adjustment": "1", "TCHOP": "0.0655", "TCHCP": "0.05496", "DSHOPP": "0.0298",
        "DSHCPP": "0.05731", "UCP_ADJ": "0.000788", "UCP Per Claim Amount": "1400.27", "Provider Type": "0",
        "HSP Rate": "", "Bills": "3952",
        "CASETA43": "3878.43", "CMIV43": "1.9834", "TACMIV43": "1.9757", "GAF": "0.933856364", "OUTFACT_F": "0.01633",
        "COUTFACT_F": "0.01269", "Proxy Readmission Adjustment Factor": "0.9975", "Proxy Quality Reduction": "0",
        "Proxy EHR Reduction": "0", "MDH Flag, CAA 2024": "", "HSP Rate for MDHs, FY 2025 extension": "",
        "Low Volume Hospital Adjustment": "1", "Low-Volume Hospital Payment Adjustment, FY 2025 extension": "1",
        "Beds": "212", "IME_CASETA43": "1210.5", "IME_TACMIV43": "1.8812"}
TITLE = ["FY 2026 IPPS Impact File -  Final Rule (August 2025)"] + [""] * 24


def impact_text(*records, header=IMPACT_HEADER):
    return tsv([TITLE, header] + [[r.get(h, "") for h in header] for r in records])


def hospital(**kw):
    return dict(GOOD, **kw)


class PaymentInputs(unittest.TestCase):
    def test_a_row_reads_into_numbers_and_flags(self):
        got = read_inputs(impact_text(hospital()))["990001"]
        self.assertEqual(got, {
            "cases": 3878.43, "cmi": 1.9757, "bills": 3952, "cmi_hsp": 1.9834, "wi": 1.0512, "cola": 1.0,
            "quality": 0, "ehr": 0, "ptype": 0, "sch": False, "mdh": False, "hsp": None, "hsp_mdh": None,
            "ime_op": 0.0655, "ime_cap": 0.05496, "dsh_op": 0.0298, "dsh_cap": 0.05731, "ucp_per_claim": 1400.27,
            "ucp_factor": 0.000788,
            "outlier_op": 0.01633, "outlier_cap": 0.01269, "gaf": 0.933856364, "low_volume": 1.0,
            "beds": 212, "ime_cases": 1210.5, "ime_cmi": 1.8812})
        self.assertEqual(sorted(got), sorted(set(PAYMENT_COLUMNS) - {"ccn"} | {"sch"}))

    def test_payment_inputs_blank_is_none(self):
        blanks = {k: "" for k in ("CASETA43", "TACMIV43", "OUTFACT_F", "COUTFACT_F", "HSP Rate", "UCP Per Claim Amount",
                                  "UCP_ADJ",
                                  "Proxy Quality Reduction", "Provider Type")}
        got = read_inputs(impact_text(hospital(**blanks)))["990001"]
        for key in ("cases", "cmi", "outlier_op", "outlier_cap", "hsp", "ucp_per_claim", "ucp_factor", "quality",
                    "ptype"):
            self.assertIsNone(got[key], key)
        self.assertFalse(got["sch"])  # no provider type: not an SCH
        self.assertEqual(got["wi"], 1.0512)  # the rest still reads

    def test_a_zero_stays_zero_and_is_not_blank(self):
        got = read_inputs(impact_text(hospital(**{"HSP Rate": "0", "OUTFACT_F": "0"})))["990001"]
        self.assertEqual((got["hsp"], got["outlier_op"]), (0.0, 0.0))

    def test_sch_follows_the_provider_type(self):
        types = {"0": False, "7": False, "8": False, "16": True, "17": True, "21": True, "22": True}
        recs = [hospital(**{"Provider Number": f"99{i:04d}", "Provider Type": t}) for i, t in enumerate(types)]
        got = read_inputs(impact_text(*recs))
        self.assertEqual([got[f"99{i:04d}"]["sch"] for i in range(len(types))], list(types.values()))
        self.assertEqual(SCH_TYPES, {16, 17, 21, 22})

    def test_mdh_is_y_and_a_puerto_rico_row_reads_like_the_rest(self):
        recs = [hospital(**{"Provider Number": "990002", "MDH Flag, CAA 2024": "Y",
                            "HSP Rate for MDHs, FY 2025 extension": "6500.5"}),
                hospital(**{"Provider Number": "40Z999"}), hospital()]
        got = read_inputs(impact_text(*recs))
        self.assertEqual((got["990002"]["mdh"], got["990002"]["hsp_mdh"]), (True, 6500.5))
        # no flag of its own: the program files decide whether a hospital is priced, and none lists Puerto Rico's
        self.assertEqual(got["40Z999"], got["990001"])

    def test_the_low_volume_column_is_the_fy2025_extension_one(self):
        got = read_inputs(impact_text(hospital(**{
            "Low Volume Hospital Adjustment": "1",
            "Low-Volume Hospital Payment Adjustment, FY 2025 extension": "1.25"})))["990001"]
        self.assertEqual(got["low_volume"], 1.25)

    def test_columns_are_found_by_name_not_position(self):
        got = read_inputs(impact_text(hospital(), header=IMPACT_HEADER[:1] + IMPACT_HEADER[:0:-1]))
        self.assertEqual(got, read_inputs(impact_text(hospital())))

    def test_payment_inputs_duplicate_ccn_raises(self):
        with self.assertRaisesRegex(SchemaError, "duplicate CCN 990001"):
            read_inputs(impact_text(hospital(), hospital(Name="INVENTED B")))

    def test_a_trailing_non_ccn_row_is_skipped_and_a_malformed_ccn_raises(self):
        text = impact_text(hospital()) + "End of worksheet\r\n"
        self.assertEqual(list(read_inputs(text)), ["990001"])
        with self.assertRaisesRegex(SchemaError, "malformed CCN"):
            read_inputs(impact_text(hospital(**{"Provider Number": "99001"})))

    def test_missing_column_raises(self):
        for key, name in PAYMENT_COLUMNS.items():
            header = [h for h in IMPACT_HEADER if h != name]
            want = "header row" if key == "ccn" else "expected one column " + re.escape(repr(name))
            with self.assertRaisesRegex(SchemaError, want):
                read_inputs(impact_text(hospital(), header=header))

    def test_the_fy2026_low_volume_column_alone_is_not_enough(self):
        header = [h for h in IMPACT_HEADER if not h.startswith("Low-Volume")]
        with self.assertRaisesRegex(SchemaError, "Low-Volume Hospital Payment Adjustment, FY 2025 extension"):
            read_inputs(impact_text(hospital(), header=header))

    def test_a_flag_is_0_1_or_blank_and_nothing_else(self):
        # CMS writes the proxy reduction flags as 0 or 1. A cell that merely rounds to one (1.4, 0.6) or that the number
        # reader would accept (1.0, "$1", 100%) is not a flag: it raises, naming the hospital and the column.
        for column in ("Proxy Quality Reduction", "Proxy EHR Reduction"):
            for bad in ("2", "-1", "1.0", "0.0", "0.6", "1.4", "$1", "100%", "yes", "Y", "n/a", ".", "--", "inf", "nan"):
                with self.assertRaisesRegex(SchemaError, f"990001.*{column}", msg=(column, bad)):
                    read_inputs(impact_text(hospital(**{column: bad})))
            for ok, want in (("0", 0), ("1", 1), ("", None), (" 1 ", 1)):
                got = read_inputs(impact_text(hospital(**{column: ok})))["990001"]
                self.assertEqual(got["quality" if column == "Proxy Quality Reduction" else "ehr"], want, (column, ok))

    def test_an_infinite_count_is_a_schema_error_not_an_overflow(self):
        # int(round(inf)) raises OverflowError, which is not a ValueError: it must still name the hospital and column
        for column in ("Bills", "Provider Type"):
            for bad in ("inf", "-inf", "Infinity"):
                with self.assertRaisesRegex(SchemaError, "990001", msg=(column, bad)):
                    read_inputs(impact_text(hospital(**{column: bad})))

    def test_a_non_numeric_cell_or_a_bad_flag_raises(self):
        for col, bad in (("CASETA43", "many"), ("FY 2026 Wage Index", "nan"), ("GAF", "inf"),
                         ("Proxy EHR Reduction", "2"), ("Proxy Quality Reduction", "yes")):
            with self.assertRaisesRegex(SchemaError, "990001"):
                read_inputs(impact_text(hospital(**{col: bad})))


# FY2024's impact file: other year stamps, no MDH or extension columns (MDH status is the provider type, its rate the
# `HSP Rate`), and `Low Volume Hospital Adjustment` is the year's low-volume multiplier.
IMPACT_HEADER_2024 = ["Provider Number", "Name", "FY 2024 Wage Index", "Cost of Living Adjustment", "Beds", "TCHOP",
                      "TCHCP", "DSHOPP", "DSHCPP", "UCP_ADJ", "UCP Per Claim Amount", "Provider Type", "HSP Rate",
                      "Bills",
                      "CASETA40", "CMIV40", "TACMIV40", "CASETA41", "CMIV41", "TACMIV41", "GAF", "OUTFACT_F",
                      "COUTFACT_F", "Low Volume Hospital Adjustment", "Proxy Quality Reduction", "Proxy EHR Reduction",
                      "IME_CASETA40", "IME_TACMIV40", "IME_CASETA41", "IME_TACMIV41"]
GOOD_2024 = {**{k: v for k, v in GOOD.items() if k in IMPACT_HEADER_2024}, "FY 2024 Wage Index": "0.9512",
             "CASETA40": "1.0", "CMIV40": "1.0", "TACMIV40": "1.0", "CASETA41": "2100.5", "CMIV41": "1.5512",
             "TACMIV41": "1.5401", "Low Volume Hospital Adjustment": "1.1", "Beds": "0", "IME_CASETA40": "1.0",
             "IME_TACMIV40": "1.0", "IME_CASETA41": "", "IME_TACMIV41": ""}


def impact_2024(*records):
    return tsv([["FY 2024 IPPS Impact File -  Final Rule (August 2023)"] + [""] * 24, IMPACT_HEADER_2024]
               + [[r.get(h, "") for h in IMPACT_HEADER_2024] for r in records])


class PaymentInputs2024(unittest.TestCase):
    def test_a_row_reads_with_the_years_columns(self):
        got = read_inputs(impact_2024(GOOD_2024), fy=2024)["990001"]
        self.assertEqual((got["cases"], got["cmi"], got["cmi_hsp"], got["wi"], got["low_volume"], got["beds"]),
                         (2100.5, 1.5401, 1.5512, 0.9512, 1.1, 0))  # V41, not V40; a zero bed count stays 0
        self.assertEqual((got["mdh"], got["hsp_mdh"], got["sch"]), (False, None, False))
        self.assertEqual((got["ime_cases"], got["ime_cmi"]), (None, None))  # V41's blank, not V40's 1.0
        self.assertEqual(sorted(got), sorted(set(PAYMENT_COLUMNS) - {"ccn"} | {"sch"}))

    def test_mdh_is_the_provider_type_and_its_rate_is_the_hsp_rate(self):
        recs = [dict(GOOD_2024, **{"Provider Number": f"99{i:04d}", "Provider Type": t, "HSP Rate": "7100.25"})
                for i, t in enumerate(("0", "14", "15", "16"))]
        got = read_inputs(impact_2024(*recs), fy=2024)
        self.assertEqual([(got[f"99{i:04d}"]["mdh"], got[f"99{i:04d}"]["hsp_mdh"], got[f"99{i:04d}"]["sch"])
                          for i in range(4)],
                         [(False, None, False), (True, 7100.25, False), (True, 7100.25, False), (False, None, True)])
        self.assertEqual(MDH_TYPES, {14, 15})
        self.assertFalse(MDH_TYPES & SCH_TYPES)

    def test_each_year_needs_its_own_columns(self):
        with self.assertRaisesRegex(SchemaError, "FY2026 impact file: expected one column"):
            read_inputs(impact_2024(GOOD_2024))  # the FY2026 map on FY2024's file
        with self.assertRaisesRegex(SchemaError, "FY2024 impact file: expected one column"):
            read_inputs(impact_text(hospital()), fy=2024)
        with self.assertRaisesRegex(SchemaError, "FY2025"):
            read_inputs(impact_text(hospital()), fy=2025)
        self.assertEqual(sorted(IMPACT_YEARS), [2024, 2026])
        self.assertTrue(all(fy == year.fy for fy, year in IMPACT_YEARS.items()))

    def test_the_inputs_are_read_by_the_year_of_the_rates_and_cannot_be_paired_with_another(self):
        # No year argument: the rates name it, once. FY2026's rates read FY2026's file; FY2024's read FY2024's.
        rates_2026, rates_2024 = read_rates(rates_text()), read_rates(rates_text(), fy=2024)
        self.assertEqual((rates_year(rates_2026).fy, rates_year(rates_2024).fy), (2026, 2024))
        self.assertEqual(sorted(read_payment_inputs(impact_text(hospital()), rates_2026)), ["990001"])
        self.assertEqual(sorted(read_payment_inputs(impact_2024(GOOD_2024), rates_2024)), ["990001"])
        # A second year cannot be passed beside them, and each year's rates refuse the other year's file.
        with self.assertRaises(TypeError):
            read_payment_inputs(impact_2024(GOOD_2024), rates_2024, fy=2026)
        with self.assertRaisesRegex(SchemaError, "FY2024 impact file: expected one column"):
            read_payment_inputs(impact_text(hospital()), rates_2024)
        with self.assertRaisesRegex(SchemaError, "FY2026 impact file: expected one column"):
            read_payment_inputs(impact_2024(GOOD_2024), rates_2026)
        # Rates that did not come from read_rates name no year, so they cannot read a file.
        with self.assertRaisesRegex(SchemaError, "carry no year"):
            read_payment_inputs(impact_text(hospital()), {k: v for k, v in rates_2026.items() if k != "year"})
        with self.assertRaisesRegex(SchemaError, "carry no year"):
            read_payment_inputs(impact_text(hospital()), None)


# --- the HRRP and VBP factor files -----------------------------------------------------------------------------------

HRRP_HEADER = ["Hospital CCN", "  Payment adjustment factor ", "Payment reduction percentage", "Dual proportion",
               "Peer group assignment", "Neutrality modifier ", "Number of eligible discharges for AMI", ""]
VBP_HEADER = ["CMS Certification Number (CCN)", "Actual FY 2026 Hospital VBP Adjustment Factor", ""]


def hrrp_text(*records, header=HRRP_HEADER):
    title = ["FY 2026 IPPS/LTCH PPS Final Rule: Hospital Readmissions Reduction Program Supplemental Data"]
    return tsv([title, header] + list(records) + [["End of worksheet"]])


def vbp_text(*records, header=VBP_HEADER):
    return tsv([["TABLE 16B.—ACTUAL HOSPITAL VALUE-BASED PURCHASING PROGRAM (VBP) ADJUSTMENT FACTORS FOR FY 2026*"],
                header] + list(records) + [["*The factors in this file are the actual payment adjustment factors."],
                                           ["End of worksheet"]])


class Factors(unittest.TestCase):
    def test_hrrp_factors_by_ccn_skipping_the_footer(self):
        text = hrrp_text(["990001", "0.9988", "0.12%", "0.18", "2", "0.9627", "273", ""],
                         ["990002", "1.0000", "0.00%", "0.10", "3", "0.9627", "12", ""])
        self.assertEqual(read_hrrp_factors(text), {"990001": 0.9988, "990002": 1.0})

    def test_vbp_factors_by_ccn_skipping_the_footnote(self):
        text = vbp_text(["990001", "1.0021821642", ""], ["990002", "0.9944241534", ""])
        self.assertEqual(read_vbp_factors(text), {"990001": 1.0021821642, "990002": 0.9944241534})

    def test_table_16b_reads_the_years_factor_heading(self):
        header_2024 = ["CMS Certification Number (CCN)", "Actual FY 2024 Hospital VBP Adjustment Factor", ""]
        text = vbp_text(["990001", "0.9947894297", ""], header=header_2024)
        self.assertEqual(read_vbp_factors(text, fy=2024), {"990001": 0.9947894297})
        with self.assertRaisesRegex(SchemaError, "'Actual FY 2026 Hospital VBP Adjustment Factor'"):
            read_vbp_factors(text)

    def test_a_missing_factor_column_raises_naming_it(self):
        with self.assertRaisesRegex(SchemaError, "'Payment adjustment factor'"):
            read_hrrp_factors(hrrp_text(["990001", "0.99"], header=["Hospital CCN", "Payment reduction percentage"]))
        with self.assertRaisesRegex(SchemaError, "'Hospital CCN'"):
            read_hrrp_factors(hrrp_text(["990001", "0.99"], header=["CCN", "Payment adjustment factor"]))
        with self.assertRaisesRegex(SchemaError, "'Actual FY 2026 Hospital VBP Adjustment Factor'"):
            read_vbp_factors(vbp_text(["990001", "1.0"], header=["CMS Certification Number (CCN)", "Factor", ""]))
        with self.assertRaisesRegex(SchemaError, "header row"):
            read_vbp_factors(vbp_text(["990001", "1.0"], header=["CCN", "Actual FY 2026 Hospital VBP Adjustment Factor"]))

    def test_a_blank_unreadable_or_non_positive_factor_raises_rather_than_becoming_one(self):
        for bad in ("", "n/a", "abc", "0", "-1", "nan", "inf"):
            with self.assertRaisesRegex(SchemaError, "990002"):
                read_hrrp_factors(hrrp_text(["990001", "0.99"], ["990002", bad]))
            with self.assertRaisesRegex(SchemaError, "990002"):
                read_vbp_factors(vbp_text(["990001", "1.01"], ["990002", bad]))

    def test_a_factor_outside_what_the_program_can_pay_raises_naming_the_hospital(self):
        # HRRP: 0.97 (the 3% floor) to 1. A percentage, a dollar figure or a ratio above 1 is a misread column. The cell
        # that overflows a float ("1e999") is infinite, so unusable, not out of range.
        for good in ("0.97", "0.9956", "1", "1.0"):
            read_hrrp_factors(hrrp_text(["990001", good]))
        for bad in ("0.96", "0.5", "1.0001", "1.5", "99.5", "4519.68", "1e999"):
            with self.assertRaisesRegex(SchemaError, "990002", msg=bad):
                read_hrrp_factors(hrrp_text(["990001", "0.99"], ["990002", bad]))
        with self.assertRaisesRegex(SchemaError, r"HRRP supplemental file: factor 0\.96 for 990002 is outside 0\.97"):
            read_hrrp_factors(hrrp_text(["990002", "0.96"]))
        # VBP: about 1; 0.9 to 1.1 is the sanity bound
        for good in ("0.98", "1.0021821642", "1.1", "0.9"):
            read_vbp_factors(vbp_text(["990001", good, ""]))
        for bad in ("0.89", "1.11", "2", "100", "1e999"):
            with self.assertRaisesRegex(SchemaError, "990002", msg=bad):
                read_vbp_factors(vbp_text(["990001", "1.01", ""], ["990002", bad, ""]))
        with self.assertRaisesRegex(SchemaError, r"Table 16B: factor 1\.5 for 990002 is outside 0\.9 to 1\.1"):
            read_vbp_factors(vbp_text(["990002", "1.5", ""]))

    def test_a_repeated_or_malformed_ccn_raises(self):
        with self.assertRaisesRegex(SchemaError, "duplicate CCN 990001"):
            read_hrrp_factors(hrrp_text(["990001", "0.99"], ["990001", "0.98"]))
        with self.assertRaisesRegex(SchemaError, "malformed CCN"):
            read_vbp_factors(vbp_text(["99001", "1.0"]))


if __name__ == "__main__":
    unittest.main()
