"""The JSON Schema subset validator (twin of engine/js/schema.js), and every shared case in schemas/conformance/."""
import copy
import json
import math
import re
import unittest

from pp_engine.schema import validate
from pp_pipeline.files import SCHEMAS_DIR, load_schemas, read_json

SCHEMAS = load_schemas()


class Base(unittest.TestCase):
    def ok(self, schema, data, schemas=None):
        self.assertEqual(validate(schema, data, schemas), [])

    def bad(self, schema, data, pattern=None, schemas=None):
        errors = validate(schema, data, schemas)
        self.assertTrue(errors, f"expected errors for {data!r}")
        if pattern:
            self.assertTrue(any(re.search(pattern, e) for e in errors), "\n".join(errors))


class Keywords(Base):
    def test_types(self):
        self.ok({"type": "object"}, {})
        self.bad({"type": "object"}, [])
        self.bad({"type": "object"}, None)
        self.ok({"type": "array"}, [])
        self.ok({"type": "string"}, "")
        self.ok({"type": "number"}, 1.5)
        self.ok({"type": "integer"}, 2)
        self.bad({"type": "integer"}, 2.5)
        self.ok({"type": "boolean"}, False)
        self.ok({"type": "null"}, None)
        self.ok({"type": ["number", "null"]}, None)
        self.bad({"type": ["number", "null"]}, "1")

    def test_bool_is_not_integer(self):
        for schema in ({"type": "integer"}, {"type": "number"}):
            self.bad(schema, True, r"^: expected (integer|number), got boolean$")
        self.bad({"type": "boolean"}, 1)

    def test_float_integral_is_integer(self):
        self.ok({"type": "integer"}, 1.0)
        self.ok({"type": "integer", "minimum": 1}, json.loads("1.0"))

    def test_nan_and_inf_fail_number(self):
        for v in (math.nan, math.inf, -math.inf):
            self.bad({"type": ["number", "null"]}, v, "non-finite")
            self.bad({"type": "integer"}, v)

    def test_enum_type_aware(self):
        self.bad({"enum": [1]}, True)
        self.bad({"const": False}, 0)
        self.bad({"const": 0}, False)
        self.ok({"const": 1}, 1.0)
        self.ok({"enum": [{"a": [1, "x"]}]}, {"a": [1, "x"]})
        self.bad({"enum": [{"a": [1]}]}, {"a": [True]})

    def test_properties_required_additional(self):
        s = {"type": "object", "properties": {"a": {"type": "string"}}, "required": ["a"], "additionalProperties": False}
        self.ok(s, {"a": "x"})
        self.bad(s, {}, r'^: missing required property "a"')
        self.bad(s, {"a": "x", "b": 1}, r'^: unexpected property "b"')
        self.bad(s, {"a": 1}, r"^/a: ")
        self.ok({"type": "object", "additionalProperties": {"type": "integer"}}, {"x": 1, "y": 2})
        self.ok({"type": "array", "items": False}, [])
        self.bad({"type": "array", "items": False}, [1], r"^/0: no value")
        self.bad({"type": "object", "additionalProperties": {"type": "integer"}}, {"x": 1.5}, r"^/x: ")

    def test_other_keywords(self):
        self.ok({"type": "array", "items": {"type": "integer"}, "minItems": 1}, [1, 2])
        self.bad({"type": "array", "items": {"type": "integer"}}, [1, "x"], r"^/1: ")
        self.bad({"type": "array", "minItems": 1}, [])
        self.ok({"enum": ["Yes", "No"]}, "No")
        self.bad({"enum": ["Yes", "No"]}, "Maybe", r'^: not one of \["Yes","No"\]$')
        self.ok({"const": 1}, 1)
        self.bad({"const": 1}, 2, r"^: must equal 1$")
        self.ok({"type": "string", "pattern": "^a+$"}, "aaa")
        self.bad({"type": "string", "pattern": "^a+$"}, "ab", r"^: does not match \^a\+\$$")
        self.ok({"type": "number", "minimum": 0, "maximum": 1}, 1)
        self.bad({"type": "number", "minimum": 0}, -0.1, "below the minimum 0")
        self.bad({"type": "number", "maximum": 1}, 1.1, "above the maximum 1")
        self.bad({"type": "string", "minLength": 1}, "", "shorter than 1")
        self.ok({"type": "string", "minLength": 2}, "é1")
        self.bad({"type": "string", "minLength": 2}, "\U0001F600")  # one code point, as in JS's [...value]

    def test_pattern_is_unanchored_search(self):
        self.ok({"type": "string", "pattern": "b"}, "abc")
        self.bad({"type": "string", "pattern": r"^\d$"}, "٣")

    def test_constraints_skip_other_types(self):
        self.ok({"type": ["string", "null"], "pattern": "^a$", "minLength": 1}, None)
        self.ok({"type": ["number", "null"], "minimum": 0}, None)

    def test_refs(self):
        local = {"$defs": {"n": {"type": "integer"}}, "type": "object", "properties": {"x": {"$ref": "#/$defs/n"}}}
        self.ok(local, {"x": 1})
        self.bad(local, {"x": "a"}, r"^/x: ")
        s = {"type": "array", "items": {"$ref": "common.schema.json#/$defs/ccn"}}
        self.ok(s, ["000001"], SCHEMAS)
        self.bad(s, ["000001", 1], r"^/1: ", SCHEMAS)
        with self.assertRaises(ValueError):
            validate({"$ref": "missing.schema.json#/$defs/x"}, 1, SCHEMAS)
        with self.assertRaises(ValueError):
            validate({"$ref": "#/$defs/nope"}, 1)

    def test_ref_depth_limit(self):
        with self.assertRaises(ValueError):
            validate({"$defs": {"a": {"$ref": "#/$defs/a"}}, "$ref": "#/$defs/a"}, 1)

    def test_pointers_name_the_failing_path(self):
        s = {"type": "object", "properties": {"hospitals": {"type": "array", "items": {
            "type": "object", "properties": {"ccn": {"type": "string"}, "a/b~": {"type": "string"}}}}}}
        data = {"hospitals": [{"ccn": "a"}, {"ccn": "b"}, {"ccn": "c"}, {"ccn": 4, "a/b~": 1}]}
        errors = validate(s, data)
        self.assertIn("/hospitals/3/ccn: expected string, got number", errors)
        self.assertIn("/hospitals/3/a~1b~0: expected string, got number", errors)

    def test_unsupported_keyword_raises(self):
        for kw in ("format", "oneOf", "anyOf", "allOf", "not", "patternProperties", "if", "exclusiveMinimum", "uniqueItems"):
            with self.assertRaises(ValueError, msg=kw):
                validate({"type": "string", kw: {}}, "x")
        with self.assertRaises(ValueError):
            validate({"type": "object", "properties": {"a": {"format": "date"}}}, {})
        with self.assertRaises(ValueError):
            validate({"$defs": {"a": {"oneOf": []}}}, 1)

    def test_every_schema_file_is_supported_and_named(self):
        for name, schema in SCHEMAS.items():
            self.assertEqual(schema["$id"], name)
            validate(schema, None, SCHEMAS)


# A case is { data } or { patch } against the suite's base; the same ops as engine/js/test/schema.test.js.
def apply_patch(base, patch):
    doc = copy.deepcopy(base)
    for op in patch:
        keys = [k.replace("~1", "/").replace("~0", "~") for k in op["path"].split("/")[1:]]
        last = keys.pop()
        node = doc
        for k in keys:
            if isinstance(node, list) and re.fullmatch(r"0|[1-9]\d*", k, re.ASCII) and int(k) < len(node):
                node = node[int(k)]
            elif isinstance(node, dict) and k in node:
                node = node[k]
            else:
                raise ValueError(f"patch path {op['path']} not in base")
        if op["op"] not in ("set", "create", "delete"):
            raise ValueError(f"patch op {op['op']!r} unknown")
        if isinstance(node, list):
            if op["op"] == "create" or not re.fullmatch(r"0|[1-9]\d*", last, re.ASCII):
                raise ValueError(f"patch {op['op']} at {op['path']}: not for arrays")
            has = int(last) < len(node)
        elif isinstance(node, dict):
            has = last in node
        else:
            raise ValueError(f"patch path {op['path']}: parent is not an object")
        if has == (op["op"] == "create"):
            raise ValueError(f"patch {op['op']} at {op['path']}: key {'exists' if has else 'missing'}")
        if op["op"] == "delete":
            del node[int(last) if isinstance(node, list) else last]
        else:
            node[int(last) if isinstance(node, list) else last] = op["value"]
    return doc


class Patches(unittest.TestCase):
    def test_ops(self):
        base = {"a": {"b": 1}, "list": [{"x": 1}]}
        patched = apply_patch(base, [{"path": "/a/b", "op": "set", "value": 2}, {"path": "/a/c", "op": "create", "value": 3},
                                     {"path": "/list/0/x", "op": "delete"}])
        self.assertEqual(patched, {"a": {"b": 2, "c": 3}, "list": [{}]})
        self.assertEqual(base, {"a": {"b": 1}, "list": [{"x": 1}]})
        self.assertEqual(apply_patch({"list": [1, 2]}, [{"path": "/list/0", "op": "delete"}]), {"list": [2]})

    def test_bad_ops_raise(self):
        for bad in ({"path": "/list/-", "op": "create", "value": 3}, {"path": "/list/2", "op": "set", "value": 3},
                    {"path": "/list/01", "op": "delete"}, {"path": "/a/b", "op": "create", "value": 1},
                    {"path": "/a/missing", "op": "delete"}, {"path": "/a/b/c", "op": "create", "value": 1},
                    {"path": "/a/b", "op": "add", "value": 1}):
            with self.assertRaises(ValueError, msg=bad):
                apply_patch({"a": {"b": 1}, "list": [1, 2]}, [bad])


class Conformance(unittest.TestCase):
    def test_every_case(self):
        files = sorted((SCHEMAS_DIR / "conformance").glob("*.cases.json"))
        self.assertTrue(files)
        for path in files:
            suite = read_json(path)
            root = SCHEMAS[suite["schema"]]
            target = {"$ref": f"{suite['schema']}#/$defs/{suite['def']}"} if suite.get("def") else root
            for case in suite["cases"]:
                with self.subTest(file=path.name, case=case["name"]):
                    data = apply_patch(suite["base"], case["patch"]) if "patch" in case else case["data"]
                    self.assertEqual(validate(target, data, SCHEMAS) == [], case["valid"])


if __name__ == "__main__":
    unittest.main()
