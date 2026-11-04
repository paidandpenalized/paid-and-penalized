"""The Readmissions data's goldens: a fresh build from the pins equals the committed file, and its body equals Thirty Day
Readmissions' own output (`data/pinned/tdr/hrrp.json`), every hospital and every field. The pinned site file is the
reference until the FY2028 refresh."""
import copy
import functools
import json
import unittest
from unittest import mock

from pp_engine import hrrp
from pp_pipeline import emit_hrrp
from pp_pipeline.files import read_json, read_manifest, read_pinned_bytes, require_current

# meta keys the emitted file sets differently on purpose: `sources` names the manifest's pins; `whatsNew` is page copy,
# kept with the site's content.
META_DIFFERS = ("sources", "whatsNew")


@functools.lru_cache(maxsize=None)
def fresh():
    return emit_hrrp.build_from_pins("2000-01-01T00:00:00Z")


@functools.lru_cache(maxsize=None)
def site():
    return json.loads(read_pinned_bytes("tdr-hrrp-fy2027"))


class Golden(unittest.TestCase):
    def test_fresh_emit_equals_committed(self):
        committed = read_json(emit_hrrp.committed_path())
        self.assertEqual({**fresh(), "built_at": None}, {**committed, "built_at": None},
                         "the committed file is not what the pins build: run `make emit`")

    def test_meta_equals_the_site_file(self):
        want = {k: v for k, v in site()["meta"].items() if k not in META_DIFFERS}
        self.assertEqual({k: v for k, v in fresh()["meta"].items() if k not in META_DIFFERS}, want)

    def test_conditions_and_history_equal_the_site_file(self):
        self.assertEqual(fresh()["conditions"], site()["conditions"])
        self.assertEqual(fresh()["history"], site()["history"])

    def test_every_hospital_equals_the_site_file(self):
        mine = {h["id"]: h for h in fresh()["hospitals"]}
        theirs = {h["id"]: h for h in site()["hospitals"]}
        self.assertEqual(sorted(mine), sorted(theirs))
        diffs = [f"{c} {k}: {mine[c].get(k)!r} vs {h.get(k)!r}" for c, h in sorted(theirs.items())
                 for k in sorted(set(h) | set(mine[c])) if mine[c].get(k, "absent") != h.get(k, "absent")]
        self.assertEqual(diffs, [], f"{len(diffs)} differences:\n" + "\n".join(diffs[:30]))

    def test_meta_sources_name_every_pin(self):
        ids = [s["id"] for s in fresh()["meta"]["sources"] if "id" in s]
        self.assertEqual(ids, list(fresh()["sources"]))


class Formula(unittest.TestCase):
    def test_every_factor_reproduces_from_the_stored_values(self):
        data = fresh()
        meds = data["meta"]["peerMedians"]
        short = []
        for h in data["hospitals"]:
            rec = {"nm": data["meta"]["nm"], "paf": h["paf"],
                   "c": {k: {**h["c"].get(k, {}), "med": meds[str(h["peer"])][k]} for k in emit_hrrp.CONDITIONS}}
            if hrrp.replication_status(rec) != "exact":
                short.append(h["id"])
        self.assertEqual(short, [])
        self.assertEqual(data["meta"]["replication"], {"exact": len(data["hospitals"]), "total": len(data["hospitals"])})


class Refusals(unittest.TestCase):
    def test_a_master_built_from_older_pins_is_refused(self):
        master = read_json(emit_hrrp.emit_hospital.committed_path())
        stale = {**master, "source_manifest": "0" * 64}
        with self.assertRaisesRegex(ValueError, "make emit"):
            require_current(stale, read_manifest(), "the hospital master")
        with mock.patch.object(emit_hrrp, "read_json", return_value=stale), self.assertRaisesRegex(ValueError, "make emit"):
            emit_hrrp.committed_master()

    def test_a_hospital_the_master_lacks_is_refused(self):
        # The refusal comes before any record is read, so the record and the inputs can be minimal.
        inputs = {"impact": {}, "rates": fresh()["meta"]["rates"], "hgi": {}}
        with self.assertRaisesRegex(hrrp.HrrpError, "999999"):
            emit_hrrp.hospital_records({"999999": {}}, inputs, {}, 1.0)

    def test_a_malformed_dollar_check_names_the_file(self):
        bad = copy.deepcopy(site()["meta"]["dollarCheck"])
        bad["n"] = 0
        with mock.patch.object(emit_hrrp, "read_pinned_bytes", return_value=json.dumps(bad).encode()):
            with self.assertRaisesRegex(hrrp.HrrpError, r"dollar_check\.json: n should be"):
                emit_hrrp.dollar_check(2027)


if __name__ == "__main__":
    unittest.main()
