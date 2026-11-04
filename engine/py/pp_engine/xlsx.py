"""Excel workbook reader over bytes (the caller reads the file).

Ported from Thirty Day Readmissions (pipeline/hrrp/parse.py at 33d1959: `_xlsx_part`, `_col_index`, `_xlsx_rows`),
taking the workbook's bytes instead of a path and raising SchemaError. Standard library only (zipfile + ElementTree).
"""
import io
import xml.etree.ElementTree as ET
import zipfile

from pp_engine.parse import SchemaError

_XL = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
_XL_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
XLSX_MAX_PART = 100_000_000  # bytes; a larger XML part is refused rather than inflated
XLSX_MAX_MEMBERS = 1000  # a workbook has a few dozen parts; far more is not a workbook


def _part(zf, name, label):
    """One parsed XML part of a workbook. Refuses DTDs (the standard library parser expands entities) and huge parts."""
    try:
        info = zf.getinfo(name)
    except KeyError:
        raise SchemaError(f"{label}: workbook has no part {name}") from None
    if info.file_size > XLSX_MAX_PART:
        raise SchemaError(f"{label}: part {name} is {info.file_size:,} bytes")
    data = zf.read(info)
    if b"<!DOCTYPE" in data or b"<!ENTITY" in data:
        raise SchemaError(f"{label}: part {name} declares a DTD")
    try:
        return ET.fromstring(data)
    except ET.ParseError as e:
        raise SchemaError(f"{label}: part {name} is not valid XML ({e})") from None


def _col_index(ref):
    """0-based column of a cell reference: 'A12' -> 0, 'AB3' -> 27."""
    n = 0
    for ch in ref:
        if not "A" <= ch <= "Z":
            break
        n = n * 26 + ord(ch) - 64
    return n - 1


def sheet_rows(data, sheet, label):
    """Rows (lists of strings) of worksheet `sheet` in the .xlsx workbook `data` (bytes); `label` names it in errors.

    Shared and inline strings are resolved; a numeric cell keeps its stored text, which Excel writes at full
    double precision ('0.18243374902572096'); a skipped cell is ''.
    """
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise SchemaError(f"{label}: not a zip/xlsx file") from None
    with zf:
        count = len(zf.infolist())
        if count > XLSX_MAX_MEMBERS:
            raise SchemaError(f"{label}: workbook has {count:,} members")
        rids = {s.get("name"): s.get(_XL_REL) for s in _part(zf, "xl/workbook.xml", label).iter(_XL + "sheet")}
        if sheet not in rids:
            raise SchemaError(f"{label}: no worksheet named {sheet!r} (found {sorted(rids)})")
        rels = {r.get("Id"): r for r in _part(zf, "xl/_rels/workbook.xml.rels", label)}
        if rids[sheet] not in rels:
            raise SchemaError(f"{label}: worksheet {sheet!r} has no relationship entry")

        def part(r):
            return "xl/" + _strip(r.get("Target"))

        shared = []
        for r in rels.values():
            if r.get("Type", "").endswith("/sharedStrings"):
                shared = ["".join(t.text or "" for t in si.findall(_XL + "t") + si.findall(f"{_XL}r/{_XL}t"))
                          for si in _part(zf, part(r), label).iter(_XL + "si")]
        rows = []
        for row in _part(zf, part(rels[rids[sheet]]), label).iter(_XL + "row"):
            out = []
            for c in row.iter(_XL + "c"):
                j = _col_index(c.get("r")) if c.get("r") else len(out)
                if j < len(out):
                    raise SchemaError(f"{label}: cell {c.get('r')} out of order")
                kind, v = c.get("t"), c.find(_XL + "v")
                if kind == "inlineStr":
                    val = "".join(t.text or "" for t in c.iter(_XL + "t"))
                else:
                    val = "" if v is None or v.text is None else v.text
                    if kind == "s":
                        val = shared[int(val)]
                out += [""] * (j - len(out)) + [val]
            rows.append(out)
        return rows


def _strip(target):
    return target[len("/xl/"):] if target.startswith("/xl/") else target
