"""A small JSON Schema (2020-12) validator for the data contract: the Python twin of engine/js/schema.js.

It supports only the keywords below and raises on any other, so a schema can never look stricter than what is
checked. Types are JSON's, not Python's: a bool is never a number, 1.0 is an integer, and patterns use ASCII classes
(as JavaScript's u mode does for \\d and \\w). Both validators run every case in schemas/conformance/.
"""
import json
import math
import re

ANNOTATIONS = {"$schema", "$id", "$defs", "title", "description"}
ASSERTIONS = {"$ref", "type", "properties", "required", "additionalProperties", "items", "enum", "const",
              "pattern", "minimum", "maximum", "minItems", "minLength"}
MAX_REF_DEPTH = 64


def _check_keywords(schema, where):
    if isinstance(schema, bool):
        return
    if not isinstance(schema, dict):
        raise ValueError(f"schema {where}: not a schema object")
    for kw in schema:
        if kw not in ANNOTATIONS and kw not in ASSERTIONS:
            raise ValueError(f'schema {where}: unsupported keyword "{kw}"')
    for name, sub in schema.get("$defs", {}).items():
        _check_keywords(sub, f"{where}/$defs/{name}")
    for name, sub in schema.get("properties", {}).items():
        _check_keywords(sub, f"{where}/properties/{name}")
    for key in ("items", "additionalProperties"):
        if key in schema:
            _check_keywords(schema[key], f"{where}/{key}")


def type_of(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "number"
    if isinstance(value, float):
        return "number" if math.isfinite(value) else "non-finite number"  # JSON would write null
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


def _has_type(value, t):
    if t == "integer":
        return type_of(value) == "number" and (isinstance(value, int) or value.is_integer())
    return type_of(value) == t


def _equal(a, b):
    ta = type_of(a)
    if ta != type_of(b):
        return False
    if ta == "array":
        return len(a) == len(b) and all(_equal(x, y) for x, y in zip(a, b))
    if ta == "object":
        return a.keys() == b.keys() and all(_equal(a[k], b[k]) for k in a)
    return a == b


def _stringify(v):
    return json.dumps(v, ensure_ascii=False, separators=(",", ":"))


def _pointer(path):
    return "".join("/" + str(p).replace("~", "~0").replace("/", "~1") for p in path)


def validate(schema, data, schemas=None):
    """Error messages ("<json-pointer>: <problem>"); empty means valid. `schemas` maps each $id to its schema, for
    $refs into other files ("common.schema.json#/$defs/ccn")."""
    schemas = schemas or {}
    checked = set()

    def ensure_checked(doc, where):
        if id(doc) not in checked:
            _check_keywords(doc, where)
            checked.add(id(doc))

    ensure_checked(schema, "#")

    def resolve(ref, root):
        file, _, frag = ref.partition("#")
        doc = root if file == "" else schemas.get(file)
        if doc is None:
            raise ValueError(f'schema: $ref to unknown schema "{file}"')
        ensure_checked(doc, file or "#")
        if frag == "":
            return doc, doc
        m = re.fullmatch(r"/\$defs/([^/]+)", frag)
        if not m or m.group(1) not in doc.get("$defs", {}):
            raise ValueError(f'schema: cannot resolve $ref "{ref}"')
        return doc["$defs"][m.group(1)], doc

    errors = []

    def walk(s, value, path, root, depth):
        if s is True:
            return
        at = _pointer(path)
        if s is False:
            errors.append(f"{at}: no value is allowed here")
            return
        if "$ref" in s:
            if depth > MAX_REF_DEPTH:
                raise ValueError(f'schema: $ref chain deeper than {MAX_REF_DEPTH} at "{s["$ref"]}"')
            target, nxt = resolve(s["$ref"], root)
            walk(target, value, path, nxt, depth + 1)
        if "type" in s:
            types = s["type"] if isinstance(s["type"], list) else [s["type"]]
            if not any(_has_type(value, t) for t in types):
                errors.append(f"{at}: expected {' or '.join(types)}, got {type_of(value)}")
                return
        if "enum" in s and not any(_equal(e, value) for e in s["enum"]):
            errors.append(f"{at}: not one of {_stringify(s['enum'])}")
        if "const" in s and not _equal(s["const"], value):
            errors.append(f"{at}: must equal {_stringify(s['const'])}")

        t = type_of(value)
        if t == "string":
            if "pattern" in s and not re.search(s["pattern"], value, re.ASCII):
                errors.append(f"{at}: does not match {s['pattern']}")
            if "minLength" in s and len(value) < s["minLength"]:
                errors.append(f"{at}: shorter than {s['minLength']}")
        elif t == "number":
            if "minimum" in s and value < s["minimum"]:
                errors.append(f"{at}: below the minimum {_stringify(s['minimum'])}")
            if "maximum" in s and value > s["maximum"]:
                errors.append(f"{at}: above the maximum {_stringify(s['maximum'])}")
        elif t == "array":
            if "minItems" in s and len(value) < s["minItems"]:
                errors.append(f"{at}: fewer than {s['minItems']} items")
            if "items" in s:
                for i, v in enumerate(value):
                    walk(s["items"], v, [*path, i], root, depth)
        elif t == "object":
            for key in s.get("required", []):
                if key not in value:
                    errors.append(f'{at}: missing required property "{key}"')
            props = s.get("properties", {})
            for key, v in value.items():
                if key in props:
                    walk(props[key], v, [*path, key], root, depth)
                elif s.get("additionalProperties") is False:
                    errors.append(f'{at}: unexpected property "{key}"')
                elif "additionalProperties" in s:
                    walk(s["additionalProperties"], v, [*path, key], root, depth)

    walk(schema, data, [], schema, 0)
    return errors
