"""make refresh's fetch and pin step: synthetic metastore records and CSVs (invented hospitals), a fake server, no
network."""
import hashlib
import http.server
import json
import tempfile
import threading
import time
import unittest
from pathlib import Path

from pp_pipeline import refresh_sources as rs
from pp_pipeline.files import PINNED_DIR, mismatched_pins, read_manifest, write_manifest
from pp_pipeline.refresh_sites import FOOTNOTES, HACRP_FILE, SITES

SOURCE = HACRP_FILE
HEADER = '"Facility Name","Facility ID","State","Fiscal Year","Payment Reduction","Total HAC Score"\n'
URL = "https://data.cms.gov/provider-data/sites/default/files/resources/0123abcd_1800000000/{}"


def hacrp_csv(fy, score="0.1"):
    return (HEADER + f'"INVENTED GENERAL","990001","AL","{fy}","No","{score}"\n'
            f'"INVENTED REGIONAL","990002","AK","{fy}","Yes","0.9"\n').encode()


def record(name, dataset="yq43-i98g", **extra):
    return json.dumps({"identifier": dataset, "modified": "2027-01-20", "released": "2027-02-01",
                       "distribution": [{"downloadURL": URL.format(name)}], **extra}).encode()


def found(name, fy=None):
    return rs.Found(URL.format(name), name, fy, "2027-01-20", "2027-02-01")


class Locate(unittest.TestCase):
    def test_a_catalog_file_whose_name_matches_is_found_with_its_year_and_dates(self):
        got = rs.locate(SOURCE, record("FY_2027_HAC_Reduction_Program_Hospital.csv"))
        self.assertEqual(got, found("FY_2027_HAC_Reduction_Program_Hospital.csv", 2027))

    def test_a_dataset_without_a_year_in_its_name_has_none(self):
        got = rs.locate(FOOTNOTES, record("Footnote_Crosswalk.csv", dataset="y9us-9xdf"))
        self.assertIsNone(got.fy)

    def test_dates_are_copied_only_as_iso_days(self):
        got = rs.locate(SOURCE, record("FY_2027_HAC_Reduction_Program_Hospital.csv", released="<b>soon</b>",
                                       modified="\u0662\u0660\u0662\u0667-01-20"))  # Arabic-Indic digits
        self.assertIsNone(got.released)
        self.assertIsNone(got.modified)

    def test_untrusted_records_are_refused(self):
        name = "FY_2027_HAC_Reduction_Program_Hospital.csv"
        bad = {
            "not JSON": b"<html>",
            "another dataset": record(name, dataset="xxxx-xxxx"),
            "no distribution": json.dumps({"identifier": "yq43-i98g"}).encode(),
            "another host": record(name).replace(b"data.cms.gov", b"data.cms.gov.example"),
            "http": record(name).replace(b"https:", b"http:"),
            "outside the catalog's files": record(name).replace(b"/resources/", b"/elsewhere/"),
            "a query": record(name + "?x=1"),
            "a path in the name": record("..%2FFY_2027_HAC_Reduction_Program_Hospital.csv"),
            "another name": record("FY_2027_HAC_Reduction_Program_Hospital.csv.exe"),
            "another script's digits": record("FY_%D9%A2%D9%A0%D9%A2%D9%A7_HAC_Reduction_Program_Hospital.csv"),
            "a dot-dot segment": record(name).replace(b"/resources/", b"/resources/../../other/"),
            "an encoded dot-dot segment": record(name).replace(b"/resources/", b"/resources/%2e%2e/other/"),
            "credentials": record(name).replace(b"https://data", b"https://user@data"),
        }
        for why, rec in bad.items():
            with self.subTest(why), self.assertRaises(rs.RefreshError):
                rs.locate(SOURCE, rec)


class CheckCsv(unittest.TestCase):
    def test_a_file_with_the_columns_gives_its_one_year(self):
        self.assertEqual(rs.check_csv(SOURCE, hacrp_csv(2027), 2027), 2027)
        self.assertIsNone(rs.check_csv(FOOTNOTES, b"Footnote,Footnote Text\n1,Too few cases.\n"))

    def test_a_byte_order_mark_is_dropped_as_the_readers_drop_it(self):
        self.assertEqual(rs.check_csv(SOURCE, b"\xef\xbb\xbf" + hacrp_csv(2027), 2027), 2027)

    def test_bad_files_are_refused(self):
        bad = {
            "not UTF-8": hacrp_csv(2027).replace(b"INVENTED", b"INV\xe9NTED"),
            "a column missing": hacrp_csv(2027).replace(b'"Payment Reduction"', b'"Payment Adjustment"'),
            "no rows": HEADER.encode(),
            "two years": hacrp_csv(2027) + b'"INVENTED EAST","990003","AZ","2026","No","0.1"\n',
            "not a year": hacrp_csv("FY27"),
            "an HTML page": b"<!doctype html><title>Error</title>",
        }
        for why, data in bad.items():
            with self.subTest(why), self.assertRaises(rs.RefreshError):
                rs.check_csv(SOURCE, data, 2027)

    def test_the_pinned_files_year_is_read_without_its_other_columns(self):
        self.assertEqual(rs.file_year(SOURCE._replace(columns=("A column CMS added",)), hacrp_csv(2026)), 2026)

    def test_the_name_and_the_contents_must_agree_on_the_year(self):
        with self.assertRaises(rs.RefreshError):
            rs.check_csv(SOURCE, hacrp_csv(2026), 2027)


class ApplyPin(unittest.TestCase):
    """A synthetic pinned folder with FY2026's file pinned under the dataset id."""
    OLD = hacrp_csv(2026)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.pinned = Path(self.tmp.name)
        path = "hacrp-fy2026/FY_2026_HAC_Reduction_Program_Hospital.csv"
        (self.pinned / "hacrp-fy2026").mkdir()
        (self.pinned / path).write_bytes(self.OLD)
        self.entry = {"id": "yq43-i98g", "title": "Hospital-Acquired Condition (HAC) Reduction Program, FY2026",
                      "path": path, "bytes": len(self.OLD), "sha256": hashlib.sha256(self.OLD).hexdigest(),
                      "downloadUrl": URL.format("FY_2026_HAC_Reduction_Program_Hospital.csv"),
                      "landingPage": "https://data.cms.gov/provider-data/dataset/yq43-i98g",
                      "pdcModified": "2026-01-26", "pdcReleased": "2026-08-13", "retrieved": "2026-10-20"}
        self.other = {"id": "hacrp-fy2025", "path": "hacrp-fy2025/x.csv", "bytes": 1, "sha256": "0" * 64}
        self.manifest = [self.entry, self.other]

    def pin(self, data, name, fy):
        return rs.apply_pin(self.manifest, SOURCE, found(name, fy), data, "2027-02-03", self.pinned)

    def test_the_same_bytes_change_nothing_and_report_cms_record_moving(self):
        out, got = self.pin(self.OLD, "FY_2026_HAC_Reduction_Program_Hospital.csv", 2026)
        self.assertIs(out, self.manifest)
        self.assertEqual(got.status, "unchanged")
        self.assertIn("pdcReleased 2026-08-13 -> 2027-02-01", got.drift)

    def test_a_corrected_file_for_the_same_year_replaces_the_pin_in_place(self):
        new = hacrp_csv(2026, score="0.2")
        out, got = self.pin(new, "FY_2026_HAC_Reduction_Program_Hospital.csv", 2026)
        self.assertEqual(got.status, "replaced")
        self.assertEqual([e["id"] for e in out], ["yq43-i98g", "hacrp-fy2025"])
        self.assertEqual(out[0]["sha256"], hashlib.sha256(new).hexdigest())
        self.assertEqual(out[0]["retrieved"], "2027-02-03")
        self.assertEqual(out[0]["pdcReleased"], "2027-02-01")
        self.assertEqual((self.pinned / out[0]["path"]).read_bytes(), new)
        self.assertEqual(mismatched_pins(out[:1], self.pinned), [])

    def test_a_renamed_file_for_the_same_year_drops_the_old_one(self):
        new = hacrp_csv(2026, score="0.2")
        source = SOURCE._replace(file=r"FY_(?P<fy>\d{4})_HAC_Reduction_Program_Hospital_v2\.csv")
        out, got = rs.apply_pin(self.manifest, source, found("FY_2026_HAC_Reduction_Program_Hospital_v2.csv", 2026),
                                new, "2027-02-03", self.pinned)
        self.assertEqual(got.status, "replaced")
        self.assertFalse((self.pinned / self.entry["path"]).exists())
        self.assertTrue((self.pinned / out[0]["path"]).exists())

    def test_a_new_year_archives_the_pinned_entry_and_pins_the_new_file_beside_it(self):
        new = hacrp_csv(2027)
        out, got = self.pin(new, "FY_2027_HAC_Reduction_Program_Hospital.csv", 2027)
        self.assertEqual(got.status, "new-year")
        self.assertEqual([e["id"] for e in out], ["yq43-i98g", "hacrp-fy2026", "hacrp-fy2025"])
        current, archived = out[0], out[1]
        self.assertEqual(current["path"], "hacrp-fy2027/FY_2027_HAC_Reduction_Program_Hospital.csv")
        self.assertEqual(current["title"], "Hospital-Acquired Condition (HAC) Reduction Program, FY2027")
        self.assertEqual({k: v for k, v in archived.items() if k not in ("id", "note")},
                         {k: v for k, v in self.entry.items() if k != "id"})
        self.assertIn("FY2027", archived["note"])
        self.assertEqual(mismatched_pins(out[:2], self.pinned), [])

    def test_an_older_year_or_a_taken_archive_id_is_refused(self):
        with self.assertRaises(rs.RefreshError):
            self.pin(hacrp_csv(2025), "FY_2025_HAC_Reduction_Program_Hospital.csv", 2025)
        self.other["id"] = "hacrp-fy2026"
        with self.assertRaises(rs.RefreshError):
            self.pin(hacrp_csv(2027), "FY_2027_HAC_Reduction_Program_Hospital.csv", 2027)
        self.assertFalse((self.pinned / "hacrp-fy2027").exists())

    def test_a_path_outside_the_pinned_folder_is_refused(self):
        source = SOURCE._replace(folder="../escape{fy}")
        with self.assertRaises(rs.RefreshError):
            rs.apply_pin(self.manifest, source, found("FY_2027_HAC_Reduction_Program_Hospital.csv", 2027),
                         hacrp_csv(2027), "2027-02-03", self.pinned)


class Manifest(unittest.TestCase):
    def test_write_manifest_keeps_the_committed_layout(self):
        with tempfile.TemporaryDirectory() as tmp:
            write_manifest(read_manifest(), tmp)
            self.assertEqual((Path(tmp) / "manifest.json").read_bytes(), (PINNED_DIR / "manifest.json").read_bytes())

    def test_every_registered_source_is_pinned_under_its_dataset_id(self):
        entries = {e["id"]: e for e in read_manifest()}
        for name, site in SITES.items():
            for source in site.sources:
                with self.subTest(name, dataset=source.dataset):
                    self.assertIn(source.dataset, entries)
                    entry = entries[source.dataset]
                    self.assertRegex(entry["path"].rsplit("/", 1)[1], f"^{source.file}$")
                    fy = rs.check_csv(source, (PINNED_DIR / entry["path"]).read_bytes())
                    self.assertEqual(entry["path"].rsplit("/", 1)[0], source.folder.format(fy=fy))
                    if source.fy_column:  # a new year needs its own title and an id for the year it replaces
                        self.assertIn("{fy}", source.title)
                        self.assertIn("{fy}", source.archive)


class _Server(http.server.BaseHTTPRequestHandler):
    """Answers /away with a redirect off the host, /down with a 503, /drip with a byte every 0.3 s, and anything else
    with 5,000 bytes."""
    def do_GET(self):
        if self.path == "/down":
            self.send_error(503)
            return
        if self.path == "/drip":
            self.send_response(200)
            self.end_headers()
            try:
                for _ in range(20):
                    self.wfile.write(b"x")
                    self.wfile.flush()
                    time.sleep(0.3)
            except (BrokenPipeError, ConnectionResetError):  # the client gave up, as it should
                pass
            return
        if self.path == "/away":
            self.send_response(302)
            self.send_header("Location", "https://example.org/")
            self.end_headers()
            return
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"x" * 5000)

    def log_message(self, *args):
        pass


class Fetch(unittest.TestCase):
    def test_only_https_on_data_cms_gov_is_read(self):
        for url in ("http://data.cms.gov/x", "https://data.cms.gov.example/x", "https://example.org/x",
                    "https://data.cms.gov:8443/x", "file:///etc/hosts"):
            with self.subTest(url), self.assertRaises(rs.RefreshError):
                rs.fetch(url, 10)

    def test_a_redirect_off_the_host_and_a_body_over_the_cap_are_refused(self):
        server = http.server.HTTPServer(("127.0.0.1", 0), _Server)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        base = f"http://127.0.0.1:{server.server_port}"
        with self.assertRaises(rs.RefreshError):  # the redirect handler checks the new URL
            rs._OPENER.open(base + "/away", timeout=5)
        original = rs.check_url
        rs.check_url = lambda url: None  # let the test server through, to reach the cap
        self.addCleanup(setattr, rs, "check_url", original)
        with self.assertRaises(rs.RefreshError):
            rs.fetch(base + "/big", 100)
        self.assertEqual(len(rs.fetch(base + "/big", 5000)), 5000)
        with self.assertRaises(rs.RefreshError):  # urllib's own error, as a RefreshError
            rs.fetch(base + "/down", 100)
        started = time.monotonic()
        with self.assertRaises(rs.RefreshError):  # the deadline holds against a server dripping bytes
            rs.fetch(base + "/drip", 100, timeout=1)
        self.assertLess(time.monotonic() - started, 3)


if __name__ == "__main__":
    unittest.main()
