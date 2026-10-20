"""Golden snapshot: the committed hospital master equals a fresh build from the pins (built_at aside)."""
import unittest

from pp_engine.contract import format_emitted, keep_built_at, source_manifest_hash
from pp_engine.parse import impact_fy
from pp_engine.schema import validate
from pp_pipeline.emit_hospital import IMPACT, IMPACT_MEMBER, SCHEMA, SOURCES, build_from_pins, emitted_path
from pp_pipeline.files import load_schemas, read_json, read_manifest, read_zip_member

FY = impact_fy(read_zip_member(IMPACT, IMPACT_MEMBER).decode("cp1252"))
PATH = emitted_path(FY)
COMMITTED = read_json(PATH)


class Golden(unittest.TestCase):
    def test_a_fresh_build_equals_the_committed_file(self):
        self.assertEqual(keep_built_at(COMMITTED, build_from_pins("2099-01-01T00:00:00Z")), COMMITTED)

    def test_the_committed_bytes_are_the_emitter_layout(self):  # so `make emit` on a clean tree leaves git clean
        self.assertEqual(format_emitted(COMMITTED), PATH.read_text(encoding="utf-8"))

    def test_contract(self):
        schemas = load_schemas()
        self.assertEqual(validate(schemas[SCHEMA], COMMITTED, schemas), [])
        manifest = {e["id"]: e for e in read_manifest()}
        self.assertEqual(COMMITTED["sources"], list(SOURCES))
        self.assertEqual(COMMITTED["source_manifest"], source_manifest_hash([manifest[s] for s in SOURCES]))
        self.assertEqual(COMMITTED["fy"], FY)


if __name__ == "__main__":
    unittest.main()
