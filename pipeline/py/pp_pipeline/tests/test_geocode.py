"""The Census Geocoder batch client (ported from Thirty Day Readmissions' tests), with a fake service: invented
addresses, synthetic CCNs, no network."""
import tempfile
import unittest
from unittest import mock
from pathlib import Path

from pp_engine.parse import read_points
from pp_pipeline import geocode

FIRST = ("hgi", "1 INVENTED WAY", "SPRINGFIELD", "AL", "36301")
SECOND = ("hgi", "2 INVENTED RD", "NORTHPOLE", "AK", "99701")
OK_ROW = ('"990001-1","1 INVENTED WAY, SPRINGFIELD, AL, 36301","Match","Exact","1 INVENTED WAY, SPRINGFIELD, AL, 36301",'
          '"-85.361445951887,31.215662945023","101238843","R"')


class ResponseTest(unittest.TestCase):
    BATCH = {"990001-1": FIRST, "990002-1": SECOND}

    def parse(self, *lines):
        return geocode.parse_response("\n".join(lines) + "\n", self.BATCH)

    def test_matched_rows_give_lat_lon_and_match_type(self):
        got = self.parse(OK_ROW, '"990002-1","2 INVENTED RD, NORTHPOLE, AK, 99701","Match","Non_Exact",'
                                 '"2 INVENTED RD, NORTHPOLE, AK, 99701","-147.739134283597,64.834607892861","1","L"')
        self.assertEqual(got, {"990001-1": (31.215662945023, -85.361445951887, "Exact"),
                               "990002-1": (64.834607892861, -147.739134283597, "Non_Exact")})

    def test_no_match_and_tie_are_ignored(self):
        self.assertEqual(self.parse('"990001-1","x","No_Match"', '"990002-1","x","Tie"'), {})

    def test_untrusted_rows_are_ignored(self):
        for bad in [OK_ROW.replace('"990001-1"', '"999999-1"'),  # id not requested
                    OK_ROW.replace('SPRINGFIELD, AL, 36301","-85', 'SPRINGFIELD, GA, 36301","-85'),  # other state
                    OK_ROW.replace("-85.361445951887,31.215662945023", "-85.36,31.21,7"),  # three numbers
                    OK_ROW.replace("-85.361445951887,31.215662945023", "1e3,31.2"),  # not a plain decimal
                    OK_ROW.replace("-85.361445951887,31.215662945023", "2.35,48.85"),  # outside the U.S.
                    OK_ROW.replace('"Exact"', '"Approximate"'),
                    OK_ROW.split(',"-85')[0]]:  # truncated row
            self.assertEqual(self.parse(bad), {}, bad)

    def test_an_id_answered_twice_is_ignored(self):
        self.assertEqual(self.parse(OK_ROW, OK_ROW), {})

    def test_us_bounds_include_alaska_hawaii_and_puerto_rico(self):
        for lat, lon in [(64.83, -147.74), (21.31, -157.86), (18.40, -66.06), (40.0, -100.0)]:
            self.assertTrue(geocode.in_us(lat, lon), (lat, lon))
        self.assertFalse(geocode.in_us(51.5, -0.1))


class FlowTest(unittest.TestCase):
    def test_candidates_put_care_compare_first_and_drop_identical_pos_address(self):
        hgi = {"990001": {"street": "PO BOX 1", "city": "A", "state": "AL", "zip": "36301"},
               "990005": {"street": "1 MAIN ST", "city": "B", "state": "AL", "zip": "35957"}}
        pos = {"990001": {"street": "1 INVENTED WAY", "city": "SPRINGFIELD", "state": "AL", "zip": "36301"},
               "990005": {"street": "1 Main St", "city": "B", "state": "AL", "zip": "35957"},
               "990006": {"street": "", "city": "C", "state": "AL", "zip": "35630"}}
        got = geocode.candidates(["990001", "990005", "990006"], hgi, pos)
        self.assertEqual([a[0] for a in got["990001"]], ["hgi", "pos"])
        self.assertEqual([a[0] for a in got["990005"]], ["hgi"])
        self.assertNotIn("990006", got)

    def test_one_request_carries_every_address_and_the_first_choice_wins(self):
        sent = []

        def send(batch):
            sent.append(dict(batch))
            second = OK_ROW.replace('"990001-1"', '"990001-2"').replace("-85.361445951887", "-85.4")
            return "\n".join([OK_ROW.replace('"990001-1"', '"990003-2"').replace("1 INVENTED WAY", "3 INVENTED WAY"),
                              second, OK_ROW, '"990003-1","x","No_Match"']) + "\n"
        cands = {"990001": [FIRST, ("pos", *FIRST[1:3], "AL", "36301")],
                 "990003": [("hgi", "PO BOX 3", "SPRINGFIELD", "AL", "36301"), ("pos", "3 INVENTED WAY", "SPRINGFIELD", "AL", "36301")]}
        found, unanswered = geocode.geocode(cands, send)
        self.assertEqual(unanswered, set())
        self.assertEqual(len(sent), 1)
        self.assertEqual(sorted(sent[0]), ["990001-1", "990001-2", "990003-1", "990003-2"])
        self.assertEqual(found, {"990001": (31.215662945023, -85.361445951887, "Exact", "hgi"),
                                 "990003": (31.215662945023, -85.361445951887, "Exact", "pos")})

    def test_a_batch_over_the_row_limit_is_refused_before_sending(self):
        cands = {f"{i:06d}": [FIRST] for i in range(geocode.MAX_ROWS + 1)}
        with self.assertRaises(SystemExit):
            geocode.geocode(cands, lambda batch: self.fail("sent"))

    def test_written_csv_round_trips_through_the_build_reader(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d, "g.csv")
            geocode.write({"990002": (64.834607892861, -147.739134283597, "Exact", "hgi"),
                           "990001": (31.215662945023, -85.361445951887, "Non_Exact", "pos")}, 3, p)
            self.assertEqual(p.read_text().splitlines(), ["ccn,lat,lon,match,source", "990001,31.21566,-85.36145,Non_Exact,pos",
                                                          "990002,64.83461,-147.73913,Exact,hgi"])
            self.assertEqual(read_points(p.read_text()), {"990001": (31.21566, -85.36145), "990002": (64.83461, -147.73913)})

    def test_a_mostly_failed_run_leaves_the_csv_alone(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d, "g.csv")
            p.write_text("ccn,lat,lon,match,source\n")
            with self.assertRaises(SystemExit):
                geocode.write({"990001": (31.2, -85.4, "Exact", "hgi")}, 2912, p)
            self.assertEqual(p.read_text(), "ccn,lat,lon,match,source\n")


    def test_a_full_run_with_an_unanswered_hospital_writes_nothing(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "geocodes.csv"
            out.write_text("ccn,lat,lon,match,source\n990009,30.00000,-85.00000,Exact,pos\n")
            hgi = {"990001": {"street": "1 INVENTED WAY", "city": "SPRINGFIELD", "state": "AL", "zip": "36301"}}
            with mock.patch.object(geocode, "gap", return_value=["990001"]), \
                    mock.patch.object(geocode, "tables", return_value={"hgi": hgi, "pos": {}}), \
                    self.assertRaisesRegex(SystemExit, "unanswered"):
                geocode.main(send=lambda batch: "", out=out)
            self.assertIn("990009", out.read_text())

    def test_kept_rows_stay_as_written_and_new_matches_join_them_in_ccn_order(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "geocodes.csv"
            keep = [["990003", "31.20000", "-85.40000", "Exact", "pos"]]
            geocode.write({"990001": (64.834607892861, -147.739134283597, "Exact", "hgi")}, 1, p, keep=keep)
            self.assertEqual(p.read_text().splitlines(), ["ccn,lat,lon,match,source", "990001,64.83461,-147.73913,Exact,hgi",
                                                          "990003,31.20000,-85.40000,Exact,pos"])
            with self.assertRaises(SystemExit):
                geocode.write({"990003": (31.2, -85.4, "Exact", "hgi")}, 1, p, keep=keep)


class GapTest(unittest.TestCase):
    def test_the_gap_is_the_master_universe_minus_tdrs_points_and_hrrp_hospitals(self):
        gap = geocode.gap()
        self.assertTrue(gap)
        self.assertEqual(gap, sorted(gap))
        self.assertFalse(set(gap) & set(geocode.tdr_points()))
        self.assertFalse(set(gap) & geocode.tables()["programs"]["hrrp"]["subject"])

    def test_changed_is_the_gap_with_a_new_care_compare_address(self):
        t = geocode.tables()
        now, before = t["hgi"], t["hgi_prior"]
        address = lambda row: [row[k].upper() for k in geocode.ADDRESS]  # noqa: E731
        gap = set(geocode.gap()) & set(now)
        new = gap - set(before)
        moved = {c for c in gap & set(before) if address(now[c]) != address(before[c])}
        self.assertTrue(new and moved, "the pins have both kinds")
        self.assertEqual(geocode.changed(set()), (sorted(new), sorted(moved)))
        self.assertEqual(geocode.changed(new), ([], sorted(moved)), "a new hospital already placed is not sent again")


class ChangedFlowTest(unittest.TestCase):
    """`geocode --changed` end to end on synthetic hospitals and a fake service: a new hospital tries Care Compare then
    POS; a moved one only its new Care Compare address; a moved one with no match loses its old row; others stay."""
    HGI = {"990001": {"street": "1 INVENTED WAY", "city": "SPRINGFIELD", "state": "AL", "zip": "36301"},
           "990002": {"street": "2 NEW RD", "city": "SPRINGFIELD", "state": "AL", "zip": "36301"},
           "990003": {"street": "3 NEW RD", "city": "SPRINGFIELD", "state": "AL", "zip": "36301"}}
    POS = {c: {"street": "9 OLD RD", "city": "SPRINGFIELD", "state": "AL", "zip": "36301"} for c in HGI}

    def test_rows_replaced_dropped_and_kept(self):
        sent = []

        def send(batch):
            sent.extend(batch.values())
            return "".join(f'"{i}","x","Match","Exact","{a[1]}, {a[2]}, {a[3]}, {a[4]}","-85.10000,31.20000","1","R"\n'
                           if i.startswith("990002") or a[0] == "pos" else f'"{i}","x","No_Match"\n'
                           for i, a in batch.items())
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "geocodes.csv"
            out.write_text("ccn,lat,lon,match,source\n990002,30.00000,-85.00000,Exact,hgi\n"
                           "990003,30.00000,-85.00000,Exact,hgi\n990009,30.00000,-85.00000,Exact,pos\n")
            seen = []

            def changed(have):
                seen.append(have)
                return ["990001"], ["990002", "990003"]
            with mock.patch.object(geocode, "changed", changed), \
                    mock.patch.object(geocode, "tables", return_value={"hgi": self.HGI, "pos": self.POS}):
                geocode.main(send=send, only_changed=True, out=out)
            self.assertEqual(out.read_text().splitlines(), [
                "ccn,lat,lon,match,source",
                "990001,31.20000,-85.10000,Exact,pos",  # new: Care Compare missed, POS matched
                "990002,31.20000,-85.10000,Exact,hgi",  # moved: replaced
                "990009,30.00000,-85.00000,Exact,pos",  # untouched
            ])  # 990003 moved and missed: its old row is gone
        self.assertEqual(sum(1 for a in sent if a[0] == "pos"), 1, "only the new hospital is offered its POS address")
        self.assertEqual(seen, [{"990002", "990003", "990009"}], "changed() is given the CCNs `out` already places")

    def test_a_small_batch_that_all_misses_still_drops_the_stale_rows(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "geocodes.csv"
            out.write_text("ccn,lat,lon,match,source\n990002,30.00000,-85.00000,Exact,hgi\n"
                           "990009,30.00000,-85.00000,Exact,pos\n")
            with mock.patch.object(geocode, "changed", return_value=([], ["990002"])), \
                    mock.patch.object(geocode, "tables", return_value={"hgi": self.HGI, "pos": self.POS}):
                geocode.main(send=lambda batch: "".join(f'"{i}","x","No_Match"\n' for i in batch), only_changed=True,
                             out=out)
            self.assertEqual(out.read_text().splitlines(), ["ccn,lat,lon,match,source",
                                                            "990009,30.00000,-85.00000,Exact,pos"])

    def test_an_unanswered_hospital_keeps_its_row(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "geocodes.csv"
            before = ("ccn,lat,lon,match,source\n990002,30.00000,-85.00000,Exact,hgi\n"
                      "990003,30.00000,-85.00000,Exact,hgi\n")
            out.write_text(before)
            with mock.patch.object(geocode, "changed", return_value=([], ["990002", "990003"])), \
                    mock.patch.object(geocode, "tables", return_value={"hgi": self.HGI, "pos": self.POS}):
                geocode.main(send=lambda batch: "<html>Service Unavailable</html>\n", only_changed=True, out=out)
                self.assertEqual(out.read_text(), before, "an outage drops nothing")
                # Only 990002 answered (No_Match): it drops to its ZIP; 990003, not answered, keeps its row.
                geocode.main(send=lambda batch: '"990002-1","x","No_Match"\n', only_changed=True, out=out)
            self.assertEqual(out.read_text().splitlines(), ["ccn,lat,lon,match,source",
                                                            "990003,30.00000,-85.00000,Exact,hgi"])

    def test_answered_means_one_complete_row_for_every_address(self):
        cands = {"990002": [("hgi", "2 NEW RD", "SPRINGFIELD", "AL", "36301")],
                 "990003": [("hgi", "3 NEW RD", "SPRINGFIELD", "AL", "36301"), ("pos", "9 OLD RD", "SPRINGFIELD", "AL", "36301")]}
        match = OK_ROW.replace("990001-1", "990002-1").replace("1 INVENTED WAY", "2 NEW RD")
        for text, unanswered in [
                ('"990003-1","x","No_Match"\n' + match[:-10], {"990002", "990003"}),  # cut off; 990003-2 never answered
                (match + "\n" + match + "\n", {"990002", "990003"}),  # answered twice
                (match + "\n" + '"990003-1","x","No_Match"\n"990003-2","x","Tie"\n', set())]:
            found, got = geocode.geocode(cands, send=lambda batch: text)
            self.assertEqual(got, unanswered, text)
            self.assertEqual(set(found), {"990002"} - unanswered, text)
        self.assertEqual(geocode.geocode({}, send=lambda batch: self.fail("sent")), ({}, set()))
        bom = "\ufeff" + OK_ROW.replace("990001-1", "990002-1").replace("1 INVENTED WAY", "2 NEW RD") + "\n"
        self.assertEqual(set(geocode.geocode(cands, send=lambda batch: bom)[0]), {"990002"})

    def test_changed_sorts_new_and_moved_and_ignores_a_case_only_edit(self):
        row = lambda street: {"street": street, "city": "SPRINGFIELD", "state": "AL", "zip": "36301"}  # noqa: E731
        now = {"990001": row("1 NEW WAY"), "990002": row("2 Moved Rd"), "990003": row("3 Main St"),
               "990004": row("4 NEW WAY")}
        before = {"990002": row("2 OLD RD"), "990003": row("3 MAIN ST")}
        with mock.patch.object(geocode, "tables", return_value={"hgi": now, "hgi_prior": before}), \
                mock.patch.object(geocode, "gap", return_value=["990001", "990002", "990003", "990004", "990005"]):
            self.assertEqual(geocode.changed(set()), (["990001", "990004"], ["990002"]))
            self.assertEqual(geocode.changed({"990004"}), (["990001"], ["990002"]))


if __name__ == "__main__":
    unittest.main()
