"""The dollar estimate run over every hospital in the pinned FY2026 impact file: it prices them all, and nothing comes
out non-finite or negative where it cannot be. (The national totals and back-tests are separate checks.)"""
import math
import unittest

from pp_engine.dollars import estimate
from pp_pipeline.ipps_pins import payment_inputs, rates

PARTS = ("fed", "mdh_addon", "ime", "dsh", "outlier_op", "sch_diff", "low_volume", "capital", "uc")


class EveryHospitalOnThePin(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.estimates = {ccn: estimate(h, rates(), hrrp=1.0, vbp=1.0, cut=False) for ccn, h in payment_inputs().items()}

    def test_every_hospital_is_priced(self):
        self.assertEqual(len(self.estimates), 3103)
        for ccn, e in self.estimates.items():
            self.assertTrue(all(math.isfinite(v) for v in e.values()), ccn[:2])

    def test_each_part_is_not_negative_and_every_hospital_has_a_federal_payment(self):
        for ccn, e in self.estimates.items():
            self.assertGreater(e["fed"], 0, ccn[:2])
            self.assertTrue(all(e[k] >= 0 for k in PARTS), ccn[:2])

    def test_t_is_b_plus_the_other_parts_and_nothing_moves_without_a_factor_or_a_cut(self):
        for ccn, e in self.estimates.items():
            self.assertAlmostEqual(e["total"], e["base"] + sum(e[k] for k in PARTS[2:]), places=4, msg=ccn[:2])
            self.assertEqual((e["hrrp"], e["hvbp"], e["hac"], e["net"]), (0.0, 0.0, 0.0, 0.0), ccn[:2])
            self.assertEqual(e["after"], e["total"])
            self.assertAlmostEqual(e["at_stake"], 0.01 * e["total"], places=6)
