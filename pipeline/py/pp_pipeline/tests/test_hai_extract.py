"""The HAI extracts: one calendar year of Care Compare's infection results per hospital, derived by a script."""
import csv
import datetime
import hashlib
import io
import os
import re
import unittest
import zipfile
from pathlib import Path

from pp_pipeline.files import PINNED_DIR, read_manifest, read_pinned_bytes
from pp_pipeline.hai_extract import COLUMNS, MEASURES, NOT_AVAILABLE, PIN_ID_PATTERN, decode, derive, extract

HEADER_NEW = ["Facility ID", "Facility Name", "Address", "City/Town", "State", "ZIP Code", "County/Parish",
              "Telephone Number", "Measure ID", "Measure Name", "Compared to National", "Score", "Footnote",
              "Start Date", "End Date"]
HEADER_2017 = ["Provider ID", "Hospital Name", "Address", "City", "State", "ZIP Code", "County Name", "Phone Number",
               "Measure Name", "Measure ID", "Compared to National", "Score", "Footnote", "Measure Start Date",
               "Measure End Date"]
KINDS = ("SIR", "NUMERATOR", "ELIGCASES")
NUMBER = re.compile(r"[0-9]+(\.[0-9]+)?")
INTEGER = re.compile(r"[0-9]+")


def raw(rows, header=HEADER_NEW, start="01/01/2024", end="12/31/2024", eol="\r\n"):
    """Synthetic raw text: header plus rows given as (ccn, measure id, score) with dates and filler cells added."""
    out = io.StringIO()
    w = csv.writer(out, lineterminator=eol, quoting=csv.QUOTE_ALL)
    w.writerow(header)
    for ccn, measure, score in rows:
        cells = {"Facility ID": ccn, "Provider ID": ccn, "Measure ID": measure, "Score": score, "Footnote": "",
                 "Facility Name": "INVENTED HOSPITAL", "Start Date": start, "Measure Start Date": start,
                 "End Date": end, "Measure End Date": end, "Measure Name": "invented"}
        w.writerow([cells.get(h, "x") for h in header])
    return out.getvalue()


def parsed(text):
    return list(csv.reader(io.StringIO(text)))


def full_hospital(ccn, n_sir="0.500", sep="_"):
    """All 18 used rows for one CCN: measure k has SIR 'k.100' (measure 1: n_sir), observed 'k', predicted 'k.500'."""
    rows = []
    for k in range(1, 7):
        values = {"SIR": n_sir if k == 1 else f"{k}.100", "NUMERATOR": str(k), "ELIGCASES": f"{k}.500"}
        rows += [(ccn, f"HAI{sep}{k}{sep}{kind}", values[kind]) for kind in KINDS]
    return rows


class Extract(unittest.TestCase):
    def test_columns_are_ccn_period_then_sir_observed_predicted_per_measure(self):
        self.assertEqual(len(COLUMNS), 3 + 3 * len(MEASURES))
        self.assertEqual(COLUMNS[:6], ("ccn", "start", "end", "hai_1_sir", "hai_1_observed", "hai_1_predicted"))
        self.assertEqual(COLUMNS[-3:], ("hai_6_sir", "hai_6_observed", "hai_6_predicted"))

    def test_maps_scores_sorts_by_ccn_and_writes_iso_dates(self):
        text = extract(raw(full_hospital("990002") + full_hospital("00001F", n_sir="Not Available")))
        rows = parsed(text)
        self.assertEqual(rows[0], list(COLUMNS))
        self.assertEqual([r[0] for r in rows[1:]], ["00001F", "990002"])  # leading zeros kept; sorted as text
        first, second = (dict(zip(COLUMNS, r)) for r in rows[1:])
        self.assertEqual((first["start"], first["end"]), ("2024-01-01", "2024-12-31"))
        self.assertEqual(first["hai_1_sir"], NOT_AVAILABLE)
        self.assertEqual((second["hai_1_sir"], second["hai_1_observed"], second["hai_1_predicted"]),
                         ("0.500", "1", "1.500"))
        self.assertEqual((second["hai_4_sir"], second["hai_4_observed"], second["hai_4_predicted"]),
                         ("4.100", "4", "4.500"))
        self.assertEqual((second["hai_6_sir"], second["hai_6_observed"], second["hai_6_predicted"]),
                         ("6.100", "6", "6.500"))
        self.assertTrue(text.endswith("\n") and "\r" not in text)

    def test_text_is_kept_verbatim(self):
        text = extract(raw([("990001", "HAI_2_SIR", "0.000"), ("990001", "HAI_2_NUMERATOR", "0"),
                            ("990001", "HAI_2_ELIGCASES", "12.340")]))
        row = dict(zip(COLUMNS, parsed(text)[1]))
        self.assertEqual((row["hai_2_sir"], row["hai_2_observed"], row["hai_2_predicted"]), ("0.000", "0", "12.340"))

    def test_absent_measure_is_blank(self):
        row = dict(zip(COLUMNS, parsed(extract(raw([("990001", "HAI_3_SIR", "1.200")])))[1]))
        self.assertEqual(row["hai_3_sir"], "1.200")
        self.assertEqual([row[c] for c in COLUMNS[3:] if c != "hai_3_sir"], [""] * (len(COLUMNS) - 4))

    def test_2017_names_give_the_same_extract(self):
        new = extract(raw(full_hospital("990001") + full_hospital("990002")))
        old = extract(raw(full_hospital("990001", sep="-") + full_hospital("990002", sep="-"), header=HEADER_2017,
                          eol="\n"))
        self.assertEqual(old, new)

    def test_header_case_and_spacing_do_not_matter(self):
        plain = raw(full_hospital("990001"))
        shouted = plain.replace('"Facility ID"', '" facility   id "', 1).replace('"Score"', '"SCORE"', 1)
        self.assertNotEqual(shouted, plain)
        self.assertEqual(extract(shouted), extract(plain))

    def test_other_known_measures_are_dropped_not_extracted(self):
        extras = [("990001", i, "9.999") for i in ("HAI_1_CILOWER", "HAI_1_CIUPPER", "HAI_1_DOPC", "HAI-2-CI-LOWER",
                                                    "HAI-2-CI-UPPER", "HAI-2-DOPC-DAYS")]
        self.assertEqual(extract(raw(full_hospital("990001") + extras)), extract(raw(full_hospital("990001"))))

    def test_period_must_match_the_requested_year(self):
        text = raw(full_hospital("990001"))
        self.assertTrue(extract(text, year=2024))
        with self.assertRaisesRegex(ValueError, "not calendar year 2023"):
            extract(text, year=2023)
        with self.assertRaisesRegex(ValueError, "not calendar year 2024"):
            extract(raw(full_hospital("990001"), end="06/30/2024"), year=2024)

    def test_missing_column_raises(self):
        for dropped in ("Facility ID", "Measure ID", "Score", "Start Date", "End Date"):
            with self.subTest(dropped):
                with self.assertRaisesRegex(ValueError, "no .* column"):
                    extract(raw([], header=[h for h in HEADER_NEW if h != dropped]))

    def test_ambiguous_header_raises(self):
        with self.assertRaisesRegex(ValueError, "more than one ccn column"):
            extract(raw([], header=[*HEADER_NEW, "Provider ID"]))

    def test_duplicate_ccn_and_measure_raises(self):
        with self.assertRaisesRegex(ValueError, "990001 has more than one HAI_1_SIR"):
            extract(raw([("990001", "HAI_1_SIR", "1.000"), ("990001", "HAI_1_SIR", "1.000")]))

    def test_duplicate_under_the_other_spelling_raises(self):
        with self.assertRaisesRegex(ValueError, "more than one HAI_1_NUMERATOR"):
            extract(raw([("990001", "HAI_1_NUMERATOR", "1"), ("990001", "HAI-1-NUMERATOR", "1")]))

    def test_duplicate_of_a_dropped_measure_raises(self):
        with self.assertRaisesRegex(ValueError, "more than one HAI_5_DOPC"):
            extract(raw([("990001", "HAI_5_DOPC", "10"), ("990001", "HAI_5_DOPC", "10")]))

    def test_dates_that_differ_within_a_file_raise(self):
        text = raw([("990001", "HAI_1_SIR", "1.000")]) + raw([("990002", "HAI_1_SIR", "1.000")], end="12/30/2024"
                                                              ).split("\r\n", 1)[1]
        with self.assertRaisesRegex(ValueError, "more than one measure period"):
            extract(text)

    def test_bad_dates_raise(self):
        for bad in ("13/01/2024", "2024", "Jan 1 2024", ""):
            with self.subTest(bad):
                with self.assertRaisesRegex(ValueError, "date"):
                    extract(raw([("990001", "HAI_1_SIR", "1.000")], start=bad))

    def test_unexpected_measure_id_raises(self):
        for measure in ("HAI_7_SIR", "HAI_1_SIRX", "COMP_HIP_KNEE", "", "HAI_1a_SIR"):
            with self.subTest(measure):
                with self.assertRaisesRegex(ValueError, "unexpected measure ID"):
                    extract(raw([("990001", measure, "1.000")]))

    def test_unexpected_score_text_raises(self):
        for score in ("Too Few to Report", "", "1,000", "-0.5", " 1.000", "1e3"):
            with self.subTest(score):
                with self.assertRaisesRegex(ValueError, "unexpected score"):
                    extract(raw([("990001", "HAI_1_SIR", score)]))

    def test_malformed_ccn_raises(self):
        for ccn in ("", "99001", "9900011", "99000a"):
            with self.subTest(ccn):
                with self.assertRaisesRegex(ValueError, "malformed CCN"):
                    extract(raw([(ccn, "HAI_1_SIR", "1.000")]))

    def test_ragged_row_raises(self):
        text = raw([("990001", "HAI_1_SIR", "1.000")]) + '"990002","INVENTED"\r\n'
        with self.assertRaisesRegex(ValueError, "line 3 has 2 cells"):
            extract(text)

    def test_empty_and_header_only_raise(self):
        with self.assertRaisesRegex(ValueError, "empty"):
            extract("")
        with self.assertRaisesRegex(ValueError, "no data rows"):
            extract(raw([]))


class Decode(unittest.TestCase):
    def test_ascii(self):
        self.assertEqual(decode(b"a,b\n"), ("a,b\n", "ascii"))

    def test_utf8_with_and_without_a_byte_order_mark(self):
        self.assertEqual(decode("café".encode("utf-8")), ("café", "utf-8"))
        self.assertEqual(decode(b"\xef\xbb\xbfFacility ID"), ("Facility ID", "utf-8"))

    def test_windows_1252_when_not_utf8(self):
        self.assertEqual(decode(b"a\x96b"), ("a–b", "cp1252"))  # 0x96 is an en dash, not a control character

    def test_bytes_no_encoding_assigns_raise(self):
        with self.assertRaises(UnicodeDecodeError):
            decode(b"a\x81b")  # not UTF-8 and unassigned in Windows-1252


class Derive(unittest.TestCase):
    MEMBER = "folder/Healthcare_Associated_Infections-Hospital.csv"

    def zipped(self, text):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(self.MEMBER, text.encode("cp1252"))
            zf.writestr("other.csv", b"ignored")
        return buf.getvalue()

    def source(self, data, **changes):
        return {"file": "invented.zip", "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
                "member": self.MEMBER, **changes}

    def test_derives_the_member_and_checks_the_year(self):
        text = raw(full_hospital("990001"))
        data = self.zipped(text)
        out, encoding = derive(data, self.source(data), 2024)
        self.assertEqual((out, encoding), (extract(text, 2024).encode("utf-8"), "ascii"))
        with self.assertRaisesRegex(ValueError, "not calendar year 2021"):
            derive(data, self.source(data), 2021)

    def test_refuses_a_zip_that_is_not_the_one_named(self):
        data = self.zipped(raw(full_hospital("990001")))
        for wrong in ({"bytes": len(data) + 1}, {"sha256": "0" * 64}):
            with self.subTest(wrong):
                with self.assertRaisesRegex(ValueError, "not the zip the manifest names"):
                    derive(data, self.source(data, **wrong), 2024)

    def test_missing_member_raises(self):
        data = self.zipped(raw(full_hospital("990001")))
        with self.assertRaises(KeyError):
            derive(data, self.source(data, member="nope.csv"), 2024)


def hai_entries():
    return [e for e in read_manifest() if PIN_ID_PATTERN.fullmatch(e["id"])]


class Committed(unittest.TestCase):
    def test_every_year_is_pinned(self):
        self.assertEqual([e["id"] for e in hai_entries()],
                         [f"hai-cy{y}" for y in (2017, 2018, 2019, 2021, 2023, 2024)])

    def test_manifest_entries_are_well_formed(self):
        for entry in hai_entries():
            year = int(PIN_ID_PATTERN.fullmatch(entry["id"]).group(1))
            with self.subTest(entry["id"]):
                self.assertEqual(entry["path"], f"{entry['id']}/hai_hospital_cy{year}.csv")
                self.assertEqual(entry["derivedBy"], "pipeline/py/pp_pipeline/hai_extract.py")
                self.assertLess(entry["bytes"], 10 * 1024 * 1024)
                source = entry["derivedFrom"]
                self.assertEqual(sorted(k for k in source if k not in ("originalUrl",)),
                                 ["bytes", "downloadUrl", "file", "member", "sha256"])
                self.assertRegex(source["sha256"], r"[0-9a-f]{64}")
                self.assertTrue(source["downloadUrl"].startswith("https://"))
                self.assertTrue(source["member"].endswith(".csv"))

    def test_extract_shape_and_values(self):
        for entry in hai_entries():
            year = int(PIN_ID_PATTERN.fullmatch(entry["id"]).group(1))
            with self.subTest(entry["id"]):
                text = read_pinned_bytes(entry["id"]).decode("utf-8")
                self.assertNotIn("\r", text)
                rows = parsed(text)
                self.assertEqual(rows[0], list(COLUMNS))
                body = rows[1:]
                ccns = [r[0] for r in body]
                self.assertGreater(len(ccns), 4000)
                self.assertEqual(ccns, sorted(set(ccns)))
                self.assertTrue(all(re.fullmatch(r"[0-9A-Z]{6}", c) for c in ccns))
                self.assertTrue(all(len(r) == len(COLUMNS) for r in body))
                self.assertEqual({(r[1], r[2]) for r in body},
                                 {(datetime.date(year, 1, 1).isoformat(), datetime.date(year, 12, 31).isoformat())})
                bad = []  # (ccn, measure number) with a cell that is not a number or "Not Available", or a wrong SIR
                for r in body:
                    row = dict(zip(COLUMNS, r))
                    for n, _ in MEASURES:
                        sir, observed, predicted = (row[f"hai_{n}_{f}"] for f in ("sir", "observed", "predicted"))
                        if not (all(NUMBER.fullmatch(c) or c == NOT_AVAILABLE for c in (sir, predicted))
                                and (INTEGER.fullmatch(observed) or observed == NOT_AVAILABLE)):
                            bad.append((row["ccn"], n))
                        elif NOT_AVAILABLE not in (sir, observed, predicted) and float(predicted) > 0 \
                                and abs(float(sir) - float(observed) / float(predicted)) > 0.002:
                            bad.append((row["ccn"], n))  # the mapping is right if SIR is observed over predicted
                self.assertEqual(bad, [])

    @unittest.skipUnless(os.environ.get("PP_HAI_ZIP_DIR"),
                         "set PP_HAI_ZIP_DIR to a folder holding the raw CMS zips to re-derive the extracts")
    def test_extracts_rederive_from_the_zips(self):
        zips = {}
        for p in Path(os.environ["PP_HAI_ZIP_DIR"]).glob("*.zip"):
            zips.setdefault(p.stat().st_size, []).append(p)
        for entry in hai_entries():
            source = entry["derivedFrom"]
            with self.subTest(entry["id"]):
                found = [p for p in zips.get(source["bytes"], [])
                         if hashlib.sha256(p.read_bytes()).hexdigest() == source["sha256"]]
                self.assertTrue(found, f"no zip in PP_HAI_ZIP_DIR matches {source['file']}")
                year = int(PIN_ID_PATTERN.fullmatch(entry["id"]).group(1))
                out, _ = derive(found[0].read_bytes(), source, year)
                self.assertEqual(out, (PINNED_DIR / entry["path"]).read_bytes())


if __name__ == "__main__":
    unittest.main()
