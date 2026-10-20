"""Every pinned input matches its manifest entry, and nothing sits in data/pinned/ unlisted."""
import unittest

from pp_pipeline.files import PINNED_DIR, read_manifest, read_pinned_bytes


class Pins(unittest.TestCase):
    def test_every_manifest_entry_matches_its_file(self):
        for entry in read_manifest():
            with self.subTest(entry["id"]):
                read_pinned_bytes(entry["id"])  # raises on a size or SHA-256 mismatch

    def test_no_unlisted_pinned_files(self):
        listed = {e["path"] for e in read_manifest()}
        on_disk = {p.relative_to(PINNED_DIR).as_posix() for p in PINNED_DIR.rglob("*") if p.is_file()}
        self.assertEqual(on_disk - {"manifest.json"}, listed)


if __name__ == "__main__":
    unittest.main()
