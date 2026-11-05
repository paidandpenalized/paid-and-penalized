"""The exposure pipeline (pp_pipeline.medicaid): its pinned inputs, the state table and the hospital records, on
synthetic rows with invented CCNs."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from pp_engine.hcris import tidy
from pp_engine.medicaid import shares
from pp_pipeline.medicaid import build, inputs, safety_net

FY2023 = ("09/30/2022", "12/31/2022", "03/31/2023", "06/30/2023", "09/30/2023")
FY2024 = ("12/31/2023", "03/31/2024", "06/30/2024", "09/30/2024")


def viii_rows(state, viii, total="1,000 "):
    return [{shares.STATE: state, shares.QUARTER_END: q, shares.TOTAL: total, shares.VIII: viii}
            for q in FY2023 + FY2024]


def urban_row(code, pcts):
    row = {"state": code, "name": code}
    for (sid, col), p in zip((("low", "wr_high_mitigation"), ("middle", "wr_medium_mitigation"),
                              ("high", "wr_low_mitigation")), pcts):
        row[col + "_pct"], row[col + "_thousands"] = str(-p), str(-p * 10)
    return row


STATES = build.state_table(
    viii_rows("Alaska", "250") + viii_rows("Wisconsin", "N/A") + viii_rows("Texas", "N/A"),
    [urban_row("AK", (10, 20, 30)), urban_row("WI", (20, 40, 60))],
    [{"state": "AK", "map_total_net_expenditures": "4000", "dsh_inpatient_hospital": "400",
      "dsh_mental_health_facility": ""}])


class Inputs(unittest.TestCase):
    def test_every_pinned_input_matches_sources_json(self):
        for e in inputs.sources():
            with self.subTest(e["id"]):
                inputs.read_bytes(e["id"])

    def test_no_unlisted_inputs(self):
        listed = {e["path"] for e in inputs.sources()} | {"sources.json"}
        self.assertEqual({p.name for p in inputs.INPUTS_DIR.iterdir()}, listed)

    def test_a_changed_pin_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = b"a,b\n1,2\n"
            (Path(tmp) / "x.csv").write_bytes(data + b"3,4\n")
            (Path(tmp) / "sources.json").write_text(json.dumps({"files": [
                {"id": "x", "path": "x.csv", "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}]}))
            with self.assertRaises(inputs.PinError):
                inputs.read_bytes("x", tmp)

    def test_headers_are_cleaned(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = b'State," ""Total"""\nAlaska,1\n'  # CMS's file quotes one header like this
            (Path(tmp) / "x.csv").write_bytes(data)
            (Path(tmp) / "sources.json").write_text(json.dumps({"files": [
                {"id": "x", "path": "x.csv", "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}]}))
            self.assertEqual(inputs.read_csv("x", tmp), [{"State": "Alaska", "Total": "1"}])


class StateTable(unittest.TestCase):
    def test_classes(self):
        self.assertEqual((STATES["AK"]["class"], STATES["WI"]["class"], STATES["TX"]["class"]),
                         (build.SCENARIO, build.NO_VIII, build.NOT_EXPANSION))

    def test_shares_and_declines(self):
        ak = STATES["AK"]
        self.assertAlmostEqual(ak["share"], 0.25)
        self.assertEqual(ak["basis"], "ffy2023")
        self.assertEqual(ak["declines"], {"low": 0.1, "middle": 0.2, "high": 0.3})
        self.assertEqual(ak["urban_thousands"]["high"], 300)
        self.assertAlmostEqual(ak["share_net_of_dsh"], 1000 / 3600)  # four quarters of 250 over 4000 less 400 DSH
        self.assertAlmostEqual(ak["total_vs_fmr"], 1.0)
        self.assertAlmostEqual(ak["share_next_year"], 0.25)


def master(*hospitals):
    keys = dict(name="Synthetic General", city="Anytown", urban=True, beds=50, own="Nonprofit", teach="none", lat=1.0,
                lon=2.0, inactive=None)
    return {"hospitals": [{**keys, **h} for h in hospitals]}


def hcris(ccn, **over):
    row = {"ccn": ccn, "year": "2023", "shape": "one", "status": "1", "status_label": "as filed",
           "period_begin": "2023-01-01", "period_end": "2023-12-31", "period_days": "365",
           "medicaid_days_all": "100", "medicaid_day_share": "0.1", "medicaid_net_revenue": "1000000",
           "medicaid_cost": "1200000", "net_patient_revenue": "10000000", "net_income_patients": "100000",
           "net_income": "300000", "other_income": "500000", "uncompensated_cost": "400000"}
    row.update(over)
    return row


class Records(unittest.TestCase):
    def setUp(self):
        m = master({"ccn": "990001", "state": "AK", "kind": "acute"},
                   {"ccn": "991301", "state": "WI", "kind": "critical_access"},
                   {"ccn": "990002", "state": "TX", "kind": "acute"},
                   {"ccn": "990003", "state": "AK", "kind": "acute"},
                   {"ccn": "994001", "state": "AK", "kind": "psychiatric"},
                   {"ccn": "990004", "state": "AK", "kind": "acute", "inactive": "2024-01-01"},
                   {"ccn": "990005", "state": "TX", "kind": "acute"})
        rows = {c: hcris(c) for c in ("990001", "991301", "990002", "994001")}
        rows["990005"] = hcris("990005", net_income_patients="-9000000")  # a -90% margin: outside the fence
        rows["990001"].update(medicaid_days_maternity="50", medicaid_day_share="0.5")  # half maternity; high MIUR
        rows["990003"] = hcris("990003", medicaid_days_all="300")  # no maternity days
        progs = {"990001": {"hrrp": -10, "hac": 0, "hvbp": 1, "net": -9, "hrrp_factor": 0.99, "hac_cut": False}}
        self.records = build.hospital_records(m, rows, STATES, progs, {"AK": 0.4}, fence=(-0.5, 0.5))

    def test_universe_and_classes(self):
        self.assertEqual([(r["ccn"], r["cls"]) for r in self.records],
                         [("990001", build.SCENARIO), ("991301", build.NO_VIII), ("990002", build.NOT_EXPANSION),
                          ("990003", build.SCENARIO), ("990005", build.NOT_EXPANSION)])
        outlier = self.records[-1]["base"]
        self.assertTrue(outlier["margin_outlier"])
        self.assertIn("margin_outlier", outlier["flags"])
        self.assertFalse(self.records[0]["base"]["margin_outlier"])

    def test_the_expansion_share_is_scaled_by_non_maternity_days(self):
        by = {r["ccn"]: r for r in self.records}
        ratio = (50 + 300) / (100 + 300)  # Alaska's two hospitals with a report, weighted by Medicaid days
        self.assertAlmostEqual(by["990001"]["state_ratio"], ratio)
        self.assertAlmostEqual(by["990001"]["base"]["share_factor"], 0.5 / ratio)
        self.assertAlmostEqual(by["990001"]["share"], 0.25 * 0.5 / ratio)
        self.assertAlmostEqual(by["990003"]["share"], 0.25 / ratio)
        self.assertAlmostEqual(by["990001"]["state_share"], 0.25)
        self.assertIsNone(by["990002"]["share"])  # not an expansion state

    def test_the_safety_net_flag(self):
        by = {r["ccn"]: r for r in self.records}
        self.assertEqual(by["990001"]["safety_net"], ("miur",))  # 0.5 >= the cut of 0.4
        self.assertEqual(by["990003"]["safety_net"], ())  # 0.1; Medicaid revenue 10% of patient revenue

    def test_scenarios_run_only_in_scenario_states(self):
        by = {r["ccn"]: r for r in self.records}
        self.assertAlmostEqual(by["990001"]["results"]["middle"]["lost"], 1000000 * by["990001"]["share"] * 0.2)
        self.assertEqual(by["991301"]["results"]["high"]["lost"], 0.0)
        self.assertEqual(by["990002"]["results"]["high"]["lost"], 0.0)
        self.assertEqual(by["990001"]["programs"]["hrrp"], -10)

    def test_roll_ups_and_outputs(self):
        nat, by_state, sens, groups = build.results(self.records, STATES)
        self.assertEqual((nat["middle"]["hospitals"], nat["middle"]["margin_hospitals"]), (5, 4))
        both = 1000000 * (self.records[0]["share"] + self.records[3]["share"])
        self.assertAlmostEqual(nat["high"]["lost"], both * 0.3, places=4)  # roll-ups are rounded to 6 places
        self.assertAlmostEqual(sens["use_1.25"]["high"]["lost"], both * 0.3 * 1.25, places=4)
        self.assertAlmostEqual(sens["state_share_only"]["high"]["lost"], 2 * 1000000 * 0.25 * 0.3)
        factors = self.records[0]["base"]["share_factor"] + self.records[3]["base"]["share_factor"]
        self.assertAlmostEqual(sens["share_net_of_dsh"]["low"]["lost"], 1000000 * (1000 / 3600) * factors * 0.1,
                               places=4)
        self.assertEqual(groups["critical_access"]["low"]["hospitals"], 1)
        self.assertEqual(groups["safety_net"]["low"]["hospitals"], 1)
        self.assertEqual(set(by_state), {"AK", "WI", "TX"})
        cols, rows = build.hospital_rows(self.records)
        self.assertEqual(len(rows), 5)
        self.assertEqual(len(cols), len(rows[0]))
        rec = build.explorer_record(self.records[0])
        self.assertEqual((rec["c"], rec["k"], rec["m2"], rec["st"], rec["mt"], rec["sn"]),
                         ("990001", "A", 1000000, "as filed", 0.5, ["miur"]))
        no_report = build.hospital_records(master({"ccn": "990009", "state": "AK", "kind": "acute"}), {}, STATES, {},
                                           {}, fence=(-0.5, 0.5))[0]
        self.assertNotIn("m2", build.explorer_record(no_report))


class LayerAndPins(unittest.TestCase):
    def test_read_hcris_reads_the_layers_year(self):
        cols = [c for c in tidy.WIDE_COLUMNS if c != "year"]
        doc = {"fy": 2023, "columns": cols, "early": True, "settledShare": 0.6, "stillFiling": False,
               "methods_version": 2, "hospitals": [[{"ccn": "990001"}.get(c) for c in cols]]}
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "hcris.json"
            path.write_text(json.dumps(doc))
            y, digest = build.read_hcris(path)
            self.assertEqual((y.early, y.settled_share, y.rows[0]["ccn"]), (True, 0.6, "990001"))
            self.assertEqual(digest, hashlib.sha256(path.read_bytes()).hexdigest())
            path.write_text(json.dumps({**doc, "fy": 2024}))
            with self.assertRaises(ValueError):
                build.read_hcris(path)

    def test_state_pools_by_postal_state(self):
        rows = [{"ccn": c, "medicaid_day_share": v} for c, v in
                (("990001", "0.1"), ("980002", "0.3"), ("994001", "0.2"), ("990003", None), ("970001", "0.5"),
                 ("960001", "0.9"))]
        state_of = {"990001": "AK", "980002": "AK", "994001": "AK", "990003": "AK", "970001": "WI"}
        out = safety_net.state_rows(rows, state_of)  # two CCN codes, one state; 960001 has no state: left out
        self.assertEqual(out[0], list(safety_net.COLUMNS))
        self.assertEqual(out[1], ["AK", "3", "0.200000", "0.100000", "0.300000"])
        self.assertEqual(len(out), 2)  # WI has one hospital: no pool
        self.assertEqual(safety_net.read_cuts([{"state": "AK", "cut": "0.3"}]), {"AK": 0.3})


if __name__ == "__main__":
    unittest.main()
