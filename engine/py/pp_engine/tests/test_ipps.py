"""The FY2026 IPPS readers, on synthetic text in the files' real layouts (invented numbers, synthetic CCNs)."""
import csv
import io
import re
import unittest

from pp_engine.ipps import (PAYMENT_COLUMNS, SCH_TYPES, rate_key, read_hrrp_factors, read_payment_inputs, read_rates,
                            read_vbp_factors)
from pp_engine.parse import SchemaError

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
        self.assertEqual(set(got), {"operating", "capital", "update"})

    def test_the_update_of_each_scenario_is_read_from_its_heading_as_a_percent(self):
        # "(Update = 2.6 Percent)" -> 2.6; the fourth heading wraps a line and the update is negative
        self.assertEqual(read_rates(rates_text())["update"], {"qe": 2.6, "qn": 0.125, "ne": 1.775, "nn": -0.7})

    def test_the_updates_follow_the_scenario_labels_not_their_position(self):
        shuffled = read_rates(rates_text(order_a=("nn", "ne", "qn", "qe"), order_b=("ne", "qe", "nn", "qn")))
        self.assertEqual(shuffled["update"], {"qe": 2.6, "qn": 0.125, "ne": 1.775, "nn": -0.7})

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
        # Table 1C states a different update from the same scenario's in Table 1A
        with self.assertRaisesRegex(SchemaError, "update"):
            read_rates(rates_text().replace("Equal to 1 (Update = 0.125 Percent)", "Equal to 1 (Update = 0.2 Percent)", 1))

    def test_puerto_rico_table_has_the_ehr_split_only(self):
        got = read_rates(rates_text())["operating"]["1C"]
        self.assertEqual(got, {"qe": pair("1C", "qe"), "qn": pair("1C", "qn")})  # the wage-index-above-one columns say
        # "Not Applicable" and are not read; the table has no quality-failure columns

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

    def test_the_cms_file_without_table_1c_raises_rather_than_dropping_puerto_rico(self):
        with self.assertRaisesRegex(SchemaError, "Table 1C"):
            read_rates(rates_text(with_1c=False))


# --- the impact file -------------------------------------------------------------------------------------------------

# A header in the real file's shape: the columns the reader needs, among others it ignores and the FY2026-named
# low-volume column it must not read.
IMPACT_HEADER = ["Provider Number", "Name", "FY 2026 Wage Index", "Cost of Living Adjustment", "TCHOP", "TCHCP",
                 "DSHOPP", "DSHCPP", "UCP Per Claim Amount", "Provider Type", "HSP Rate", "Bills", "CASETA43",
                 "CMIV43", "TACMIV43", "GAF", "OUTFACT_F", "COUTFACT_F", "Proxy Readmission Adjustment Factor",
                 "Proxy Quality Reduction", "Proxy EHR Reduction", "MDH Flag, CAA 2024",
                 "HSP Rate for MDHs, FY 2025 extension", "Low Volume Hospital Adjustment",
                 "Low-Volume Hospital Payment Adjustment, FY 2025 extension"]
GOOD = {"Provider Number": "990001", "Name": "INVENTED A", "FY 2026 Wage Index": "1.0512",
        "Cost of Living Adjustment": "1", "TCHOP": "0.0655", "TCHCP": "0.05496", "DSHOPP": "0.0298",
        "DSHCPP": "0.05731", "UCP Per Claim Amount": "1400.27", "Provider Type": "0", "HSP Rate": "", "Bills": "3952",
        "CASETA43": "3878.43", "CMIV43": "1.9834", "TACMIV43": "1.9757", "GAF": "0.933856364", "OUTFACT_F": "0.01633",
        "COUTFACT_F": "0.01269", "Proxy Readmission Adjustment Factor": "0.9975", "Proxy Quality Reduction": "0",
        "Proxy EHR Reduction": "0", "MDH Flag, CAA 2024": "", "HSP Rate for MDHs, FY 2025 extension": "",
        "Low Volume Hospital Adjustment": "1", "Low-Volume Hospital Payment Adjustment, FY 2025 extension": "1"}
TITLE = ["FY 2026 IPPS Impact File -  Final Rule (August 2025)"] + [""] * 24


def impact_text(*records, header=IMPACT_HEADER):
    return tsv([TITLE, header] + [[r.get(h, "") for h in header] for r in records])


def hospital(**kw):
    return dict(GOOD, **kw)


class PaymentInputs(unittest.TestCase):
    def test_a_row_reads_into_numbers_and_flags(self):
        got = read_payment_inputs(impact_text(hospital()))["990001"]
        self.assertEqual(got, {
            "cases": 3878.43, "cmi": 1.9757, "bills": 3952, "cmi_hsp": 1.9834, "wi": 1.0512, "cola": 1.0,
            "quality": 0, "ehr": 0, "ptype": 0, "sch": False, "mdh": False, "hsp": None, "hsp_mdh": None,
            "ime_op": 0.0655, "ime_cap": 0.05496, "dsh_op": 0.0298, "dsh_cap": 0.05731, "ucp_per_claim": 1400.27,
            "outlier_op": 0.01633, "outlier_cap": 0.01269, "gaf": 0.933856364, "low_volume": 1.0, "pr": False})
        self.assertEqual(sorted(got), sorted(set(PAYMENT_COLUMNS) - {"ccn"} | {"sch", "pr"}))

    def test_payment_inputs_blank_is_none(self):
        blanks = {k: "" for k in ("CASETA43", "TACMIV43", "OUTFACT_F", "COUTFACT_F", "HSP Rate", "UCP Per Claim Amount",
                                  "Proxy Quality Reduction", "Provider Type")}
        got = read_payment_inputs(impact_text(hospital(**blanks)))["990001"]
        for key in ("cases", "cmi", "outlier_op", "outlier_cap", "hsp", "ucp_per_claim", "quality", "ptype"):
            self.assertIsNone(got[key], key)
        self.assertFalse(got["sch"])  # no provider type: not an SCH
        self.assertEqual(got["wi"], 1.0512)  # the rest still reads

    def test_a_zero_stays_zero_and_is_not_blank(self):
        got = read_payment_inputs(impact_text(hospital(**{"HSP Rate": "0", "OUTFACT_F": "0"})))["990001"]
        self.assertEqual((got["hsp"], got["outlier_op"]), (0.0, 0.0))

    def test_sch_follows_the_provider_type(self):
        types = {"0": False, "7": False, "8": False, "16": True, "17": True, "21": True, "22": True}
        recs = [hospital(**{"Provider Number": f"99{i:04d}", "Provider Type": t}) for i, t in enumerate(types)]
        got = read_payment_inputs(impact_text(*recs))
        self.assertEqual([got[f"99{i:04d}"]["sch"] for i in range(len(types))], list(types.values()))
        self.assertEqual(SCH_TYPES, {16, 17, 21, 22})

    def test_mdh_is_y_and_pr_is_the_state_code(self):
        recs = [hospital(**{"Provider Number": "990002", "MDH Flag, CAA 2024": "Y",
                            "HSP Rate for MDHs, FY 2025 extension": "6500.5"}),
                hospital(**{"Provider Number": "40Z999"})]
        got = read_payment_inputs(impact_text(*recs))
        self.assertEqual((got["990002"]["mdh"], got["990002"]["hsp_mdh"], got["990002"]["pr"]), (True, 6500.5, False))
        self.assertEqual((got["40Z999"]["mdh"], got["40Z999"]["pr"]), (False, True))

    def test_the_low_volume_column_is_the_fy2025_extension_one(self):
        got = read_payment_inputs(impact_text(hospital(**{
            "Low Volume Hospital Adjustment": "1",
            "Low-Volume Hospital Payment Adjustment, FY 2025 extension": "1.25"})))["990001"]
        self.assertEqual(got["low_volume"], 1.25)

    def test_columns_are_found_by_name_not_position(self):
        got = read_payment_inputs(impact_text(hospital(), header=IMPACT_HEADER[:1] + IMPACT_HEADER[:0:-1]))
        self.assertEqual(got, read_payment_inputs(impact_text(hospital())))

    def test_payment_inputs_duplicate_ccn_raises(self):
        with self.assertRaisesRegex(SchemaError, "duplicate CCN 990001"):
            read_payment_inputs(impact_text(hospital(), hospital(Name="INVENTED B")))

    def test_a_trailing_non_ccn_row_is_skipped_and_a_malformed_ccn_raises(self):
        text = impact_text(hospital()) + "End of worksheet\r\n"
        self.assertEqual(list(read_payment_inputs(text)), ["990001"])
        with self.assertRaisesRegex(SchemaError, "malformed CCN"):
            read_payment_inputs(impact_text(hospital(**{"Provider Number": "99001"})))

    def test_missing_column_raises(self):
        for key, name in PAYMENT_COLUMNS.items():
            header = [h for h in IMPACT_HEADER if h != name]
            want = "header row" if key == "ccn" else "expected one column " + re.escape(repr(name))
            with self.assertRaisesRegex(SchemaError, want):
                read_payment_inputs(impact_text(hospital(), header=header))

    def test_the_fy2026_low_volume_column_alone_is_not_enough(self):
        header = [h for h in IMPACT_HEADER if not h.startswith("Low-Volume")]
        with self.assertRaisesRegex(SchemaError, "Low-Volume Hospital Payment Adjustment, FY 2025 extension"):
            read_payment_inputs(impact_text(hospital(), header=header))

    def test_a_non_numeric_cell_or_a_bad_flag_raises(self):
        for col, bad in (("CASETA43", "many"), ("FY 2026 Wage Index", "nan"), ("GAF", "inf"),
                         ("Proxy EHR Reduction", "2"), ("Proxy Quality Reduction", "yes")):
            with self.assertRaisesRegex(SchemaError, "990001"):
                read_payment_inputs(impact_text(hospital(**{col: bad})))


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

    def test_a_repeated_or_malformed_ccn_raises(self):
        with self.assertRaisesRegex(SchemaError, "duplicate CCN 990001"):
            read_hrrp_factors(hrrp_text(["990001", "0.99"], ["990001", "0.98"]))
        with self.assertRaisesRegex(SchemaError, "malformed CCN"):
            read_vbp_factors(vbp_text(["99001", "1.0"]))


if __name__ == "__main__":
    unittest.main()
