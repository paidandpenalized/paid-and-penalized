"""The dollar estimate run over every hospital in the pinned FY2026 impact file: it prices them all, and nothing comes
out non-finite or negative where it cannot be. (The national totals and back-tests are separate checks.)"""
import math
import unittest

from pp_engine.dollars import estimate, hospital_row, national
from pp_pipeline.ipps_pins import hrrp_factors, payment_inputs, rates, vbp_factors

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


class EveryRowAddsUp(unittest.TestCase):
    """The whole-dollar rows built from the pins: every sum is exactly the sum of its parts, for a hospital CMS cuts
    and for one it does not, and so is every column total."""

    @classmethod
    def setUpClass(cls):
        inputs, table, hrrp, vbp = payment_inputs(), rates(), hrrp_factors(), vbp_factors()
        cls.rows = {cut: [hospital_row(ccn, "VA", h, table, hrrp=hrrp.get(ccn), vbp=vbp.get(ccn), cut=cut,
                                       parhm=frozenset()) for ccn, h in inputs.items()] for cut in (False, True)}

    def test_every_row_adds_up(self):
        for cut, rows in self.rows.items():
            estimated = [r for r in rows if r["status"] == "estimated"]
            self.assertGreater(len(estimated), 3000)
            for r in estimated:
                self.assertTrue(all(type(r[k]) is int for k in PARTS + ("base", "total", "hrrp", "hvbp", "after",
                                                                         "at_stake", "hac", "net")), r["ccn"][:2])
                self.assertEqual(r["base"], r["fed"] + r["mdh_addon"], r["ccn"][:2])
                self.assertEqual(r["total"], r["base"] + sum(r[k] for k in PARTS[2:]), r["ccn"][:2])
                self.assertEqual(r["after"], r["total"] + r["hrrp"] + r["hvbp"], r["ccn"][:2])
                self.assertEqual(r["at_stake"], round(0.01 * r["after"]), r["ccn"][:2])
                self.assertEqual(r["hac"], -r["at_stake"] if cut else 0, r["ccn"][:2])
                self.assertEqual(r["net"], r["hrrp"] + r["hvbp"] + r["hac"], r["ccn"][:2])

    def test_every_column_total_adds_up(self):
        for cut, rows in self.rows.items():
            nat = national(rows)
            estimated = [r for r in rows if r["status"] == "estimated"]
            for key in ("base", "total", "hrrp", "hvbp", "after", "hac", "net"):
                self.assertEqual(nat[key], sum(r[key] for r in estimated), (cut, key))
            self.assertEqual(nat["after"], nat["total"] + nat["hrrp"] + nat["hvbp"])
            self.assertEqual(nat["net"], nat["hrrp"] + nat["hvbp"] + nat["hac"])
