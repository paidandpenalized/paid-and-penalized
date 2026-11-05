"""Steps 1 to 4 and the roll-ups (pp_engine.medicaid.exposure, rollup), on synthetic hospital-year rows with invented
CCNs."""
import unittest

from pp_engine.medicaid import exposure, params, rollup
from pp_engine.medicaid.exposure import ExposureError


def hcris_row(**over):
    """A synthetic tidy-table row: a full-year settled report with round numbers."""
    row = {"ccn": "990001", "shape": "one", "status": "2", "period_begin": "2023-01-01", "period_end": "2023-12-31",
           "period_days": "365", "medicaid_net_revenue": "10000000", "medicaid_supplemental": "2000000",
           "medicaid_cost": "15000000", "net_patient_revenue": "100000000", "net_income_patients": "2000000",
           "net_income": "5000000", "other_income": "4000000", "uncompensated_cost": "6000000"}
    row.update(over)
    return row


class Base(unittest.TestCase):
    def test_status_labels(self):
        self.assertEqual(exposure.status_label("2"), "settled")
        self.assertEqual(exposure.status_label("3 4"), "settled")
        self.assertEqual(exposure.status_label("2 1"), "as filed")
        self.assertEqual(exposure.status_label("5"), "as filed")
        with self.assertRaises(ExposureError):
            exposure.status_label("")

    def test_a_full_year_is_left_as_filed(self):
        b = exposure.hospital_base(hcris_row())
        self.assertEqual((b["factor"], b["flags"], b["status"]), (1.0, [], "settled"))
        self.assertAlmostEqual(b["cost_ratio"], 1.5)
        self.assertAlmostEqual(b["cost_ratio_line2_5"], 1.25)
        self.assertEqual(b["revenue_line2_5"], 12000000.0)

    def test_long_and_short_periods_are_annualized(self):
        b = exposure.hospital_base(hcris_row(period_days="730", shape="long"))
        self.assertEqual(b["factor"], 0.5)
        self.assertEqual(b["medicaid_net_revenue"], 5000000.0)
        self.assertEqual(b["flags"], ["annualized"])
        self.assertAlmostEqual(b["cost_ratio"], 1.5)  # ratios don't move
        short = exposure.hospital_base(hcris_row(period_days="73"))
        self.assertEqual(short["factor"], 5.0)
        self.assertEqual(short["flags"], ["annualized", "short_period"])
        self.assertEqual(exposure.annual_factor(366), 1.0)
        with self.assertRaises(ExposureError):
            exposure.annual_factor(0)

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
        self.assertAlmostEqual(r["operating_margin"], 0.02)
        npr_after = 100000000 - 1000000 + 1500000 * 0.07
        self.assertAlmostEqual(r["operating_margin_after"], (2000000 + income) / npr_after)
        self.assertAlmostEqual(r["total_margin"], 5000000 / 104000000)
        self.assertAlmostEqual(r["total_margin_after"], (5000000 + income) / (npr_after + 4000000))
        self.assertAlmostEqual(r["uncompensated_change"], 1500000 * 0.93 * 0.56 / 6000000)
        self.assertAlmostEqual(exposure.margin_change(r), (r["operating_margin_after"] - 0.02) * 100)

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

    def test_inconsistent_inputs_are_not_scored(self):
        b = exposure.hospital_base(hcris_row(net_patient_revenue="9000000"))
        self.assertFalse(b["scored"])
        self.assertEqual(exposure.scenario(b, 0.25, 0.4)["lost"], 0.0)
        self.assertTrue(self.base["scored"])

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
        self.assertAlmostEqual(t["total_margin"], 5100000 / 124000000)
        self.assertAlmostEqual(t["uncompensated_change"], (ra["added_uncompensated"] * 2) / 12000000)
        self.assertEqual(t["into_red"], 1)  # b's total margin goes from 0.5% to below zero
        self.assertTrue(rollup.into_red(rb))
        self.assertFalse(rollup.into_red(ra))

    def test_margin_outliers_stay_in_dollars_but_not_margins(self):
        a = exposure.hospital_base(hcris_row())
        b = exposure.hospital_base(hcris_row(ccn="990002"))
        b["margin_outlier"] = True
        t = rollup.roll_up([(a, exposure.scenario(a, 0.25, 0.4)), (b, exposure.scenario(b, 0.25, 0.4))])
        self.assertEqual((t["hospitals"], t["margin_hospitals"]), (2, 1))
        self.assertAlmostEqual(t["lost"], 2000000)
        self.assertAlmostEqual(t["net_patient_revenue"], 100000000)

    def test_empty(self):
        t = rollup.roll_up([])
        self.assertEqual(t["hospitals"], 0)
        self.assertIsNone(t["operating_margin"])
        self.assertIsNone(t["uncompensated_change"])


if __name__ == "__main__":
    unittest.main()
