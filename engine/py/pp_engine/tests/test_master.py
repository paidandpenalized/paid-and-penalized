"""The hospital master: universe, attributes, per-program flags and reason codes. Synthetic CCNs and invented names."""
import itertools
import random
import unittest

from pp_engine import geo, location, master
from pp_engine.master import KINDS, REASONS, Place, build_master, build_record, kind_of, no_place, reason_for
from pp_engine.parse import SchemaError
from pp_engine.schema import validate
from pp_pipeline.files import load_schemas

SCHEMAS = load_schemas()
MANIFEST = [{"id": s, "sha256": "0" * 64} for s in ("hgi", "impact", "pos", "hacrp", "hrrp")]
NOT_IPPS = {"critical_access": "critical_access", "psychiatric": "psychiatric", "childrens": "childrens",
            "long_term": "long_term", "rural_emergency": "rural_emergency", "va": "federal", "dod": "federal"}


def hgi_row(name="INVENTED GENERAL HOSPITAL", kind="Acute Care Hospitals", state="ZZ", **kw):
    return {"name": name, "street": "1 MAIN ST", "city": "SPRINGFIELD", "state": state, "zip": "01234",
            "county": "INVENTED", "type": kind, "ownership": "Voluntary non-profit - Private", **kw}


def impact_row(**kw):
    return {"name": "Invented General Hosp", "urgeo": "RURAL", "irb": 0.0, "beds": 40, "own": "2", "ptype": 0,
            "mdh": False, "fips": None, "cbsa_geo": "", **kw}


def pos_row(term="00", **kw):
    return {"name": "INVENTED POS NAME", "street": "9 SIDE ST", "city": "SHELBYVILLE", "state": "YY", "zip": "05678",
            "beds": 50, "term": term, "termDate": "2025-01-31" if term != "00" else None, **kw}


def ccn(rng):
    return "".join(rng.choice("0123456789") for _ in range(2)) + "".join(rng.choice("0123456789ABCDEFZ") for _ in range(4))


def build(hgi=None, impact=None, pos=None, hacrp=(), hrrp=(), hacrp_exempt=(), place=None):
    """`hacrp_exempt`: CCNs the HACRP file lists but doesn't adjust (Payment Reduction N/A)."""
    return build_master(hgi or {}, impact or {}, pos or {},
                        {"hacrp": {"fy": 2026, "names": {c: "INVENTED HACRP NAME" for c in hacrp},
                                   "subject": set(hacrp) - set(hacrp_exempt)},
                         "hrrp": {"fy": 2027, "names": {c: "Invented HRRP Name" for c in hrrp}, "subject": set(hrrp)}},
                        fy=2027, manifest=MANIFEST, sources=[m["id"] for m in MANIFEST], built_at="2026-10-20T00:00:00Z",
                        place=place or no_place())


class Universe(unittest.TestCase):
    def test_universe_is_the_union(self):
        rng = random.Random(20261020)
        for _ in range(500):
            pool = list({ccn(rng) for _ in range(30)})
            pick = lambda: set(rng.sample(pool, rng.randint(0, len(pool))))  # noqa: E731
            hgi, impact, pos, hacrp, hrrp = pick(), pick(), pick(), pick(), pick()
            out = build({c: hgi_row() for c in hgi}, {c: impact_row() for c in impact}, {c: pos_row() for c in pos},
                        hacrp, hrrp)
            got = [h["ccn"] for h in out["hospitals"]]
            self.assertEqual(got, sorted(hgi | impact | hacrp | hrrp))
            self.assertTrue(set(pos) - hgi - impact - hacrp - hrrp <= set(pos) - set(got))  # POS alone adds nobody

    def test_ccns_survive_as_text(self):
        ccns = ["000001", "00001F", "120345", "99000Z"]
        out = build({c: hgi_row() for c in ccns})
        self.assertEqual([h["ccn"] for h in out["hospitals"]], sorted(ccns))
        self.assertTrue(all(isinstance(h["ccn"], str) for h in out["hospitals"]))

    def test_envelope_and_program_years(self):
        out = build({"000001": hgi_row()}, hacrp=["000001"])
        self.assertEqual(list(out)[:6], ["schema_version", "methods_version", "source_manifest", "sources", "built_at", "fy"])
        self.assertEqual(out["fy"], 2027)
        self.assertEqual(out["programYears"], {"hacrp": 2026, "hrrp": 2027})
        self.assertEqual(validate(SCHEMAS["hospital.schema.json"], out, SCHEMAS), [])


class Reasons(unittest.TestCase):
    STATES = ("MD", "VA", None)

    def test_subject_always_wins(self):
        for kind, state, inactive in itertools.product([*KINDS.values(), "unknown"], self.STATES, (True, False)):
            self.assertIsNone(reason_for(True, kind, state, inactive), (kind, state, inactive))

    def test_reason_precedence(self):
        def oracle(listed, kind, state, inactive):
            if listed:
                return None
            if kind in NOT_IPPS:
                return NOT_IPPS[kind]
            if state == "MD":
                return "maryland"
            return "inactive" if inactive else "not_listed"

        for args in itertools.product((True, False), [*KINDS.values(), "unknown"], self.STATES, (True, False)):
            got = reason_for(*args)
            self.assertEqual(got, oracle(*args), args)
            self.assertTrue(got is None or got in REASONS)

    def test_in_program_iff_no_reason(self):
        rng = random.Random(7)
        hgi = {ccn(rng): hgi_row(kind=rng.choice(list(KINDS)), state=rng.choice(["MD", "ZZ"])) for _ in range(300)}
        listed = set(rng.sample(sorted(hgi), 150))
        for h in build(hgi, hacrp=listed, hrrp=set(rng.sample(sorted(hgi), 100)))["hospitals"]:
            for p in h["programs"].values():
                self.assertEqual(p["inProgram"], p["reason"] is None)
            self.assertEqual(h["programs"]["hacrp"]["inProgram"], h["ccn"] in listed)

    def test_inactive_and_maryland_from_data(self):
        out = build({"000001": hgi_row(state="MD"), "000002": hgi_row()}, pos={"000002": pos_row(term="01")},
                    hacrp=["000001"])
        a, b = out["hospitals"]
        self.assertEqual(a["programs"], {"hacrp": {"inProgram": True, "reason": None},
                                         "hrrp": {"inProgram": False, "reason": "maryland"}})
        self.assertEqual(b["programs"]["hacrp"]["reason"], "inactive")
        self.assertEqual(b["inactive"], {"date": "2025-01-31", "reason": "merger or closure"})

    def test_listed_but_not_adjusted_is_out_of_the_program(self):
        out = build({"000001": hgi_row(state="MD"), "000002": hgi_row()}, hacrp=["000001", "000002"],
                    hacrp_exempt=["000001"])
        a, b = out["hospitals"]
        self.assertEqual(a["programs"]["hacrp"], {"inProgram": False, "reason": "maryland"})
        self.assertEqual(b["programs"]["hacrp"], {"inProgram": True, "reason": None})
        self.assertEqual([h["ccn"] for h in out["hospitals"]], ["000001", "000002"])  # still in the universe

    def test_state_falls_back_to_the_impact_files_fips_state(self):
        r = build_record("000001", None, impact_row(fips="24003"), None, {"hacrp": False})
        self.assertEqual((r["state"], r["fips"], r["programs"]["hacrp"]["reason"]), ("MD", "24003", "maryland"))
        r = build_record("000001", None, impact_row(fips="24003"), pos_row(state="VA"), {})
        self.assertEqual(r["state"], "VA")  # POS before the FIPS code


class Attributes(unittest.TestCase):
    def test_kind_of(self):
        for text, kind in KINDS.items():
            self.assertEqual(kind_of(hgi_row(kind=text), False), kind)
        self.assertEqual(kind_of(None, True), "acute")
        self.assertEqual(kind_of(None, False), "unknown")
        with self.assertRaisesRegex(SchemaError, "Space Hospitals"):
            kind_of(hgi_row(kind="Space Hospitals"), True)

    def test_name_fallbacks(self):
        self.assertEqual(build_record("000001", hgi_row(), impact_row(), pos_row(), {})["name"], "Invented General Hospital")
        self.assertEqual(build_record("000001", None, impact_row(), pos_row(), {})["name"], "Invented General Hosp")
        self.assertEqual(build_record("000001", None, None, pos_row(), {})["name"], "Invented Pos Name")
        self.assertEqual(build_record("000001", None, None, None, {}, ["ST  IVO HOSPITAL"])["name"], "St Ivo Hospital")
        self.assertEqual(build_record("000001", None, None, None, {}, ["Already (Mixed) Case"])["name"], "Already (Mixed) Case")
        out = build(hacrp=["000001"], hrrp=["000001"])
        self.assertEqual(out["hospitals"][0]["name"], "Invented Hacrp Name")  # program files in id order
        self.assertEqual(build_record("000001", None, impact_row(name=""), None, {})["name"],
                         "Hospital 000001 (name not in CMS files)")

    def test_address_falls_back_to_pos(self):
        r = build_record("000001", None, impact_row(), pos_row(), {})
        self.assertEqual((r["street"], r["city"], r["state"], r["zip"]), ("9 SIDE ST", "Shelbyville", "YY", "05678"))
        r = build_record("000001", hgi_row(street="", zip=""), None, None, {})
        self.assertEqual((r["street"], r["zip"]), (None, None))

    def test_beds_source(self):
        self.assertEqual(self._beds(pos_row(beds=50), impact_row(beds=40)), (50, "pos"))
        self.assertEqual(self._beds(pos_row(beds=None), impact_row(beds=40)), (40, "cr"))
        self.assertEqual(self._beds(None, impact_row(beds=None)), (None, None))
        self.assertEqual(self._beds(None, impact_row(beds=0)), (None, None))

    def _beds(self, pos, impact):
        r = build_record("000001", hgi_row(), impact, pos, {})
        return r["beds"], r["bedsSource"]

    def test_ipps_attributes(self):
        r = build_record("000001", hgi_row(), impact_row(ptype=17, mdh=True, irb=0.3, urgeo="LURBAN"), None, {})
        self.assertEqual((r["ipps"], r["types"], r["teach"], r["urban"]), (True, ["MDH", "RRC", "SCH"], "major", True))
        r = build_record("000001", hgi_row(), impact_row(irb=0.1, urgeo="RURAL"), None, {})
        self.assertEqual((r["types"], r["teach"], r["urban"]), ([], "minor", False))

    def test_non_ipps_has_no_ipps_attributes(self):
        r = build_record("000001", hgi_row(kind="Critical Access Hospitals"), None, pos_row(), {})
        self.assertEqual((r["ipps"], r["types"], r["teach"], r["urban"]), (False, [], None, None))

    def test_ownership(self):
        r = build_record("000001", hgi_row(ownership="Proprietary"), impact_row(own="1"), None, {})
        self.assertEqual((r["own"], r["ownDetail"]), ("For-profit", "Proprietary"))
        r = build_record("000001", None, impact_row(own="G"), None, {})
        self.assertEqual((r["own"], r["ownDetail"]), ("Government", None))

    def test_inactive_codes(self):
        for code in ("00", "80"):
            self.assertIsNone(build_record("000001", hgi_row(), None, pos_row(term=code), {})["inactive"])
        for code in ("01", "05", "07"):
            self.assertIsNotNone(build_record("000001", hgi_row(), None, pos_row(term=code), {})["inactive"])

    def test_records_validate(self):
        rng = random.Random(11)
        for _ in range(200):
            c = ccn(rng)
            hgi = hgi_row(kind=rng.choice(list(KINDS))) if rng.random() < 0.8 else None
            imp = impact_row(ptype=rng.choice([0, 7, 14, 16, 17, 22]), mdh=rng.random() < 0.2) if rng.random() < 0.6 else None
            pos = pos_row(term=rng.choice(["00", "01", "80"]), beds=rng.choice([None, 10])) if rng.random() < 0.9 else None
            if not (hgi or imp or pos):
                continue
            out = build({c: hgi} if hgi else {}, {c: imp} if imp else {}, {c: pos} if pos else {},
                        hacrp=[c] if rng.random() < 0.5 else [], hrrp=[c] if rng.random() < 0.5 else [])
            self.assertEqual(validate(SCHEMAS["hospital.schema.json"], out, SCHEMAS), [])

    def test_schema_vocabularies_match_the_code(self):
        h = SCHEMAS["hospital.schema.json"]["$defs"]
        self.assertEqual(set(h["hospital"]["properties"]["kind"]["enum"]), {*KINDS.values(), "unknown"})
        self.assertEqual(set(h["program"]["properties"]["reason"]["enum"]), {None, *REASONS})
        self.assertEqual(set(h["hospital"]["properties"]["types"]["items"]["enum"]),
                         {t for ts in master.PTYPES.values() for t in ts} | {"MDH"})
        self.assertEqual(h["hospital"]["required"], list(master.RECORD_KEYS))
        self.assertEqual(h["hospital"]["properties"]["region"]["enum"][1:], list(dict.fromkeys(r for r, _ in geo.DIVISIONS.values())))
        self.assertEqual(h["hospital"]["properties"]["division"]["enum"][1:], list(geo.DIVISIONS))
        self.assertEqual(set(h["hospital"]["properties"]["geo"]["enum"]), {None, "address", "zip", "county"})

    def test_record_keys_in_order(self):
        self.assertEqual(list(build_record("000001", hgi_row(), None, None, {"hacrp": True})), list(master.RECORD_KEYS))


SQUARE = [[(0.0, 0.0), (0.0, 1.0), (1.0, 1.0), (1.0, 0.0), (0.0, 0.0)]]  # ~111 km square county at the equator


def place(points=None):
    counties = geo.Counties(centroid={"99001": (0.5, 0.5)}, by_name={}, shape={"99001": [SQUARE]},
                            name={"99001": "Squareville"}, named={})
    zcta = {"01234": (0.25, 0.75), "05678": (0.75, 0.25)}
    return Place(location.Ref(zcta, counties, points or {}, [], []), {"99901": "Invented, ZZ"})


class Location(unittest.TestCase):
    def test_location_fields(self):
        r = build_record("000001", hgi_row(state="VA"), impact_row(fips="99001", cbsa_geo="99901"), None, {},
                         place=place())
        self.assertEqual({k: r[k] for k in ("county", "fips", "lat", "lon", "geo", "cbsa", "cbsaName", "region", "division")},
                         {"county": "Squareville County", "fips": "99001", "lat": 0.25, "lon": 0.75, "geo": "zip",
                          "cbsa": "99901", "cbsaName": "Invented, ZZ", "region": "South", "division": "South Atlantic"})

    def test_cbsa_only_when_five_digits_and_name_only_when_known(self):
        for code, want in (("05", (None, None)), ("", (None, None)), ("99902", ("99902", None))):
            r = build_record("000001", hgi_row(), impact_row(cbsa_geo=code), None, {}, place=place())
            self.assertEqual((r["cbsa"], r["cbsaName"]), want, code)

    def test_an_address_point_wins_and_rounds_to_four_places(self):
        r = build_record("000001", hgi_row(), impact_row(fips="99001"), None, {},
                         place=place({"000001": (0.123456, 0.654321)}))
        self.assertEqual((r["lat"], r["lon"], r["geo"]), (0.1235, 0.6543, "address"))

    def test_no_care_compare_row_uses_pos_zip_and_the_impact_county(self):
        r = build_record("000001", None, impact_row(fips="99001"), pos_row(), {}, place=place())
        self.assertEqual((r["lat"], r["lon"], r["geo"], r["county"]), (0.75, 0.25, "zip", "Squareville County"))

    def test_no_geography_gives_null_location(self):
        r = build_record("000001", hgi_row(state="ZZ"), None, None, {})
        self.assertEqual([r[k] for k in ("lat", "lon", "geo", "fips", "cbsa", "region", "division")], [None] * 7)

    def test_records_with_location_validate(self):
        out = build({"000001": hgi_row(state="VA"), "000002": hgi_row()},
                    {"000001": impact_row(fips="99001", cbsa_geo="99901")}, place=place({"000002": (0.5, 0.5)}))
        self.assertEqual(validate(SCHEMAS["hospital.schema.json"], out, SCHEMAS), [])

    def test_a_ccn_in_two_point_files_raises(self):
        self.assertEqual(location.merge_points({"000001": (1, 2)}, {"000002": (3, 4)}),
                         {"000001": (1, 2), "000002": (3, 4)})
        with self.assertRaisesRegex(SchemaError, "1 CCNs in two point files"):
            location.merge_points({"000001": (1, 2)}, {"000001": (1, 2)})

    def test_the_county_gate_lists_and_fails_above_the_limit(self):
        rows = [("000001", "THE DISTRICT", "Invented City", "unknown county"), ("000002", None, "Narnia County", "x")]
        self.assertEqual(location.describe_unchecked(rows),
                         ["000001 'THE DISTRICT' -> Invented City (unknown county)", "000002 None -> Narnia County (x)"])
        location.county_gate(rows, 2, {"000001": True, "000002": True})
        with self.assertRaisesRegex(SchemaError, r"^1 county names .* than 0: 000001 "):  # no name: reported, not gated
            location.county_gate(rows, 0, {"000001": True, "000002": True})
        location.county_gate(rows, 0, {"000001": False, "000002": True})  # a state the atlas lacks: not gated


if __name__ == "__main__":
    unittest.main()
