"""The per-hospital dollar estimate, on synthetic hospitals with small round numbers. Every expected value is worked by
hand in the test that checks it (the arithmetic is in a comment beside the number)."""
import math
import unittest

from pp_engine.dollars import HAC_RATE, base_payment, estimate, total_payment

# Invented standardized amounts (labor, nonlabor), all different so a mix-up of table, key or column shows.
RATES = {
    "operating": {
        "1A": {"qe": (4000.0, 2000.0), "qn": (3900.0, 1900.0), "ne": (3800.0, 1800.0), "nn": (3700.0, 1700.0)},
        "1B": {"qe": (3000.0, 2500.0), "qn": (2900.0, 2400.0), "ne": (2800.0, 2300.0), "nn": (2700.0, 2200.0)},
        "1C": {"qe": (3100.0, 2600.0), "qn": (3000.0, 2500.0)},
    },
    "capital": 500.0,
}

# The synthetic hospital: 10 cases at a case-mix of 1.5 and a wage index of 1.5 (Table 1A, quality + EHR scenario), so
# its federal DRG payment is 10 x 1.5 x (4000 x 1.5 + 2000 x 1.0) = 15 x 8000 = 120,000. Everything else is off:
# no add-ons, no capital (gaf 0 turns the capital payment off), no uncompensated care.
FED = 120000.0


def hospital(**changes):
    h = {"cases": 10.0, "cmi": 1.5, "bills": 12, "cmi_hsp": 1.6, "wi": 1.5, "cola": 1.0, "quality": 0, "ehr": 0,
         "ptype": 0, "sch": False, "mdh": False, "hsp": None, "hsp_mdh": None, "ime_op": 0.0, "ime_cap": 0.0,
         "dsh_op": 0.0, "dsh_cap": 0.0, "ucp_per_claim": 0.0, "outlier_op": 0.0, "outlier_cap": 0.0, "gaf": 0.0,
         "low_volume": 1.0, "pr": False}
    h.update(changes)
    return h


def est(h=None, hrrp=1.0, vbp=1.0, cut=False, **changes):
    return estimate(h if h is not None else hospital(**changes), RATES, hrrp=hrrp, vbp=vbp, cut=cut)


def nonzero(e):
    """The estimate's dollar components that are not zero."""
    parts = ("fed", "mdh_addon", "ime", "dsh", "outlier_op", "sch_diff", "low_volume", "capital", "uc")
    return {k: e[k] for k in parts if e[k] != 0}


class Close(unittest.TestCase):
    def assertDollars(self, got, want, msg=None):
        self.assertAlmostEqual(got, want, places=6, msg=msg)

    def assertParts(self, got, want):
        self.assertEqual(sorted(got), sorted(want))
        for k, v in want.items():
            self.assertDollars(got[k], v, k)


class Base(Close):
    def test_base_uses_1a_above_one_and_1b_at_or_below(self):
        # wage index 1.5 > 1, Table 1A: 15 x (4000 x 1.5 + 2000 x 1) = 15 x 8000 = 120,000
        self.assertDollars(base_payment(hospital(), RATES), 120000.0)
        # wage index 1.0 is "at or below": Table 1B: 15 x (3000 x 1 + 2500 x 1) = 15 x 5500 = 82,500
        self.assertDollars(base_payment(hospital(wi=1.0), RATES), 82500.0)
        # wage index 0.8, Table 1B: 15 x (3000 x 0.8 + 2500 x 1) = 15 x 4900 = 73,500
        self.assertDollars(base_payment(hospital(wi=0.8), RATES), 73500.0)
        # just above 1 flips to Table 1A: 15 x (4000 x 1.0001 + 2000) = 15 x 6000.4 = 90,006
        self.assertDollars(base_payment(hospital(wi=1.0001), RATES), 90006.0)

    def test_cola_scales_nonlabor_only(self):
        # Table 1A, cola 1.2: 15 x (4000 x 1.5 + 2000 x 1.2) = 15 x 8400 = 126,000
        self.assertDollars(base_payment(hospital(cola=1.2), RATES), 126000.0)
        # Table 1B, cola 1.2: 15 x (3000 x 0.8 + 2500 x 1.2) = 15 x 5400 = 81,000
        self.assertDollars(base_payment(hospital(wi=0.8, cola=1.2), RATES), 81000.0)

    def test_cases_and_cmi_scale_the_whole_payment(self):
        # 20 cases at 1.0: 20 x 8000 = 160,000
        self.assertDollars(base_payment(hospital(cases=20.0, cmi=1.0), RATES), 160000.0)

    def test_the_four_quality_and_ehr_flags_each_pick_their_pair(self):
        one = dict(cases=1.0, cmi=1.0)  # one case-mix-weighted case: B is the rate itself, Table 1A, wage index 1.5
        for quality, ehr, want in ((0, 0, 4000 * 1.5 + 2000.0),   # qe 8000
                                   (0, 1, 3900 * 1.5 + 1900.0),   # qn 7750
                                   (1, 0, 3800 * 1.5 + 1800.0),   # ne 7500
                                   (1, 1, 3700 * 1.5 + 1700.0)):  # nn 7250
            self.assertDollars(base_payment(hospital(quality=quality, ehr=ehr, **one), RATES), want, (quality, ehr))
        # and Table 1B's, wage index 1: 2900 + 2400 (qn)
        self.assertDollars(base_payment(hospital(wi=1.0, ehr=1, **one), RATES), 5300.0)

    def test_puerto_rico_uses_table_1c_whatever_the_wage_index(self):
        one = dict(cases=1.0, cmi=1.0, pr=True)
        # 1C qe: 3100 x 0.8 + 2600 = 5080; 1C qn (EHR reduction): 3000 x 0.8 + 2500 = 4900
        self.assertDollars(base_payment(hospital(wi=0.8, **one), RATES), 5080.0)
        self.assertDollars(base_payment(hospital(wi=0.8, ehr=1, **one), RATES), 4900.0)
        # a wage index above 1 still reads 1C (the file has no such Puerto Rico hospital; the rule is the table's)
        self.assertDollars(base_payment(hospital(wi=1.5, **one), RATES), 3100 * 1.5 + 2600.0)

    def test_a_puerto_rico_hospital_whose_key_is_not_in_1c_raises(self):
        with self.assertRaises(ValueError):
            base_payment(hospital(pr=True, wi=0.8, quality=1), RATES)  # 1C has qe and qn only

    def test_mdh_addon_is_three_quarters_of_the_shortfall_and_never_negative(self):
        # HSP side: 9000 x 1.6 (cmi_hsp) x 10 cases = 144,000; shortfall 144,000 - 120,000 = 24,000; 75% = 18,000
        h = hospital(mdh=True, hsp_mdh=9000.0)
        self.assertDollars(base_payment(h, RATES), 138000.0)
        e = est(h)
        self.assertParts(nonzero(e), {"fed": 120000.0, "mdh_addon": 18000.0})
        # HSP side below the federal payment: 7000 x 16 = 112,000 < 120,000: no add-on, never negative
        low = hospital(mdh=True, hsp_mdh=7000.0)
        self.assertDollars(base_payment(low, RATES), 120000.0)
        self.assertEqual(est(low)["mdh_addon"], 0)

    def test_mdh_addon_needs_the_flag_and_a_usable_hsp_rate(self):
        for h in (hospital(mdh=False, hsp_mdh=9000.0),  # the rate is there, the status is not
                  hospital(mdh=True, hsp_mdh=None),     # the status, no rate (blank)
                  hospital(mdh=True, hsp_mdh=0.0)):     # a zero rate is "no usable rate"
            self.assertDollars(base_payment(h, RATES), FED)

    def test_the_mdh_comparison_uses_the_hsp_case_mix_not_the_transfer_adjusted_one(self):
        # cmi_hsp 1.0 instead of 1.6: HSP side 9000 x 1.0 x 10 = 90,000 < 120,000: no add-on
        self.assertDollars(base_payment(hospital(mdh=True, hsp_mdh=9000.0, cmi_hsp=1.0), RATES), FED)

    def test_sch_base_is_federal(self):
        # The SCH rate is higher (9000 x 1.6 x 10 = 144,000) yet B stays the federal 120,000; the 24,000 is in T.
        h = hospital(sch=True, ptype=16, hsp=9000.0)
        self.assertDollars(base_payment(h, RATES), FED)
        self.assertDollars(est(h)["sch_diff"], 24000.0)


class Total(Close):
    def test_total_adds_each_component(self):
        # One component nonzero at a time; T is B plus that component.
        for changes, parts in (
                ({}, {"fed": 120000.0}),
                # IME: 0.1 x 120,000 = 12,000
                ({"ime_op": 0.1}, {"fed": 120000.0, "ime": 12000.0}),
                # DSH: 0.05 x 120,000 = 6,000
                ({"dsh_op": 0.05}, {"fed": 120000.0, "dsh": 6000.0}),
                # operating outliers, no IME or DSH: 0.02 x 120,000 = 2,400
                ({"outlier_op": 0.02}, {"fed": 120000.0, "outlier_op": 2400.0}),
                # SCH difference: 9000 x 1.6 x 10 = 144,000, minus 120,000 = 24,000
                ({"sch": True, "ptype": 16, "hsp": 9000.0}, {"fed": 120000.0, "sch_diff": 24000.0}),
                # low volume 1.1: 0.1 x 120,000 = 12,000
                ({"low_volume": 1.1}, {"fed": 120000.0, "low_volume": 12000.0}),
                # capital: 500 x 1.5 (cmi) x 1.2 (gaf) x 10 cases = 9,000
                ({"gaf": 1.2}, {"fed": 120000.0, "capital": 9000.0}),
                # capital with IME, DSH and outliers: 9,000 x (1 + 0.1 + 0.05) x (1 + 0.04) = 9,000 x 1.15 x 1.04 = 10,764
                ({"gaf": 1.2, "ime_cap": 0.1, "dsh_cap": 0.05, "outlier_cap": 0.04},
                 {"fed": 120000.0, "capital": 10764.0}),
                # uncompensated care: 50 per claim x 12 bills = 600 (bills, not the 10 transfer-adjusted cases)
                ({"ucp_per_claim": 50.0}, {"fed": 120000.0, "uc": 600.0}),
                # MDH add-on: 18,000 (worked above)
                ({"mdh": True, "hsp_mdh": 9000.0}, {"fed": 120000.0, "mdh_addon": 18000.0})):
            h = hospital(**changes)
            e = est(h)
            self.assertParts(nonzero(e), parts)
            want_total = sum(parts.values())
            self.assertDollars(e["total"], want_total, changes)
            self.assertDollars(total_payment(h, RATES, base_payment(h, RATES)), want_total, changes)

    def test_outliers_are_a_fraction_of_the_federal_payment_with_ime_and_dsh(self):
        # 0.02 x (120,000 + 12,000 IME + 6,000 DSH) = 0.02 x 138,000 = 2,760
        e = est(ime_op=0.1, dsh_op=0.05, outlier_op=0.02)
        self.assertDollars(e["outlier_op"], 2760.0)
        self.assertDollars(e["total"], 120000 + 12000 + 6000 + 2760)

    def test_ime_dsh_and_outliers_follow_the_federal_payment_not_the_mdh_addon(self):
        # MDH add-on 18,000 is in B but is not a base for IME (0.1 x 120,000, not x 138,000), DSH or outliers
        e = est(mdh=True, hsp_mdh=9000.0, ime_op=0.1, dsh_op=0.05, outlier_op=0.02)
        self.assertParts(nonzero(e), {"fed": 120000.0, "mdh_addon": 18000.0, "ime": 12000.0, "dsh": 6000.0,
                                      "outlier_op": 2760.0})

    def test_low_volume_applies_to_the_operating_payment_only(self):
        # 0.1 x (120,000 + 18,000 MDH + 12,000 IME + 6,000 DSH + 2,760 outliers) = 0.1 x 158,760 = 15,876
        # (not capital, not uncompensated care: those are nonzero here and left out of the base)
        e = est(mdh=True, hsp_mdh=9000.0, ime_op=0.1, dsh_op=0.05, outlier_op=0.02, low_volume=1.1, gaf=1.2,
                ucp_per_claim=50.0)
        self.assertDollars(e["low_volume"], 15876.0)

    def test_a_blank_optional_input_contributes_zero(self):
        # Outliers, hospital-specific rates: None means the file left them blank. No None arithmetic, no error.
        for status in ({"sch": True, "ptype": 16}, {"mdh": True}):
            h = hospital(outlier_op=None, outlier_cap=None, hsp=None, hsp_mdh=None, gaf=1.2, **status)
            e = est(h)
            self.assertEqual(e["outlier_op"], 0)
            self.assertEqual(e["sch_diff"], 0)
            self.assertEqual(e["mdh_addon"], 0)
            self.assertDollars(e["capital"], 9000.0)  # capital without its outlier term: 500 x 1.5 x 1.2 x 10
            self.assertDollars(e["total"], 129000.0)  # 120,000 + 9,000

    def test_a_hospital_flagged_both_sch_and_mdh_raises(self):
        with self.assertRaises(ValueError):
            est(sch=True, mdh=True, hsp=9000.0, hsp_mdh=9000.0)

    def test_a_zero_sch_rate_is_no_rate(self):
        e = est(sch=True, ptype=16, hsp=0.0)
        self.assertEqual(e["sch_diff"], 0)

    def test_an_sch_paid_the_federal_rate_has_no_difference(self):
        # HSP side 7000 x 1.6 x 10 = 112,000 < 120,000: federal rate; nothing extra
        self.assertEqual(est(sch=True, ptype=16, hsp=7000.0)["sch_diff"], 0)

    def test_a_missing_required_input_raises_naming_it(self):
        for key in ("cases", "cmi", "wi", "cola", "gaf", "low_volume", "ime_op", "dsh_cap", "ucp_per_claim", "bills"):
            h = hospital()
            h[key] = None
            with self.assertRaises(ValueError, msg=key) as cm:
                est(h)
            self.assertIn(key, str(cm.exception))

    def test_a_hospital_dict_without_a_key_raises_rather_than_pricing_without_it(self):
        h = hospital()
        del h["ime_op"]
        with self.assertRaises(ValueError):
            est(h)


class Adjustments(Close):
    def test_hrrp_and_hvbp_are_taken_on_the_base_payment(self):
        # B = 138,000 (MDH). HRRP factor 0.97: 138,000 x -0.03 = -4,140. VBP factor 1.01: 138,000 x 0.01 = +1,380.
        # IME, DSH etc. are not in the base the two programs adjust.
        e = est(mdh=True, hsp_mdh=9000.0, ime_op=0.1, hrrp=0.97, vbp=1.01)
        self.assertDollars(e["base"], 138000.0)
        self.assertDollars(e["hrrp"], -4140.0)
        self.assertDollars(e["hvbp"], 1380.0)
        self.assertDollars(e["total"], 138000.0 + 12000.0)
        self.assertDollars(e["after"], 150000.0 - 4140.0 + 1380.0)

    def test_a_factor_of_one_is_no_adjustment(self):
        e = est()
        self.assertEqual(e["hrrp"], 0)
        self.assertEqual(e["hvbp"], 0)
        self.assertDollars(e["after"], e["total"])

    def test_hac_is_one_percent_of_total_after_both(self):
        e = est(ime_op=0.1, hrrp=0.97, vbp=1.01, cut=True)
        self.assertEqual(HAC_RATE, 0.01)
        self.assertDollars(e["hac"], -0.01 * (e["total"] + e["hrrp"] + e["hvbp"]))
        # by hand: T = 120,000 + 12,000 = 132,000; HRRP -3,600; HVBP +1,200; after = 129,600; HAC = -1,296
        self.assertDollars(e["total"], 132000.0)
        self.assertDollars(e["after"], 129600.0)
        self.assertDollars(e["hac"], -1296.0)

    def test_not_cut_keeps_at_stake_and_zero_hac(self):
        e = est(ime_op=0.1, hrrp=0.97, vbp=1.01, cut=False)
        self.assertDollars(e["at_stake"], 1296.0)  # 1% of the same 129,600, whether or not the hospital is cut
        self.assertEqual(e["hac"], 0)
        self.assertEqual(est(ime_op=0.1, hrrp=0.97, vbp=1.01, cut=True)["at_stake"], e["at_stake"])
        self.assertFalse(math.copysign(1.0, e["hac"]) < 0)  # a plain zero, never -0.0

    def test_net_is_the_sum(self):
        e = est(ime_op=0.1, hrrp=0.97, vbp=1.01, cut=True)
        self.assertDollars(e["net"], e["hrrp"] + e["hvbp"] + e["hac"])
        self.assertDollars(e["net"], -3600.0 + 1200.0 - 1296.0)  # -3,696
        n = est(ime_op=0.1, hrrp=0.97, vbp=1.01, cut=False)
        self.assertDollars(n["net"], -3600.0 + 1200.0)

    def test_the_two_factors_are_required_numbers(self):
        with self.assertRaises(ValueError):
            est(hrrp=None)
        with self.assertRaises(ValueError):
            est(vbp=None)

    def test_the_result_has_the_briefed_keys_then_the_components(self):
        e = est()
        self.assertEqual(list(e), ["base", "total", "hrrp", "hvbp", "after", "at_stake", "hac", "net", "fed",
                                   "mdh_addon", "ime", "dsh", "outlier_op", "sch_diff", "low_volume", "capital",
                                   "uc"])
        self.assertTrue(all(isinstance(v, float) for v in e.values()))

    def test_estimate_does_not_change_its_inputs(self):
        h = hospital(mdh=True, hsp_mdh=9000.0)
        before = dict(h)
        est(h)
        self.assertEqual(h, before)


class AllTerms(Close):
    def test_a_medicare_dependent_hospital_with_every_term(self):
        # fed 120,000; MDH add-on 0.75 x (9000 x 1.6 x 10 - 120,000) = 18,000 -> B = 138,000
        # IME 12,000; DSH 6,000; outliers 0.02 x (120,000 + 12,000 + 6,000) = 2,760; no SCH difference
        # low volume 0.1 x (120,000 + 18,000 + 12,000 + 6,000 + 2,760) = 15,876
        # capital 500 x 1.5 x 1.2 x (1 + 0.1 + 0.05) x 10 x (1 + 0.04) = 10,764; UC 50 x 12 = 600
        # T = 138,000 + 12,000 + 6,000 + 2,760 + 15,876 + 10,764 + 600 = 186,000
        # HRRP 0.97: 138,000 x -0.03 = -4,140; VBP 1.01: +1,380; after = 183,240; HAC = -1,832.40
        e = est(mdh=True, hsp_mdh=9000.0, ime_op=0.1, dsh_op=0.05, outlier_op=0.02, low_volume=1.1, gaf=1.2,
                ime_cap=0.1, dsh_cap=0.05, outlier_cap=0.04, ucp_per_claim=50.0, hrrp=0.97, vbp=1.01, cut=True)
        want = {"base": 138000.0, "total": 186000.0, "hrrp": -4140.0, "hvbp": 1380.0, "after": 183240.0,
                "at_stake": 1832.4, "hac": -1832.4, "net": -4140.0 + 1380.0 - 1832.4, "fed": 120000.0,
                "mdh_addon": 18000.0, "ime": 12000.0, "dsh": 6000.0, "outlier_op": 2760.0, "sch_diff": 0.0,
                "low_volume": 15876.0, "capital": 10764.0, "uc": 600.0}
        self.assertParts(e, want)

    def test_a_sole_community_hospital_with_every_term(self):
        # fed 120,000 = B; SCH difference 9000 x 1.6 x 10 - 120,000 = 24,000 (in T, not in B)
        # IME 12,000; DSH 6,000; outliers 2,760; low volume 0.1 x (120,000 + 12,000 + 6,000 + 2,760) = 14,076
        # capital 10,764; UC 600
        # T = 120,000 + 12,000 + 6,000 + 2,760 + 24,000 + 14,076 + 10,764 + 600 = 190,200
        # HRRP 0.97: 120,000 x -0.03 = -3,600; VBP 1.01: +1,200; after = 187,800; at stake 1,878; not cut
        e = est(sch=True, ptype=16, hsp=9000.0, ime_op=0.1, dsh_op=0.05, outlier_op=0.02, low_volume=1.1, gaf=1.2,
                ime_cap=0.1, dsh_cap=0.05, outlier_cap=0.04, ucp_per_claim=50.0, hrrp=0.97, vbp=1.01, cut=False)
        want = {"base": 120000.0, "total": 190200.0, "hrrp": -3600.0, "hvbp": 1200.0, "after": 187800.0,
                "at_stake": 1878.0, "hac": 0.0, "net": -2400.0, "fed": 120000.0, "mdh_addon": 0.0, "ime": 12000.0,
                "dsh": 6000.0, "outlier_op": 2760.0, "sch_diff": 24000.0, "low_volume": 14076.0, "capital": 10764.0,
                "uc": 600.0}
        self.assertParts(e, want)

    def test_the_components_add_up_to_the_total(self):
        e = est(mdh=True, hsp_mdh=9000.0, ime_op=0.1, dsh_op=0.05, outlier_op=0.02, low_volume=1.1, gaf=1.2,
                ucp_per_claim=50.0)
        parts = ("fed", "mdh_addon", "ime", "dsh", "outlier_op", "sch_diff", "low_volume", "capital", "uc")
        self.assertDollars(sum(e[k] for k in parts), e["total"])
        self.assertDollars(e["base"], e["fed"] + e["mdh_addon"])


if __name__ == "__main__":
    unittest.main()
