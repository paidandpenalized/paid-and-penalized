"""The exposure pipeline (pp_pipeline.medicaid): its pinned inputs, the state table and the hospital records, on
synthetic rows with invented CCNs."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from pp_engine.medicaid import shares
from pp_pipeline.medicaid import build, inputs

FY2023 = ("12/31/2022", "03/31/2023", "06/30/2023", "09/30/2023")
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
        self.assertAlmostEqual(ak["share_next_year"], 0.25)


def master(*hospitals):
    keys = dict(name="Synthetic General", city="Anytown", urban=True, beds=50, own="Nonprofit", teach="none", lat=1.0,
                lon=2.0, inactive=None)
    return {"hospitals": [{**keys, **h} for h in hospitals]}


def hcris(ccn, **over):
    row = {"ccn": ccn, "year": "2023", "shape": "one", "status": "1", "period_begin": "2023-01-01",
           "period_end": "2023-12-31", "period_days": "365", "medicaid_net_revenue": "1000000",
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
        progs = {"990001": {"hrrp": -10, "hac": 0, "hvbp": 1, "net": -9, "hrrp_factor": 0.99, "hac_cut": False}}
        self.records = build.hospital_records(m, rows, STATES, progs, fence=(-0.5, 0.5))

    def test_universe_and_classes(self):
        self.assertEqual([(r["ccn"], r["cls"]) for r in self.records],
                         [("990001", build.SCENARIO), ("991301", build.NO_VIII), ("990002", build.NOT_EXPANSION),
                          ("990003", build.NO_REPORT), ("990005", build.NOT_EXPANSION)])
        outlier = self.records[-1]["base"]
        self.assertTrue(outlier["margin_outlier"])
        self.assertIn("margin_outlier", outlier["flags"])
        self.assertFalse(self.records[0]["base"]["margin_outlier"])

    def test_scenarios_run_only_in_scenario_states(self):
        by = {r["ccn"]: r for r in self.records}
        self.assertAlmostEqual(by["990001"]["results"]["middle"]["lost"], 1000000 * 0.25 * 0.2)
        self.assertEqual(by["991301"]["results"]["high"]["lost"], 0.0)
        self.assertEqual(by["990002"]["results"]["high"]["lost"], 0.0)
        self.assertEqual(by["990001"]["programs"]["hrrp"], -10)

    def test_roll_ups_and_outputs(self):
        nat, by_state, sens, groups = build.results(self.records, STATES)
        self.assertEqual((nat["middle"]["hospitals"], nat["middle"]["margin_hospitals"]), (4, 3))
        self.assertAlmostEqual(nat["high"]["lost"], 1000000 * 0.25 * 0.3)
        self.assertAlmostEqual(sens["use_1.25"]["high"]["lost"], 1000000 * 0.25 * 0.3 * 1.25)
        self.assertAlmostEqual(sens["share_net_of_dsh"]["low"]["lost"], 1000000 * (1000 / 3600) * 0.1, places=4)
        self.assertEqual(groups["critical_access"]["low"]["hospitals"], 1)
        self.assertEqual(set(by_state), {"AK", "WI", "TX"})
        self.assertEqual(build.settled_share(self.records), 0.0)
        cols, rows = build.hospital_rows(self.records)
        self.assertEqual(len(rows), 5)
        self.assertEqual(len(cols), len(rows[0]))
        rec = build.explorer_record(self.records[0])
        self.assertEqual((rec["c"], rec["k"], rec["m2"], rec["st"]), ("990001", "A", 1000000, "as filed"))
        self.assertNotIn("m2", build.explorer_record(self.records[3]))


if __name__ == "__main__":
    unittest.main()
