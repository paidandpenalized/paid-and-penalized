"""Location rules (ported from Thirty Day Readmissions' tests), on synthetic geography and synthetic CCNs."""
import random
import unittest

from pp_engine import geo, location

SQUARE = [[(0.0, 0.0), (0.0, 1.0), (1.0, 1.0), (1.0, 0.0), (0.0, 0.0)]]  # ~111 km square county at the equator


class CountyLabelTest(unittest.TestCase):
    """location.county_label: Care Compare's county when the atlas knows it, else the impact-file county's name; either
    with its legal suffix."""
    NAMES = {"11001": "District of Columbia", "51760": "Richmond", "51159": "Richmond", "51095": "James City",
             "51830": "Williamsburg", "51059": "Fairfax", "51600": "Fairfax", "51775": "Salem", "51683": "Manassas",
             "51153": "Prince William", "29189": "St. Louis", "29510": "St. Louis", "32510": "Carson City",
             "06007": "Butte", "22033": "East Baton Rouge", "02090": "Fairbanks North Star", "46102": "Oglala Lakota",
             "17037": "DeKalb", "55039": "Fond du Lac", "49035": "Salt Lake", "13089": "DeKalb", "17043": "DuPage",
             "17099": "LaSalle", "22059": "LaSalle", "29186": "Ste. Genevieve", "35013": "Doña Ana", "48201": "Harris",
             "09003": "Hartford", "51019": "Bedford", "29051": "Cole", "29099": "Jefferson", "19193": "Woodbury",
             "19167": "Sioux", "49011": "Davis", "51161": "Roanoke", "51770": "Roanoke", "51510": "Alexandria",
             "32005": "Douglas", "48201": "Harris"}
    COUNTIES = geo.Counties(centroid={}, by_name={geo.county_key(geo.STATE_FIPS[f[:2]], n): (0, 0) for f, n in NAMES.items()},
                            shape={"51059": [SQUARE], "29189": [SQUARE], "51510": [[[(x + 1.2, y) for x, y in SQUARE[0]]]],
                                   "29510": [[[(x + 1.2, y) for x, y in SQUARE[0]]]]},
                            name=NAMES, named=geo.spellings(NAMES))

    def county(self, st, county, fips, point=None, moved=None):
        return location.county_label({"county": county}, st, fips, self.COUNTIES, point, moved)

    def label(self, st, county, fips, point=None):
        return self.county(st, county, fips, point)[0]

    def test_unknown_care_compare_county_falls_back_to_the_impact_file_county(self):
        self.assertEqual(self.label("DC", "THE DISTRICT", "11001"), "District of Columbia")
        self.assertEqual(self.label("LA", "E. BATON ROUGE", "22033"), "East Baton Rouge Parish")
        self.assertEqual(self.label("VA", "RICHMND", "51760"), "Richmond City")  # the atlas's "Richmond" for 51760
        self.assertEqual(self.label("VA", "RICHMND", "51159"), "Richmond County")
        self.assertEqual(self.label("CA", "BUTTTE", "06007"), "Butte County")
        self.assertEqual(self.label("CA", "BUTTTE", "06999"), "Buttte County")  # no atlas county: Care Compare's name
        self.assertIsNone(self.label("CA", None, None))

    def test_a_known_county_takes_the_atlas_spelling(self):
        self.assertEqual(self.label("IL", "DE KALB", "17037"), "DeKalb County")
        self.assertEqual(self.label("WI", "FOND DU LAC", "55039"), "Fond du Lac County")

    def test_a_county_written_as_its_city_outside_the_independent_city_states_is_that_county(self):
        self.assertEqual(self.label("UT", "SALT LAKE CITY", "49035"), "Salt Lake County")

    def test_known_county_and_virginia_city_keep_care_compares_wording(self):
        self.assertEqual(self.label("DC", "DISTRICT OF COLUMBIA", "11001"), "District of Columbia")
        self.assertEqual(self.label("VA", "RICHMOND CITY", "51760"), "Richmond City")

    def test_suffix_by_state(self):
        self.assertEqual(self.label("CA", "BUTTE", "06007"), "Butte County")
        self.assertEqual(self.label("LA", "EAST BATON ROUGE", "22033"), "East Baton Rouge Parish")
        self.assertEqual(self.label("AK", "FAIRBANKS NORTH STAR", "02090"), "Fairbanks North Star")
        self.assertEqual(self.label("SD", "OGLALA LAKOTA COUNTY", "46102"), "Oglala Lakota County")

    def test_independent_cities_keep_city_and_counties_named_city_get_county(self):
        self.assertEqual(self.label("VA", "JAMES CITY", "51095"), "James City County")
        self.assertEqual(self.label("VA", "JAMES CITY", "51830"), "James City County")  # FIPS of Williamsburg, a city
        self.assertEqual(self.label("VA", "MANASSAS CITY", "51153"), "Manassas City")  # FIPS of a county
        self.assertEqual(self.label("MO", "ST. LOUIS CITY", "29189"), "St. Louis City")
        self.assertEqual(self.label("MO", "ST. LOUIS", "29189"), "St. Louis County")
        self.assertEqual(self.label("NV", "CARSON CITY", "32510"), "Carson City")
        self.assertEqual(self.label("VA", "SALEM", "51775"), "Salem City")  # Virginia has no Salem County

    def test_a_name_a_county_shares_with_a_city_goes_by_the_address_then_the_fips_then_the_county(self):
        # A hospital filed under Fairfax city (51600) whose street address is in Fairfax County.
        self.assertEqual(self.label("VA", "FAIRFAX", "51600", point=(0.5, 0.5)), "Fairfax County")
        self.assertEqual(self.label("VA", "FAIRFAX", "51600", point=(5.0, 5.0)), "Fairfax City")  # in neither: the FIPS
        self.assertEqual(self.label("VA", "FAIRFAX", "51600"), "Fairfax City")
        self.assertEqual(self.label("VA", "RICHMOND", "51760"), "Richmond City")
        self.assertEqual(self.label("VA", "RICHMOND", "51087"), "Richmond County")  # FIPS is neither: the county

    def test_place_name(self):
        self.assertEqual(location.place_name("Richmond", "VA", True), "Richmond City")
        self.assertEqual(location.place_name("Richmond City", "VA", True), "Richmond City")
        self.assertEqual(location.place_name("James City", "VA", False), "James City County")
        self.assertEqual(location.place_name("Orleans", "LA", False), "Orleans Parish")
        self.assertEqual(location.place_name("Anchorage", "AK", False), "Anchorage")
        self.assertEqual(location.place_name("", "TX", False), "")
        self.assertEqual(location.place_name("Narnia-County", "TX", False), "Narnia-County")
        self.assertEqual(location.place_name("Kansas City", "MO", None), "Kansas City")  # county or city unknown
        self.assertEqual(location.place_name("Narnia", "MO", None), "Narnia")

    def test_independent_city_fips(self):
        self.assertEqual([location.independent_city(f) for f in ("51760", "51159", "29510", "32510", "24510", "06500", None)],
                         [True, False, True, True, True, False, False])


class StrayPointTest(unittest.TestCase):
    """location.locate: a ZIP point far outside the impact-file county falls back to that county's centroid."""
    COUNTIES = geo.Counties(centroid={"99001": (0.5, 0.5), "99002": (9.0, 9.0)}, by_name={},
                            shape={"99001": [SQUARE]}, name={"99001": "Squareville"}, named={})
    HOSP = {"zip": "11111", "county": "Wrongshire"}
    IMP = {"fips": "99001"}

    def locate(self, zip_pt, imp=IMP, point=None, hosp=HOSP):
        return location.locate(hosp, imp, "ZZ", {"11111": zip_pt}, self.COUNTIES, point)

    def test_address_point_wins_and_corrects_a_care_compare_county_naming_elsewhere(self):
        self.assertEqual(self.locate((0.2, 0.3), point=(0.6, 0.6)), (0.6, 0.6, "address", "Squareville"))
        self.assertEqual(self.locate((0.2, 0.3), point=(0.6, 0.6), hosp={**self.HOSP, "county": "SQUAREVILLE"}),
                         (0.6, 0.6, "address", None))
        self.assertEqual(self.locate((0.2, 0.3), point=(0.6, 0.6), hosp={**self.HOSP, "county": "SQUAREVILLE CITY"}),
                         (0.6, 0.6, "address", None))

    def test_address_point_near_the_county_keeps_care_compare_county(self):
        self.assertEqual(self.locate((0.2, 0.3), point=(0.5, 1.2)), (0.5, 1.2, "address", None))  # ~22 km out

    def test_address_point_far_outside_falls_back_to_zip_logic(self):
        self.assertEqual(self.locate((0.2, 0.3), point=(0.5, 2.0)), (0.2, 0.3, "zip", None))  # ~111 km out
        self.assertEqual(self.locate((0.5, 2.0), point=(0.5, 2.0)), (0.5, 0.5, "county", "Squareville"))

    def test_address_point_for_a_county_missing_from_the_atlas_is_used(self):
        self.assertEqual(self.locate((0.2, 0.3), {"fips": "09110"}, point=(5.0, 5.0)), (5.0, 5.0, "address", None))

    def test_km_outside(self):
        self.assertEqual(geo.km_outside(0.5, 0.5, [SQUARE]), 0.0)
        self.assertAlmostEqual(geo.km_outside(0.5, 1.1, [SQUARE]), 11.1, delta=0.3)
        hole = [SQUARE[0], [(0.4, 0.4), (0.4, 0.6), (0.6, 0.6), (0.6, 0.4), (0.4, 0.4)]]
        self.assertAlmostEqual(geo.km_outside(0.5, 0.5, [hole]), 11.1, delta=0.3)  # nearest edge is the hole's

    def test_inside_keeps_zip(self):
        self.assertEqual(self.locate((0.2, 0.3)), (0.2, 0.3, "zip", None))

    def test_slightly_outside_keeps_zip(self):
        self.assertEqual(self.locate((0.5, 1.2)), (0.5, 1.2, "zip", None))  # ~22 km out

    def test_far_outside_uses_fips_centroid_and_name(self):
        self.assertEqual(self.locate((0.5, 2.0)), (0.5, 0.5, "county", "Squareville"))  # ~111 km out

    def test_a_stray_address_point_is_no_evidence_for_the_county(self):
        for zip_pt, src in [((0.2, 0.3), "zip"), ((0.5, 2.0), "county")]:
            *_, gsrc, fips_county = self.locate(zip_pt, point=(0.5, 2.0))  # the address point, ~111 km out, is set aside
            self.assertEqual(gsrc, src)
            self.assertEqual(location.county_label(self.HOSP, "ZZ", "99001", self.COUNTIES, None, gsrc if fips_county else None),
                             ("Squareville County", "unknown county; the impact-file county's name"))

    def test_fips_missing_from_atlas_keeps_zip(self):
        self.assertEqual(self.locate((5.0, 5.0), {"fips": "09110"}), (5.0, 5.0, "zip", None))
        self.assertEqual(self.locate((5.0, 5.0), {"fips": "99002"}), (5.0, 5.0, "zip", None))  # centroid known, no shape


CHECKED_COUNTIES = [
    ("IL", "DE KALB", "17037", "DeKalb County"), ("IL", "DEKALB  ", "17037", "DeKalb County"), ("IL", "De-Kalb", "17037", "DeKalb County"),
    ("GA", "DE KALB", "13089", "DeKalb County"), ("IL", "DU PAGE", "17043", "DuPage County"),
    ("WI", "FOND DU LAC", "55039", "Fond du Lac County"), ("NM", "DONA ANA", "35013", "Doña Ana County"),
    ("IL", "LA SALLE", "17099", "LaSalle County"), ("IL", "LA  SALLE", "17099", "LaSalle County"),
    ("LA", "LA SALLE", "22059", "LaSalle Parish"), ("LA", "LA SALLE", "17099", "LaSalle Parish"),  # the state decides
    ("MO", "ST. LOUIS", "29189", "St. Louis County"), ("MO", "SAINT LOUIS", "29189", "St. Louis County"),
    ("MO", "ST. LOUIS COUNTY", "29189", "St. Louis County"), ("VA", "RICHMONDCITY", "51760", "Richmond City"),
    ("VA", "RICHMOND CITY.", "51760", "Richmond City"), ("VA", "RICHMOND-CITY", "51760", "Richmond City"),
    ("MO", "SAINT-LOUIS", "29189", "St. Louis County"), ("MO", "ST LOUIS", "29189", "St. Louis County"),
    ("MO", "ST. LOUIS CITY", "29510", "St. Louis City"),
    ("MO", "SAINT LOUIS CITY", "29510", "St. Louis City"), ("MO", "STE. GENEVIEVE", "29186", "Ste. Genevieve County"),
    ("MO", "SAINTE GENEVIEVE", "29186", "Ste. Genevieve County"), ("LA", "EAST BATON ROUGE", "22033", "East Baton Rouge Parish"),
    ("AK", "FAIRBANKS NORTH STAR BOROUGH", "02090", "Fairbanks North Star"), ("VA", "RICHMOND CITY", "51760", "Richmond City"),
    ("VA", "JAMES CITY", "51830", "James City County"), ("NV", "CARSON CITY", "32510", "Carson City"),
    ("VA", "FAIRFAX", "51059", "Fairfax County"), ("VA", "ROANOKE CITY", "51770", "Roanoke City"),
    ("UT", "SALT LAKE CITY", "49035", "Salt Lake County"), ("DC", "DISTRICT OF COLUMBIA", "11001", "District of Columbia"),
    ("CT", "HARTFORD", "09110", "Hartford County"),  # a planning-region FIPS the atlas lacks; Care Compare's county is known
    ("MO", "ST. LOUIS COUNTY.", "29189", "St. Louis County"), ("TX", "HARRIS-COUNTY", "48201", "Harris County"),
    ("MO", "ST. LOUIS COUNTY.", None, "St. Louis County"), ("TX", "HARRIS-COUNTY", None, "Harris County"),  # no FIPS
]


class HospitalCountyTest(unittest.TestCase):
    """location.place_hospital: the county label sees the street-address point only when the map kept it."""
    def record(self, point):
        ref = location.Ref({"11111": (0.5, 1.7)}, CountyLabelTest.COUNTIES, {"990001": point}, [], [])
        _, _, gsrc, county = location.place_hospital("990001", {"county": "FAIRFAX", "zip": "11111"}, {"fips": "51510"},
                                                     "VA", ref)
        return gsrc, county, ref.unchecked

    # Fairfax County is the unit square; the impact file's Alexandria city is the square 1.2 degrees east; the ZIP point
    # is in Alexandria. Care Compare says a bare "FAIRFAX".
    def test_a_kept_address_point_settles_county_or_city(self):
        self.assertEqual(self.record((0.5, 0.9)), ("address", "Fairfax County", []))  # ~33 km from Alexandria: kept

    def test_a_set_aside_address_point_is_no_evidence(self):
        geo_src, county, unchecked = self.record((0.5, 0.1))  # in Fairfax County, ~122 km from Alexandria: set aside
        self.assertEqual((geo_src, county), ("zip", "Fairfax County"))
        self.assertRegex(unchecked[0][3], "do not settle it")  # had the stray point counted, it would be settled

    def test_place_hospital_records_a_move_and_an_unchecked_county_for_the_build_report(self):
        hosp, imp = {"county": "FAIRFAX", "zip": "11111"}, {"fips": "51510"}
        ref = location.Ref({"11111": (0.5, 1.7)}, CountyLabelTest.COUNTIES, {"990001": (0.5, 1.7)}, [], [])
        # The street address is inside the impact file's Alexandria city, not the Fairfax Care Compare names.
        self.assertEqual(location.place_hospital("990001", hosp, imp, "VA", ref), (0.5, 1.7, "address", "Alexandria City"))
        self.assertEqual((ref.moved, ref.unchecked), ([("990001", "FAIRFAX", "Alexandria", "address")], []))
        ref = location.Ref({"11111": (0.5, 1.7)}, CountyLabelTest.COUNTIES, {"990001": (0.5, 0.1)}, [], [])
        # A set-aside address point: the ZIP point, and county or city unsettled.
        lat, lon, gsrc, county = location.place_hospital("990001", hosp, imp, "VA", ref)
        self.assertEqual((lat, lon, gsrc, county, ref.moved), (0.5, 1.7, "zip", "Fairfax County", []))
        self.assertEqual([(c, raw, label) for c, raw, label, _ in ref.unchecked], [("990001", "FAIRFAX", "Fairfax County")])


class CountyDoubtTest(unittest.TestCase):
    """location.county_label's doubt: a county the rules cannot check is listed, never silently guessed."""
    county = CountyLabelTest.county
    COUNTIES = CountyLabelTest.COUNTIES

    def test_known_names_misspellings_and_collisions_are_checked(self):
        for st, cc, fips, want in CHECKED_COUNTIES:
            self.assertEqual(self.county(st, cc, fips), (want, None), (st, cc, fips))
        # The street address in Fairfax County decides over the impact file's Fairfax city.
        self.assertEqual(self.county("VA", "FAIRFAX", "51600", point=(0.5, 0.5)), ("Fairfax County", None))

    def test_county_or_city_conflicts_and_gaps_are_listed(self):
        for st, cc, fips, point, want in [
                ("MO", "ST. LOUIS", "29999", None, "St. Louis County"),  # bare name, nothing decides: the county
                ("VA", "FAIRFAX", "51510", None, "Fairfax County"),
                ("VA", "FAIRFAX", "51600", None, "Fairfax City"),  # bare name, only the impact file says city
                ("MO", "ST. LOUIS", "29510", None, "St. Louis City"),
                ("VA", "ROANOKE", "51770", None, "Roanoke City"),
                ("VA", "ROANOKE CITY", "51161", None, "Roanoke City"),
                ("MO", "ST. LOUIS CITY", "29189", None, "St. Louis City"),  # Care Compare says city, the impact file county
                ("MO", "ST. LOUIS COUNTY", "29510", None, "St. Louis County"),  # and the reverse
                ("VA", "FAIRFAX COUNTY", "51600", None, "Fairfax County"),
                ("VA", "FAIRFAX-COUNTY", "51600", None, "Fairfax County"),  # Care Compare's word, however punctuated
                ("MO", "ST. LOUIS COUNTY.", "29510", None, "St. Louis County"),
                ("MO", "ST. LOUIS CITY", "29189", (0.5, 0.5), "St. Louis County")]:  # the street address is in the county
            label, doubt = self.county(st, cc, fips, point)
            self.assertEqual(label, want, (st, cc, fips))
            self.assertRegex(doubt, "do not settle it", (st, cc, fips))
        self.assertEqual(self.county("MO", "ST. LOUIS CITY", "29510", (5.0, 5.0)), ("St. Louis City", None))  # address in neither
        self.assertEqual(self.county("MO", "ST. LOUIS", "29189", (0.5, 0.5)), ("St. Louis County", None))

    def test_an_address_over_the_line_does_not_override_care_compare_and_the_impact_file_when_they_agree(self):
        # St. Louis County (29189) and Fairfax County (51059) are the unit square; St. Louis city (29510) is the square
        # 1.2 degrees east. A bare name is Care Compare's county.
        for st, cc, fips, point, want in [
                ("MO", "ST. LOUIS CITY", "29510", (0.5, 0.5), "St. Louis City"),  # the address is in the county
                ("MO", "ST. LOUIS COUNTY", "29189", (0.5, 1.7), "St. Louis County"),  # the address is in the city
                ("MO", "ST. LOUIS", "29189", (0.5, 1.7), "St. Louis County"),
                # They disagree: the address breaks the tie.
                ("MO", "ST. LOUIS CITY", "29189", (0.5, 1.7), "St. Louis City"),
                ("MO", "ST. LOUIS", "29510", (0.5, 0.5), "St. Louis County"),
                ("VA", "FAIRFAX", "51600", (0.5, 0.5), "Fairfax County")]:
            self.assertEqual(self.county(st, cc, fips, point), (want, None), (st, cc, fips, point))

    def test_x_city_needs_an_independent_city_x_or_elsewhere_the_impact_files_county_x(self):
        impact = "unknown county; the impact-file county's name"
        self.assertEqual(self.county("VA", "BEDFORD CITY", "51019"), ("Bedford County", impact))  # no longer a city
        self.assertEqual(self.county("MO", "JEFFERSON CITY", "29051"), ("Cole County", impact))  # a city in Cole County
        self.assertEqual(self.county("IA", "SIOUX CITY", "19193"), ("Woodbury County", impact))  # not Sioux County
        self.assertEqual(self.county("UT", "SALT LAKE CITY", "49011"), ("Davis County", impact))  # the impact file disagrees
        self.assertEqual(self.county("UT", "SALT LAKE CITY", "49035"), ("Salt Lake County", None))
        alone = "unknown county; Care Compare's name alone"  # no atlas county for the impact file either
        self.assertEqual(self.county("UT", "SALT LAKE CITY", None), ("Salt Lake County", alone))
        self.assertEqual(self.county("IA", "SIOUX CITY", None), ("Sioux County", alone))
        self.assertEqual(self.county("VA", "BEDFORD CITY", None), ("Bedford County", alone))
        either = "unknown county or city; Care Compare's name alone"  # an independent-city state, and no atlas place X
        self.assertEqual(self.county("MD", "ELLICOTT CITY", None), ("Ellicott City", either))
        self.assertEqual(self.county("MO", "KANSAS CITY", None), ("Kansas City", either))
        self.assertEqual(self.county("TX", "TEXAS CITY", None), ("Texas City", either))  # not "Texas City County"
        self.assertEqual(self.county("LA", "MORGAN CITY", None), ("Morgan City", either))  # not "Morgan City Parish"
        self.assertEqual(self.county("MO", "NARNIA", None), ("Narnia County", alone))  # a bare name: the county

    def test_named_city_does_not_guess_city_for_an_x_city_the_atlas_lacks(self):
        for says, want in [("city", (None, False)), ("county", (False, True)), (None, (False, True))]:
            self.assertEqual(location.named_city(("MO", "kansas"), says, "MO", None, None, self.COUNTIES), want, says)
            self.assertEqual(location.named_city(("TX", "texas"), says, "TX", None, None, self.COUNTIES), want, says)

    def test_an_unknown_or_missing_county_says_where_its_label_came_from(self):
        impact, spelling = "unknown county; the impact-file county's name", "unknown county; Care Compare's name alone"
        self.assertEqual(self.county("TX", "NARNIA", "48201"), ("Harris County", impact))
        self.assertEqual(self.county("TX", "NARNIA", None), ("Narnia County", spelling))
        self.assertEqual(self.county("TX", None, "48201"), ("Harris County", impact))
        self.assertEqual(self.county("TX", None, None), (None, "no county"))
        self.assertEqual(self.county("TX", "NARNIA COUNTY.", None), ("Narnia County", spelling))  # not "County. County"
        self.assertEqual(self.county("TX", "NARNIA-COUNTY", None), ("Narnia-County", spelling))
        self.assertEqual(self.county("TX", "NARNIA (COUNTY)", None), ("Narnia (County)", spelling))  # keeps its ")"
        for raw in ("NARNIA COUNTY*", "NARNIA COUNTY'", "NARNIA (", "NARNIA COUNTY /"):
            self.assertEqual(self.county("TX", raw, None), ("Narnia County", spelling), raw)
        self.assertEqual(self.county("LA", "E. BATON ROUGE", "22033", moved="address"), ("East Baton Rouge Parish", impact))
        self.assertEqual(self.county("VA", "JAMES CITY", "51830", moved="address"), ("Williamsburg City", None))  # address

    def test_a_far_off_point_moving_a_hospital_from_care_compares_place_is_listed(self):
        other = "Care Compare names another place and no street address settles it; took the impact file's"
        which = "county or city? Care Compare and the impact file disagree and no street address settles it; took the impact file's"
        for st, cc, fips, want, doubt in [
                ("MO", "JEFFERSON", "29051", "Cole County", other),
                ("NV", "CARSON CITY", "32005", "Douglas County", other),
                ("TX", "HARRIS", "06007", "Butte County", other),  # an impact-file county in another state
                ("MO", "ST. LOUIS CITY", "29189", "St. Louis County", which),
                ("MO", "ST. LOUIS", "29510", "St. Louis City", which),  # bare name: Care Compare's county
                ("VA", "RICHMOND CITY", "51159", "Richmond County", which),
                ("VA", "RICHMOND", "51760", "Richmond City", which),
                ("MO", "ST. LOUIS CITY", "29510", "St. Louis City", None),  # the same place
                ("UT", "SALT LAKE CITY", "49035", "Salt Lake County", None),
                ("NV", "CARSON CITY", "32510", "Carson City", None),  # a city by its whole name
                ("VA", "RICHMOND CITY", "51760", "Richmond City", None),
                ("VA", "RICHMOND", "51159", "Richmond County", None)]:
            self.assertEqual(self.county(st, cc, fips, moved="county"), (want, doubt), (st, cc, fips))
        self.assertEqual(self.county("MO", "JEFFERSON", "29051", moved="address"), ("Cole County", None))  # the address decides

class FallbackOrderProperty(unittest.TestCase):
    """locate() over random mixes of evidence: a street-address point, else the ZIP centroid, else Care Compare's
    county, else the impact-file county; a point more than STRAY_KM outside the impact-file county never stands."""
    COUNTIES = geo.Counties(centroid={"99001": (0.5, 0.5), "99002": (9.0, 9.0)},
                            by_name={("ZZ", "squareville"): (0.5, 0.5)}, shape={"99001": [SQUARE]},
                            name={"99001": "Squareville", "99002": "Faraway"}, named={})
    # (lat, lon) -> km outside 99001: inside, ~22 km out, ~111 km out
    PLACES = {"in": (0.6, 0.6), "near": (0.5, 1.2), "far": (0.5, 2.0)}
    DRAWS = 500

    def cases(self):
        rnd = random.Random(2026)
        for _ in range(self.DRAWS):
            yield (rnd.choice([None, "in", "near", "far"]), rnd.choice([None, "in", "near", "far"]),
                   rnd.choice([None, "SQUAREVILLE", "NOWHERE"]), rnd.choice([None, "99001", "99002", "99999"]))

    def run_case(self, point, zip_at, county, fips):
        g = {"zip": "11111" if zip_at else None, "county": county}
        zcta = {"11111": self.PLACES[zip_at]} if zip_at else {}
        return location.locate(g, {"fips": fips}, "ZZ", zcta, self.COUNTIES, self.PLACES.get(point))

    def expected(self, point, zip_at, county, fips):
        """(source, point) by the rule's own words, with the fixture's distances: near is within STRAY_KM, far isn't."""
        checked = fips == "99001"  # only a county with a shape can set a point aside
        if point and (not checked or point != "far"):
            return "address", self.PLACES[point]
        cand = ("zip", self.PLACES[zip_at]) if zip_at else ("county", (0.5, 0.5)) if county == "SQUAREVILLE" else None
        if cand and checked and cand[1] == self.PLACES["far"]:
            return "county", self.COUNTIES.centroid[fips]
        if cand:
            return cand
        if fips in self.COUNTIES.centroid:
            return "county", self.COUNTIES.centroid[fips]
        return None, None

    def test_fallback_order(self):
        for case in self.cases():
            lat, lon, src, _ = self.run_case(*case)
            want_src, want_pt = self.expected(*case)
            self.assertEqual((src, (lat, lon) if src else None), (want_src, want_pt if want_src else None), case)

    def test_coordinates_null_exactly_when_source_is(self):
        for case in self.cases():
            lat, lon, src, label = self.run_case(*case)
            self.assertEqual(lat is None, src is None, case)
            self.assertEqual(lon is None, src is None, case)
            if src is None:
                self.assertIsNone(label, case)

    def test_a_far_point_lands_on_the_fips_centroid(self):
        for case in self.cases():
            lat, lon, src, label = self.run_case(*case)
            if label is not None and src == "county":
                self.assertEqual((lat, lon), self.COUNTIES.centroid[case[3]], case)
                self.assertEqual(label, self.COUNTIES.name[case[3]], case)


if __name__ == "__main__":
    unittest.main()
