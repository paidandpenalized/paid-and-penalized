"""The Census Geocoder batch client (ported from Thirty Day Readmissions' tests), with a fake service: invented
addresses, synthetic CCNs, no network."""
import tempfile
import unittest
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
        found = geocode.geocode(cands, send)
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


class GapTest(unittest.TestCase):
    def test_the_gap_is_the_master_universe_minus_tdrs_points_and_hrrp_hospitals(self):
        gap = geocode.gap()
        self.assertTrue(gap)
        self.assertEqual(gap, sorted(gap))
        self.assertFalse(set(gap) & set(geocode.tdr_points()))
        self.assertFalse(set(gap) & geocode.tables()["programs"]["hrrp"]["subject"])


if __name__ == "__main__":
    unittest.main()
