"""The per-hospital dollar estimate, on synthetic hospitals with small round numbers. Every expected value is worked by
hand in the test that checks it (the arithmetic is in a comment beside the number)."""
import math
import random
import unittest

from pp_engine.dollars import (HAC_SHARE, HRRP_SHARE, PARTS, STATUSES, VBP_NET_OF_POOL, VBP_WITHHOLD,
                               YES_UNESTIMATED_MAX, checks, estimate, hospital_row, national, round_dollars, status)
from pp_engine.parse import SchemaError
from pp_engine.tests.fixtures import assert_adds_up

# Invented standardized amounts (labor, nonlabor), all different so a mix-up of table, key or column shows.
RATES = {
    "operating": {
        "1A": {"qe": (4000.0, 2000.0), "qn": (3900.0, 1900.0), "ne": (3800.0, 1800.0), "nn": (3700.0, 1700.0)},
        "1B": {"qe": (3000.0, 2500.0), "qn": (2900.0, 2400.0), "ne": (2800.0, 2300.0), "nn": (2700.0, 2200.0)},
        "1C": {"qe": (3100.0, 2600.0), "qn": (3000.0, 2500.0)},
    },
    "capital": 500.0,
    # The FY2026 update (percent) each scenario's heading states in Tables 1A/1B, invented and all different: the
    # hospital-specific rate of a Medicare-dependent hospital is multiplied by (1 + mdh_update / 100), where the impact
    # file's rate is the year before's (`update` is the headings' own; `mdh_update` what the rate takes).
    "update": {"qe": 10.0, "qn": 5.0, "ne": 2.5, "nn": -5.0},
    "mdh_update": {"qe": 10.0, "qn": 5.0, "ne": 2.5, "nn": -5.0},
}
# The rates of a final rule whose impact file already gives the MDH rate updated to the year: no further update.
RATES_UPDATED = {**RATES, "mdh_update": dict.fromkeys(RATES["mdh_update"], 0.0)}

# The synthetic hospital: 10 cases at a case-mix of 1.5 and a wage index of 1.5 (Table 1A, quality + EHR scenario), so
# its federal DRG payment is 10 x 1.5 x (4000 x 1.5 + 2000 x 1.0) = 15 x 8000 = 120,000. Everything else is off:
# no add-ons, no capital (gaf 0 turns the capital payment off), no uncompensated care.
FED = 120000.0


def hospital(**changes):
    h = {"cases": 10.0, "cmi": 1.5, "bills": 12, "cmi_hsp": 1.6, "wi": 1.5, "cola": 1.0, "quality": 0, "ehr": 0,
         "ptype": 0, "sch": False, "mdh": False, "hsp": None, "hsp_mdh": None, "ime_op": 0.0, "ime_cap": 0.0,
         "dsh_op": 0.0, "dsh_cap": 0.0, "ucp_per_claim": 0.0, "outlier_op": 0.0, "outlier_cap": 0.0, "gaf": 0.0,
         "low_volume": 1.0, "pr": False, "ime_cases": None, "ime_cmi": None}
    h.update(changes)
    return h


def est(h=None, hrrp=1.0, vbp=1.0, cut=False, **changes):
    return estimate(h if h is not None else hospital(**changes), RATES, hrrp=hrrp, vbp=vbp, cut=cut)


def nonzero(e):
    """The estimate's dollar components that are not zero."""
    return {k: e[k] for k in PARTS if e[k] != 0}


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
        self.assertDollars(est()["base"], 120000.0)
        # wage index 1.0 is "at or below": Table 1B: 15 x (3000 x 1 + 2500 x 1) = 15 x 5500 = 82,500
        self.assertDollars(est(wi=1.0)["base"], 82500.0)
        # wage index 0.8, Table 1B: 15 x (3000 x 0.8 + 2500 x 1) = 15 x 4900 = 73,500
        self.assertDollars(est(wi=0.8)["base"], 73500.0)
        # just above 1 flips to Table 1A: 15 x (4000 x 1.0001 + 2000) = 15 x 6000.4 = 90,006
        self.assertDollars(est(wi=1.0001)["base"], 90006.0)

    def test_cola_scales_nonlabor_only(self):
        # Table 1A, cola 1.2: 15 x (4000 x 1.5 + 2000 x 1.2) = 15 x 8400 = 126,000
        self.assertDollars(est(cola=1.2)["base"], 126000.0)
        # Table 1B, cola 1.2: 15 x (3000 x 0.8 + 2500 x 1.2) = 15 x 5400 = 81,000
        self.assertDollars(est(wi=0.8, cola=1.2)["base"], 81000.0)

    def test_cases_and_cmi_scale_the_whole_payment(self):
        # 20 cases at 1.0: 20 x 8000 = 160,000
        self.assertDollars(est(cases=20.0, cmi=1.0)["base"], 160000.0)

    def test_the_four_quality_and_ehr_flags_each_pick_their_pair(self):
        one = dict(cases=1.0, cmi=1.0)  # one case-mix-weighted case: B is the rate itself, Table 1A, wage index 1.5
        for quality, ehr, want in ((0, 0, 4000 * 1.5 + 2000.0),   # qe 8000
                                   (0, 1, 3900 * 1.5 + 1900.0),   # qn 7750
                                   (1, 0, 3800 * 1.5 + 1800.0),   # ne 7500
                                   (1, 1, 3700 * 1.5 + 1700.0)):  # nn 7250
            self.assertDollars(est(quality=quality, ehr=ehr, **one)["base"], want, (quality, ehr))
        # and Table 1B's, wage index 1: 2900 + 2400 (qn)
        self.assertDollars(est(wi=1.0, ehr=1, **one)["base"], 5300.0)

    def test_puerto_rico_uses_table_1c_whatever_the_wage_index(self):
        one = dict(cases=1.0, cmi=1.0, pr=True)
        # 1C qe: 3100 x 0.8 + 2600 = 5080; 1C qn (EHR reduction): 3000 x 0.8 + 2500 = 4900
        self.assertDollars(est(wi=0.8, **one)["base"], 5080.0)
        self.assertDollars(est(wi=0.8, ehr=1, **one)["base"], 4900.0)
        # a wage index above 1 still reads 1C (the file has no such Puerto Rico hospital; the rule is the table's)
        self.assertDollars(est(wi=1.5, **one)["base"], 3100 * 1.5 + 2600.0)

    def test_a_puerto_rico_hospital_whose_key_is_not_in_1c_raises(self):
        with self.assertRaises(ValueError):
            est(pr=True, wi=0.8, quality=1)["base"]  # 1C has qe and qn only

    def test_mdh_addon_is_three_quarters_of_the_shortfall_and_never_negative(self):
        # HSP side: 9000 x 1.10 (the qe update, 10%) x 1.6 (cmi_hsp) x 10 cases = 9,900 x 16 = 158,400;
        # shortfall against the federal payment 158,400 - 120,000 = 38,400; 75% = 28,800
        h = hospital(mdh=True, hsp_mdh=9000.0)
        self.assertDollars(est(h)["base"], 148800.0)
        e = est(h)
        self.assertParts(nonzero(e), {"fed": 120000.0, "mdh_addon": 28800.0})
        # HSP side below the federal payment: 6500 x 1.10 x 16 = 114,400 < 120,000: no add-on, never negative
        low = hospital(mdh=True, hsp_mdh=6500.0)
        self.assertDollars(est(low)["base"], 120000.0)
        self.assertEqual(est(low)["mdh_addon"], 0)

    def test_the_mdh_rate_is_updated_to_fy2026_by_the_hospitals_scenario(self):
        # The impact file's MDH rate is the FY2025 one; the FY2026 rate is it x (1 + the scenario's update). 8000 stands
        # for the file's rate, cmi_hsp 1.6, 10 cases: 128,000 before the update, so the update is what moves the add-on.
        # qe (+10%): 8000 x 1.10 x 16 = 140,800 vs fed 120,000: shortfall 20,800; 75% = 15,600 (not 0.75 x 8,000 = 6,000)
        self.assertDollars(est(mdh=True, hsp_mdh=8000.0)["mdh_addon"], 15600.0)
        # qn (quality ok, EHR reduced: +5%): fed 15 x (3900 x 1.5 + 1900) = 116,250; 8000 x 1.05 x 16 = 134,400;
        # shortfall 18,150; 75% = 13,612.50
        e = est(mdh=True, hsp_mdh=8000.0, ehr=1)
        self.assertDollars(e["fed"], 116250.0)
        self.assertDollars(e["mdh_addon"], 13612.5)
        # ne (quality failed, EHR ok: +2.5%): fed 15 x (3800 x 1.5 + 1800) = 112,500; 8000 x 1.025 x 16 = 131,200;
        # shortfall 18,700; 75% = 14,025
        self.assertDollars(est(mdh=True, hsp_mdh=8000.0, quality=1)["mdh_addon"], 14025.0)
        # nn (both reduced: -5%): fed 15 x (3700 x 1.5 + 1700) = 108,750; 8000 x 0.95 x 16 = 121,600; shortfall 12,850;
        # 75% = 9,637.50 (a negative update lowers the rate)
        self.assertDollars(est(mdh=True, hsp_mdh=8000.0, quality=1, ehr=1)["mdh_addon"], 9637.5)

    def test_an_mdh_rate_the_file_already_updated_is_not_updated_again(self):
        # FY2024's impact file states its MDH rates "updated to FY 2024": its rates' mdh_update is 0 and the rate is
        # used as it is. 8000 x 1.6 x 10 = 128,000 vs fed 120,000: shortfall 8,000; 75% = 6,000 (not 15,600)
        e = estimate(hospital(mdh=True, hsp_mdh=8000.0), RATES_UPDATED, hrrp=1.0, vbp=1.0, cut=False)
        self.assertDollars(e["mdh_addon"], 6000.0)

    def test_a_puerto_rico_mdh_takes_the_update_of_its_ehr_scenario(self):
        # Table 1C qn (EHR reduced: +5%), wage index 0.8: fed 15 x (3000 x 0.8 + 2500) = 73,500; 8000 x 1.05 x 16 =
        # 134,400; shortfall 60,900; 75% = 45,675
        e = est(mdh=True, hsp_mdh=8000.0, pr=True, wi=0.8, ehr=1)
        self.assertDollars(e["fed"], 73500.0)
        self.assertDollars(e["mdh_addon"], 45675.0)

    def test_a_rates_table_without_the_update_raises_for_an_mdh_that_needs_it(self):
        no_update = {k: v for k, v in RATES.items() if k != "mdh_update"}
        with self.assertRaises(ValueError):
            estimate(hospital(mdh=True, hsp_mdh=8000.0), no_update, hrrp=1.0, vbp=1.0, cut=False)
        # a hospital that has no MDH rate to update does not need it
        estimate(hospital(), no_update, hrrp=1.0, vbp=1.0, cut=False)

    def test_the_mdh_comparison_is_against_the_federal_side_with_its_add_ons(self):
        # FY2026 final rule: an MDH is paid "the higher of the Federal rate, or the Federal rate plus 75 percent of the
        # difference between the Federal rate and the hospital-specific rate". The Federal rate is the whole federal
        # operating payment: F = fed 120,000 + IME 12,000 + DSH 6,000 + outliers 0.02 x 138,000 = 2,760 + UC 50 x 12 = 600
        # = 141,360. H = 158,400 (as above). Add-on 0.75 x (158,400 - 141,360) = 0.75 x 17,040 = 12,780
        # (against fed alone it would be 28,800).
        e = est(mdh=True, hsp_mdh=9000.0, ime_op=0.1, dsh_op=0.05, outlier_op=0.02, ucp_per_claim=50.0)
        self.assertDollars(e["mdh_addon"], 12780.0)
        # F above H: nothing. IME 0.4 x 120,000 = 48,000 puts F at 168,000, past H = 158,400
        self.assertEqual(est(mdh=True, hsp_mdh=9000.0, ime_op=0.4)["mdh_addon"], 0)

    def test_mdh_addon_needs_the_flag_and_a_usable_hsp_rate(self):
        for h in (hospital(mdh=False, hsp_mdh=9000.0),  # the rate is there, the status is not
                  hospital(mdh=True, hsp_mdh=None),     # the status, no rate (blank)
                  hospital(mdh=True, hsp_mdh=0.0)):     # a zero rate is "no usable rate"
            self.assertDollars(est(h)["base"], FED)

    def test_the_mdh_comparison_uses_the_hsp_case_mix_not_the_transfer_adjusted_one(self):
        # cmi_hsp 1.0 instead of 1.6: HSP side 9000 x 1.0 x 10 = 90,000 < 120,000: no add-on
        self.assertDollars(est(mdh=True, hsp_mdh=9000.0, cmi_hsp=1.0)["base"], FED)

    def test_sch_base_is_federal(self):
        # The SCH rate is higher (9000 x 1.6 x 10 = 144,000) yet B stays the federal 120,000; the 24,000 is in T.
        h = hospital(sch=True, ptype=16, hsp=9000.0)
        self.assertDollars(est(h)["base"], FED)
        self.assertDollars(est(h)["sch_diff"], 24000.0)

    def test_the_sch_comparison_is_against_the_federal_side_with_its_add_ons(self):
        # FY2026 final rule: an SCH is paid "the higher of the applicable Federal rate, or the hospital-specific rate".
        # F = fed 120,000 + IME 12,000 + DSH 6,000 + outliers 0.02 x 138,000 = 2,760 + UC 50 x 12 = 600 = 141,360.
        # H = 9000 x 1.6 x 10 = 144,000 (the SCH file's rate is already the FY2026 one: no update). Difference
        # 144,000 - 141,360 = 2,640 (against fed alone it would be 24,000).
        e = est(sch=True, ptype=16, hsp=9000.0, ime_op=0.1, dsh_op=0.05, outlier_op=0.02, ucp_per_claim=50.0)
        self.assertDollars(e["sch_diff"], 2640.0)
        # a hospital paid its hospital-specific rate is paid H in all: nothing lies on top of it
        self.assertDollars(e["fed"] + e["ime"] + e["dsh"] + e["outlier_op"] + e["uc"] + e["sch_diff"], 144000.0)

    def test_an_sch_whose_federal_side_with_add_ons_passes_its_hsp_payment_has_no_difference(self):
        # H = 144,000 beats fed 120,000, but IME 0.25 x 120,000 = 30,000 lifts F to 150,000: paid the federal rate
        e = est(sch=True, ptype=16, hsp=9000.0, ime_op=0.25)
        self.assertDollars(e["fed"] + e["ime"], 150000.0)
        self.assertEqual(e["sch_diff"], 0)
        # exactly equal: no difference either (F = 144,000 with IME 0.2)
        self.assertEqual(est(sch=True, ptype=16, hsp=9000.0, ime_op=0.2)["sch_diff"], 0)

    def test_the_sch_rate_is_not_updated(self):
        # the SCH column is already "updated to FY 2026" (the impact file's README); the scenario's update is not applied
        for changes in ({}, {"ehr": 1}, {"quality": 1, "ehr": 1}):
            e = est(sch=True, ptype=16, hsp=9000.0, **changes)
            self.assertDollars(e["sch_diff"], 144000.0 - e["fed"], changes)


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
                # MDH add-on: 28,800 (worked above)
                ({"mdh": True, "hsp_mdh": 9000.0}, {"fed": 120000.0, "mdh_addon": 28800.0})):
            h = hospital(**changes)
            e = est(h)
            self.assertParts(nonzero(e), parts)
            want_total = sum(parts.values())
            self.assertDollars(e["total"], want_total, changes)

    def test_outliers_are_a_fraction_of_the_federal_payment_with_ime_and_dsh(self):
        # 0.02 x (120,000 + 12,000 IME + 6,000 DSH) = 0.02 x 138,000 = 2,760
        e = est(ime_op=0.1, dsh_op=0.05, outlier_op=0.02)
        self.assertDollars(e["outlier_op"], 2760.0)
        self.assertDollars(e["total"], 120000 + 12000 + 6000 + 2760)

    def test_ime_dsh_and_outliers_follow_the_federal_payment_not_the_mdh_addon(self):
        # The MDH add-on is in B but is not a base for IME (0.1 x 120,000, not x B), DSH or outliers.
        # F = 120,000 + 12,000 + 6,000 + 2,760 = 140,760; add-on 0.75 x (158,400 - 140,760) = 0.75 x 17,640 = 13,230
        e = est(mdh=True, hsp_mdh=9000.0, ime_op=0.1, dsh_op=0.05, outlier_op=0.02)
        self.assertParts(nonzero(e), {"fed": 120000.0, "mdh_addon": 13230.0, "ime": 12000.0, "dsh": 6000.0,
                                      "outlier_op": 2760.0})

    def test_low_volume_is_on_total_per_discharge_payments_but_not_uncompensated_care(self):
        # FY2026 final rule: the adjustment "is based on total per discharge payments made under section 1886 of the
        # Act, including capital, DSH, IME, and outlier payments". Base = fed 120,000 + MDH add-on + IME 12,000 +
        # DSH 6,000 + outliers 2,760 + SCH difference (none) + capital 10,764. The MDH add-on (F = 141,360 with the
        # 600 of UC; H = 158,400) is 0.75 x 17,040 = 12,780. Base 164,304; x 0.1 = 16,430.4. Uncompensated care (600)
        # is nonzero here and not in the base.
        e = est(mdh=True, hsp_mdh=9000.0, ime_op=0.1, dsh_op=0.05, outlier_op=0.02, low_volume=1.1, gaf=1.2,
                ime_cap=0.1, dsh_cap=0.05, outlier_cap=0.04, ucp_per_claim=50.0)
        self.assertDollars(e["capital"], 10764.0)
        self.assertDollars(e["uc"], 600.0)
        self.assertDollars(e["mdh_addon"], 12780.0)
        self.assertDollars(e["low_volume"], 16430.4)

    def test_low_volume_for_an_sch_includes_the_hsp_difference(self):
        # "For SCHs and MDHs, the low-volume hospital payment adjustment is based in part on either the Federal rate or
        # the hospital-specific rate, whichever results in a greater operating IPPS payment." SCH, H = 144,000;
        # IME 12,000 -> F = 132,000, difference 12,000; capital 500 x 1.5 x 1.2 x 10 = 9,000.
        # Base 120,000 + 12,000 + 12,000 + 9,000 = 153,000; x 0.1 = 15,300
        e = est(sch=True, ptype=16, hsp=9000.0, ime_op=0.1, low_volume=1.1, gaf=1.2)
        self.assertDollars(e["sch_diff"], 12000.0)
        self.assertDollars(e["low_volume"], 15300.0)

    def test_low_volume_with_nothing_else_is_on_the_federal_payment_and_capital(self):
        # 0.1 x (120,000 + 9,000 capital) = 12,900
        self.assertDollars(est(low_volume=1.1, gaf=1.2)["low_volume"], 12900.0)

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

    def test_medicare_advantage_ime_is_priced_like_the_hospitals_own_ime_and_enters_t_only(self):
        # IME factor 0.1 x 4 MA cases x MA cmi 2.0 x (4000 x 1.5 + 2000 x 1.0) = 0.1 x 8 x 8,000 = 6,400
        e = est(ime_op=0.1, ime_cases=4.0, ime_cmi=2.0)
        self.assertParts(nonzero(e), {"fed": 120000.0, "ime": 12000.0, "ime_ma": 6400.0})
        self.assertDollars(e["base"], 120000.0)  # not in the base the readmissions and value-based programs adjust
        self.assertDollars(e["total"], 120000.0 + 12000.0 + 6400.0)
        self.assertDollars(e["at_stake"], 0.01 * 138400.0)  # but in the payment the HAC cut is taken on
        # Table 1B, COLA and the hospital's scenario price it as they price its own stays: wage index 0.8, cola 1.2,
        # quality failed (ne): 0.1 x 8 x (2800 x 0.8 + 2300 x 1.2) = 0.8 x 5,000 = 4,000
        self.assertDollars(est(ime_op=0.1, ime_cases=4.0, ime_cmi=2.0, wi=0.8, cola=1.2, quality=1)["ime_ma"], 4000.0)
        # no IME factor, or blank or zero MA columns: none
        for changes in ({"ime_op": 0.0, "ime_cases": 4.0, "ime_cmi": 2.0}, {"ime_op": 0.1, "ime_cases": None, "ime_cmi": 2.0},
                        {"ime_op": 0.1, "ime_cases": 4.0, "ime_cmi": None}, {"ime_op": 0.1, "ime_cases": 0.0, "ime_cmi": 2.0}):
            self.assertEqual(est(**changes)["ime_ma"], 0, changes)

    def test_medicare_advantage_ime_is_outside_the_sch_and_mdh_comparisons_and_the_low_volume_base(self):
        # Worksheet E adds line 29.01 after the comparison (line 49): an MDH's add-on and an SCH's difference are what
        # they are without it (13,230 and 12,000, worked above), and the low-volume base leaves it out (16,430.4 above).
        ma = {"ime_cases": 4.0, "ime_cmi": 2.0}
        e = est(mdh=True, hsp_mdh=9000.0, ime_op=0.1, dsh_op=0.05, outlier_op=0.02, **ma)
        self.assertDollars(e["mdh_addon"], 13230.0)
        self.assertDollars(est(sch=True, ptype=16, hsp=9000.0, ime_op=0.1, low_volume=1.1, gaf=1.2, **ma)["sch_diff"], 12000.0)
        lv = est(mdh=True, hsp_mdh=9000.0, ime_op=0.1, dsh_op=0.05, outlier_op=0.02, low_volume=1.1, gaf=1.2,
                 ime_cap=0.1, dsh_cap=0.05, outlier_cap=0.04, ucp_per_claim=50.0, **ma)
        self.assertDollars(lv["low_volume"], 16430.4)
        self.assertDollars(lv["ime_ma"], 6400.0)

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
        # MDH: F = 120,000 + IME 12,000 = 132,000; add-on 0.75 x (158,400 - 132,000) = 19,800; B = 139,800.
        # HRRP factor 0.97: 139,800 x -0.03 = -4,194. VBP factor 1.01: 139,800 x 0.01 = +1,398.
        # IME, DSH etc. are not in the base the two programs adjust.
        e = est(mdh=True, hsp_mdh=9000.0, ime_op=0.1, hrrp=0.97, vbp=1.01)
        self.assertDollars(e["base"], 139800.0)
        self.assertDollars(e["hrrp"], -4194.0)
        self.assertDollars(e["hvbp"], 1398.0)
        self.assertDollars(e["total"], 139800.0 + 12000.0)
        self.assertDollars(e["after"], 151800.0 - 4194.0 + 1398.0)

    def test_a_factor_of_one_is_no_adjustment(self):
        e = est()
        self.assertEqual(e["hrrp"], 0)
        self.assertEqual(e["hvbp"], 0)
        self.assertDollars(e["after"], e["total"])

    def test_hac_is_one_percent_of_total_after_both(self):
        e = est(ime_op=0.1, hrrp=0.97, vbp=1.01, cut=True)
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
                                   "mdh_addon", "ime", "ime_ma", "dsh", "outlier_op", "sch_diff", "low_volume", "capital",
                                   "uc"])
        self.assertTrue(all(isinstance(v, float) for v in e.values()))

    def test_estimate_does_not_change_its_inputs(self):
        h = hospital(mdh=True, hsp_mdh=9000.0)
        before = dict(h)
        est(h)
        self.assertEqual(h, before)


class AllTerms(Close):
    def test_a_medicare_dependent_hospital_with_every_term(self):
        # fed 120,000; IME 12,000; DSH 6,000; outliers 0.02 x (120,000 + 12,000 + 6,000) = 2,760; UC 50 x 12 = 600
        # F = 141,360; MDH add-on 0.75 x (9000 x 1.10 x 1.6 x 10 - 141,360) = 0.75 x 17,040 = 12,780 -> B = 132,780
        # capital 500 x 1.5 x 1.2 x (1 + 0.1 + 0.05) x 10 x (1 + 0.04) = 10,764; no SCH difference
        # low volume 0.1 x (120,000 + 12,780 + 12,000 + 6,000 + 2,760 + 10,764) = 0.1 x 164,304 = 16,430.4
        # T = 132,780 + 12,000 + 6,000 + 2,760 + 16,430.4 + 10,764 + 600 = 181,334.4
        # HRRP 0.97: 132,780 x -0.03 = -3,983.4; VBP 1.01: +1,327.8; after = 178,678.8; HAC = -1,786.788
        e = est(mdh=True, hsp_mdh=9000.0, ime_op=0.1, dsh_op=0.05, outlier_op=0.02, low_volume=1.1, gaf=1.2,
                ime_cap=0.1, dsh_cap=0.05, outlier_cap=0.04, ucp_per_claim=50.0, hrrp=0.97, vbp=1.01, cut=True)
        want = {"base": 132780.0, "total": 181334.4, "hrrp": -3983.4, "hvbp": 1327.8, "after": 178678.8,
                "at_stake": 1786.788, "hac": -1786.788, "net": -3983.4 + 1327.8 - 1786.788, "fed": 120000.0,
                "mdh_addon": 12780.0, "ime": 12000.0, "ime_ma": 0.0, "dsh": 6000.0, "outlier_op": 2760.0, "sch_diff": 0.0,
                "low_volume": 16430.4, "capital": 10764.0, "uc": 600.0}
        self.assertParts(e, want)

    def test_a_sole_community_hospital_with_every_term(self):
        # fed 120,000 = B; IME 12,000; DSH 6,000; outliers 2,760; UC 600; F = 141,360
        # SCH difference 9000 x 1.6 x 10 - 141,360 = 2,640 (in T, not in B); capital 10,764
        # low volume 0.1 x (120,000 + 12,000 + 6,000 + 2,760 + 2,640 + 10,764) = 0.1 x 154,164 = 15,416.4
        # T = 120,000 + 12,000 + 6,000 + 2,760 + 2,640 + 15,416.4 + 10,764 + 600 = 170,180.4
        # HRRP 0.97: 120,000 x -0.03 = -3,600; VBP 1.01: +1,200; after = 167,780.4; at stake 1,677.804; not cut
        e = est(sch=True, ptype=16, hsp=9000.0, ime_op=0.1, dsh_op=0.05, outlier_op=0.02, low_volume=1.1, gaf=1.2,
                ime_cap=0.1, dsh_cap=0.05, outlier_cap=0.04, ucp_per_claim=50.0, hrrp=0.97, vbp=1.01, cut=False)
        want = {"base": 120000.0, "total": 170180.4, "hrrp": -3600.0, "hvbp": 1200.0, "after": 167780.4,
                "at_stake": 1677.804, "hac": 0.0, "net": -2400.0, "fed": 120000.0, "mdh_addon": 0.0, "ime": 12000.0, "ime_ma": 0.0,
                "dsh": 6000.0, "outlier_op": 2760.0, "sch_diff": 2640.0, "low_volume": 15416.4, "capital": 10764.0,
                "uc": 600.0}
        self.assertParts(e, want)

    def test_the_components_add_up_to_the_total(self):
        e = est(mdh=True, hsp_mdh=9000.0, ime_op=0.1, dsh_op=0.05, outlier_op=0.02, low_volume=1.1, gaf=1.2,
                ucp_per_claim=50.0)
        self.assertDollars(sum(e[k] for k in PARTS), e["total"])
        self.assertDollars(e["base"], e["fed"] + e["mdh_addon"])


# --- statuses, rows and the national checks ---------------------------------------------------------------------------

# Invented CCNs and states. A row's dollars are worked on the synthetic hospital above: B = T = 120,000 (no add-ons).
NO_PARHM = frozenset()


def row(ccn="990001", state="VA", inp=None, hrrp=None, vbp=None, cut=False, parhm=NO_PARHM):
    return hospital_row(ccn, state, hospital() if inp is None else inp, RATES, hrrp=hrrp, vbp=vbp, cut=cut,
                        parhm=parhm)


def bare(ccn, status_, cut=False, hrrp_listed=True, vbp_listed=True, **dollars):
    """A row built by hand: the national functions read only these keys."""
    r = {"ccn": ccn, "status": status_, "cut": cut, "hrrp_listed": hrrp_listed, "vbp_listed": vbp_listed}
    r.update(dollars)
    return r


def money(base, hrrp=0, hvbp=0, hac=0, total=None):
    total = base if total is None else total
    parts = {**dict.fromkeys(PARTS, 0), "fed": base, "uc": total - base}  # B is all federal payment; the rest, uc
    return {"base": base, "total": total, "hrrp": hrrp, "hvbp": hvbp, "after": total + hrrp + hvbp, "hac": hac,
            "net": hrrp + hvbp + hac, **parts}


NAT = {"hospitals": 4, "base": 480000, "total": 480000, "hrrp": -2112, "hvbp": 0, "after": 477888, "hac": -1195,
       "net": -3307, "cut": 1, "hrrp_base": 480000, "vbp_base": 240000, "yes": 1, "yes_unestimated": 0,
       "by_status": {"estimated": 4, "maryland": 0, "parhm": 0, "no-inputs": 0},
       "parts": {**dict.fromkeys(PARTS, 0), "fed": 480000}}


class Status(unittest.TestCase):
    def test_the_four_statuses(self):
        self.assertEqual(STATUSES, ("estimated", "maryland", "parhm", "no-inputs"))

    def test_a_priced_hospital_is_estimated(self):
        self.assertEqual(status("990001", "VA", hospital(), NO_PARHM), "estimated")

    def test_maryland_is_maryland_whatever_else_is_true(self):
        self.assertEqual(status("990001", "MD", hospital(), NO_PARHM), "maryland")
        self.assertEqual(status("990001", "MD", None, NO_PARHM), "maryland")  # no impact row: still Maryland
        self.assertEqual(status("990001", "MD", hospital(cases=0.0), frozenset({"990001"})), "maryland")

    def test_a_participant_set_member_is_parhm_only_when_in_the_set(self):
        self.assertEqual(status("990001", "PA", hospital(), frozenset({"990001"})), "parhm")
        self.assertEqual(status("990002", "PA", hospital(), frozenset({"990001"})), "estimated")
        # it outranks no-inputs: the reason shown to a reader is the program, not the missing file row
        self.assertEqual(status("990001", "PA", None, frozenset({"990001"})), "parhm")

    def test_no_row_or_blank_or_zero_cases_or_case_mix_is_no_inputs(self):
        for inp in (None, hospital(cases=0.0), hospital(cases=None), hospital(cmi=0.0), hospital(cmi=None),
                    hospital(cases=-1.0), hospital(cmi=-0.5), hospital(cases=float("nan"))):
            self.assertEqual(status("990001", "VA", inp, NO_PARHM), "no-inputs", inp)
        # a row with no cases key at all is a hospital the file did not price
        self.assertEqual(status("990001", "VA", {"cmi": 1.5}, NO_PARHM), "no-inputs")
        self.assertEqual(status("990001", "VA", {}, NO_PARHM), "no-inputs")

    def test_state_is_matched_exactly(self):
        for state in ("VA", "", "MA", "mD"):
            self.assertEqual(status("990001", state, hospital(), NO_PARHM), "estimated", state)


class RoundDollars(unittest.TestCase):
    def test_every_dollar_field_becomes_a_whole_number_of_dollars(self):
        rounded = round_dollars(est(ime_op=0.1, hrrp=0.9956, vbp=1.0, cut=True), cut=True)
        # B = 120,000; T = 120,000 + IME 12,000 = 132,000; HRRP 120,000 x -0.0044 = -528; after = 131,472;
        # at stake 0.01 x 131,472 = 1,314.72 -> 1,315; HAC -1,315; net = -528 - 1,315
        self.assertEqual(rounded["base"], 120000)
        self.assertEqual(rounded["total"], 132000)
        self.assertEqual(rounded["hrrp"], -528)
        self.assertEqual(rounded["after"], 131472)
        self.assertEqual(rounded["at_stake"], 1315)
        self.assertEqual(rounded["hac"], -1315)
        self.assertEqual(rounded["net"], -1843)
        self.assertEqual(rounded["ime"], 12000)
        self.assertTrue(all(type(v) is int for v in rounded.values()), rounded)
        self.assertEqual(list(rounded), list(est()))  # same keys, same order

    def test_each_part_is_pythons_round(self):
        # fed 100.4 -> 100; a half goes to the even dollar (2.5 -> 2, 3.5 -> 4); a negative rounds toward the nearer
        for part, value, want in (("fed", 100.4, 100), ("ime", 100.6, 101), ("dsh", 2.5, 2), ("capital", 3.5, 4),
                                  ("uc", 0.4, 0), ("sch_diff", 0.0, 0), ("hrrp", -4140.4, -4140),
                                  ("hrrp", -4140.6, -4141), ("hvbp", -0.4, 0)):
            self.assertEqual(round_dollars(dict(est(), **{part: value}), cut=False)[part], want, (part, value))
        self.assertEqual(str(round_dollars(dict(est(), hvbp=-0.0), cut=False)["hvbp"]), "0")  # an int zero, never -0.0

    def test_the_sums_come_from_the_rounded_parts(self):
        # Hand-worked, B = 4,900.39 (wage index 0.80013, Table 1B: 3000 x 0.80013 + 2500):
        #   IME 0.1 x B = 490.039; DSH 0.05 x B = 245.0195; outliers 0.02 x (B + IME + DSH) = 112.70897;
        #   capital 500 x 1.2 x 1 = 600; UC 0.37 x 12 = 4.44
        #   low volume 0.1 x (B + IME + DSH + outliers + capital) = 0.1 x 6,348.15747 = 634.815747
        #   rounded: 4,900 + 490 + 245 + 113 + 0 + 635 + 600 + 4
        # base 4,900; total 4,900 + 490 + 245 + 113 + 635 + 600 + 4 = 6,987
        # HRRP 0.97: B x -0.03 = -147.0117 -> -147; HVBP 1.01: +49.0039 -> 49; after 6,987 - 147 + 49 = 6,889
        # at stake round(68.89) = 69; HAC -69; net -147 + 49 - 69 = -167
        r = round_dollars(est(cases=1.0, cmi=1.0, wi=0.80013, ime_op=0.1, dsh_op=0.05, outlier_op=0.02,
                              low_volume=1.1, gaf=1.2, ucp_per_claim=0.37, hrrp=0.97, vbp=1.01, cut=True), cut=True)
        self.assertEqual({k: r[k] for k in ("fed", "ime", "dsh", "outlier_op", "low_volume", "capital", "uc")},
                         {"fed": 4900, "ime": 490, "dsh": 245, "outlier_op": 113, "low_volume": 635, "capital": 600,
                          "uc": 4})
        self.assertEqual((r["base"], r["total"], r["hrrp"], r["hvbp"], r["after"], r["at_stake"], r["hac"], r["net"]),
                         (4900, 6987, -147, 49, 6889, 69, -69, -167))

    def test_a_sum_can_sit_a_dollar_from_the_rounded_unrounded_figure(self):
        # B = 100.4 + 100.4 (MDH add-on) -> parts 100 + 100 = base 200, though round(200.8) = 201: the rounded sum wins
        r = round_dollars(dict(est(), fed=100.4, mdh_addon=100.4), cut=False)
        self.assertEqual(r["base"], 200)

    def test_a_hospital_that_is_not_cut_has_no_hac_and_a_cut_one_loses_its_at_stake(self):
        self.assertEqual(round_dollars(est(hrrp=0.97, cut=False), cut=False)["hac"], 0)
        r = round_dollars(est(hrrp=0.97, cut=True), cut=True)
        self.assertEqual((r["at_stake"], r["hac"], r["net"]), (1164, -1164, -3600 - 1164))  # 0.01 x 116,400
        self.assertEqual(round_dollars(est(hrrp=0.97, cut=False), cut=False)["at_stake"], 1164)  # the same whether or not it is cut

    def test_factors_cases_and_other_keys_are_left_alone(self):
        e = dict(est(), hrrp_factor=0.9956, vbp_factor=1.0123, cases=10.4)
        rounded = round_dollars(e, cut=False)
        self.assertEqual((rounded["hrrp_factor"], rounded["vbp_factor"], rounded["cases"]), (0.9956, 1.0123, 10.4))

    def test_it_returns_a_new_dict(self):
        e = est()
        before = dict(e)
        round_dollars(e, cut=False)
        self.assertEqual(e, before)


class RowsAddUp(unittest.TestCase):
    """Every figure a reader can add up is exact: in a row, and down a column."""

    @staticmethod
    def random_rows(n=300, seed=20261022):
        rng = random.Random(seed)
        out = []
        for i in range(n):
            kind = rng.choice(("plain", "mdh", "sch"))
            h = hospital(cases=rng.uniform(1, 5000), cmi=rng.uniform(0.8, 2.2), cmi_hsp=rng.uniform(0.8, 2.2),
                         wi=rng.uniform(0.7, 1.6), quality=rng.choice((0, 1)), ehr=rng.choice((0, 1)),
                         ime_op=rng.uniform(0, 0.3), ime_cap=rng.uniform(0, 0.1), dsh_op=rng.uniform(0, 0.15),
                         dsh_cap=rng.uniform(0, 0.05), outlier_op=rng.uniform(0, 0.05),
                         outlier_cap=rng.uniform(0, 0.05), gaf=rng.uniform(0.9, 1.3), low_volume=rng.uniform(1, 1.25),
                         ucp_per_claim=rng.uniform(0, 3000), bills=rng.randint(1, 9000),
                         mdh=kind == "mdh", sch=kind == "sch", hsp_mdh=rng.uniform(2000, 12000),
                         hsp=rng.uniform(2000, 12000))
            out.append((h, hospital_row(f"99{i:04d}", "VA", h, RATES, hrrp=rng.uniform(0.97, 1.0),
                                        vbp=rng.choice((None, rng.uniform(0.98, 1.02))), cut=rng.random() < 0.3,
                                        parhm=NO_PARHM)))
        return out

    def test_every_row_adds_up_exactly(self):
        pairs = self.random_rows()
        for _, r in pairs:
            assert_adds_up(self, r, r["ccn"])  # invented CCNs
        # the test has teeth: rounding the sums themselves would often miss by a dollar
        self.assertGreater(sum(round(estimate(h, RATES, hrrp=1.0, vbp=1.0, cut=False)["total"]) != r["total"]
                               for h, r in pairs), 5)

    def test_every_column_total_adds_up_exactly(self):
        rows = [r for _, r in self.random_rows()]
        nat = national(rows)
        for key in ("base", "total", "hrrp", "hvbp", "after", "hac", "net"):
            self.assertEqual(nat[key], sum(r[key] for r in rows), key)
        self.assertEqual(nat["after"], nat["total"] + nat["hrrp"] + nat["hvbp"])
        self.assertEqual(nat["net"], nat["hrrp"] + nat["hvbp"] + nat["hac"])
        self.assertEqual(nat["hac"], -sum(r["at_stake"] for r in rows if r["cut"]))
        self.assertEqual(nat["parts"], {k: sum(r[k] for r in rows) for k in PARTS})


class HospitalRow(unittest.TestCase):
    def test_an_estimated_row_is_the_flags_then_the_rounded_estimate(self):
        r = row(hrrp=0.9956, vbp=1.0, cut=True)
        self.assertEqual(list(r)[:5], ["ccn", "status", "cut", "hrrp_listed", "vbp_listed"])
        self.assertEqual((r["ccn"], r["status"], r["cut"], r["hrrp_listed"], r["vbp_listed"]),
                         ("990001", "estimated", True, True, True))
        self.assertEqual(r, {**{"ccn": "990001", "status": "estimated", "cut": True, "hrrp_listed": True,
                                "vbp_listed": True},
                             "hrrp_factor": 0.9956, "vbp_factor": 1.0, "cases": 10.0, "bills": 12,  # the synthetic hospital's
                             **round_dollars(est(hrrp=0.9956, vbp=1.0, cut=True), cut=True)})
        # B = T = 120,000; HRRP -528; after 119,472; HAC -1,194.72 -> -1,195
        self.assertEqual((r["base"], r["total"], r["hrrp"], r["hvbp"], r["after"], r["hac"]),
                         (120000, 120000, -528, 0, 119472, -1195))

    def test_a_hospital_with_no_factor_row_takes_one_and_says_so(self):
        r = row(hrrp=None, vbp=1.01)
        self.assertEqual((r["hrrp_listed"], r["vbp_listed"]), (False, True))
        self.assertEqual((r["hrrp"], r["hvbp"]), (0, 1200))  # no HRRP row: factor 1; VBP 1.01: 120,000 x 0.01
        self.assertEqual((r["hrrp_factor"], r["vbp_factor"]), (1.0, 1.01))
        r = row(hrrp=0.97, vbp=None)
        self.assertEqual((r["hrrp_listed"], r["vbp_listed"], r["hrrp"], r["hvbp"]), (True, False, -3600, 0))
        self.assertEqual((r["hrrp_factor"], r["vbp_factor"]), (0.97, 1.0))

    def test_a_listed_factor_of_one_is_still_listed(self):
        r = row(hrrp=1.0, vbp=1.0)
        self.assertEqual((r["hrrp_listed"], r["vbp_listed"]), (True, True))

    def test_maryland_parhm_and_no_inputs_rows_have_no_dollars(self):
        # (Review Focus 1: no dollar key at all, so nothing downstream can print 0 or NaN for them.)
        keys = ["ccn", "status", "cut", "hrrp_listed", "vbp_listed"]
        self.assertEqual(list(row("990001", "MD", hrrp=0.97)), keys)
        self.assertEqual(list(row("990002", "PA", parhm=frozenset({"990002"}))), keys)
        self.assertEqual(list(row("990003", inp=hospital(cases=0.0))), keys)
        self.assertEqual(list(row("990004", inp=hospital(cmi=None))), keys)
        none = hospital_row("990005", "VA", None, RATES, hrrp=None, vbp=None, cut=True, parhm=NO_PARHM)
        self.assertEqual(none, {"ccn": "990005", "status": "no-inputs", "cut": True, "hrrp_listed": False,
                                "vbp_listed": False})

    def test_no_inputs_never_reaches_the_estimate(self):
        # Zero cases would price to all zeros, and an inputs dict this bare would raise: neither may happen.
        for inp in ({"cases": 0.0, "cmi": 1.5}, {"cases": 10.0, "cmi": 0.0}, {"cases": 10.0}):
            self.assertEqual(row(inp=inp)["status"], "no-inputs", inp)

    def test_cut_must_be_a_real_bool(self):
        for cut in ("Yes", "No", "N/A", 1, 0, None):
            with self.assertRaises(ValueError, msg=repr(cut)):
                row(cut=cut)
        with self.assertRaises(ValueError):
            row("990001", "MD", cut="No")  # checked for every status, not only the priced ones

    def test_an_estimated_hospital_that_cannot_be_priced_raises(self):
        with self.assertRaises(ValueError):
            row(inp=hospital(wi=None))  # a missing input: the build fails, the hospital does not vanish
        with self.assertRaises(ValueError):
            row(hrrp=0.0)  # a listed factor of zero is bad data, not "no row"
        with self.assertRaises(SchemaError):
            row(inp=hospital(quality=5))  # rate_key does not know this flag

    def test_the_inputs_are_not_changed(self):
        h = hospital()
        before = dict(h)
        row(inp=h, hrrp=0.97, vbp=1.01, cut=True)
        self.assertEqual(h, before)


class National(unittest.TestCase):
    def test_maryland_is_zero_and_out_of_totals(self):
        rows = [row("990001", hrrp=0.97, cut=True),
                row("990002", "MD", hrrp=0.97, vbp=1.01),  # priced inputs, listed factors: still nothing
                row("990003", hrrp=0.97)]
        nat = national(rows)
        self.assertEqual(nat["by_status"]["maryland"], 1)
        self.assertEqual(nat["hospitals"], 2)
        # two hospitals at B = T = 120,000, HRRP -3,600 each, one cut: after 116,400, HAC -1,164
        self.assertEqual((nat["base"], nat["total"], nat["hrrp"], nat["hvbp"], nat["hac"]),
                         (240000, 240000, -7200, 0, -1164))
        self.assertEqual(nat["hrrp_base"], 240000)  # the Maryland row's base is not in it either
        self.assertEqual(nat["vbp_base"], 0)
        maryland = rows[1]
        self.assertNotIn("base", maryland)

    def test_no_inputs_has_no_dollars(self):
        # Review Focus 1: the hospital is counted (by status, and by the file's Yes count) but adds no dollars.
        rows = [row("990001", cut=True), row("990002", inp=hospital(cases=0.0), cut=True),
                bare("990003", "no-inputs"), row("990004", inp=hospital(cmi=0.0))]
        nat = national(rows)
        self.assertEqual(nat["hospitals"], 1)
        self.assertEqual(nat["by_status"], {"estimated": 1, "maryland": 0, "parhm": 0, "no-inputs": 3})
        self.assertEqual((nat["base"], nat["total"]), (120000, 120000))
        self.assertEqual((nat["yes"], nat["yes_unestimated"], nat["cut"]), (2, 1, 1))
        for r in rows[1:]:
            self.assertFalse({"base", "total", "hrrp", "hvbp", "after", "hac", "net"} & set(r), r)

    def test_totals_are_sums_of_rounded(self):
        # Review Focus 4. Each of these three has B = 3000 x 0.80013 + 2500 = 4,900.39, which rounds to 4,900: the
        # rounded sum is 14,700, not round(14,701.17) = 14,701. The headline is what a reader adding the table gets.
        h = hospital(cases=1.0, cmi=1.0, wi=0.80013)
        rows = [row(f"99000{i}", inp=h, hrrp=0.97, vbp=1.01, cut=(i == 1)) for i in (1, 2, 3)]
        self.assertEqual({r["base"] for r in rows}, {4900})
        nat = national(rows)
        self.assertEqual(nat["base"], 14700)
        self.assertEqual(nat["total"], 14700)
        for key in ("base", "total", "hrrp", "hvbp", "after", "hac", "net"):
            self.assertEqual(nat[key], sum(r[key] for r in rows), key)
        self.assertTrue(all(type(nat[k]) is int for k in ("base", "total", "hrrp", "hvbp", "after", "hac", "net")))
        self.assertEqual(nat["parts"]["fed"], 14700)  # three federal payments of 4,900
        # and it is not the rounded sum of the unrounded figures
        self.assertNotEqual(nat["base"], round(3 * est(h)["base"]))

    def test_parts_are_summed_over_estimated_rows_only(self):
        # Two hospitals at fed 120,000 and IME 0.1 x 120,000 = 12,000; a Maryland row adds nothing.
        ime = hospital(ime_op=0.1)
        rows = [row("990001", inp=ime), row("990002", inp=ime, cut=True), row("990003", "MD", inp=ime)]
        parts = national(rows)["parts"]
        self.assertEqual(list(parts), list(PARTS))
        self.assertEqual({k: v for k, v in parts.items() if v}, {"fed": 240000, "ime": 24000})

    def test_the_bases_the_checks_need(self):
        rows = [bare("990001", "estimated", **money(1000, hrrp=-10)),
                bare("990002", "estimated", hrrp_listed=False, **money(2000)),
                bare("990003", "estimated", vbp_listed=False, **money(4000, hrrp=-40)),
                bare("990004", "estimated", hrrp_listed=False, vbp_listed=False, **money(8000)),
                bare("990005", "estimated", **money(16000)),  # listed in both, factor 1: not penalized
                bare("990006", "maryland", hrrp_listed=True, vbp_listed=True)]
        nat = national(rows)
        self.assertEqual(nat["base"], 31000)
        self.assertEqual(nat["hrrp_base"], 1000 + 4000)         # the penalized hospitals' base (HRRP dollars below zero)
        self.assertEqual(nat["vbp_base"], 1000 + 2000 + 16000)  # rows in Table 16B

    def test_hrrp_base_is_the_penalized_hospitals_not_every_listed_one(self):
        rows = [row("990001", hrrp=0.97), row("990002", hrrp=1.0), row("990003", hrrp=None), row("990004", hrrp=0.99)]
        nat = national(rows)
        self.assertEqual(nat["hrrp_base"], 240000)  # two penalized hospitals at B = 120,000
        self.assertEqual(nat["hrrp"], -3600 - 1200)
        # CMS's share is over the penalized hospitals: 4,800 / 240,000 = 2%, not 4,800 / 360,000 (listed) = 1.33%
        self.assertAlmostEqual(-nat["hrrp"] / nat["hrrp_base"], 0.02)

    def test_counts(self):
        rows = [bare("990001", "estimated", cut=True, **money(1000)),
                bare("990002", "estimated", **money(1000)),
                bare("990003", "no-inputs", cut=True),
                bare("990004", "parhm", cut=True),
                bare("990005", "maryland"),
                bare("990006", "no-inputs")]
        nat = national(rows)
        self.assertEqual(nat["hospitals"], 2)
        self.assertEqual(nat["cut"], 1)              # estimated and cut
        self.assertEqual(nat["yes"], 3)              # cut, any status
        self.assertEqual(nat["yes_unestimated"], 2)  # cut, not estimated
        self.assertEqual(nat["by_status"], {"estimated": 2, "maryland": 1, "parhm": 1, "no-inputs": 2})

    def test_an_empty_set_is_all_zeros(self):
        nat = national([])
        self.assertEqual(nat["hospitals"], 0)
        self.assertEqual(sum(v for k, v in nat.items() if k not in ("by_status", "parts")), 0)
        self.assertEqual(sum(nat["by_status"].values()), 0)
        self.assertEqual(nat["parts"], dict.fromkeys(PARTS, 0))
        self.assertEqual(list(nat["by_status"]), list(STATUSES))

    def test_the_keys(self):
        self.assertEqual(list(national([])), list(NAT))

    def test_an_unknown_status_or_a_string_cut_raises(self):
        with self.assertRaises(ValueError):
            national([bare("990001", "pending")])
        with self.assertRaises(ValueError):
            national([bare("990001", "estimated", cut="Yes", **money(1000))])

    def test_it_takes_any_iterable_of_rows_and_changes_none(self):
        rows = [row("990001", hrrp=0.97, cut=True), row("990002")]
        before = [dict(r) for r in rows]
        self.assertEqual(national(iter(rows)), national(rows))
        self.assertEqual(rows, before)


class Checks(unittest.TestCase):
    def check(self, nat=None, hacrp_yes=1, **changes):
        nat = dict(NAT if nat is None else nat, **changes)
        return {c["id"]: c for c in checks(nat, hacrp_yes=hacrp_yes)}

    def test_the_constants(self):
        self.assertEqual(HRRP_SHARE, (0.0040, 0.0048))
        self.assertEqual(HAC_SHARE, (0.002, 0.003))
        self.assertEqual(VBP_NET_OF_POOL, 0.10)
        self.assertEqual(VBP_WITHHOLD, 0.02)
        self.assertEqual(YES_UNESTIMATED_MAX, 9)

    def test_the_shape_and_order(self):
        got = checks(NAT, hacrp_yes=1)
        self.assertEqual([c["id"] for c in got],
                         ["hrrp_share", "vbp_net", "hac_share", "hac_count", "yes_unestimated"])
        for c in got:
            self.assertEqual(sorted(c), ["high", "id", "low", "pass", "value"])
            self.assertIs(c["pass"], True, c)

    def test_the_worked_values(self):
        c = self.check()
        self.assertAlmostEqual(c["hrrp_share"]["value"], 2112 / 480000)  # 0.0044
        self.assertEqual((c["hrrp_share"]["low"], c["hrrp_share"]["high"]), HRRP_SHARE)
        self.assertEqual(c["vbp_net"]["value"], 0)
        self.assertEqual((c["vbp_net"]["low"], c["vbp_net"]["high"]), (0, 0.10 * 0.02 * 240000))  # up to 480
        self.assertAlmostEqual(c["hac_share"]["value"], 1195 / 480000)
        self.assertEqual((c["hac_share"]["low"], c["hac_share"]["high"]), HAC_SHARE)
        self.assertEqual((c["hac_count"]["value"], c["hac_count"]["low"], c["hac_count"]["high"]), (1, 1, 1))
        self.assertEqual((c["yes_unestimated"]["value"], c["yes_unestimated"]["low"], c["yes_unestimated"]["high"]),
                         (0, 0, YES_UNESTIMATED_MAX))

    def test_checks_flag_a_share_outside_its_range(self):
        # HRRP: the dollars over the base of the penalized hospitals; 0.40% to 0.48% passes, either side fails
        for hrrp, ok in ((-1919, False), (-1920, True), (-2304, True), (-2305, False)):  # 480,000 x 0.004 / 0.0048
            self.assertIs(self.check(hrrp=hrrp)["hrrp_share"]["pass"], ok, hrrp)
        # the denominator is the penalized hospitals' base, not every base
        self.assertIs(self.check(hrrp=-2112, hrrp_base=900000)["hrrp_share"]["pass"], False)
        # HAC: the cut over all T; 0.2% to 0.3%
        for hac, ok in ((-959, False), (-960, True), (-1440, True), (-1441, False)):
            self.assertIs(self.check(hac=hac)["hac_share"]["pass"], ok, hac)
        # a credit is not a share of anything: a positive HRRP total (money paid out) fails
        self.assertIs(self.check(hrrp=500)["hrrp_share"]["pass"], False)

    def test_the_vbp_net_is_held_to_a_tenth_of_the_pool_either_way(self):
        pool = 0.02 * 240000  # 4,800: the 2% withheld from the Table 16B hospitals' base payments
        self.assertEqual(VBP_NET_OF_POOL * pool, 480.0)
        for hvbp, ok in ((0, True), (480, True), (-480, True), (481, False), (-481, False), (30000, False)):
            c = self.check(hvbp=hvbp)["vbp_net"]
            self.assertIs(c["pass"], ok, hvbp)
            self.assertEqual(c["value"], abs(hvbp))
        # it scales with the base of the hospitals in Table 16B, not with all of them
        self.assertIs(self.check(hvbp=480, vbp_base=100000)["vbp_net"]["pass"], False)

    def test_hac_count_check_equals_the_files_yes_count_less_exclusions(self):
        # Every hospital CMS cut must be a row, whatever its status: the ones left without an estimate (a participant,
        # no inputs) are still counted in `yes`, and surface in yes_unestimated instead of vanishing.
        rows = [row("990001", cut=True), row("990002", cut=True, inp=hospital(cases=0.0)),
                row("990003", "PA", cut=True, parhm=frozenset({"990003"})), row("990004"), row("990005")]
        nat = national(rows)
        self.assertEqual((nat["yes"], nat["cut"], nat["yes_unestimated"]), (3, 1, 2))
        file_yes = 3
        c = self.check(nat, hacrp_yes=file_yes)
        self.assertEqual((c["hac_count"]["value"], c["hac_count"]["low"], c["hac_count"]["high"]), (3, 3, 3))
        self.assertIs(c["hac_count"]["pass"], True)
        # the exclusions are not silent: two Yes hospitals have no estimate, and they are shown (within the allowance)
        self.assertEqual(c["yes_unestimated"]["value"], 2)
        self.assertIs(c["yes_unestimated"]["pass"], 2 <= YES_UNESTIMATED_MAX)
        # a Yes hospital left out of the rows, or one the rows invented, fails the count
        self.assertIs(self.check(nat, hacrp_yes=4)["hac_count"]["pass"], False)
        self.assertIs(self.check(nat, hacrp_yes=2)["hac_count"]["pass"], False)
        self.assertEqual(self.check(nat, hacrp_yes=4)["hac_count"]["low"], 4)

    def test_more_yes_hospitals_without_an_estimate_than_the_allowance_fails(self):
        # the allowance is the count on the FY2026 pins (2026-10-22): nine; a tenth fails
        for n, ok in ((0, True), (9, True), (10, False), (50, False)):
            c = self.check(yes_unestimated=n)["yes_unestimated"]
            self.assertIs(c["pass"], ok, n)
            self.assertEqual((c["value"], c["low"], c["high"]), (n, 0, 9))

    def test_a_check_that_cannot_be_computed_fails_rather_than_dividing_by_zero(self):
        c = self.check(national([]), hacrp_yes=0)
        self.assertEqual((c["hrrp_share"]["value"], c["hrrp_share"]["pass"]), (None, False))
        self.assertEqual((c["hac_share"]["value"], c["hac_share"]["pass"]), (None, False))

    def test_the_worked_example_end_to_end(self):
        # four hospitals, B = T = 120,000 each; HRRP 0.9956 -> -528 each; one cut: HAC = -1,194.72 -> -1,195
        rows = [row("990001", hrrp=0.9956, vbp=1.0, cut=True), row("990002", hrrp=0.9956, vbp=1.0),
                row("990003", hrrp=0.9956), row("990004", hrrp=0.9956)]
        nat = national(rows)
        self.assertEqual({k: nat[k] for k in NAT}, NAT)
        got = checks(nat, hacrp_yes=1)
        self.assertEqual([c["pass"] for c in got], [True] * 5)

    def test_it_does_not_change_the_national_dict(self):
        nat = dict(NAT)
        checks(nat, hacrp_yes=1)
        self.assertEqual(nat, NAT)


if __name__ == "__main__":
    unittest.main()
