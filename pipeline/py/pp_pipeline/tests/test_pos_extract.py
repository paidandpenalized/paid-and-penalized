"""The POS extract: a fixed row and column subset of CMS's Provider of Services file, derived by a script."""
import csv
import hashlib
import io
import os
import re
import unittest
from pathlib import Path

from pp_pipeline.files import PINNED_DIR, manifest_entry, read_pinned_bytes
from pp_pipeline.pos_extract import COLUMNS, PIN_ID, extract

HEADER = ["PRVDR_CTGRY_SBTYP_CD", "PRVDR_CTGRY_CD", "OTHER", *[c for c in COLUMNS if c != "PRVDR_CTGRY_SBTYP_CD"]]


def raw(rows, header=HEADER):
    """Synthetic raw POS text: header plus rows given as {column: value} (missing columns blank)."""
    out = io.StringIO()
    w = csv.writer(out, lineterminator="\r\n")
    w.writerow(header)
    for r in rows:
        w.writerow([r.get(h, "") for h in header])
    return out.getvalue()


def parsed(text):
    return list(csv.reader(io.StringIO(text)))


class Extract(unittest.TestCase):
    def test_keeps_hospital_rows_and_columns_in_order(self):
        text = extract(raw([
            {"PRVDR_NUM": "990002", "PRVDR_CTGRY_CD": "01", "FAC_NAME": " INVENTED B HOSPITAL ", "OTHER": "x"},
            {"PRVDR_NUM": "990001", "PRVDR_CTGRY_CD": "21", "FAC_NAME": "A CLINIC"},
            {"PRVDR_NUM": "00001F", "PRVDR_CTGRY_CD": "01", "FAC_NAME": "INVENTED A HOSPITAL", "CRTFD_BED_CNT": "12"},
        ]))
        rows = parsed(text)
        self.assertEqual(rows[0], list(COLUMNS))
        self.assertEqual([r[0] for r in rows[1:]], ["00001F", "990002"])  # sorted; category 21 dropped; text kept
        self.assertEqual(rows[2][COLUMNS.index("FAC_NAME")], "INVENTED B HOSPITAL")
        self.assertEqual(rows[1][COLUMNS.index("CRTFD_BED_CNT")], "12")
        self.assertTrue(text.endswith("\n") and "\r" not in text)

    def test_missing_column_raises(self):
        with self.assertRaisesRegex(ValueError, "ZIP_CD"):
            extract(raw([], header=[h for h in HEADER if h != "ZIP_CD"]))

    def test_duplicate_ccn_raises(self):
        row = {"PRVDR_NUM": "990001", "PRVDR_CTGRY_CD": "01"}
        with self.assertRaisesRegex(ValueError, "990001"):
            extract(raw([row, row]))


class Committed(unittest.TestCase):
    def test_extract_shape(self):
        rows = parsed(read_pinned_bytes(PIN_ID).decode("utf-8"))
        self.assertEqual(rows[0], list(COLUMNS))
        ccns = [r[0] for r in rows[1:]]
        self.assertTrue(ccns)
        self.assertEqual(ccns, sorted(set(ccns)))
        self.assertTrue(all(re.fullmatch(r"[0-9A-Z]{6}", c) for c in ccns))
        self.assertTrue(all(len(r) == len(COLUMNS) for r in rows))

    @unittest.skipUnless(os.environ.get("PP_RAW_POS"), "set PP_RAW_POS to the raw POS file to re-derive the extract")
    def test_extract_rederives_from_raw(self):
        data = Path(os.environ["PP_RAW_POS"]).read_bytes()
        source = manifest_entry(PIN_ID)["derivedFrom"]
        self.assertEqual((len(data), hashlib.sha256(data).hexdigest()), (source["bytes"], source["sha256"]))
        committed = (PINNED_DIR / manifest_entry(PIN_ID)["path"]).read_bytes()
        self.assertEqual(extract(data.decode("latin-1")).encode("utf-8"), committed)


if __name__ == "__main__":
    unittest.main()
