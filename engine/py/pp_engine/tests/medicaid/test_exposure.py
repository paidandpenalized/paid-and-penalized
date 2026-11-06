"""Steps 1 to 4 and the roll-ups (pp_engine.medicaid.exposure, rollup), on synthetic hospital-year rows with invented
CCNs."""
import unittest

from pp_engine.medicaid import exposure, params, rollup
from pp_engine.medicaid.exposure import ExposureError


def hcris_row(**over):
    """A synthetic tidy-table row: a full-year settled report with round numbers."""
    row = {"ccn": "990001", "shape": "one", "status": "2", "status_label": "settled", "period_begin": "2023-01-01",
           "period_end": "2023-12-31", "period_days": "365", "medicaid_net_revenue": "10000000", "medicaid_supplemental": "2000000",
           "medicaid_cost": "15000000", "net_patient_revenue": "100000000", "net_income_patients": "2000000",
           "net_income": "5000000", "other_income": "4000000", "uncompensated_cost": "6000000",
           "medicaid_days_all": "1000"}
    row.update(over)
    return row


class Base(unittest.TestCase):
    def test_the_layer_status_label_is_used(self):
        self.assertEqual(exposure.hospital_base(hcris_row(status="4", status_label="settled"))["status"], "settled")
        self.assertEqual(exposure.hospital_base(hcris_row(status="5", status_label="as filed"))["status"], "as filed")
        with self.assertRaises(ExposureError):
            exposure.hospital_base(hcris_row(status_label=""))

    def test_a_full_year_is_left_as_filed(self):
        b = exposure.hospital_base(hcris_row())
        self.assertEqual((b["flags"], b["status"], b["scored"], b["scored_line2_5"]), ([], "settled", True, True))
        self.assertAlmostEqual(b["cost_ratio"], 1.5)
        self.assertAlmostEqual(b["cost_ratio_line2_5"], 1.25)
        self.assertEqual(b["revenue_line2_5"], 12000000.0)

    def test_nothing_is_annualized_a_part_year_is_flagged(self):
        b = exposure.hospital_base(hcris_row(period_days="200", shape="long"))  # the layer's fullest report
        self.assertEqual(b["medicaid_net_revenue"], 10000000.0)  # as filed
        self.assertIn("part_year", b["flags"])
        self.assertNotIn("part_year", exposure.hospital_base(hcris_row(period_days="360"))["flags"])
        with self.assertRaises(ExposureError):
            exposure.hospital_base(hcris_row(period_days="0"))

    def test_flags_for_missing_or_odd_cells(self):
        self.assertIn("no_medicaid_revenue", exposure.hospital_base(hcris_row(medicaid_net_revenue=""))["flags"])
        self.assertIn("negative_medicaid_revenue",
                      exposure.hospital_base(hcris_row(medicaid_net_revenue="-5"))["flags"])
        nocost = exposure.hospital_base(hcris_row(medicaid_cost=""))
        self.assertEqual((nocost["cost_ratio"], nocost["flags"]), (1.0, ["cost_missing"]))
        capped = exposure.hospital_base(hcris_row(medicaid_cost="90000000"))
        self.assertEqual((capped["cost_ratio"], capped["flags"]), (params.MAX_COST_RATIO, ["cost_ratio_capped"]))
        self.assertIn("no_margin", exposure.hospital_base(hcris_row(net_patient_revenue="0"))["flags"])
        self.assertIn("medicaid_exceeds_patient_revenue",
                      exposure.hospital_base(hcris_row(net_patient_revenue="9000000"))["flags"])
        self.assertIn("no_uncompensated_cost", exposure.hospital_base(hcris_row(uncompensated_cost=""))["flags"])


class HospitalShare(unittest.TestCase):
    def days(self, routine, ld, maternity):
        return exposure.hospital_base(hcris_row(medicaid_days_all=routine, days_medicaid_labor_delivery=ld,
                                                medicaid_days_maternity=maternity))

    def test_medicaid_days_add_labor_and_delivery_and_split_out_maternity(self):
        self.assertEqual(exposure.medicaid_days(self.days("900", "100", "300")), (1000.0, 700.0))
        self.assertIsNone(exposure.medicaid_days(self.days("", "", "")))
        self.assertIsNone(exposure.medicaid_days(self.days("", "50", "50")))  # labor and delivery alone: a gap
        self.assertEqual(exposure.medicaid_days(self.days("10", "", "10")), (10.0, 0.0))  # all maternity
        self.assertIsNone(exposure.medicaid_days(self.days("10", "", "40")))  # more maternity than all: a gap

    def test_the_factor_is_the_hospitals_share_over_its_states(self):
        a, b = self.days("900", "100", "300"), self.days("1000", "", "")  # 70% and 100% non-maternity
        ratio = exposure.nonmaternity_ratio([a, b, self.days("", "", "")])
        self.assertAlmostEqual(ratio, 1700 / 2000)
        self.assertAlmostEqual(exposure.share_factor(a, ratio), 0.7 / 0.85)
        self.assertAlmostEqual(exposure.share_factor(b, ratio), 1 / 0.85)
        self.assertEqual(exposure.share_factor(self.days("", "", ""), ratio), 1.0)  # no days: the state's share
        self.assertIn("no_medicaid_days", self.days("", "", "")["flags"])
        self.assertEqual(exposure.share_factor(a, None), 1.0)
        self.assertIsNone(exposure.nonmaternity_ratio([]))

    def test_too_few_medicaid_days_keep_the_states_share(self):
        floor = params.MIN_MEDICAID_DAYS
        few = self.days(str(floor - 1), "", str(floor - 1))  # all maternity, but too few days to say so
        enough = self.days(str(floor), "", str(floor // 2))  # half maternity, at the floor
        self.assertEqual(exposure.share_factor(few, 0.9), 1.0)
        self.assertIn("few_medicaid_days", few["flags"])
        self.assertAlmostEqual(exposure.share_factor(enough, 0.9), 0.5 / 0.9)
        self.assertNotIn("few_medicaid_days", enough["flags"])
        self.assertAlmostEqual(exposure.nonmaternity_ratio([few, enough]), (0 + floor / 2) / (2 * floor - 1))

    def test_the_share_is_capped_at_one(self):
        self.assertAlmostEqual(exposure.hospital_share(0.3, 0.5), 0.15)
        self.assertEqual(exposure.hospital_share(0.95, 1.1), 1.0)
        self.assertIsNone(exposure.hospital_share(None, 1.2))


class LinesTwoAndFive(unittest.TestCase):
    def test_lines_2_and_5_above_patient_revenue_leave_that_comparison_only(self):
        b = exposure.hospital_base(hcris_row(medicaid_net_revenue="60000000", medicaid_supplemental="50000000"))
        self.assertIn("medicaid_2_5_exceeds_patient_revenue", b["flags"])
        self.assertEqual((b["scored"], b["scored_line2_5"]), (True, False))
        self.assertEqual(exposure.revenue_at_risk(b, 0.25), 15000000)
        self.assertEqual(exposure.revenue_at_risk(b, 0.25, line2_5=True), 0.0)

    def test_a_scenario_that_leaves_no_operating_revenue_is_not_a_one_point_fall(self):
        b = exposure.hospital_base(hcris_row(other_operating_income="-99000000"))  # 1M of operating revenue
        r = exposure.scenario(b, 0.5, 0.5)
        self.assertIsNone(r["operating_margin_after"])
        self.assertIsNone(exposure.margin_change(r))
        out = rollup.roll_up([(b, r)])
        self.assertEqual(out["falls_1pp"], 0)


class Scenario(unittest.TestCase):
    def setUp(self):
        self.base = exposure.hospital_base(hcris_row())

    def test_steps_one_to_four_by_hand(self):
        r = exposure.scenario(self.base, 0.25, 0.4)
        self.assertAlmostEqual(r["at_risk"], 2500000)  # 10M x 0.25
        self.assertAlmostEqual(r["lost"], 1000000)  # x 0.4
        self.assertAlmostEqual(r["lost_cost"], 1500000)  # x 1.5
        self.assertAlmostEqual(r["added_uncompensated"], 1500000 * 0.93 * 0.56)
        self.assertAlmostEqual(r["care_avoided"], 1500000 * 0.93 * 0.44)
        self.assertAlmostEqual(r["other_coverage"], 1500000 * 0.07)
        income = -1000000 + 1500000 * (1 - 0.93 * 0.56)
        self.assertAlmostEqual(r["income_change"], income)
        self.assertAlmostEqual(r["operating_margin"], 0.02)  # no lines 8 to 22: the patient margin
        npr_after = 100000000 - 1000000 + 1500000 * 0.07
        self.assertAlmostEqual(r["operating_margin_after"], (2000000 + income) / npr_after)
        self.assertAlmostEqual(r["total_margin"], 5000000 / 104000000)
        self.assertAlmostEqual(r["total_margin_after"], (5000000 + income) / (npr_after + 4000000))
        self.assertAlmostEqual(r["uncompensated_change"], 1500000 * 0.93 * 0.56 / 6000000)
        self.assertAlmostEqual(exposure.margin_change(r), (r["operating_margin_after"] - 0.02) * 100)

    def test_the_operating_margin_counts_lines_8_to_22(self):
        b = exposure.hospital_base(hcris_row(other_operating_income="1000000", patient_margin="0.02"))
        self.assertAlmostEqual(b["patient_margin"], 0.02)  # the layer's column, read as is
        self.assertAlmostEqual(exposure.operating_margin(b), 3000000 / 101000000)
        r = exposure.scenario(b, 0.25, 0.4)
        npr_after = 100000000 - r["lost"] + r["other_coverage"]
        self.assertAlmostEqual(r["operating_margin_after"], (3000000 + r["income_change"]) / (npr_after + 1000000))
        self.assertAlmostEqual(r["total_margin"], 5000000 / 104000000)  # line 25 already holds lines 8 to 22

    def test_the_use_multiple_scales_dollars_proportionally(self):
        one, more = exposure.scenario(self.base, 0.25, 0.4), exposure.scenario(self.base, 0.25, 0.4, use=1.25)
        for k in ("lost", "added_uncompensated", "income_change"):
            self.assertAlmostEqual(more[k], one[k] * 1.25)
        with self.assertRaises(ExposureError):
            exposure.scenario(self.base, 0.25, 0.4, use=1.5)
        with self.assertRaises(ExposureError):
            exposure.scenario(self.base, 0.25, -0.1)
        with self.assertRaises(ExposureError):
            exposure.scenario(self.base, 1.2, 0.1)

    def test_lines_2_and_5_base(self):
        r = exposure.scenario(self.base, 0.25, 0.4, line2_5=True)
        self.assertAlmostEqual(r["lost"], 12000000 * 0.25 * 0.4)
        self.assertAlmostEqual(r["lost_cost"], 15000000 * 0.25 * 0.4)  # the same patients' cost either way

    def test_no_share_or_no_revenue_means_no_exposure(self):
        for base, share in ((self.base, None), (exposure.hospital_base(hcris_row(medicaid_net_revenue="")), 0.3),
                            (exposure.hospital_base(hcris_row(medicaid_net_revenue="-9")), 0.3)):
            r = exposure.scenario(base, share, 0.4)
            self.assertEqual((r["lost"], r["added_uncompensated"], r["income_change"]), (0.0, 0.0, 0.0))
            if base["has_margin"]:
                self.assertAlmostEqual(r["operating_margin_after"], r["operating_margin"])

    def test_a_blank_line_2_is_scored_for_lines_2_and_5(self):
        b = exposure.hospital_base(hcris_row(medicaid_net_revenue=""))
        self.assertTrue(b["scored"])
        self.assertEqual(exposure.scenario(b, 0.25, 0.4)["lost"], 0.0)
        self.assertAlmostEqual(exposure.scenario(b, 0.25, 0.4, line2_5=True)["lost"], 2000000 * 0.25 * 0.4)

    def test_negative_uncompensated_care_gives_no_percent(self):
        b = exposure.hospital_base(hcris_row(uncompensated_cost="-5"))
        self.assertIn("negative_uncompensated_cost", b["flags"])
        self.assertIsNone(exposure.scenario(b, 0.25, 0.4)["uncompensated_change"])
        self.assertIsNone(rollup.roll_up([(b, exposure.scenario(b, 0.25, 0.4))])["uncompensated_change"])

    def test_inconsistent_inputs_are_not_scored(self):
        b = exposure.hospital_base(hcris_row(net_patient_revenue="9000000"))
        self.assertEqual((b["scored"], b["scored_line2_5"]), (False, False))
        self.assertEqual(exposure.scenario(b, 0.25, 0.4)["lost"], 0.0)
        self.assertTrue(self.base["scored"])

    def test_the_filing_error_screens_run_without_a_usable_margin(self):
        for over in ({"net_income_patients": ""},  # no line 5
                     {"other_operating_income": "-200"}):  # no operating revenue left
            with self.subTest(**over):
                b = exposure.hospital_base(hcris_row(medicaid_net_revenue="200", net_patient_revenue="100",
                                                     medicaid_supplemental="", **over))
                self.assertFalse(b["has_margin"])
                self.assertIn("no_margin", b["flags"])
                self.assertIn("medicaid_exceeds_patient_revenue", b["flags"])
                self.assertEqual((b["scored"], b["scored_line2_5"]), (False, False))
                self.assertEqual(exposure.scenario(b, 0.25, 0.4)["lost"], 0.0)
        b25 = exposure.hospital_base(hcris_row(medicaid_net_revenue="60", medicaid_supplemental="50",
                                               net_patient_revenue="100", net_income_patients=""))
        self.assertIn("medicaid_2_5_exceeds_patient_revenue", b25["flags"])
        self.assertEqual((b25["scored"], b25["scored_line2_5"]), (True, False))

    def test_no_patient_revenue_no_screen(self):
        for npr in ("", "0", "-5"):
            with self.subTest(npr=npr):
                b = exposure.hospital_base(hcris_row(net_patient_revenue=npr))
                self.assertEqual((b["scored"], b["scored_line2_5"]), (True, True))
                self.assertNotIn("medicaid_exceeds_patient_revenue", b["flags"])

    def test_margin_fence(self):
        lo, hi = exposure.margin_fence([0.0, 0.01, 0.02, 0.03, 0.04, None])
        self.assertLess(lo, 0.0)
        self.assertGreater(hi, 0.04)
        with self.assertRaises(ExposureError):
            exposure.margin_fence([0.1, None])

    def test_flag_margin_outliers(self):
        bases = [exposure.hospital_base(hcris_row(ccn=f"99000{i}", net_income_patients=str(v)))
                 for i, v in enumerate((1000000, 2000000, 3000000, -90000000))]
        exposure.flag_margin_outliers(bases, fence=(-0.5, 0.5))
        self.assertEqual([b["margin_outlier"] for b in bases], [False, False, False, True])
        self.assertIn("margin_outlier", bases[3]["flags"])
        self.assertAlmostEqual(exposure.operating_margin(bases[0]), 0.01)
        self.assertIsNone(exposure.operating_margin(exposure.hospital_base(hcris_row(net_patient_revenue=""))))

    def test_no_margin_when_lines_8_to_22_leave_no_operating_revenue(self):
        b = exposure.hospital_base(hcris_row(net_patient_revenue="1000000", other_operating_income="-1000000"))
        self.assertIn("no_margin", b["flags"])
        self.assertIsNone(exposure.scenario(b, 0.25, 0.4)["operating_margin_after"])

    def test_no_margin_without_patient_revenue(self):
        r = exposure.scenario(exposure.hospital_base(hcris_row(net_patient_revenue="")), 0.25, 0.4)
        self.assertIsNone(r["operating_margin_after"])
        self.assertIsNone(exposure.margin_change(r))


class RollUp(unittest.TestCase):
    def test_dollars_add_and_margins_come_from_the_sums(self):
        a = exposure.hospital_base(hcris_row())
        b = exposure.hospital_base(hcris_row(ccn="990002", net_income="100000", net_patient_revenue="20000000",
                                             net_income_patients="-1000000", other_income="0"))
        ra, rb = exposure.scenario(a, 0.25, 0.4), exposure.scenario(b, 0.25, 0.4)
        t = rollup.roll_up([(a, ra), (b, rb)])
        self.assertEqual((t["hospitals"], t["exposed"], t["margin_hospitals"]), (2, 2, 2))
        self.assertAlmostEqual(t["lost"], ra["lost"] + rb["lost"])
        self.assertAlmostEqual(t["operating_margin"], 1000000 / 120000000)
        self.assertAlmostEqual(t["net_patient_revenue"], 120000000)
        self.assertAlmostEqual(t["total_margin"], 5100000 / 124000000)
        self.assertAlmostEqual(t["uncompensated_change"], (ra["added_uncompensated"] * 2) / 12000000)
        self.assertEqual(t["into_red"], 1)  # b's total margin goes from 0.5% to below zero
        self.assertTrue(rollup.into_red(rb))
        self.assertFalse(rollup.into_red(ra))

    def test_operating_margin_sums_add_lines_8_to_22_to_both_sides(self):
        a = exposure.hospital_base(hcris_row(other_operating_income="5000000"))
        t = rollup.roll_up([(a, exposure.scenario(a, 0.0, 0.0))])
        self.assertAlmostEqual(t["operating_margin"], 7000000 / 105000000)
        self.assertAlmostEqual(t["net_patient_revenue"], 100000000)

    def test_margin_outliers_stay_in_dollars_but_not_margins(self):
        a = exposure.hospital_base(hcris_row())
        b = exposure.hospital_base(hcris_row(ccn="990002"))
        b["margin_outlier"] = True
        t = rollup.roll_up([(a, exposure.scenario(a, 0.25, 0.4)), (b, exposure.scenario(b, 0.25, 0.4))])
        self.assertEqual((t["hospitals"], t["margin_hospitals"]), (2, 1))
        self.assertAlmostEqual(t["lost"], 2000000)
        self.assertAlmostEqual(t["net_patient_revenue"], 100000000)

    def test_an_operating_margin_counts_without_net_income(self):
        b = exposure.hospital_base(hcris_row(net_income="", net_patient_revenue="20000000"))
        t = rollup.roll_up([(b, exposure.scenario(b, 0.25, 0.9))])
        self.assertEqual((t["margin_hospitals"], t["falls_1pp"], t["into_red"]), (1, 1, 0))
        self.assertIsNotNone(t["operating_margin_after"])
        self.assertIsNone(t["total_margin"])

    def test_the_lines_2_and_5_roll_up_divides_by_lines_2_and_5_of_its_own_hospitals(self):
        a = exposure.hospital_base(hcris_row())  # lines 2 + 5: 12M
        b = exposure.hospital_base(hcris_row(ccn="990002", medicaid_net_revenue="60000000",
                                             medicaid_supplemental="50000000"))  # out of the lines 2 + 5 comparison
        line2 = rollup.roll_up([(x, exposure.scenario(x, 0.25, 0.4)) for x in (a, b)])
        self.assertAlmostEqual(line2["medicaid_revenue"], 70000000)
        self.assertAlmostEqual(line2["lost_share_of_medicaid"], 0.25 * 0.4)
        both = rollup.roll_up([(x, exposure.scenario(x, 0.25, 0.4, line2_5=True)) for x in (a, b)], line2_5=True)
        self.assertAlmostEqual(both["medicaid_revenue"], 12000000)
        self.assertAlmostEqual(both["lost"], 12000000 * 0.25 * 0.4)
        self.assertAlmostEqual(both["lost_share_of_medicaid"], 0.25 * 0.4)

    def test_empty(self):
        t = rollup.roll_up([])
        self.assertEqual(t["hospitals"], 0)
        self.assertIsNone(t["operating_margin"])
        self.assertIsNone(t["uncompensated_change"])


if __name__ == "__main__":
    unittest.main()
