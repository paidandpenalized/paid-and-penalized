"""Envelope helpers: the same hashes and layout as pipeline/contract.js."""
import json
import unittest

from pp_engine.contract import canonical_json, envelope, format_emitted, keep_built_at, source_manifest_hash
from pp_pipeline.files import SCHEMAS_DIR, read_json


class Contract(unittest.TestCase):
    def test_shared_vectors(self):
        cases = read_json(SCHEMAS_DIR / "conformance" / "source-manifest.vectors.json")["cases"]
        self.assertTrue(cases)
        for c in cases:
            pins = sorted(({"id": e["id"], "sha256": e["sha256"]} for e in c["entries"]), key=lambda e: e["id"])
            self.assertEqual(canonical_json(pins), c["canonical"])
            self.assertEqual(source_manifest_hash(c["entries"]), c["sha256"])

    def test_canonical_json(self):
        self.assertEqual(canonical_json({"b": 1, "a": [2, 1]}), canonical_json({"a": [2, 1], "b": 1}))
        self.assertNotEqual(canonical_json([1, 2]), canonical_json([2, 1]))
        self.assertEqual(canonical_json({"é": "ü", "a": None}), '{"a":null,"é":"ü"}')

    def test_source_manifest_hash_ignores_order_and_metadata(self):
        a, b = {"id": "a", "sha256": "00", "title": "x"}, {"id": "b", "sha256": "ff"}
        self.assertEqual(source_manifest_hash([a, b]), source_manifest_hash([b, {"id": "a", "sha256": "00"}]))

    def test_envelope(self):
        manifest = [{"id": "a", "sha256": "00"}, {"id": "b", "sha256": "ff"}]
        env = envelope(1, 2, ["b"], manifest, "2026-10-20T00:00:00Z", 2027)
        self.assertEqual(list(env), ["schema_version", "methods_version", "source_manifest", "sources", "built_at", "fy"])
        self.assertEqual(env["source_manifest"], source_manifest_hash([manifest[1]]))
        with self.assertRaises(KeyError):
            envelope(1, 1, ["missing"], manifest, "2026-10-20T00:00:00Z", 2027)

    def test_keep_built_at(self):
        old = {"built_at": "2026-01-01T00:00:00Z", "x": 1}
        self.assertEqual(keep_built_at(old, {"built_at": "2026-02-02T00:00:00Z", "x": 1}), old)
        new = {"built_at": "2026-02-02T00:00:00Z", "x": 2}
        self.assertEqual(keep_built_at(old, new), new)
        self.assertEqual(keep_built_at(None, new), new)

    def test_format_emitted(self):
        obj = {"schema_version": 1, "sources": ["a", "é"], "hospitals": [{"ccn": "000001"}, {"ccn": "00001F"}], "empty": []}
        text = format_emitted(obj)
        self.assertEqual(json.loads(text), obj)
        self.assertTrue(text.endswith("}\n"))
        self.assertIn('"hospitals": [\n{"ccn":"000001"},\n{"ccn":"00001F"}\n]', text)
        self.assertIn('"empty": []', text)
        self.assertIn('"é"', text)


if __name__ == "__main__":
    unittest.main()
