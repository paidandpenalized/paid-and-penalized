"""The Readmissions data's goldens: a fresh build from the pins equals the committed file, and its body equals Thirty Day
Readmissions' own output (`data/pinned/tdr/hrrp.json`), every hospital and every field. The pinned site file is the
reference until the FY2028 refresh. Since methods_version 2 the MDHs' base and pen differ by design (MDH case mix;
`docs/METHODS-LOG.md`), and a test proves that is the only difference. Since 2026-11-09 the dual proportion is stored to
more decimals (`hrrp.DUAL_DECIMALS`; corrections/2026-11-09-dual-eligible-share.md): rounded to 4 decimals it is the site
file's value. The site file was built on an earlier Care Compare file than the master now is, so the comparisons with it
build on that file (the master from `tdr_inputs` and its star ratings); a test holds that the newer file moves only the
fields Care Compare feeds, and only for the hospitals whose Care Compare row changed."""
import copy
import functools
import io
import json
import unittest
from unittest import mock

from pp_engine import hrrp
from pp_engine.hrrp_read import read_hgi_stars
from pp_engine.parse import SchemaError
from pp_pipeline import emit_hospital, emit_hrrp
from pp_pipeline.files import read_json, read_manifest, read_pinned_bytes, require_current
from pp_pipeline.tests.tdr_inputs import CARE_COMPARE_FIELDS, care_compare_changed, july_master

# meta keys the emitted file sets differently on purpose: `sources` names the manifest's pins; `whatsNew` is page copy,
# kept with the site's content.
META_DIFFERS = ("sources", "whatsNew")
# What the MDH case mix (methods_version 2) moves: an MDH's base and penalty, and the national totals of both.
MDH_FIELDS = ("base", "pen")
TOTALS_DIFFER = ("modelBase", "modelPen")
# A hospital record's fields that come from its Care Compare row (the master's CARE_COMPARE_FIELDS, as the record names
# them, and the star rating), and the meta that counts them (how many map points came from an address, ZIP or county).
RECORD_CARE_COMPARE = tuple(f for f in CARE_COMPARE_FIELDS if f in emit_hrrp.MASTER_FIELDS) + ("star",)
META_CARE_COMPARE = ("geocode",)


@functools.lru_cache(maxsize=None)
def fresh():
    return emit_hrrp.build_from_pins("2000-01-01T00:00:00Z")


@functools.lru_cache(maxsize=None)
def on_the_sites_care_compare(the_sites_case_mix=False):
    """A build on the Care Compare file Thirty Day Readmissions used (its master and star ratings); with
    `the_sites_case_mix`, the MDH add-on also uses the transfer-adjusted case mix, as that site's does."""
    real = emit_hrrp.read_inputs
    stars = read_hgi_stars(read_pinned_bytes(emit_hospital.HGI_PRIOR).decode("utf-8"))

    def inputs():
        got = {**real(), "stars": stars}
        if the_sites_case_mix:
            got["impact"] = {c: {**r, "cmi_hsp": r["cmi"]} for c, r in got["impact"].items()}
        return got
    with mock.patch.object(emit_hrrp, "read_inputs", inputs), mock.patch.object(emit_hrrp, "committed_master", july_master):
        return emit_hrrp.build_from_pins("2000-01-01T00:00:00Z")


@functools.lru_cache(maxsize=None)
def mdh_ids():
    return {h["id"] for h in fresh()["hospitals"] if "MDH" in h["types"]}


def as_the_site_file_rounds(h):
    """A hospital record with its dual proportion at the site file's 4 decimals."""
    return {**h, "dual": hrrp.rnd(h["dual"], 4, half_up=True)} if "dual" in h else h


def differences(mine, theirs):
    """[(ccn, key, 'ccn key: mine vs theirs')] for every hospital field that differs, the dual proportion compared at
    the site file's 4 decimals."""
    a, b = {h["id"]: as_the_site_file_rounds(h) for h in mine}, {h["id"]: h for h in theirs}
    return [(c, k, f"{c} {k}: {a[c].get(k)!r} vs {h.get(k)!r}") for c, h in sorted(b.items())
            for k in sorted(set(h) | set(a[c])) if a[c].get(k, "absent") != h.get(k, "absent")]


def assert_none(test, diffs):
    test.assertEqual(diffs, [], f"{len(diffs)} differences:\n" + "\n".join(d[2] for d in diffs[:30]))


def without(meta, totals=()):
    out = {k: v for k, v in meta.items() if k not in META_DIFFERS}
    out["totals"] = {k: v for k, v in out["totals"].items() if k not in totals}
    return out


@functools.lru_cache(maxsize=None)
def site():
    return json.loads(read_pinned_bytes("tdr-hrrp-fy2027"))


class Golden(unittest.TestCase):
    def test_fresh_emit_equals_committed(self):
        committed = read_json(emit_hrrp.committed_path())
        self.assertEqual({**fresh(), "built_at": None}, {**committed, "built_at": None},
                         "the committed file is not what the pins build: run `make emit`")

    def test_meta_equals_the_site_file_but_the_totals_the_mdh_case_mix_moves(self):
        self.assertEqual(without(on_the_sites_care_compare()["meta"], TOTALS_DIFFER), without(site()["meta"], TOTALS_DIFFER))

    def test_conditions_and_history_equal_the_site_file(self):
        self.assertEqual(fresh()["conditions"], site()["conditions"])
        self.assertEqual(fresh()["history"], site()["history"])

    def test_every_hospital_equals_the_site_file_but_the_mdhs_base_and_penalty(self):
        self.assertEqual(sorted(h["id"] for h in fresh()["hospitals"]), sorted(h["id"] for h in site()["hospitals"]))
        diffs = differences(on_the_sites_care_compare()["hospitals"], site()["hospitals"])
        assert_none(self, [d for d in diffs if not (d[0] in mdh_ids() and d[1] in MDH_FIELDS)])

    def test_the_newer_care_compare_moves_only_its_own_fields_of_the_hospitals_it_changed(self):
        changed = care_compare_changed()
        now, then = fresh(), on_the_sites_care_compare()
        before = {h["id"]: h for h in then["hospitals"]}
        self.assertEqual(sorted(before), [h["id"] for h in now["hospitals"]])
        moved = [f"{h['id']} {k}: {before[h['id']].get(k)!r} -> {h.get(k)!r}" for h in now["hospitals"]
                 for k in sorted(set(h) | set(before[h["id"]]))
                 if h.get(k) != before[h["id"]].get(k) and not (h["id"] in changed and k in RECORD_CARE_COMPARE)]
        self.assertEqual(moved, [], f"{len(moved)} differences Care Compare does not explain:\n" + "\n".join(moved[:30]))
        meta = {k for k in now["meta"].keys() | then["meta"].keys() if now["meta"].get(k) != then["meta"].get(k)}
        self.assertLessEqual(meta, {"sources", *META_CARE_COMPARE})
        self.assertEqual({k: v for k, v in now.items() if k not in ("meta", "hospitals", "source_manifest", "sources")},
                         {k: v for k, v in then.items() if k not in ("meta", "hospitals", "source_manifest", "sources")})


class MdhCaseMix(unittest.TestCase):
    """methods_version 2: the MDH case mix is the only difference from the site file."""

    def test_with_the_sites_case_mix_every_hospital_and_the_meta_equal_the_site_file(self):
        theirs = site()
        mine = on_the_sites_care_compare(the_sites_case_mix=True)
        assert_none(self, differences(mine["hospitals"], theirs["hospitals"]))
        self.assertEqual(without(mine["meta"]), without(theirs["meta"]))

    def test_the_hsp_case_mix_moves_some_mdhs_and_nothing_else(self):
        moved = {c for c, _, _ in differences(on_the_sites_care_compare()["hospitals"], site()["hospitals"])}
        self.assertTrue(moved, "no MDH changed: is the add-on still on the transfer-adjusted case mix?")
        self.assertLessEqual(moved, mdh_ids())

    def test_meta_sources_name_every_pin(self):
        ids = [s["id"] for s in fresh()["meta"]["sources"] if "id" in s]
        self.assertEqual(ids, list(fresh()["sources"]))


class DualProportion(unittest.TestCase):
    def test_stored_to_more_decimals_than_the_site_file_and_printing_as_cmss_value_rounds(self):
        inputs = emit_hrrp.read_inputs()
        self.assertEqual(hrrp.dual_mismatches(inputs["supp"], inputs["pub"]), [])
        stored = {h["id"]: h["dual"] for h in fresh()["hospitals"]}
        self.assertTrue(any(stored[c] != h["dual"] for c, h in ((h["id"], h) for h in site()["hospitals"])),
                        "no dual proportion has more than the site file's 4 decimals")
        # CMS's own 4 decimals print some shares a tenth of a point off: the reason for the extra decimals.
        self.assertTrue(hrrp.dual_mismatches(inputs["supp"], inputs["pub"], places=4))

    def test_the_page_rounding_matches_javascript(self):
        # fmtShare(x, 1): 0.2065 (a float just under the tie) and 0.15146762 read as JavaScript's toUnit reads them.
        self.assertEqual(hrrp.share_tenths(0.2065), 207)
        self.assertEqual(hrrp.share_tenths(0.15146762), 151)
        self.assertEqual(hrrp.true_tenths(0.15146762267533048), 151)
        self.assertEqual(hrrp.true_tenths(0.2065), 207)


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
        inputs = {"impact": {}, "rates": fresh()["meta"]["rates"], "stars": {}}
        with self.assertRaisesRegex(hrrp.HrrpError, "999999"):
            emit_hrrp.hospital_records({"999999": {}}, inputs, {}, 1.0)

    def test_a_malformed_dollar_check_names_the_file(self):
        bad = copy.deepcopy(site()["meta"]["dollarCheck"])
        bad["n"] = 0
        with mock.patch.object(emit_hrrp, "read_pinned_bytes", return_value=json.dumps(bad).encode()):
            with self.assertRaisesRegex(hrrp.HrrpError, r"dollar_check\.json: n should be"):
                emit_hrrp.dollar_check(2027)


class NamedFailures(unittest.TestCase):
    def test_a_reader_failure_prints_not_written_and_returns_1(self):
        # SchemaError subclasses Exception, not ValueError: main() still reports it and writes nothing.
        with mock.patch.object(emit_hrrp, "_build", side_effect=SchemaError("HRRP history: invented")), \
                mock.patch.object(emit_hrrp, "write_emitted") as write, \
                mock.patch("sys.stderr", new_callable=io.StringIO) as err:
            self.assertEqual(emit_hrrp.main(), 1)
        write.assert_not_called()
        self.assertIn("hrrp: not written; HRRP history: invented", err.getvalue())

    def test_a_history_pin_that_stops_short_of_the_prior_year_is_refused(self):
        supp = {c: {"paf": 1.0} for c in fresh()["history"]["paf"]}
        fy = fresh()["meta"]["fy"]
        emit_hrrp.history_body(supp, fy)  # today's pins cover FY2013 to fy - 1
        with self.assertRaisesRegex(hrrp.HrrpError, f"ends at FY{fy - 1}.*FY{fy} is needed"):
            emit_hrrp.history_body(supp, fy + 1)

    def test_a_national_summary_ending_early_is_refused(self):
        supp = {c: {"paf": 1.0} for c in fresh()["history"]["paf"]}
        fy = fresh()["meta"]["fy"]
        text = read_pinned_bytes(emit_hrrp.SUMMARY).decode("utf-8")
        short = "\n".join(line for line in text.splitlines() if not line.startswith(f"{fy - 1},")) + "\n"
        real = emit_hrrp.read_pinned_bytes
        with mock.patch.object(emit_hrrp, "read_pinned_bytes",
                               lambda i: short.encode() if i == emit_hrrp.SUMMARY else real(i)):
            with self.assertRaisesRegex(hrrp.HrrpError, "national summary"):
                emit_hrrp.history_body(supp, fy)

    def _supp(self):
        supp, pub = {}, {}
        for i, peer in enumerate(range(1, 6)):
            ccn = f"99000{i}"
            rec = {"paf": 1.0, "dual": 0.1 * (i + 1), "peer": peer, "nm": 1.0,
                   "c": {k: {"n": 30, "err": 1.0, "med": 1.0, "flag": 0, "ratio": 1.0} for k in emit_hrrp.CONDITIONS}}
            supp[ccn], pub[ccn] = rec, copy.deepcopy(rec)
        return supp, pub

    def test_an_empty_peer_group_is_named(self):
        supp, pub = self._supp()
        for c in [c for c, s in supp.items() if s["peer"] == 3]:
            del supp[c], pub[c]
        with self.assertRaisesRegex(hrrp.HrrpError, "peer group 3"):
            emit_hrrp.stored_values(supp, pub, [])

    def test_a_blank_dual_proportion_names_its_peer_group(self):
        supp, pub = self._supp()
        next(s for s in supp.values() if s["peer"] == 2)["dual"] = None
        with self.assertRaisesRegex(hrrp.HrrpError, "peer group 2"):
            emit_hrrp.stored_values(supp, pub, [])


if __name__ == "__main__":
    unittest.main()
