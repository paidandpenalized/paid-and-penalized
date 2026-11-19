"""The TEAM build (pp_engine.team, pp_pipeline.emit_team): the method's units on synthetic inputs with invented CCNs,
then the whole build from the pins, recounted rule by rule here. Failure messages name no hospital, CCN or dollar
figure."""
import functools
import unittest
from collections import Counter, defaultdict

from pp_engine.schema import validate
from pp_engine.team import episodes, quality, status
from pp_engine.team.build import MEASURES, default_ccn, division_of, participant_quality, quality_tables
from pp_pipeline.files import load_schemas
from pp_pipeline.tests.team.helpers import fresh, pins


def price_rows(cells):
    """Price rows from (category, drg, division, price, average_row) tuples."""
    return [{"category": c, "drg": d, "division": v, "price": p, "average_row": a} for c, d, v, p, a in cells]


class Episodes(unittest.TestCase):
    DRG_CATEGORY = {"426": "SPINAL", "447": "SPINAL", "450": "SPINAL", "523": "SPINAL", "469": "LEJR"}

    def test_retired_drgs_move_to_their_fy2027_successors(self):
        cells = {"456": 20, "459": 11, "426": 12, "469": 40, "999": 50}
        alloc = episodes.allocate(cells, self.DRG_CATEGORY)
        self.assertEqual(alloc["SPINAL"], {"523": 20, "447": 5.5, "450": 5.5, "426": 12})
        self.assertEqual(alloc["LEJR"], {"469": 40})
        self.assertEqual(sum(alloc["SPINAL"].values()), 20 + 11 + 12)

    def test_every_remap_target_is_a_priced_drg_of_one_category(self):
        _, _, drg_category, _ = episodes.price_tables(pins().price_rows)
        for source, targets in episodes.REMAPS.items():
            self.assertAlmostEqual(sum(targets.values()), 1)
            self.assertTrue(set(targets) <= set(drg_category), source)
            self.assertEqual(len({drg_category[t] for t in targets}), 1, source)

    def test_hidden_counts_the_source_cells_absent_from_the_file(self):
        sources = episodes.source_drgs(self.DRG_CATEGORY)
        self.assertNotIn("523", sources["SPINAL"])  # new in FY2027: no data year counts cases under it
        self.assertIn("456", sources["SPINAL"])
        hidden = episodes.hidden_cells({"426": 12, "456": 30}, sources)
        # SPINAL's sources here: 426, 447, 450 and retired 453, 456, 459 (454 and the rest map outside this table).
        self.assertEqual(hidden["SPINAL"], 4)
        self.assertEqual(hidden["LEJR"], 1)

    def test_low_volume_scales_two_years_to_three(self):
        threshold, factor = episodes.LOW_VOLUME_THRESHOLD, episodes.BASELINE_SCALE
        self.assertTrue(episodes.is_low_volume(0, 0))
        below = (threshold / factor) - 1
        self.assertTrue(episodes.is_low_volume(below, 0))
        self.assertFalse(episodes.is_low_volume(threshold, 0))
        self.assertFalse(episodes.is_low_volume(10, 11))  # 21 x 1.5 = 31.5
        self.assertTrue(episodes.is_low_volume(10, 10))  # 20 x 1.5 = 30
        self.assertTrue(episodes.is_low_volume(10.5, 10))  # 20.5 x 1.5 = 30.75 (split counts)

    def test_category_price_is_episode_weighted_and_falls_back_to_the_average(self):
        prices = {"447": {"1": 100.0}, "450": {"1": 200.0}}
        self.assertAlmostEqual(episodes.category_price({"447": 3, "450": 1}, prices, "1", 999.0), 125.0)
        self.assertEqual(episodes.category_price({}, prices, "1", 999.0), 999.0)

    def test_price_tables_keep_cms_averages_and_derive_a_missing_one(self):
        rows = price_rows([("LEJR", "469", "1", "100.004", "0"), ("LEJR", "470", "1", "50", "0"),
                           ("LEJR", "All", "1", "70.5", "1"), ("SPINAL", "447", "1", "300", "0"),
                           ("SPINAL", "450", "1", "100", "0")])
        prices, avg, drg_category, derived = episodes.price_tables(rows)
        self.assertEqual(prices["469"], {"1": 100.0})  # to the cent
        self.assertEqual(avg["LEJR"], {"1": 70.5})
        self.assertEqual(avg["SPINAL"], {"1": 200.0})  # a pure {division: price} map: no flag among the prices
        self.assertEqual(derived, ["SPINAL"])
        self.assertEqual(drg_category, {"469": "LEJR", "470": "LEJR", "447": "SPINAL", "450": "SPINAL"})


class Quality(unittest.TestCase):
    def test_lower_is_better_and_ties_take_the_higher_percentile(self):
        cohort = [1.0, 2.0, 2.0, 3.0]
        pct = functools.partial(quality.percentile, cohort=sorted(cohort))
        self.assertEqual(pct(1.0), 100)  # every other hospital is worse
        self.assertEqual(pct(2.0), 66)  # one worse and one tied, of three others
        self.assertEqual(pct(3.0), 0)

    def test_a_value_outside_the_cohort_is_ranked_against_all_of_it(self):
        self.assertEqual(quality.percentile(2.5, sorted([1.0, 2.0, 3.0, 4.0]), in_cohort=False), 50)

    def test_percentiles_for_a_cohort(self):
        self.assertEqual(quality.percentiles({"990001": 5.0, "990002": 5.0}), {"990001": 100, "990002": 100})

    def test_a_measure_with_no_other_hospital_to_rank_against_is_null(self):
        # A cohort of one (the hospital itself), or an empty one, leaves no percentile: the measure is null, as for a
        # hospital with no public value, never {value, pct: null}.
        values = {m: {} for m in MEASURES}
        values["hybrid_hwr"]["990001"] = 5.0
        values["iscmr"]["990002"] = 7.0  # not IPPS, so outside the cohort, which is then empty
        hospitals = [hosp("990001"), hosp("990002", ipps=False)]
        tables = quality_tables(values, hospitals)
        self.assertEqual(participant_quality("990001", values, tables), {"hybrid_hwr": None, "iscmr": None})
        self.assertEqual(participant_quality("990002", values, tables), {"hybrid_hwr": None, "iscmr": None})


def hosp(ccn, **kw):
    base = {"ccn": ccn, "state": "ZZ", "kind": "acute", "ipps": True, "types": [], "ownDetail": None, "urban": True}
    return {**base, **kw}


class Status(unittest.TestCase):
    AREA = status.Area(counties={"99001"}, states={"ZZ"}, doubtful={"99003"})

    def code(self, h, listed=None, cjrx=(), place="99001"):
        return status.status_of(h, listed, set(cjrx), {h["ccn"]: place} if place else {}, self.AREA)

    def test_the_list_comes_first(self):
        on = {"participation": "mandatory", "start": "2026-01-01", "end": "2030-12-31"}
        self.assertEqual(self.code(hosp("990001"), on), ["in", "mandatory"])
        self.assertEqual(self.code(hosp("990001"), {**on, "start": status.PY2_START}), ["in27", status.PY2_START])
        self.assertEqual(self.code(hosp("990001"), {**on, "end": "2026-02-01"}), ["ended", "2026-02-01"])

    def test_a_leaver_on_the_cjrx_list_keeps_both(self):
        ended = {"participation": "mandatory", "start": "2026-01-01", "end": "2026-02-01"}
        self.assertEqual(self.code(hosp("990001"), ended, cjrx=["990001"]), ["cjrx", ["ended", "2026-02-01"]])

    def test_a_current_participant_on_the_cjrx_list_fails_the_build(self):
        on = {"participation": "mandatory", "start": "2026-01-01", "end": "2030-12-31"}
        for listed in (on, {**on, "start": status.PY2_START}):
            with self.assertRaises(ValueError):
                self.code(hosp("990001"), listed, cjrx=["990001"])

    def test_reasons_off_the_list(self):
        self.assertEqual(self.code(hosp("990001", state="MD")), ["maryland", None])
        self.assertEqual(self.code(hosp("990001"), place="99002"), ["outside", "acute"])
        self.assertEqual(self.code(hosp("990001", kind="psychiatric", ipps=False)), ["in_area_kind", "psychiatric"])
        # An acute or unknown kind that isn't IPPS-paid (closed, converted): the kind is no reason, so a code of its own.
        self.assertEqual(self.code(hosp("990001", ipps=False)), ["in_area_other", "acute"])
        self.assertEqual(self.code(hosp("990001", kind="unknown", ipps=False)), ["in_area_other", "unknown"])
        self.assertEqual(self.code(hosp("990001", types=["IHS"])), ["ihs", None])
        self.assertEqual(self.code(hosp("990001", ownDetail="Tribal")), ["ihs", None])
        self.assertEqual(self.code(hosp("990001")), ["unlisted", None])

    def test_an_unplaced_county_is_outside_only_where_its_state_has_no_area(self):
        self.assertEqual(self.code(hosp("990001"), place=None), ["area_unknown", None])
        self.assertEqual(self.code(hosp("990001", state="YY", kind="critical_access"), place=None),
                         ["outside", "critical_access"])

    def test_a_county_that_may_lie_in_a_selected_area_is_not_called_outside(self):
        self.assertEqual(self.code(hosp("990001"), place="99003"), ["area_unknown", None])
        self.assertEqual(self.code(hosp("990001"), cjrx=["990001"], place="99003"), ["cjrx", ["area_unknown", None]])

    def test_cjrx_wraps_the_reason(self):
        self.assertEqual(self.code(hosp("990001"), cjrx=["990001"], place="99002"), ["cjrx", ["outside", "acute"]])
        self.assertEqual(self.code(hosp("990001"), cjrx=["990001"]), ["cjrx", ["unlisted", None]])

    def test_selected_areas_reach_divisions_and_unlisted_micropolitan_counties(self):
        participants = [{"ccn": "990001", "cbsa": "11110", "cbsa_name": "Big, ZZ-XX", "participation": "mandatory"},
                        {"ccn": "990002", "cbsa": "22220", "cbsa_name": "Small, ZZ", "participation": "mandatory"},
                        {"ccn": "990003", "cbsa": "33330", "cbsa_name": "Other, YY", "participation": "voluntary"}]
        crosswalk = [{"fips": "99001", "state": "ZZ", "cbsa": "11114"},  # a division of 11110
                     {"fips": "99002", "state": "ZZ", "cbsa": "11114"},
                     {"fips": "99003", "state": "ZZ", "cbsa": ""},  # micropolitan: blank in the crosswalk
                     {"fips": "99004", "state": "ZZ", "cbsa": "22220"},
                     {"fips": "99005", "state": "YY", "cbsa": "33330"},
                     {"fips": "99006", "state": "YY", "cbsa": ""}]
        placed = {"990001": "99001", "990002": "99003", "990003": "99005"}
        area = status.selected_area(participants, crosswalk, placed, {"990001": "ZZ", "990002": "ZZ", "990003": "YY"})
        self.assertEqual(area.counties, {"99001", "99002", "99003", "99004"})  # not 99005: voluntary only
        self.assertEqual(area.states, {"ZZ"})

    def test_counties_the_crosswalk_cannot_place_are_doubtful_where_a_selected_area_may_reach(self):
        # 11110 is divided (its participant's county carries a division code); 22220 is micropolitan (its participant's
        # county is blank). Another division's county, or a blank county, may belong to one of them when it lies in a
        # state its title names; elsewhere it cannot.
        participants = [{"ccn": "990001", "cbsa": "11110", "cbsa_name": "Big, ZZ-XX", "participation": "mandatory"},
                        {"ccn": "990002", "cbsa": "22220", "cbsa_name": "Small, WW", "participation": "mandatory"}]
        crosswalk = [{"fips": "99001", "state": "ZZ", "cbsa": "11114"},  # the participant's division
                     {"fips": "99002", "state": "XX", "cbsa": "12344"},  # another division, in a state 11110 names
                     {"fips": "99003", "state": "YY", "cbsa": "56784"},  # a division in a state no divided area names
                     {"fips": "99004", "state": "WW", "cbsa": ""},  # the micropolitan participant's county
                     {"fips": "99005", "state": "WW", "cbsa": ""},  # blank, in the micropolitan area's state
                     {"fips": "99006", "state": "ZZ", "cbsa": ""},  # blank, in a state only a divided area names
                     {"fips": "99007", "state": "WW", "cbsa": "77770"}]  # a whole CBSA the crosswalk names: not selected
        placed = {"990001": "99001", "990002": "99004"}
        area = status.selected_area(participants, crosswalk, placed, {"990001": "ZZ", "990002": "WW"})
        self.assertEqual(area.counties, {"99001", "99004"})
        self.assertEqual(area.doubtful, {"99002", "99005"})

    def test_a_cbsa_title_must_name_its_states(self):
        participants = [{"ccn": "990001", "cbsa": "22220", "cbsa_name": "No states", "participation": "mandatory"}]
        crosswalk = [{"fips": "99001", "state": "ZZ", "cbsa": ""}]
        with self.assertRaises(ValueError):
            status.selected_area(participants, crosswalk, {"990001": "99001"}, {"990001": "ZZ"})


    def test_a_county_or_code_shared_by_two_list_cbsas_is_refused(self):
        crosswalk = [{"fips": "99001", "state": "ZZ", "cbsa": ""}, {"fips": "99002", "state": "ZZ", "cbsa": "11114"},
                     {"fips": "99003", "state": "ZZ", "cbsa": "11114"}]
        same_county = [{"ccn": "990001", "cbsa": "11110", "cbsa_name": "A, ZZ", "participation": "mandatory"},
                       {"ccn": "990002", "cbsa": "22220", "cbsa_name": "B, ZZ", "participation": "mandatory"}]
        with self.assertRaises(ValueError):
            status.selected_area(same_county, crosswalk, {"990001": "99001", "990002": "99001"}, {})
        with self.assertRaises(ValueError):
            status.selected_area(same_county, crosswalk, {"990001": "99002", "990002": "99003"}, {})


class Divisions(unittest.TestCase):
    def test_territories_take_the_pacific_division_and_an_unknown_state_raises(self):
        pacific = division_of("CA")
        for territory in ("AS", "GU", "MP", "PR", "VI"):
            self.assertEqual(division_of(territory), pacific, territory)
        self.assertEqual(division_of("ME"), 1)
        with self.assertRaises(ValueError):
            division_of("ZZ")


class Placement(unittest.TestCase):
    def test_counties_by_fips_name_then_city(self):
        crosswalk = [{"fips": "99001", "county": "SAINT LUCIE", "state": "ZZ", "cbsa": ""},
                     {"fips": "99002", "county": "OTHER", "state": "ZZ", "cbsa": ""}]
        hospitals = [hosp("990001", fips="99002", county="Other County", city="A"),
                     hosp("990002", fips=None, county="St. Lucie County", city="B"),
                     hosp("990003", fips=None, county="Old County", city="A"),
                     hosp("990004", fips=None, county=None, city="Nowhere", lat=None, lon=None)]
        placed, routes = status.place_counties(hospitals, crosswalk, shapes=None)
        self.assertEqual(placed, {"990001": "99002", "990002": "99001", "990003": "99002"})
        self.assertEqual(routes, {"990001": "fips", "990002": "name", "990003": "city"})


@functools.lru_cache(maxsize=None)
def allocations():
    """{ccn: {category: {FY2027 DRG: episodes}}} for the latest data year (the target's episodes)."""
    p = pins()
    _, _, drg_category, _ = episodes.price_tables(p.price_rows)
    return {r["ccn"]: episodes.allocate(p.latest.get(r["ccn"], {}), drg_category) for r in p.participants}


class WholeBuild(unittest.TestCase):
    def test_the_schema_validates_and_every_code_is_in_its_enum(self):
        schemas = load_schemas()
        schema = schemas["team.schema.json"]
        self.assertEqual(validate(schema, fresh(), schemas), [])
        code_schema = schema["$defs"]["statusCode"]
        for code, arg in fresh()["status"].values():
            inner = arg[0] if code == "cjrx" else code
            self.assertEqual(validate(code_schema, code, schemas) + validate(code_schema, inner, schemas), [])

    def test_category_averages_are_prices_only_and_the_derived_ones_are_listed(self):
        doc = fresh()
        for cat, by_div in doc["categoryAvg"].items():
            for div, price in by_div.items():
                self.assertRegex(div, r"^[1-9]$", cat)
                self.assertIsInstance(price, float, cat)
        cms = {r["category"] for r in pins().price_rows if r["average_row"] == "1"}
        self.assertEqual(doc["categoryAvgDerived"], [c for c in episodes.CATEGORIES if c not in cms])
        schemas = load_schemas()
        flagged = {**doc, "categoryAvg": {**doc["categoryAvg"], "SPINAL": {**doc["categoryAvg"]["SPINAL"], "derived": True}}}
        self.assertNotEqual(validate(schemas["team.schema.json"], flagged, schemas), [])

    def test_every_master_hospital_has_one_status(self):
        master = pins().hospitals
        self.assertEqual(set(fresh()["status"]), {h["ccn"] for h in master})
        self.assertEqual(sum(Counter(c for c, _ in fresh()["status"].values()).values()), len(master))

    def test_each_codes_count_equals_a_recount_by_its_rule(self):
        p = pins()
        listed = {r["ccn"]: r for r in p.participants}
        by_ccn = {h["ccn"]: h for h in p.hospitals}
        on_list = [listed[c] for c in by_ccn if c in listed]
        start = status.PY2_START
        expect, cjrx = Counter(), Counter()
        ended = [r for r in on_list if r["end"] < start]
        expect["ended"] = sum(r["ccn"] not in p.cjrx for r in ended)
        cjrx["ended"] = expect["cjrx"] = len(ended) - expect["ended"]
        expect["in27"] = sum(r["end"] >= start and r["start"] >= start for r in on_list)
        expect["in"] = sum(r["end"] >= start and r["start"] < start for r in on_list)
        # Off the list: the area is recomputed here from the pins (selected CBSAs, the crosswalk, the mandatory
        # participants' counties); county placement is the build's (tested above on synthetic rows).
        placed, _ = status.place_counties(p.hospitals, p.crosswalk, p.shapes)
        selected = {r["cbsa"] for r in p.participants if r["participation"] == "mandatory"}
        mandatory_counties = {placed[r["ccn"]] for r in p.participants
                              if r["participation"] == "mandatory" and r["ccn"] in placed}
        codes_there = {x["cbsa"] for x in p.crosswalk if x["fips"] in mandatory_counties and x["cbsa"]}
        area = {x["fips"] for x in p.crosswalk if x["cbsa"] in selected | codes_there} | mandatory_counties
        state_of = {x["fips"]: x["state"] for x in p.crosswalk}
        area_states = {state_of[f] for f in area if f in state_of} | {
            by_ccn[r["ccn"]]["state"] for r in p.participants if r["participation"] == "mandatory" and r["ccn"] in by_ccn}
        # Doubtful counties: a selected CBSA the crosswalk has no code for is either divided (a participant's county
        # carries a division code, last digit 4) or micropolitan (a participant's county is blank). Outside the area,
        # a division's county in a state a divided one's title names, or a blank county in a state a micropolitan
        # one's names, may still lie in it.
        code_of = {x["fips"]: x["cbsa"] for x in p.crosswalk}
        open_cbsas = selected - set(code_of.values())
        titles = {r["cbsa"]: r["cbsa_name"] for r in p.participants}
        their_codes = defaultdict(set)  # open CBSA -> its mandatory participants' crosswalk codes
        for r in p.participants:
            if r["cbsa"] in open_cbsas and r["participation"] == "mandatory" and r["ccn"] in placed:
                their_codes[r["cbsa"]].add(code_of[placed[r["ccn"]]])
        divided = {c for c, codes in their_codes.items() if any(x.endswith("4") for x in codes)}
        micro = {c for c, codes in their_codes.items() if "" in codes}

        def named(cbsas):
            return {st for c in cbsas for st in titles[c].split(", ")[-1].split("-")}
        doubtful = {f for f, c in code_of.items() if f not in area and (
            (c.endswith("4") and state_of[f] in named(open_cbsas - micro))
            or (not c and state_of[f] in named(open_cbsas - divided)))}
        for ccn, h in by_ccn.items():
            if ccn in listed:
                continue
            f = placed.get(ccn)
            if h["state"] == "MD":
                reason = "maryland"
            elif f is None:
                reason = "outside" if h["state"] not in area_states else "area_unknown"
            elif f in doubtful:
                reason = "area_unknown"
            elif f not in area:
                reason = "outside"
            elif not (h["kind"] == "acute" and h["ipps"]):
                reason = "in_area_other" if h["kind"] in ("acute", "unknown") else "in_area_kind"
            elif "IHS" in h["types"] or h["ownDetail"] == "Tribal":
                reason = "ihs"
            else:
                reason = "unlisted"
            if ccn in p.cjrx:
                cjrx[reason] += 1
                reason = "cjrx"
            expect[reason] += 1
        got = Counter(c for c, _ in fresh()["status"].values())
        self.assertEqual(dict(got), dict(+expect))
        got_cjrx = Counter(arg[0] for c, arg in fresh()["status"].values() if c == "cjrx")
        self.assertEqual(dict(got_cjrx), dict(+cjrx))

    def test_ended_participants_are_not_active(self):
        for r in fresh()["participants"]:
            self.assertEqual(r["active"], r["end"] >= status.PY2_START, "a participant's active flag")

    def test_every_active_target_is_the_sum_of_episodes_times_price(self):
        doc = fresh()
        prices = doc["prices"]
        allocated = allocations()
        checked = 0
        for r in doc["participants"]:
            if not r["active"]:
                continue
            by_category = sum(c["n"] * c["price"] for c in r["cats"].values())
            by_drg = sum(n * prices[d][str(r["division"])] for alloc in allocated[r["ccn"]].values()
                         for d, n in alloc.items())
            self.assertAlmostEqual(r["target"], by_category, delta=0.01, msg="target vs categories")
            self.assertAlmostEqual(r["target"], by_drg, delta=0.01, msg="target vs DRGs")
            checked += 1
        self.assertGreater(checked, 0)

    def test_a_category_without_episodes_carries_the_category_average(self):
        doc = fresh()
        for r in doc["participants"]:
            for cat, c in r["cats"].items():
                if c["n"] == 0:
                    self.assertEqual(c["price"], doc["categoryAvg"][cat][str(r["division"])], "an empty category's price")

    def test_the_default_hospital_follows_the_rule(self):
        doc = fresh()
        pool = sorted((r for r in doc["participants"]
                       if r["participation"] == "mandatory" and r["active"] and not r["track2Flags"]
                       and sum(c["n"] > 0 for c in r["cats"].values()) >= 4),
                      key=lambda r: (r["target"], r["ccn"]))
        self.assertTrue(pool)
        self.assertEqual(doc["defaultCcn"], pool[(len(pool) - 1) // 2]["ccn"])
        self.assertEqual(default_ccn(doc["participants"]), doc["defaultCcn"])

    def test_a4_every_listed_ccn_is_a_participant_or_a_recorded_miss(self):
        doc = fresh()
        listed = {r["ccn"] for r in pins().participants}
        got = {r["ccn"] for r in doc["participants"]}
        self.assertEqual(got | set(doc["a4"]["teamMissing"]), listed)
        self.assertEqual(got & set(doc["a4"]["teamMissing"]), set())
        master = {h["ccn"] for h in pins().hospitals}
        self.assertEqual(doc["a4"]["cjrxMissing"], len(pins().cjrx - master))

    def test_quality_values_and_percentiles(self):
        doc = fresh()
        for r in doc["participants"]:
            for measure in ("hybrid_hwr", "iscmr"):
                q = r["quality"][measure]
                self.assertEqual(q is None, r["ccn"] not in pins().quality[measure], "a missing value is null")
                if q is not None:
                    self.assertTrue(0 <= q["pct"] <= 100)

    def test_meta_comes_from_the_manifest(self):
        meta = fresh()["meta"]
        self.assertEqual(meta["mupYears"], sorted(meta["mupYears"]))
        self.assertEqual(len(meta["mupYears"]), 2)
        for key in ("listAsOf", "cjrxAsOf", "pricesDated", "qualityReleased"):
            self.assertRegex(meta[key], r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")


if __name__ == "__main__":
    unittest.main()
