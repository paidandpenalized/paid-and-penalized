"""The VIII group's share of state Medicaid spending (pp_engine.medicaid.shares), on invented CMS-64 rows."""
import unittest

from pp_engine.medicaid import shares
from pp_engine.medicaid.shares import SharesError


def row(state, quarter, total, viii):
    return {shares.STATE: state, shares.QUARTER_END: quarter, shares.TOTAL: total, shares.VIII: viii}


FY = ("12/31/2022", "3/31/2023", "06/30/2023", "09/30/2023")


class Amounts(unittest.TestCase):
    def test_reads_separators_padding_and_na(self):
        self.assertEqual(shares.amount("1,247,551,057 "), 1247551057.0)
        self.assertEqual(shares.amount("-3"), -3.0)
        self.assertIsNone(shares.amount("N/A"))
        self.assertIsNone(shares.amount(" "))
        with self.assertRaises(SharesError):
            shares.amount("12x")

    def test_dates_and_fiscal_years(self):
        self.assertEqual(shares.federal_fy(shares.quarter_end("12/31/2022")), 2023)
        self.assertEqual(shares.federal_fy(shares.quarter_end("09/30/2023")), 2023)
        self.assertEqual(shares.federal_fy(shares.quarter_end("10/31/2023")), 2024)
        with self.assertRaises(SharesError):
            shares.quarter_end("2023-09-30")


class StateShares(unittest.TestCase):
    def test_the_base_year_four_quarters(self):
        rows = [row("Statea", q, "100", "25") for q in FY] + [row("Statea", "12/31/2023", "100", "90")]
        s = shares.state_shares(rows, 2023)["Statea"]
        self.assertAlmostEqual(s.share, 0.25)
        self.assertEqual((s.basis, s.first, s.last, s.total), ("ffy2023", "2022-12-31", "2023-09-30", 400.0))

    def test_a_state_without_the_group_has_none(self):
        rows = [row("Stateb", q, "100", "N/A") for q in FY]
        self.assertIsNone(shares.state_shares(rows, 2023)["Stateb"])

    def test_a_late_adopter_uses_its_four_newest_quarters(self):
        later = ("12/31/2023", "03/31/2024", "06/30/2024", "09/30/2024", "12/31/2024")
        rows = ([row("Statec", q, "100", "N/A") for q in FY[:3]] + [row("Statec", FY[3], "100", "1")] +
                [row("Statec", q, "100", v) for q, v in zip(later, ("5", "10", "10", "20", "20"))])
        s = shares.state_shares(rows, 2023)["Statec"]
        self.assertEqual((s.basis, s.first, s.last), ("latest4", "2024-03-31", "2024-12-31"))
        self.assertAlmostEqual(s.share, 60 / 400)

    def test_net_of_a_deduction_only_in_the_base_year(self):
        base = shares.Share(0.25, 100.0, 400.0, "ffy2023", "", "")
        self.assertAlmostEqual(shares.net_of(base, 80.0, 2023), 100 / 320)
        late = shares.Share(0.2, 80.0, 400.0, "latest4", "", "")
        self.assertEqual(shares.net_of(late, 80.0, 2023), 0.2)
        with self.assertRaises(SharesError):
            shares.net_of(base, 400.0, 2023)

    def test_too_few_quarters_or_repeats_fail(self):
        with self.assertRaises(SharesError):
            shares.state_shares([row("Stated", FY[0], "100", "N/A"), row("Stated", "12/31/2023", "100", "4")], 2023)
        with self.assertRaises(SharesError):
            shares.state_shares([row("Statee", FY[0], "100", "1"), row("Statee", FY[0], "100", "1")], 2023)
        with self.assertRaises(SharesError):
            shares.state_shares([row("Statef", FY[0], "N/A", "1")], 2023)


if __name__ == "__main__":
    unittest.main()
