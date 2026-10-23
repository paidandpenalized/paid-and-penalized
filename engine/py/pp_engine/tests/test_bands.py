"""The back-test's statistics (pp_engine.bands) on synthetic errors whose percentiles are known by construction."""
import math
import unittest

from pp_engine import bands


def spread(center, n):
    """n errors evenly spaced from center - 1 to center + 1: the p-th quantile (linear interpolation) is exactly
    center - 1 + 2p, so p10 = center - 0.8, the median = center, p90 = center + 0.8."""
    return [center - 1 + 2 * i / (n - 1) for i in range(n)]


class Strata(unittest.TestCase):
    def test_bed_bands_and_kinds(self):
        self.assertEqual([bands.bed_band(b) for b in (1, 99, 100, 299, 300, 2800)],
                         ["under-100", "under-100", "100-299", "100-299", "300-plus", "300-plus"])
        for missing in (None, 0, -3):
            self.assertIsNone(bands.bed_band(missing))
            # no bed count: no stratum of its own, the whole set's band
            self.assertEqual(bands.stratum_of({"beds": missing, "sch": True, "mdh": False}), bands.ALL)
        self.assertNotIn(bands.ALL, bands.STRATA)
        self.assertEqual(bands.stratum_of({"beds": 45, "sch": True, "mdh": False}), "under-100/sch-mdh")
        self.assertEqual(bands.stratum_of({"beds": 45, "sch": False, "mdh": True}), "under-100/sch-mdh")
        self.assertEqual(bands.stratum_of({"beds": 150, "sch": False, "mdh": False}), "100-299/other")
        self.assertEqual(bands.stratum_id("300-plus", bands.OTHER), "300-plus/other")
        self.assertEqual(list(bands.STRATA), [bands.stratum_id(band, kind) for band, _, _ in bands.BED_BANDS
                                              for kind in bands.KINDS])
        self.assertEqual(len(bands.STRATA), 6)


class Pairs(unittest.TestCase):
    def test_kinds(self):
        self.assertEqual([bands.pair_kind(m, a) for m, a in ((5, 4), (-5, -4), (5, -4), (-5, 4), (5, 0), (0, 4), (0, 0))],
                         ["compared", "compared", "sign_mismatch", "sign_mismatch", "zero_actual", "zero_model",
                          "both_zero"])

    def test_the_error_is_the_log_of_model_over_actual_and_only_for_a_compared_pair(self):
        self.assertAlmostEqual(bands.log_ratio(110, 100), math.log(1.1))
        self.assertAlmostEqual(bands.log_ratio(-90, -100), math.log(0.9))
        for m, a in ((5, -4), (5, 0), (0, 4)):
            with self.assertRaises(ValueError):
                bands.log_ratio(m, a)


class Percentiles(unittest.TestCase):
    def test_linear_interpolation_between_order_statistics(self):
        # PERCENTILE.INC on 1..5: p = 0.1 sits 0.4 of the way from 1 to 2; 0.9 at 4.6; the median 3
        self.assertAlmostEqual(bands.percentile([5, 1, 3, 2, 4], 0.1), 1.4)
        self.assertAlmostEqual(bands.percentile([5, 1, 3, 2, 4], 0.9), 4.6)
        self.assertEqual(bands.percentile([5, 1, 3, 2, 4], 0.5), 3)
        self.assertEqual(bands.percentile([7], 0.9), 7)
        with self.assertRaises(ValueError):
            bands.percentile([], 0.5)

    def test_summary_of_a_known_spread(self):
        got = bands.summary(spread(0.2, 41))
        self.assertEqual(got, {"n": 41, "p10": -0.6, "p90": 1.0, "median": 0.2})
        self.assertEqual(bands.summary([]), {"n": 0, "p10": None, "p90": None, "median": None})

    def test_the_multipliers_bracket_the_actual_80_percent_of_the_time(self):
        # errors log(model / actual) = e; the range estimate x exp(-p90) .. estimate x exp(-p10) holds the actual
        # (= estimate x exp(-e)) exactly when p10 <= e <= p90
        errors = spread(0.1, 101)
        s = bands.summary(errors)
        low, high = bands.multipliers(s["p10"], s["p90"])
        self.assertEqual((low, high), (round(math.exp(-0.9), 4), round(math.exp(0.7), 4)))
        inside = sum(low - 1e-4 <= math.exp(-e) <= high + 1e-4 for e in errors)
        self.assertEqual(inside, 81)  # 10th to 90th percentile of 101 evenly spaced values: 81 of them


class StratumBands(unittest.TestCase):
    def test_a_full_stratum_keeps_its_own_and_a_thin_one_borrows_its_bed_band(self):
        errors = {"under-100/sch-mdh": spread(0.3, 40), "under-100/other": spread(-0.1, 10),
                  "100-299/sch-mdh": spread(0.0, 12), "100-299/other": spread(0.0, 12),
                  "300-plus/other": spread(0.5, 31)}
        strata, overall = bands.stratum_bands(errors)
        by = {s["stratum"]: s for s in strata}
        self.assertEqual([s["stratum"] for s in strata], list(bands.STRATA))
        own = by["under-100/sch-mdh"]
        self.assertEqual((own["pool"], own["n"], own["poolN"], own["median"], own["p10"], own["p90"]),
                         ("stratum", 40, 40, 0.3, -0.5, 1.1))
        self.assertEqual((own["low"], own["high"]), bands.multipliers(-0.5, 1.1))
        thin = by["under-100/other"]  # 10 of its own, 50 in the band: the band's percentiles, its own median
        self.assertEqual((thin["pool"], thin["n"], thin["poolN"], thin["median"]), ("beds", 10, 50, -0.1))
        self.assertEqual((thin["p10"], thin["p90"]), (bands.summary(errors["under-100/sch-mdh"] + errors["under-100/other"])["p10"],
                                                      bands.summary(errors["under-100/sch-mdh"] + errors["under-100/other"])["p90"]))
        # 100-299: 24 in the band, too few: every hospital's
        self.assertEqual((by["100-299/other"]["pool"], by["100-299/other"]["poolN"]), ("all", 105))
        # 300-plus/sch-mdh has none of its own: its band (31) has enough; no median of its own
        empty = by["300-plus/sch-mdh"]
        self.assertEqual((empty["pool"], empty["n"], empty["poolN"], empty["median"]), ("beds", 0, 31, None))
        self.assertEqual(overall["n"], 105)
        # the overall band carries its multipliers: a hospital with no stratum (ALL) takes them
        self.assertEqual(overall, {**bands.summary([e for v in errors.values() for e in v]),
                                   "low": bands.multipliers(overall["p10"], overall["p90"])[0],
                                   "high": bands.multipliers(overall["p10"], overall["p90"])[1]})
        self.assertEqual((by["100-299/other"]["low"], by["100-299/other"]["high"]), (overall["low"], overall["high"]))

    def test_too_few_hospitals_in_all_raises(self):
        with self.assertRaisesRegex(ValueError, "too few"):
            bands.stratum_bands({"under-100/other": spread(0.0, 29)})


class Bootstrap(unittest.TestCase):
    def test_the_ratio_and_its_percentiles_are_fixed_by_the_seed(self):
        pairs = [(100.0 + i, 100.0 + i * 1.1) for i in range(40)]
        a, b = bands.bootstrap_ratio(pairs, draws=500), bands.bootstrap_ratio(pairs, draws=500)
        self.assertEqual(a, b)
        self.assertEqual(a["ratio"], round(sum(p[1] for p in pairs) / sum(p[0] for p in pairs), 4))
        self.assertLess(a["p10"], a["ratio"])
        self.assertGreater(a["p90"], a["ratio"])
        self.assertEqual((a["n"], a["draws"], a["seed"]), (40, 500, bands.BOOTSTRAP_SEED))
        self.assertNotEqual(bands.bootstrap_ratio(pairs, draws=500, seed=1), a)

    def test_identical_ratios_give_no_spread(self):
        got = bands.bootstrap_ratio([(10.0 * (i + 1), 12.0 * (i + 1)) for i in range(30)], draws=200)
        self.assertEqual((got["ratio"], got["p10"], got["p90"]), (1.2, 1.2, 1.2))

    def test_refuses_too_few_or_non_positive(self):
        with self.assertRaisesRegex(ValueError, "too few"):
            bands.bootstrap_ratio([(1.0, 1.0)] * 29)
        with self.assertRaisesRegex(ValueError, "positive"):
            bands.bootstrap_ratio([(1.0, 1.0)] * 29 + [(1.0, -1.0)])


if __name__ == "__main__":
    unittest.main()
