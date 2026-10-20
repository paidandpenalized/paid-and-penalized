"""Golden snapshot: the committed hospital master equals a fresh build from the pins (built_at aside)."""
import unittest

from pp_engine.contract import format_emitted, keep_built_at
from pp_engine.schema import validate
from pp_pipeline.emit_hospital import SCHEMA, build_from_pins, committed_path
from pp_pipeline.files import load_schemas, read_json


class Golden(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.path = committed_path()
        cls.committed = read_json(cls.path)

    def test_a_fresh_build_equals_the_committed_file(self):  # envelope included: sources, source_manifest, fy
        self.assertEqual(keep_built_at(self.committed, build_from_pins("2099-01-01T00:00:00Z")), self.committed)

    def test_the_committed_bytes_are_the_emitter_layout(self):  # so `make emit` on a clean tree leaves git clean
        self.assertEqual(format_emitted(self.committed), self.path.read_text(encoding="utf-8"))

    def test_the_committed_file_passes_its_schema(self):
        schemas = load_schemas()
        self.assertEqual(validate(schemas[SCHEMA], self.committed, schemas), [])


if __name__ == "__main__":
    unittest.main()
