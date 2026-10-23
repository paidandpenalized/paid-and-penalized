"""The checks the IPPS readers' tests make on every pinned final rule (test_ipps_pins for FY2026, test_ipps_pins_fy2024
for FY2024), written once. A test module combines each mixin with `unittest.TestCase` and sets the rule's facts as class
attributes: the year, and the counts and ranges that are facts of its pinned bytes (a different file is a re-pin, and
the numbers move with it on purpose). They hold no hospital names. What differs between the rules in kind, not in
number (how a hospital-specific rate is found), is tested in the year's own module."""
from pp_engine.ipps import PUERTO_RICO, RATE_KEYS, SCH_TYPES, rate_key
from pp_pipeline.ipps_pins import hrrp_factors, payment_inputs, rates, vbp_factors


class RatesCases:
    """Attributes: FY; UPDATE (each key's update, as the "Update = X Percent" in the tables' own scenario headings:
    an independent statement of what the key means, to check the reader's column choice against); LABOR (the labor
    share of Tables 1A and 1B); MDH_BUDGET_NEUTRALITY (the rule's factors for hospital-specific rates where the impact
    file's MDH rate is the year before's, so takes the year's update and them; None where it is already the year's);
    UC_POOL (the rule's uncompensated care amount, Factor 1 x Factor 2, as the rule prints it)."""

    @classmethod
    def setUpClass(cls):
        cls.rates = rates(cls.FY)
        cls.op = cls.rates["operating"]

    def test_the_four_scenarios_and_their_updates(self):
        self.assertEqual(sorted(self.op), ["1A", "1B", "1C"])
        for table in ("1A", "1B"):
            self.assertEqual(sorted(self.op[table]), sorted(RATE_KEYS), table)
        self.assertEqual(sorted(self.op["1C"]), ["qe", "qn"])  # the EHR split only
        for table in self.op.values():
            for labor, nonlabor in table.values():
                self.assertGreater(min(labor, nonlabor), 0)
        self.assertGreater(self.rates["capital"], 0)
        self.assertEqual(self.rates["update"], self.UPDATE)
        bn = self.MDH_BUDGET_NEUTRALITY
        for key, update in self.UPDATE.items():
            want = 1.0 if bn is None else (1 + update / 100) * bn[0] * bn[1]
            self.assertAlmostEqual(self.rates["mdh_factor"][key], want, places=12, msg=key)
        self.assertEqual(self.rates["uc_pool"], self.UC_POOL)

    def test_both_tables_split_one_standardized_amount_by_the_years_labor_share(self):
        for key in RATE_KEYS:
            a, b = self.op["1A"][key], self.op["1B"][key]
            self.assertAlmostEqual(sum(a), sum(b), delta=0.011, msg=key)  # one amount, split two ways
            for table, pair in (("1A", a), ("1B", b)):
                self.assertAlmostEqual(pair[0] / sum(pair), self.LABOR[table], delta=0.001, msg=(table, key))

    def test_each_key_carries_its_scenarios_update(self):
        full = {k: sum(self.op["1B"][k]) for k in RATE_KEYS}
        for key, update in self.UPDATE.items():
            # a swapped column pair would miss by more than 1e-3
            self.assertAlmostEqual(full[key] / full["qe"], (1 + update / 100) / (1 + self.UPDATE["qe"] / 100),
                                   delta=1e-5, msg=key)

    def test_puerto_rico_rates_are_the_low_wage_index_national_rates(self):
        for key, pair in self.op["1C"].items():
            self.assertEqual(pair, self.op["1B"][key], key)


class PaymentInputsCases:
    """Attributes: FY; COUNTS (the impact file's hospitals, and how many are `mdh`, `sch`, in Puerto Rico (`pr`, by
    the CCN's state code), reduced for quality (`quality` = 1) or the EHR (`ehr` = 1), and in the low-volume tiers
    (`low_volume` above 1)); BLANKS (the keys the file leaves blank, with how many hospitals each)."""

    @classmethod
    def setUpClass(cls):
        cls.inp = payment_inputs(cls.FY)
        cls.rates = rates(cls.FY)

    def count(self, pred):
        return sum(1 for h in self.inp.values() if pred(h))

    def test_the_impact_file_counts(self):
        self.assertEqual({"hospitals": len(self.inp), "mdh": self.count(lambda h: h["mdh"]),
                          "sch": self.count(lambda h: h["sch"]), "pr": sum(c[:2] == PUERTO_RICO for c in self.inp),
                          "quality": self.count(lambda h: h["quality"] == 1), "ehr": self.count(lambda h: h["ehr"] == 1),
                          "low_volume": self.count(lambda h: h["low_volume"] > 1)}, self.COUNTS)

    def test_a_hospital_is_not_both_sole_community_and_medicare_dependent(self):
        self.assertFalse(any(h["mdh"] and h["sch"] for h in self.inp.values()))
        self.assertTrue(SCH_TYPES >= {h["ptype"] for h in self.inp.values() if h["sch"]})

    def test_the_uncompensated_care_factors_share_out_the_whole_pool(self):
        # Factor 3 is each hospital's share of the pool: over the whole file the shares add to 1 (to the file's six
        # decimal places), so the factors times the pool are the pool
        self.assertAlmostEqual(sum(h["ucp_factor"] or 0 for h in self.inp.values()), 1.0, delta=1e-5)
        self.assertTrue(all(h["ucp_factor"] is None or 0 <= h["ucp_factor"] < 0.05 for h in self.inp.values()))

    def test_blank_only_where_the_file_leaves_it_blank(self):
        blanks = {k: self.count(lambda h: h[k] is None) for k in next(iter(self.inp.values()))
                  if k not in ("sch", "mdh")}
        self.assertEqual({k: n for k, n in blanks.items() if n}, self.BLANKS)
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
        self.assertGreater(span("gaf")[0], 0.5)
        self.assertLess(span("gaf")[1], 2.0)
        self.assertGreater(span("beds")[0], 0)  # every row has a bed count (one without would take the whole set's band)
        for key in ("ime_op", "ime_cap", "dsh_op", "dsh_cap"):
            self.assertGreaterEqual(span(key)[0], 0, key)
            self.assertLess(span(key)[1], 1, key)  # fractions of the federal payment
        for key in ("outlier_cap", "hsp", "hsp_mdh", "ucp_per_claim"):
            self.assertGreaterEqual(span(key)[0], 0, key)
        self.assertGreaterEqual(span("low_volume")[0], 1.0)  # a multiplier: 1 = none
        self.assertLessEqual(span("low_volume")[1], 1.25)
        self.assertEqual({h["quality"] for h in self.inp.values()} | {h["ehr"] for h in self.inp.values()}, {0, 1})

    def test_every_hospital_has_a_rate(self):
        for h in self.inp.values():
            key = rate_key(h["quality"], h["ehr"])
            self.assertIn(key, self.rates["operating"]["1A"])
            self.assertIn(key, self.rates["operating"]["1B"])


class FactorsCases:
    """Attributes: FY; COUNTS (the hospitals in the HRRP file and in Table 16B; of the HRRP file's, the factors below
    and at 1; of Table 16B's, below and above 1; and how many of each file's are in the impact file)."""

    @classmethod
    def setUpClass(cls):
        cls.hrrp, cls.vbp, cls.inp = hrrp_factors(cls.FY), vbp_factors(cls.FY), payment_inputs(cls.FY)

    def test_factors_in_range_on_the_pins(self):
        self.assertTrue(all(0.97 <= f <= 1.0 for f in self.hrrp.values()))  # at most the statute's 3% reduction
        self.assertTrue(all(0.9 < f < 1.1 for f in self.vbp.values()))
        self.assertEqual({"hrrp": len(self.hrrp), "vbp": len(self.vbp),
                          "hrrp_below_1": sum(f < 1 for f in self.hrrp.values()),
                          "hrrp_at_1": sum(f == 1 for f in self.hrrp.values()),
                          "vbp_below_1": sum(f < 1 for f in self.vbp.values()),
                          "vbp_above_1": sum(f > 1 for f in self.vbp.values()),
                          "hrrp_in_impact": len(set(self.hrrp) & set(self.inp)),
                          "vbp_in_impact": len(set(self.vbp) & set(self.inp))}, self.COUNTS)

    def test_factor_hospitals_are_outside_maryland_and_puerto_rico(self):
        for factors in (self.hrrp, self.vbp):
            self.assertFalse({c for c in factors if c[:2] in ("21", "40")})
