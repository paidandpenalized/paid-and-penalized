"""The IPPS readers against the pinned FY2024 files, the back-test's inputs. As for FY2026 (test_ipps_pins), counts and
ranges are facts of the pinned bytes; they hold no hospital names."""
import unittest

from pp_engine.ipps import MDH_TYPES, RATE_KEYS, SCH_TYPES, rate_key
from pp_pipeline.ipps_pins import BACKTEST_FY, hrrp_factors, payment_inputs, rates, vbp_factors

FY = BACKTEST_FY
# Each key's update, as the "Update = X Percent" in the FY2024 tables' own scenario headings.
UPDATE = {"qe": 3.1, "qn": 0.625, "ne": 2.275, "nn": -0.2}
# FY2024's labor shares: Table 1A "67.6 PERCENT LABOR SHARE/32.4 PERCENT NONLABOR SHARE", Table 1B 62/38.
LABOR = {"1A": 0.676, "1B": 0.62}


class RatesOnThePin(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rates = rates(FY)
        cls.op = cls.rates["operating"]

    def test_the_four_scenarios_and_their_updates(self):
        for table in ("1A", "1B"):
            self.assertEqual(sorted(self.op[table]), sorted(RATE_KEYS), table)
        self.assertEqual(sorted(self.op["1C"]), ["qe", "qn"])
        self.assertEqual(self.rates["update"], UPDATE)  # Table 1C's "(Update = 3.1)" reads as 1A's 3.1 percent
        self.assertGreater(self.rates["capital"], 0)

    def test_both_tables_split_one_standardized_amount_by_the_years_labor_share(self):
        for key in RATE_KEYS:
            a, b = self.op["1A"][key], self.op["1B"][key]
            self.assertAlmostEqual(sum(a), sum(b), delta=0.011, msg=key)
            for table, pair in (("1A", a), ("1B", b)):
                self.assertAlmostEqual(pair[0] / sum(pair), LABOR[table], delta=0.001, msg=(table, key))

    def test_each_key_carries_its_scenarios_update(self):
        full = {k: sum(self.op["1B"][k]) for k in RATE_KEYS}
        for key, update in UPDATE.items():
            self.assertAlmostEqual(full[key] / full["qe"], (1 + update / 100) / (1 + UPDATE["qe"] / 100), delta=1e-5,
                                   msg=key)

    def test_puerto_rico_rates_are_the_low_wage_index_national_rates(self):
        for key, pair in self.op["1C"].items():
            self.assertEqual(pair, self.op["1B"][key], key)


class PaymentInputsOnThePin(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.inp = payment_inputs(FY)
        cls.rates = rates(FY)

    def count(self, pred):
        return sum(1 for h in self.inp.values() if pred(h))

    def test_the_impact_file_counts(self):
        self.assertEqual(len(self.inp), 3199)
        self.assertEqual(self.count(lambda h: h["mdh"]), 177)
        self.assertEqual(self.count(lambda h: h["sch"]), 468)
        self.assertEqual(self.count(lambda h: h["pr"]), 51)
        self.assertEqual(self.count(lambda h: h["quality"] == 1), 101)
        self.assertEqual(self.count(lambda h: h["ehr"] == 1), 150)
        self.assertEqual(self.count(lambda h: h["low_volume"] > 1), 625)

    def test_the_hsp_rate_belongs_to_the_sch_and_mdh_rows_and_mdh_comes_from_the_provider_type(self):
        self.assertEqual({c for c, h in self.inp.items() if h["hsp"] is not None},
                         {c for c, h in self.inp.items() if h["sch"] or h["mdh"]})
        self.assertEqual({c for c, h in self.inp.items() if h["mdh"]}, {c for c, h in self.inp.items() if h["ptype"] in MDH_TYPES})
        self.assertEqual({c for c, h in self.inp.items() if h["mdh"]}, {c for c, h in self.inp.items() if h["hsp_mdh"] is not None})
        self.assertFalse(any(h["mdh"] and h["sch"] for h in self.inp.values()))
        self.assertTrue(SCH_TYPES >= {h["ptype"] for h in self.inp.values() if h["sch"]})
        self.assertFalse(any(h["hsp_mdh_prior_year"] for h in self.inp.values()))  # "updated to FY 2024"

    def test_blank_only_where_the_file_leaves_it_blank(self):
        blanks = {k: self.count(lambda h: h[k] is None) for k in next(iter(self.inp.values()))
                  if k not in ("sch", "mdh", "pr", "hsp_mdh_prior_year")}
        self.assertEqual({k: n for k, n in blanks.items() if n}, {"hsp": 2554, "hsp_mdh": 3022, "outlier_op": 68,
                                                                  "outlier_cap": 68, "ime_cases": 1980, "ime_cmi": 1966})
        self.assertFalse(any(h["ime_cases"] and not h["ime_op"] for h in self.inp.values()))  # teaching hospitals only

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
        self.assertGreater(span("beds")[0], 0)  # every row has a bed count: the back-test's strata need it
        for key in ("ime_op", "ime_cap", "dsh_op", "dsh_cap"):
            self.assertGreaterEqual(span(key)[0], 0, key)
            self.assertLess(span(key)[1], 1, key)
        self.assertGreaterEqual(span("low_volume")[0], 1.0)
        self.assertLessEqual(span("low_volume")[1], 1.25)

    def test_every_hospital_has_a_rate(self):
        for ccn, h in self.inp.items():
            key = rate_key(h["quality"], h["ehr"])
            self.assertIn(key, self.rates["operating"]["1A"])
            if h["pr"]:
                self.assertIn(key, self.rates["operating"]["1C"], ccn[:2])
                self.assertLessEqual(h["wi"], 1)


class FactorsOnThePin(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.hrrp, cls.vbp, cls.inp = hrrp_factors(FY), vbp_factors(FY), payment_inputs(FY)

    def test_factors_in_range_on_the_pins(self):
        self.assertEqual((len(self.hrrp), len(self.vbp)), (3037, 2474))
        self.assertTrue(all(0.97 <= f <= 1.0 for f in self.hrrp.values()))
        self.assertTrue(all(0.9 < f < 1.1 for f in self.vbp.values()))
        self.assertEqual((sum(f < 1 for f in self.hrrp.values()), sum(f == 1 for f in self.hrrp.values())), (2356, 681))
        self.assertEqual((sum(f < 1 for f in self.vbp.values()), sum(f > 1 for f in self.vbp.values())), (1237, 1237))

    def test_factor_hospitals_are_impact_file_hospitals_outside_maryland_and_puerto_rico(self):
        self.assertEqual(len(set(self.hrrp) & set(self.inp)), 3029)
        self.assertEqual(len(set(self.vbp) & set(self.inp)), 2474)
        for factors in (self.hrrp, self.vbp):
            self.assertFalse({c for c in factors if c[:2] in ("21", "40")})


if __name__ == "__main__":
    unittest.main()
