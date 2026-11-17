"""The safety-net flag (pp_engine.medicaid.safety_net), on synthetic values."""
import statistics
import unittest

from pp_engine.medicaid import safety_net


class SafetyNet(unittest.TestCase):
    def test_state_stats_use_hospitals_with_medicaid_days(self):
        n, mean, sd, cut = safety_net.state_stats([0.1, 0.2, 0.3, 0.0, None])
        self.assertEqual(n, 3)
        self.assertAlmostEqual(mean, 0.2)
        self.assertAlmostEqual(sd, statistics.stdev([0.1, 0.2, 0.3]))
        self.assertAlmostEqual(cut, 0.3)
        self.assertIsNone(safety_net.state_stats([0.4, 0.0]))

    def test_either_criterion_flags(self):
        self.assertEqual(safety_net.reasons(0.31, 0.3, 0.1), ("miur",))
        self.assertEqual(safety_net.reasons(0.3, 0.3, 0.26), ("miur", "low_income"))
        self.assertEqual(safety_net.reasons(0.2, 0.3, 0.25), ())  # 25% is not above 25%
        self.assertEqual(safety_net.reasons(None, None, None), ())

    def test_low_income_share(self):
        def share(npr, rev, scored=True):
            return safety_net.low_income_share({"net_patient_revenue": npr, "revenue_line2_5": rev, "scored": scored})
        self.assertAlmostEqual(share(100.0, 30.0), 0.3)
        self.assertIsNone(share(0.0, 30.0))
        self.assertIsNone(share(100.0, None))
        self.assertIsNone(share(100.0, 200.0, scored=False))  # line 2 a filing error: no low-income share


if __name__ == "__main__":
    unittest.main()
