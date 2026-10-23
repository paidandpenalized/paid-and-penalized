"""Every pinned input matches its manifest entry, nothing sits in data/pinned/ unlisted, and a derived extract is
written only when it is the one the manifest records."""
import contextlib
import hashlib
import io
import tempfile
import unittest
from pathlib import Path

from pp_pipeline import hai_extract, hcris_extract, pos_extract
from pp_pipeline.files import PINNED_DIR, read_manifest, read_pinned_bytes, write_derived_pin


class Pins(unittest.TestCase):
    def test_every_manifest_entry_matches_its_file(self):
        for entry in read_manifest():
            with self.subTest(entry["id"]):
                read_pinned_bytes(entry["id"])  # raises on a size or SHA-256 mismatch

    def test_no_unlisted_pinned_files(self):
        listed = {e["path"] for e in read_manifest()}
        on_disk = {p.relative_to(PINNED_DIR).as_posix() for p in PINNED_DIR.rglob("*") if p.is_file()}
        self.assertEqual(on_disk - {"manifest.json"}, listed)


class DerivedPinWrite(unittest.TestCase):
    DATA = b"ccn,value\n990001,1\n"
    ENTRY = {"id": "synthetic-extract", "path": "synthetic/extract.csv", "bytes": len(DATA),
             "sha256": hashlib.sha256(DATA).hexdigest()}

    def write(self, root, data):
        printed = io.StringIO()
        with contextlib.redirect_stdout(printed):
            code = write_derived_pin(self.ENTRY, data, root=root)
        return code, printed.getvalue()

    def test_the_manifests_bytes_are_written(self):
        with tempfile.TemporaryDirectory() as tmp:
            code, printed = self.write(tmp, self.DATA)
            self.assertEqual(code, 0)
            self.assertEqual((Path(tmp) / self.ENTRY["path"]).read_bytes(), self.DATA)
            self.assertIn(self.ENTRY["sha256"], printed)

    def test_other_bytes_leave_the_committed_pin_as_it_was(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / self.ENTRY["path"]
            path.parent.mkdir(parents=True)
            path.write_bytes(self.DATA)
            other = self.DATA + b"990002,2\n"
            code, printed = self.write(tmp, other)
            self.assertEqual(code, 1)
            self.assertEqual(path.read_bytes(), self.DATA)
            self.assertIn(hashlib.sha256(other).hexdigest(), printed)  # what the entry would need, to re-pin
            self.assertIn("nothing written", printed)
            path.unlink()  # nor is a missing pin created from other bytes
            self.assertEqual(self.write(tmp, other)[0], 1)
            self.assertFalse(path.exists())

    def test_every_extractor_writes_through_it(self):
        for module in (hai_extract, hcris_extract, pos_extract):
            with self.subTest(module.__name__):
                self.assertIs(module.write_derived_pin, write_derived_pin)
                self.assertNotIn("write_bytes", Path(module.__file__).read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
