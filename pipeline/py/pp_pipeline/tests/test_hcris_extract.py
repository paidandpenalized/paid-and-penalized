"""The HCRIS extract (pp_pipeline.hcris_extract): derived exactly from a small synthetic report file and numeric file,
refused from anything else, and the committed extract's shape. Synthetic CCNs and report numbers only."""
import csv
import hashlib
import io
import os
import re
import tempfile
import unittest
import zipfile
from pathlib import Path

from pp_pipeline.files import PINNED_DIR, manifest_entry, read_pinned_bytes
from pp_pipeline.hcris_extract import CELLS, COLUMNS, PIN_ID, derive, extract


def report(rpt, ccn, begin="10/01/2023", end="09/30/2024", status="1"):
    """An 18-field report row in HCRIS's order (RPT_REC_NUM, PRVDR_CTRL_TYPE_CD, PRVDR_NUM, NPI, RPT_STUS_CD,
    FY_BGN_DT, FY_END_DT, ...), invented values in the fields the extract does not read."""
    return [rpt, "2", ccn, "", status, begin, end, "01/15/2025", "N", "Y", "T", "99999", "4", "01/02/2025", "F", "", "",
            "01/01/2025"]


REPORTS = [report("20", "990002", status="5"), report("3", "990001"), report("100", "991300", "01/01/2024", "12/31/2024")]
NUMBERS = [
    ["3", "E00A18A", "00102", "00100", "5000000"],
    ["3", "E00A18A", "00102", "00101", "250000"],  # a second column: the status changed in the period
    ["3", "E00A18A", "07099", "00100", "61000"],
    ["3", "E00A18A", "07094", "00100", "-12000"],
    ["3", "E00A18A", "03000", "00100", "1"],  # a line the back-test does not read: left out
    ["3", "S300001", "01400", "00100", "777"],  # another worksheet: left out
    ["20", "E00S18A", "00102", "00100", "999"],  # the PARHM worksheet: only its presence is kept
    ["20", "E00A18A", "07093", "00100", "-450"],
]
EXPECTED = (",".join(COLUMNS) + "\n"
            + "3,990001,1,2023-10-01,2024-09-30,Y,N," + ",".join(
                {"l00102_c00100": "5000000", "l00102_c00101": "250000", "l07099_c00100": "61000",
                 "l07094_c00100": "-12000"}.get(c, "") for c in CELLS) + "\n"
            + "20,990002,5,2023-10-01,2024-09-30,Y,Y," + ",".join(
                {"l07093_c00100": "-450"}.get(c, "") for c in CELLS) + "\n"
            + "100,991300,1,2024-01-01,2024-12-31,N,N," + "," * (len(CELLS) - 1) + "\n")


def csv_bytes(rows):
    out = io.StringIO()
    csv.writer(out, lineterminator="\r\n").writerows(rows)
    return out.getvalue().encode("ascii")


class Extract(unittest.TestCase):
    def test_the_extract_of_a_synthetic_file(self):
        self.assertEqual(extract(REPORTS, NUMBERS), EXPECTED)

    def test_derive_reads_the_zip_it_is_told_and_refuses_another(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "synthetic.zip"
            with zipfile.ZipFile(path, "w") as zf:
                zf.writestr("rpt.csv", csv_bytes(REPORTS))
                zf.writestr("nmrc.csv", csv_bytes(NUMBERS))
            data = path.read_bytes()
            source = {"file": "synthetic.zip", "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
                      "members": ["rpt.csv", "nmrc.csv"]}
            self.assertEqual(derive(path, source), EXPECTED.encode("ascii"))
            with self.assertRaisesRegex(ValueError, "not the zip the manifest names"):
                derive(path, {**source, "sha256": "0" * 64})

    def test_a_malformed_row_or_value_stops_the_extract(self):
        cases = (
            ([report("3", "990001")[:17]], [], "18"),
            ([report("3", "990001"), report("3", "990002")], [], "appears twice"),
            ([report("3", "99001")], [], "malformed CCN"),
            ([report("3", "990001", begin="2023-10-01")], [], "MM/DD/YYYY"),
            ([report("3", "990001")], [["4", "E00A18A", "07099", "00100", "1"]], "not in the report file"),
            ([report("3", "990001")], [["3", "E00A18A", "07099", "00200", "1"]], "column 00200"),
            ([report("3", "990001")], [["3", "E00A18A", "07099", "00100", "1e5"]], "not a number"),
            ([report("3", "990001")], [["3", "E00A18A", "07099", "00100", "1"]] * 2, "appears twice"),
            ([report("3", "990001")], [["3", "E00A18A", "07099", "00100"]], "5"),
        )
        for reports, numbers, message in cases:
            with self.subTest(message), self.assertRaisesRegex(ValueError, message):
                extract(reports, numbers)


class Committed(unittest.TestCase):
    def test_the_manifest_entry(self):
        entry = manifest_entry(PIN_ID)
        self.assertEqual(entry["derivedBy"], "pipeline/py/pp_pipeline/hcris_extract.py")
        source = entry["derivedFrom"]
        self.assertEqual(source["members"], ["HOSP10_2024_rpt.csv", "HOSP10_2024_nmrc.csv"])
        self.assertTrue(source["downloadUrl"].startswith("https://downloads.cms.gov/"))
        self.assertGreater(source["bytes"], 10 * 1024 * 1024)  # why it is not pinned itself
        self.assertNotIn("archiveUrl", source)  # publishing an archive copy is a public action, not taken
        self.assertLess(entry["bytes"], 10 * 1024 * 1024)

    def test_the_extract_shape(self):
        rows = list(csv.reader(io.StringIO(read_pinned_bytes(PIN_ID).decode("ascii"))))
        self.assertEqual(rows[0], list(COLUMNS))
        body = rows[1:]
        numbers = [int(r[0]) for r in body]
        self.assertEqual(numbers, sorted(set(numbers)))
        self.assertTrue(all(len(r) == len(COLUMNS) for r in body))
        self.assertTrue(all(re.fullmatch(r"[0-9A-Z]{6}", r[1]) for r in body))
        self.assertTrue(all(r[5] in "YN" and r[6] in "YN" for r in body))
        self.assertTrue(all(re.fullmatch(r"-?\d*", c) for r in body for c in r[7:]))
        self.assertTrue({r[3] for r in body} <= {f"{y}-{m:02d}-{d:02d}" for y in (2023, 2024) for m in range(1, 13)
                                                 for d in range(1, 32)})

    @unittest.skipUnless(os.environ.get("PP_HCRIS_ZIP"), "set PP_HCRIS_ZIP to the raw HCRIS zip to re-derive the extract")
    def test_the_extract_rederives_from_the_zip(self):
        entry = manifest_entry(PIN_ID)
        self.assertEqual(derive(Path(os.environ["PP_HCRIS_ZIP"]), entry["derivedFrom"]),
                         (PINNED_DIR / entry["path"]).read_bytes())


if __name__ == "__main__":
    unittest.main()
