"""The FY2026 IPPS readers against the pinned CMS files. Counts and ranges asserted here are facts of the pinned bytes
(a different file is a re-pin, and the numbers move with it on purpose); they hold no hospital names."""
import unittest

from pp_engine.ipps import RATE_KEYS, SCH_TYPES, rate_key
from pp_pipeline.ipps_pins import hrrp_factors, payment_inputs, rates, vbp_factors

# Each key's update, as the "Update = X Percent" in the table's own scenario headings: an independent statement of
# what the key means, to check the reader's column choice against.
UPDATE = {"qe": 2.6, "qn": 0.125, "ne": 1.775, "nn": -0.7}


class RatesOnThePin(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rates = rates()
        cls.op = cls.rates["operating"]

    def test_rates_on_the_pin(self):
        self.assertEqual(sorted(self.op), ["1A", "1B", "1C"])
        for table in ("1A", "1B"):
            self.assertEqual(sorted(self.op[table]), sorted(RATE_KEYS), table)
        self.assertEqual(sorted(self.op["1C"]), ["qe", "qn"])
        for table in self.op.values():
            for labor, nonlabor in table.values():
                self.assertGreater(min(labor, nonlabor), 0)
        self.assertGreater(self.rates["capital"], 0)

    def test_both_tables_split_one_standardized_amount_by_the_labor_share(self):
        for key in RATE_KEYS:
            a, b = self.op["1A"][key], self.op["1B"][key]
            self.assertAlmostEqual(sum(a), sum(b), delta=0.011, msg=key)  # one amount, split 66/34 and 62/38
            self.assertAlmostEqual(a[0] / sum(a), 0.66, delta=0.001, msg=key)
            self.assertAlmostEqual(b[0] / sum(b), 0.62, delta=0.001, msg=key)

    def test_each_key_carries_its_scenarios_update(self):
        full = {k: sum(self.op["1B"][k]) for k in RATE_KEYS}
        for key, update in UPDATE.items():
            self.assertAlmostEqual(full[key] / full["qe"], (1 + update / 100) / (1 + UPDATE["qe"] / 100), delta=1e-5,
                                   msg=key)  # a swapped column pair would miss by more than 1e-3

    def test_puerto_rico_rates_are_the_low_wage_index_national_rates(self):
        for key, pair in self.op["1C"].items():
            self.assertEqual(pair, self.op["1B"][key], key)


class PaymentInputsOnThePin(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.inp = payment_inputs()
        cls.rates = rates()

    def count(self, pred):
        return sum(1 for h in self.inp.values() if pred(h))

    def test_the_impact_file_counts(self):
        self.assertEqual(len(self.inp), 3103)
        self.assertEqual(self.count(lambda h: h["mdh"]), 162)
        self.assertEqual(self.count(lambda h: h["sch"]), 426)
        self.assertEqual(self.count(lambda h: h["pr"]), 52)
        self.assertEqual(self.count(lambda h: h["quality"] == 1), 99)
        self.assertEqual(self.count(lambda h: h["ehr"] == 1), 106)

    def test_sch_rows_are_the_ones_with_a_hospital_specific_rate(self):
        # Includes the EACH/RRC rows (type 22): the file gives them an SCH rate, which supports paying EACHs as SCHs.
        self.assertEqual({c for c, h in self.inp.items() if h["sch"]}, {c for c, h in self.inp.items() if h["hsp"] is not None})
        each = [h for h in self.inp.values() if h["ptype"] in (21, 22)]
        self.assertEqual(len(each), 2)
        self.assertTrue(all(h["sch"] and h["hsp"] > 0 for h in each))
        self.assertTrue(SCH_TYPES >= {h["ptype"] for h in self.inp.values() if h["sch"]})

    def test_mdh_rows_are_the_ones_with_an_mdh_rate_and_are_not_sch(self):
        self.assertEqual({c for c, h in self.inp.items() if h["mdh"]}, {c for c, h in self.inp.items() if h["hsp_mdh"] is not None})
        self.assertFalse(any(h["mdh"] and h["sch"] for h in self.inp.values()))

    def test_blank_only_where_the_file_leaves_it_blank(self):
        blanks = {k: self.count(lambda h: h[k] is None) for k in next(iter(self.inp.values()))
                  if k not in ("sch", "mdh", "pr")}
        self.assertEqual({k: n for k, n in blanks.items() if n}, {"hsp": 2677, "hsp_mdh": 2941, "outlier_op": 70,
                                                                  "outlier_cap": 70})

    def test_values_are_in_range(self):
        def span(key):
            vals = [h[key] for h in self.inp.values() if h[key] is not None]
            return min(vals), max(vals)
        self.assertGreater(span("cases")[0], 0)
        self.assertGreater(span("cmi")[0], 0.5)
        self.assertLess(span("cmi")[1], 6)
        self.assertGreater(span("wi")[0], 0.4)
        self.assertLess(span("wi")[1], 2.2)
        self.assertGreaterEqual(span("cola")[0], 1.0)
        self.assertLess(span("cola")[1], 1.3)
        self.assertGreater(span("gaf")[0], 0.5)
        self.assertLess(span("gaf")[1], 2.0)
        for key in ("ime_op", "ime_cap", "dsh_op", "dsh_cap", "outlier_cap", "hsp", "hsp_mdh", "ucp_per_claim"):
            self.assertGreaterEqual(span(key)[0], 0, key)
        for key in ("ime_op", "ime_cap", "dsh_op", "dsh_cap"):
            self.assertLess(span(key)[1], 1, key)  # fractions of the federal payment
        self.assertGreaterEqual(span("low_volume")[0], 1.0)  # a multiplier: 1 = none
        self.assertLessEqual(span("low_volume")[1], 1.25)
        self.assertEqual(self.count(lambda h: h["low_volume"] > 1), 572)  # the extension's tiers apply to these
        self.assertEqual({h["quality"] for h in self.inp.values()} | {h["ehr"] for h in self.inp.values()}, {0, 1})

    def test_every_hospital_has_a_rate_and_puerto_rico_has_its_own(self):
        pr_rates = self.rates["operating"]["1C"]
        for ccn, h in self.inp.items():
            key = rate_key(h["quality"], h["ehr"])
            self.assertIn(key, self.rates["operating"]["1A"])
            if h["pr"]:
                self.assertIn(key, pr_rates, ccn[:2])  # no Puerto Rico hospital failed quality reporting
                self.assertLessEqual(h["wi"], 1)  # so the table's wage-index-above-one columns are never needed


class FactorsOnThePin(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.hrrp, cls.vbp, cls.inp = hrrp_factors(), vbp_factors(), payment_inputs()

    def test_factors_in_range_on_the_pins(self):
        self.assertEqual((len(self.hrrp), len(self.vbp)), (2945, 2448))
        self.assertTrue(all(0.97 <= f <= 1.0 for f in self.hrrp.values()))  # at most the statute's 3% reduction
        self.assertTrue(all(0.9 < f < 1.1 for f in self.vbp.values()))
        self.assertEqual((sum(f < 1 for f in self.hrrp.values()), sum(f == 1 for f in self.hrrp.values())), (2304, 641))
        self.assertEqual((sum(f < 1 for f in self.vbp.values()), sum(f > 1 for f in self.vbp.values())), (1191, 1257))

    def test_factor_hospitals_are_impact_file_hospitals_outside_maryland_and_puerto_rico(self):
        self.assertEqual(len(set(self.hrrp) & set(self.inp)), 2931)
        self.assertEqual(len(set(self.vbp) & set(self.inp)), 2448)
        for factors in (self.hrrp, self.vbp):
            self.assertFalse({c for c in factors if c[:2] in ("21", "40")})


if __name__ == "__main__":
    unittest.main()
