"""The FY2026 IPPS readers against the pinned CMS files. Counts and ranges asserted here are facts of the pinned bytes
(a different file is a re-pin, and the numbers move with it on purpose); they hold no hospital names. The checks every
final rule's files get are in ipps_pin_cases; this module sets FY2026's facts and tests what is FY2026's alone."""
import unittest

from pp_pipeline.tests.ipps_pin_cases import FactorsCases, PaymentInputsCases, RatesCases

FY = 2026


class RatesOnThePin(RatesCases, unittest.TestCase):
    FY = FY
    UPDATE = {"qe": 2.6, "qn": 0.125, "ne": 1.775, "nn": -0.7}
    LABOR = {"1A": 0.66, "1B": 0.62}
    MDH_BUDGET_NEUTRALITY = (0.998580, 0.999897)  # "HSP Rate updated to FY 2025 for MDH providers": update and factors
    UC_POOL = 7_713_127_500.0  # "$12,412,500,000 * 0.6214 = $ 7,713,127,500" (90 FR 36889)


class PaymentInputsOnThePin(PaymentInputsCases, unittest.TestCase):
    FY = FY
    COUNTS = {"hospitals": 3103, "mdh": 162, "sch": 426, "pr": 52, "quality": 99, "ehr": 106, "low_volume": 572}
    BLANKS = {"hsp": 2677, "hsp_mdh": 2941, "outlier_op": 70, "outlier_cap": 70, "ime_cases": 1842, "ime_cmi": 1842,
              "ucp_factor": 739}

    def test_sch_rows_are_the_ones_with_a_hospital_specific_rate(self):
        # Includes the EACH/RRC rows (type 22): the file gives them an SCH rate, which supports paying EACHs as SCHs.
        self.assertEqual({c for c, h in self.inp.items() if h["sch"]},
                         {c for c, h in self.inp.items() if h["hsp"] is not None})
        each = [h for h in self.inp.values() if h["ptype"] in (21, 22)]
        self.assertEqual(len(each), 2)
        self.assertTrue(all(h["sch"] and h["hsp"] > 0 for h in each))

    def test_mdh_rows_are_the_ones_with_an_mdh_rate(self):
        self.assertEqual({c for c, h in self.inp.items() if h["mdh"]},
                         {c for c, h in self.inp.items() if h["hsp_mdh"] is not None})


class FactorsOnThePin(FactorsCases, unittest.TestCase):
    FY = FY
    COUNTS = {"hrrp": 2945, "vbp": 2448, "hrrp_below_1": 2304, "hrrp_at_1": 641, "vbp_below_1": 1191,
              "vbp_above_1": 1257, "hrrp_in_impact": 2931, "vbp_in_impact": 2448}


if __name__ == "__main__":
    unittest.main()
