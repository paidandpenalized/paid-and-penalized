"""The HRRP formula, stored decimals, build gates, MDH share and dollar estimate, on synthetic records. Ported from
Thirty Day Readmissions (pipeline/tests/test_model.py and test_build.py at 33d1959)."""
import re
import unittest
from unittest import mock

from pp_engine import dollars, hrrp
from pp_engine.dollars import MDH_SHARE
from pp_engine.hrrp_read import CONDITIONS


def cond(n, err, med, ratio, flag=None):
    if flag is None:
        flag = 1 if (n or 0) >= 25 and err is not None and err > med else 0
    return {"n": n, "err": err, "med": med, "flag": flag, "ratio": ratio}


# CMS "Payment Reduction Methodology" infographic, Hospital A (FY2027 edition)
HOSPITAL_A = {
    "nm": 0.9458, "paf": 0.9966,
    "c": {
        "AMI": cond(42, 1.0259, 0.9970, 0.0648),
        "COPD": cond(38, 1.0476, 0.9954, 0.0331),
        "HF": cond(22, 1.0783, 1.0077, 0.0500),
        "PN": cond(23, 1.0007, 1.0021, 0.0700),
        "CABG": cond(25, 0.9439, 1.0093, 0.0200),
        "THA_TKA": cond(0, None, 1.0073, None),
    },
}

# Invented standardized amounts (labor, nonlabor), all different so a mix-up of table, key or column shows.
RATES = {
    "1A": {"qe": (4000.0, 2000.0), "qn": (3900.0, 1900.0), "ne": (3800.0, 1800.0), "nn": (3700.0, 1700.0)},
    "1B": {"qe": (3000.0, 2500.0), "qn": (2900.0, 2400.0), "ne": (2800.0, 2300.0), "nn": (2700.0, 2200.0)},
}


class ContributionTest(unittest.TestCase):
    def test_cms_worked_example(self):
        c = hrrp.contributions(HOSPITAL_A)
        self.assertAlmostEqual(c["AMI"], 0.9458 * 0.0648 * (1.0259 - 0.9970), places=9)
        self.assertAlmostEqual(c["COPD"], 0.9458 * 0.0331 * (1.0476 - 0.9954), places=9)
        for k in ("HF", "PN", "CABG", "THA_TKA"):  # HF and PN are under 25 discharges, CABG is under the median
            self.assertEqual(c[k], 0.0, k)
        self.assertEqual(round(hrrp.reduction(HOSPITAL_A), 4), 0.0034)
        self.assertEqual(round(1 - round(hrrp.reduction(HOSPITAL_A), 4), 4), 0.9966)
        self.assertEqual(hrrp.replication_status(HOSPITAL_A), "exact")

    def test_a_factor_off_in_the_fourth_decimal_is_a_mismatch(self):
        self.assertEqual(hrrp.replication_status({**HOSPITAL_A, "paf": 0.9965}), "mismatch")

    def test_cap(self):
        h = {"nm": 1.0, "paf": 0.97, "c": {k: cond(500, 1.5, 1.0, 0.1) for k in CONDITIONS}}
        self.assertEqual(hrrp.reduction(h), 0.03)
        self.assertEqual(hrrp.CAP, 0.03)

    def test_missing_ratio_contributes_zero(self):
        h = {"nm": 1.0, "paf": 1.0, "c": {k: cond(100, 1.2, 1.0, None) for k in CONDITIONS}}
        self.assertEqual(hrrp.reduction(h), 0.0)

    def test_the_discharge_minimum_is_inclusive(self):
        at = {"n": hrrp.MIN_DISCHARGES, "err": 1.1, "med": 1.0, "ratio": 0.1}
        self.assertGreater(hrrp.contribution(1.0, at), 0)
        self.assertEqual(hrrp.contribution(1.0, {**at, "n": hrrp.MIN_DISCHARGES - 1}), 0.0)
        self.assertEqual(hrrp.contribution(None, at), 0.0)
        self.assertEqual(hrrp.contribution(1.0, {**at, "n": None}), 0.0)


class DollarTest(unittest.TestCase):
    def test_wage_index_above_one_uses_table_1a(self):
        imp = {"cases": 1000, "cmi": 1.5, "wi": 1.1, "cola": 1.0, "qual_red": False, "ehr_red": False}
        self.assertAlmostEqual(hrrp.est_base_payment(imp, RATES), 1000 * 1.5 * (4000.0 * 1.1 + 2000.0), places=2)

    def test_wage_index_at_or_below_one_uses_table_1b_and_flags(self):
        imp = {"cases": 10, "cmi": 2.0, "wi": 1.0, "cola": 1.0, "qual_red": False, "ehr_red": True}
        self.assertAlmostEqual(hrrp.est_base_payment(imp, RATES), 10 * 2.0 * (2900.0 * 1.0 + 2400.0), places=2)  # "qn"
        imp = {**imp, "qual_red": True, "ehr_red": False}
        self.assertAlmostEqual(hrrp.est_base_payment(imp, RATES), 10 * 2.0 * (2800.0 + 2300.0), places=2)  # "ne"
        imp = {**imp, "ehr_red": True}
        self.assertAlmostEqual(hrrp.est_base_payment(imp, RATES), 10 * 2.0 * (2700.0 + 2200.0), places=2)  # "nn"

    def test_cola_scales_nonlabor_share(self):
        imp = {"cases": 1, "cmi": 1.0, "wi": 1.2, "cola": 1.25, "qual_red": False, "ehr_red": False}
        self.assertAlmostEqual(hrrp.est_base_payment(imp, RATES), 4000.0 * 1.2 + 2000.0 * 1.25, places=2)

    def test_missing_inputs_return_none(self):
        self.assertIsNone(hrrp.est_base_payment({"cases": None, "cmi": 1, "wi": 1, "cola": 1}, RATES))
        self.assertIsNone(hrrp.est_base_payment(None, RATES))
        self.assertIsNone(hrrp.est_base_payment({}, RATES))

    def test_mdh_addon_is_the_mdh_share_of_the_excess_times_the_year_share(self):
        self.assertEqual(MDH_SHARE, 0.75)
        imp = {"cases": 100, "cmi": 1.5, "hsp": 10_000.0}
        self.assertAlmostEqual(hrrp.est_mdh_addon(imp, 1_200_000, 0.25), 0.75 * (1_500_000 - 1_200_000) * 0.25, places=6)
        self.assertEqual(hrrp.est_mdh_addon(imp, 1_600_000, 0.25), 0.0)  # federal payment already higher
        self.assertEqual(hrrp.est_mdh_addon({**imp, "hsp": None}, 1_200_000, 0.25), 0.0)
        self.assertEqual(hrrp.est_mdh_addon(imp, None, 0.25), 0.0)

    def test_penalty_dollars(self):
        self.assertAlmostEqual(hrrp.est_penalty(1_000_000, 0.9966), 3400.0, places=6)
        self.assertIsNone(hrrp.est_penalty(None, 0.99))
        self.assertIsNone(hrrp.est_penalty(1_000_000, None))


class MdhShareTest(unittest.TestCase):
    def test_shortfall_skips_mdhs_with_no_federal_base(self):
        addons = {"a": (100.0, 10.0, 40.0), "b": (0.0, 0.0, 0.0), "c": (0, 0.0, 5.0)}
        self.assertEqual(hrrp.mdh_shortfall(addons), {"a": 100 * (1 - 110 / 140)})
        self.assertEqual(hrrp.mdh_shortfall({}), {})

    def test_year_share_clamps(self):
        self.assertEqual(dollars.MDH_END, "2026-12-31")
        self.assertEqual(hrrp.year_share(2027, dollars.MDH_END), 92 / 365)  # Oct 1 - Dec 31, 2026
        self.assertEqual(hrrp.year_share(2028, "2028-09-30"), 1)  # leap-year FY: 366 of 366
        self.assertEqual(hrrp.year_share(2027, "2026-09-30"), 0)  # the day before the fiscal year starts
        self.assertEqual(hrrp.year_share(2027, "2026-10-01"), 1 / 365)  # its first day
        self.assertEqual(hrrp.year_share(2027, "2027-09-30"), 1)  # its last day


class PrecisionTest(unittest.TestCase):
    FULL = {"a": {"paf": 0.9871, "dual": 0.15625, "peer": 1, "nm": 0.95173218450771123,
                  "c": {"HF": {"n": 540, "err": 1.07309968120934, "med": 0.98846227301558842, "flag": 1,
                               "ratio": 0.041873294017625}}}}
    PUBLISHED = {"a": {"paf": 0.9871, "dual": 0.1563, "peer": 1, "nm": 0.9517,
                       "c": {"HF": {"n": 540, "err": 1.0731, "med": 0.9885, "flag": 1, "ratio": 0.0419}}}}

    def test_cms_rounds_half_up(self):
        self.assertEqual([hrrp.rnd(v, 4, half_up=True) for v in (0.15625, 0.98625, None)], [0.1563, 0.9863, None])
        self.assertEqual([hrrp.rnd(v, 4) for v in (0.15625, None)], [0.1562, None])

    def test_workbook_value_is_compared_as_excel_shows_it(self):
        v = 0.12344999999999999  # a different double from 0.12345; Excel shows it, to 15 digits, as 0.12345
        self.assertNotEqual(v, 0.12345)
        self.assertEqual(hrrp.rnd(v, 4, half_up=True), 0.1235)
        full = {"a": {**self.FULL["a"], "dual": v}}
        self.assertEqual(hrrp.precision_mismatches(full, {"a": {**self.PUBLISHED["a"], "dual": 0.1235}}), [])

    def test_to_fixed4_is_javascripts(self):
        # 1.02485 and 0.06145 are stored just above and below the tie; 0.03125 is an exact tie, which goes up.
        self.assertEqual([str(hrrp.to_fixed4(v)) for v in (1.02485, 0.06145, 0.03125, 1.0)],
                         ["1.0249", "0.0614", "0.0313", "1.0000"])

    def test_matching_tables_pass(self):
        self.assertEqual(hrrp.precision_mismatches(self.FULL, self.PUBLISHED), [])

    def test_mis_mapped_column_is_caught(self):
        hf = self.PUBLISHED["a"]["c"]["HF"]
        swapped = {"a": {**self.PUBLISHED["a"], "c": {"HF": {**hf, "err": hf["med"], "med": hf["err"]}}}}
        self.assertEqual(hrrp.precision_mismatches(self.FULL, swapped), [("a", "HF.err"), ("a", "HF.med")])
        self.assertEqual(hrrp.precision_mismatches(self.FULL, {}), [("a", "missing")])

    def test_stored_values_are_rounded_to_decimals(self):
        s = hrrp.as_stored("a", self.FULL["a"], self.PUBLISHED["a"], 0.951732, {"1": {"HF": 0.988462}})
        self.assertEqual((s["nm"], s["c"]["HF"]["med"], s["c"]["HF"]["err"], s["c"]["HF"]["n"]),
                         (0.951732, 0.988462, round(1.07309968120934, hrrp.DECIMALS), 540))

    def test_a_peer_group_missing_or_outside_1_to_5_names_the_hospital(self):
        absent = {k: v for k, v in self.FULL["a"].items() if k != "peer"}
        for peer, rec in ((None, {**self.FULL["a"], "peer": None}), (None, absent),
                          (0, {**self.FULL["a"], "peer": 0}), (6, {**self.FULL["a"], "peer": 6})):
            with self.subTest(peer=peer, absent=rec is absent), self.assertRaisesRegex(hrrp.HrrpError, f"^a: peer group {peer!r} is not one of 1-5$"):
                hrrp.as_stored("a", rec, self.PUBLISHED["a"], 0.951732, {"1": {"HF": 0.988462}})

    def test_a_value_without_a_published_value_names_its_label(self):
        with self.assertRaisesRegex(hrrp.HrrpError, "a HF.err has no published 4-decimal value"):
            hrrp.stored(1.0731, None, "a HF.err")

    def test_a_missing_published_record_condition_or_peer_median_names_the_hospital_and_field(self):
        peer = {"1": {"HF": 0.988462}}
        pub = self.PUBLISHED["a"]
        no_cond = {**pub, "c": {}}
        no_field = {**pub, "c": {"HF": {**pub["c"]["HF"], "err": None}}}
        for what, p, med, rx in (("record", None, peer, "a: no published record"),
                                 ("condition", no_cond, peer, "a HF: no published"),
                                 ("field", no_field, peer, "a HF.err has no published 4-decimal value"),
                                 ("median", pub, {"1": {}}, "a HF: peer 1 has no median")):
            with self.subTest(what), self.assertRaisesRegex(hrrp.HrrpError, rx):
                hrrp.as_stored("a", self.FULL["a"], p, 0.951732, med)

    def test_group_constants_are_checked_at_full_precision_then_stored_once(self):
        full = {"a": 0.95173218450771123, "b": 0.95173218450771123}
        self.assertEqual(hrrp.stored_constant(["a", "b"], full.get, lambda c: 0.9517, "nm"), 0.951732)
        ties = []
        self.assertEqual(hrrp.stored_constant(["a"], lambda c: 0.06145, lambda c: 0.0615, "peer 1 HF median", ties),
                         0.061450000001)
        self.assertEqual(ties, [("peer 1 HF median", 0.06145, 0.061450000001)])
        with self.assertRaisesRegex(hrrp.HrrpError, "peer 2 HF median is not constant"):
            hrrp.stored_constant(["a", "b"], {"a": 0.9885, "b": 0.98850001}.get, lambda c: 0.9885, "peer 2 HF median")
        with self.assertRaisesRegex(hrrp.HrrpError, "peer 3 AMI median is not constant: \\[\\]"):
            hrrp.stored_constant([], full.get, lambda c: 0.9517, "peer 3 AMI median")

    def test_needs_more_decimals(self):
        self.assertEqual((hrrp.DECIMALS, hrrp.MAX_DECIMALS), (6, 12))
        self.assertEqual(hrrp.stored(1.02484970123, 1.0248, "x"), 1.0248497)  # 1.02485 would print 1.0249
        self.assertEqual(hrrp.stored(0.06145012, 0.0615, "x"), 0.0614501)  # 0.06145 would print 0.0614
        self.assertEqual(hrrp.stored(1.07309968120934, 1.0731, "x"), 1.0731)
        self.assertIsNone(hrrp.stored(None, None, "x"))
        with self.assertRaisesRegex(hrrp.HrrpError, "a AMI.err: 1.0251 does not print as CMS's 1.0248"):
            hrrp.stored(1.0251, 1.0248, "a AMI.err")

    def test_exact_tie_moves_one_unit(self):
        # The double 0.06145 is 0.061449999...: Excel (15 digits) shows 0.06145 and CMS 0.0615, but every rounding of it
        # is 0.06145 again, which toFixed(4) prints 0.0614.
        self.assertEqual({round(0.06145, d) for d in range(hrrp.DECIMALS, hrrp.MAX_DECIMALS + 1)}, {0.06145})
        self.assertEqual(hrrp.rnd(0.06145, 4, half_up=True), 0.0615)
        # The move is one unit of the finest decimal (1e-12), the smallest that prints right, and is reported.
        ties = []
        v = hrrp.stored(0.06145, 0.0615, "peer 1 HF median", ties)
        self.assertEqual((v, str(hrrp.to_fixed4(v))), (0.061450000001, "0.0615"))
        self.assertEqual(ties, [("peer 1 HF median", 0.06145, 0.061450000001)])
        # The same just above a tie that CMS rounded down: 1.02484999999999 rounds to 1.02485, which prints 1.0249.
        v = hrrp.stored(1.02484999999999, 1.0248, "a HF.err", ties)
        self.assertEqual((v, str(hrrp.to_fixed4(v))), (1.024849999999, "1.0248"))
        self.assertEqual(ties[1], ("a HF.err", 1.02484999999999, 1.024849999999))
        # Plain rounding at any precision still wins over a move, and is not reported.
        self.assertEqual(hrrp.stored(0.06145012, 0.0615, "x", ties), 0.0614501)
        self.assertEqual(hrrp.stored(1.02484970123, 1.0248, "x", ties), 1.0248497)
        self.assertEqual(len(ties), 2)

    def test_plain_roundings_stop_at_the_first_that_prints_right(self):
        with mock.patch.object(hrrp, "to_fixed4", wraps=hrrp.to_fixed4) as spy:
            self.assertEqual(hrrp.stored(1.07309968120934, 1.0731, "x"), 1.0731)
        self.assertEqual(spy.call_count, 1)  # DECIMALS decimals already print right: no finer rounding is tried

    def test_replication_gate_names_every_hospital_and_both_causes(self):
        none = {"n": None, "err": None, "med": None, "flag": 0, "ratio": None}
        hf = {"n": 540, "err": 1.0731, "med": 0.9885, "flag": 1, "ratio": 0.0419}  # 0.9517 x 0.0419 x 0.0846 = 0.0034
        ok = {"paf": 0.9966, "nm": 0.9517, "c": {**{k: none for k in CONDITIONS}, "HF": hf}}
        hrrp.replication_gate({"a": ok})
        no_weight = {**ok, "c": {**ok["c"], "HF": {**hf, "ratio": None}}}  # flagged, CMS counted it, no weight published
        with self.assertRaises(hrrp.HrrpError) as e:
            hrrp.replication_gate({"a": ok, "b": no_weight, "c": no_weight})
        msg = str(e.exception)
        self.assertIn("2 hospitals: b, c.", msg)
        self.assertIn("DECIMALS", msg)
        self.assertIn("payment weight", msg)

    def test_extra_places_counts_values_stored_finer_than_decimals(self):
        hospitals = [{"c": {"HF": {"err": 1.0248497, "ratio": 0.0419}, "AMI": {"err": None, "ratio": None}}}]
        self.assertEqual(hrrp.extra_places(hospitals, {"1": {"HF": 0.988462}}, 0.951732), (1, 4))  # nm, one median, HF's err and ratio; AMI's None is not counted


class GateTest(unittest.TestCase):
    SUPP = {"a": {"paf": 0.9966}, "b": {"paf": 0.97}, "c": {"paf": 1.0}}

    def test_table15_agreeing_with_the_supplemental_file_is_clean(self):
        self.assertEqual(hrrp.table15_mismatches({"a": 0.9966, "b": 0.97, "c": 1.0}, self.SUPP), [])

    def test_table15_lists_hospitals_in_only_one_then_those_that_differ(self):
        t15 = {"a": 0.9965, "b": 0.97, "d": 1.0}
        self.assertEqual(hrrp.table15_mismatches(t15, self.SUPP), ["c", "d", "a"])

    def test_out_of_range(self):
        self.assertEqual(hrrp.out_of_range(self.SUPP), [])
        self.assertEqual(hrrp.out_of_range({**self.SUPP, "x": {"paf": 0.9699}, "y": {"paf": 1.0001}}), ["x", "y"])

    def test_a_blank_paf_is_out_of_range_and_a_table15_mismatch(self):
        self.assertEqual(hrrp.out_of_range({**self.SUPP, "x": {"paf": None}}), ["x"])
        self.assertEqual(hrrp.table15_mismatches({"a": None, "b": 0.97, "c": 1.0}, {**self.SUPP, "a": {"paf": 0.9966}}), ["a"])
        self.assertEqual(hrrp.table15_mismatches({"a": 0.9966, "b": 0.97, "c": 1.0}, {**self.SUPP, "a": {"paf": None}}), ["a"])
        self.assertEqual(hrrp.table15_mismatches({"a": None, "b": 0.97, "c": 1.0}, {**self.SUPP, "a": {"paf": None}}), ["a"])


class DollarCheckTest(unittest.TestCase):
    GOOD = {"asOf": "2026-10-11", "source": "Medicare cost reports", "costFy": 2024, "n": 2845, "rateDrift": 1.066,
            "within10": 73.4, "within15": 85.0, "within15Small": 73.7, "within15Large": 89.6, "note": "optional"}

    def check(self, rec):
        return hrrp.check_dollar_check(rec, 2027)

    def test_a_complete_record_is_returned_as_written(self):
        self.assertIs(self.check(self.GOOD), self.GOOD)
        self.assertEqual(self.check({**self.GOOD, "within15": 85, "within10": 0, "within15Large": 100, "rateDrift": 2})["within15"], 85)
        self.assertEqual(self.check({k: v for k, v in self.GOOD.items() if k != "note"})["n"], 2845)  # note is optional
        self.assertEqual(self.check({**self.GOOD, "costFy": 2027})["costFy"], 2027)

    def test_the_cost_year_may_not_pass_the_fiscal_year(self):
        with self.assertRaisesRegex(hrrp.HrrpError, "costFy should be a fiscal year from 2013 to 2026, not 2027"):
            hrrp.check_dollar_check({**self.GOOD, "costFy": 2027}, 2026)

    def test_dollar_check_names_each_bad_field(self):
        rec = {k: v for k, v in self.GOOD.items() if k not in ("within15Large", "asOf")}
        with self.assertRaises(hrrp.HrrpError) as e:
            self.check({**rec, "n": 0, "rateDrift": 106.6})
        msg = str(e.exception)
        self.assertIn("asOf is missing; ", msg)
        self.assertIn("n should be a positive integer, not 0", msg)
        self.assertIn("rateDrift should be a number between 0.5 and 2, not 106.6", msg)
        self.assertIn("within15Large is missing.", msg)
        self.assertIn("update it by hand when that comparison is redone", msg)
        self.assertNotIn("within10", msg)
        with self.assertRaisesRegex(hrrp.HrrpError, "asOf is missing; source is missing; costFy is missing"):
            self.check([])
        self.assertEqual(set(hrrp.DOLLAR_CHECK_FIELDS), {k for k in self.GOOD if k != "note"})
        self.assertEqual(tuple(hrrp._dollar_check_rules(2027)), hrrp.DOLLAR_CHECK_FIELDS)

    def test_the_guidance_is_dated_by_the_records_own_as_of(self):
        with self.assertRaisesRegex(hrrp.HrrpError, r"n is missing\. It is a dated result of the 2027-03-02 cost-report comparison "):
            self.check({**{k: v for k, v in self.GOOD.items() if k != "n"}, "asOf": "2027-03-02"})
        with self.assertRaisesRegex(hrrp.HrrpError, r"\. It is a dated result of the cost-report comparison "):
            self.check({**self.GOOD, "asOf": "Oct 2026"})
        with self.assertRaises(hrrp.HrrpError) as e:
            self.check({**self.GOOD, "n": 0})
        self.assertNotIn("October 2026", str(e.exception))

    def test_a_malformed_field_is_named(self):
        for field, bad, want in [("asOf", "Oct 2026", "a YYYY-MM-DD date"), ("asOf", "2026-02-30", "a YYYY-MM-DD date"),
                                 ("source", "", "a non-empty string"), ("source", 7, "a non-empty string"),
                                 ("costFy", "2024", "a fiscal year"), ("costFy", 2024.0, "a fiscal year"),
                                 ("costFy", True, "a fiscal year"), ("costFy", 24, "a fiscal year"),
                                 ("n", None, "a positive integer"), ("n", 2845.0, "a positive integer"),
                                 ("n", -3, "a positive integer"), ("n", True, "a positive integer"),
                                 ("rateDrift", "1.066", "a number between 0.5 and 2"),
                                 ("rateDrift", 0.49, "a number between 0.5 and 2"), ("rateDrift", 2.01, "a number between 0.5 and 2"),
                                 ("within15", True, "a percentage between 0 and 100"),
                                 ("within10", float("nan"), "a percentage between 0 and 100"),
                                 ("within10", -0.1, "a percentage between 0 and 100"),
                                 ("within15", 100.5, "a percentage between 0 and 100"),
                                 ("within15Small", 737, "a percentage between 0 and 100"),
                                 ("within15Large", float("inf"), "a percentage between 0 and 100")]:
            with self.subTest(field=field, bad=bad), self.assertRaisesRegex(hrrp.HrrpError, f"{field} should be {re.escape(want)}.*, not {re.escape(repr(bad))}"):
                self.check({**self.GOOD, field: bad})


class ProgramFieldsTest(unittest.TestCase):
    # CMS's tab-delimited export rounds to 4 decimals, so a record as stored carries whatever as_stored wrote.
    S = {"paf": 0.9966, "dual": 0.15625, "peer": 4,
         "c": {"AMI": {"n": 42, "err": 1.0259, "flag": 1, "ratio": 0.0648, "med": 0.997},
               "HF": {"n": 22, "err": 1.0783, "flag": 0, "ratio": 0.05, "med": 1.0077},
               "PN": {"n": None, "err": None, "flag": 0, "ratio": None, "med": 1.0021},
               "CABG": {"n": 0, "err": None, "flag": 0, "ratio": None, "med": 1.0093}}}
    IMP = {"cases": 1000, "cmi": 1.5, "wi": 1.1, "cola": 1.0, "qual_red": False, "ehr_red": False, "hsp": None}
    FEDERAL = 1000 * 1.5 * (4000.0 * 1.1 + 2000.0)

    def test_fields_are_the_hrrp_part_of_the_record(self):
        fields, addon = hrrp.program_fields(self.S, self.IMP, ["RRC"], RATES, 0.25)
        self.assertIsNone(addon)
        self.assertEqual(list(fields), ["paf", "red", "dual", "peer", "base", "pen", "c"])
        self.assertEqual((fields["paf"], fields["red"], fields["dual"], fields["peer"]), (0.9966, 0.34, 0.1563, 4))
        self.assertEqual(fields["base"], round(self.FEDERAL))
        self.assertEqual(fields["pen"], round(self.FEDERAL * (1 - 0.9966)))
        self.assertEqual(fields["c"]["AMI"], {"n": 42, "err": 1.0259, "flag": 1, "ratio": 0.0648})  # med is dropped
        self.assertEqual(fields["c"]["HF"]["n"], 22)
        self.assertEqual(sorted(fields["c"]), ["AMI", "CABG", "HF"])  # PN has neither n nor err; CABG has n = 0

    def test_no_impact_record_leaves_the_dollars_none(self):
        fields, addon = hrrp.program_fields(self.S, {}, ["MDH"], RATES, 0.25)
        self.assertEqual((fields["base"], fields["pen"], addon), (None, None, None))

    def test_an_mdh_base_includes_the_add_on_and_the_triple_is_reported(self):
        imp = {**self.IMP, "hsp": 10_000.0}
        fields, addon = hrrp.program_fields(self.S, imp, ["MDH", "RRC"], RATES, 0.25)
        excess = 10_000.0 * 1.5 * 1000 - self.FEDERAL
        self.assertGreater(excess, 0)
        want = (self.FEDERAL, 0.75 * excess * 0.25, 0.75 * excess)
        for got, exp in zip(addon, want):
            self.assertAlmostEqual(got, exp, places=4)
        self.assertEqual(fields["base"], round(self.FEDERAL + want[1]))
        self.assertEqual(fields["pen"], round((self.FEDERAL + want[1]) * (1 - 0.9966)))

    def test_a_hospital_that_is_not_an_mdh_gets_no_add_on_even_with_an_hsp_rate(self):
        fields, addon = hrrp.program_fields(self.S, {**self.IMP, "hsp": 10_000.0}, ["SCH"], RATES, 0.25)
        self.assertIsNone(addon)
        self.assertEqual(fields["base"], round(self.FEDERAL))

    def test_a_hospital_with_no_penalty_has_a_zero_penalty(self):
        fields, _ = hrrp.program_fields({**self.S, "paf": 1.0}, self.IMP, [], RATES, 0.25)
        self.assertEqual((fields["red"], fields["pen"]), (0.0, 0))


if __name__ == "__main__":
    unittest.main()
