"""The IPPS readers against the pinned FY2024 files, the back-test's inputs. As for FY2026 (test_ipps_pins), counts and
ranges are facts of the pinned bytes; they hold no hospital names. The checks every final rule's files get are in
ipps_pin_cases; this module sets FY2024's facts and tests what is FY2024's alone."""
import unittest

from pp_engine.ipps import MDH_TYPES
from pp_pipeline.ipps_pins import BACKTEST_FY
from pp_pipeline.tests.ipps_pin_cases import FactorsCases, PaymentInputsCases, RatesCases

FY = BACKTEST_FY


class RatesOnThePin(RatesCases, unittest.TestCase):
    FY = FY
    UPDATE = {"qe": 3.1, "qn": 0.625, "ne": 2.275, "nn": -0.2}
    # FY2024's labor shares: Table 1A "67.6 PERCENT LABOR SHARE/32.4 PERCENT NONLABOR SHARE", Table 1B 62/38.
    LABOR = {"1A": 0.676, "1B": 0.62}
    MDH_BUDGET_NEUTRALITY = None  # "updated to FY 2024 for SCH & MDH providers": the file's rate is the year's already
    UC_POOL = 5_938_006_756.87  # "$10,015,191,021.88 * 0.5929 = $5,938,006,756.87" (88 FR 59001)


class PaymentInputsOnThePin(PaymentInputsCases, unittest.TestCase):
    FY = FY
    COUNTS = {"hospitals": 3199, "mdh": 177, "sch": 468, "pr": 51, "quality": 101, "ehr": 150, "low_volume": 625}
    BLANKS = {"hsp": 2554, "hsp_mdh": 3022, "outlier_op": 68, "outlier_cap": 68, "ime_cases": 1980, "ime_cmi": 1966,
              "ucp_factor": 815}

    def test_the_hsp_rate_belongs_to_the_sch_and_mdh_rows_and_mdh_comes_from_the_provider_type(self):
        self.assertEqual({c for c, h in self.inp.items() if h["hsp"] is not None},
                         {c for c, h in self.inp.items() if h["sch"] or h["mdh"]})
        mdh = {c for c, h in self.inp.items() if h["mdh"]}
        self.assertEqual(mdh, {c for c, h in self.inp.items() if h["ptype"] in MDH_TYPES})
        self.assertEqual(mdh, {c for c, h in self.inp.items() if h["hsp_mdh"] is not None})


class FactorsOnThePin(FactorsCases, unittest.TestCase):
    FY = FY
    COUNTS = {"hrrp": 3037, "vbp": 2474, "hrrp_below_1": 2356, "hrrp_at_1": 681, "vbp_below_1": 1237,
              "vbp_above_1": 1237, "hrrp_in_impact": 3029, "vbp_in_impact": 2474}


if __name__ == "__main__":
    unittest.main()
