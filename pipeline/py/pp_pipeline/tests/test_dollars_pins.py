"""The dollar estimate run over every hospital in the pinned FY2026 impact file: it prices them all, and nothing comes
out non-finite or negative where it cannot be. (The national totals and back-tests are separate checks.)"""
import math
import unittest

from pp_engine.dollars import PARTS, estimate, hospital_row
from pp_engine.tests.fixtures import assert_adds_up
from pp_pipeline.ipps_pins import hrrp_factors, payment_inputs, rates, vbp_factors


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

    def test_nothing_moves_without_a_factor_or_a_cut(self):
        for ccn, e in self.estimates.items():
            self.assertEqual((e["hrrp"], e["hvbp"], e["hac"], e["net"]), (0.0, 0.0, 0.0, 0.0), ccn[:2])
            self.assertEqual(e["after"], e["total"])
            self.assertAlmostEqual(e["at_stake"], 0.01 * e["total"], places=6)


class EveryRowAddsUp(unittest.TestCase):
    """The whole-dollar rows built from the pins, for a hospital CMS cuts and for one it does not: every row adds up
    exactly. (Forcing `cut` both ways puts the HAC cut on every hospital, which the committed file does not.)"""

    def test_every_row_adds_up(self):
        inputs, table, hrrp, vbp = payment_inputs(), rates(), hrrp_factors(), vbp_factors()
        for cut in (False, True):
            rows = [hospital_row(ccn, "VA", h, table, hrrp=hrrp.get(ccn), vbp=vbp.get(ccn), cut=cut, parhm=frozenset())
                    for ccn, h in inputs.items()]
            estimated = [r for r in rows if r["status"] == "estimated"]
            self.assertGreater(len(estimated), 3000)
            for r in estimated:
                assert_adds_up(self, r, r["ccn"][:2])
