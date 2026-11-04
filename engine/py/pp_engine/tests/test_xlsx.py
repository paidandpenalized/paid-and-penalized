"""The Excel workbook reader, on synthetic workbooks built here (no hospital names, no pinned files)."""
import io
import unittest
import zipfile
from xml.sax.saxutils import escape

from pp_engine import xlsx
from pp_engine.parse import SchemaError

MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG = "http://schemas.openxmlformats.org/package/2006/relationships"


def _ref(j, r):
    return (chr(64 + j // 26) if j >= 26 else "") + chr(65 + j % 26) + str(r)


def make_xlsx(sheets, doctype="", sheet_xml=None):
    """A minimal workbook's bytes: text cells as shared strings, numeric text as numbers, empty cells skipped.
    `sheet_xml` replaces the generated <sheetData> body of every sheet."""
    shared, books, rels = [], [], []
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for i, (name, rows) in enumerate(sheets.items(), 1):
            xml_rows = []
            for r, row in enumerate(rows, 1):
                cells = []
                for j, v in enumerate(row):
                    if not v:
                        continue
                    try:
                        float(v)
                        cells.append(f'<c r="{_ref(j, r)}"><v>{v}</v></c>')
                    except ValueError:
                        shared.append(v)
                        cells.append(f'<c r="{_ref(j, r)}" t="s"><v>{len(shared) - 1}</v></c>')
                xml_rows.append(f'<row r="{r}">{"".join(cells)}</row>')
            body = sheet_xml or "".join(xml_rows)
            zf.writestr(f"xl/worksheets/sheet{i}.xml",
                        f'{doctype}<worksheet xmlns="{MAIN}"><sheetData>{body}</sheetData></worksheet>')
            books.append(f'<sheet name="{escape(name)}" sheetId="{i}" r:id="rId{i}"/>')
            rels.append(f'<Relationship Id="rId{i}" Type="{REL}/worksheet" Target="/xl/worksheets/sheet{i}.xml"/>')
        rels.append(f'<Relationship Id="rIdS" Type="{REL}/sharedStrings" Target="sharedStrings.xml"/>')
        zf.writestr("xl/workbook.xml",
                    f'<workbook xmlns="{MAIN}" xmlns:r="{REL}"><sheets>{"".join(books)}</sheets></workbook>')
        zf.writestr("xl/_rels/workbook.xml.rels", f'<Relationships xmlns="{PKG}">{"".join(rels)}</Relationships>')
        zf.writestr("xl/sharedStrings.xml",
                    f'<sst xmlns="{MAIN}">{"".join(f"<si><t>{escape(t)}</t></si>" for t in shared)}</sst>')
    return buf.getvalue()


class SheetRowsTest(unittest.TestCase):
    def test_reads_shared_inline_and_numeric_cells(self):
        wb = make_xlsx({"S": [["a", "", "0.18243374902572096"]]})
        self.assertEqual(xlsx.sheet_rows(wb, "S", "w"), [["a", "", "0.18243374902572096"]])
        wb = make_xlsx({"S": []}, sheet_xml='<row r="1"><c r="B1" t="inlineStr"><is><t>hi</t></is></c>'
                                            '<c r="AB1"><v>7</v></c></row>')
        row = xlsx.sheet_rows(wb, "S", "w")[0]
        self.assertEqual((len(row), row[1], row[27]), (28, "hi", "7"))

    def test_skipped_cells_are_blank(self):
        wb = make_xlsx({"S": [["", "b"], ["a"]]})
        self.assertEqual(xlsx.sheet_rows(wb, "S", "w"), [["", "b"], ["a"]])

    def test_picks_the_named_sheet(self):
        wb = make_xlsx({"Notes": [["x"]], "Data": [["y"]]})
        self.assertEqual(xlsx.sheet_rows(wb, "Data", "w"), [["y"]])

    def test_refuses_a_dtd(self):
        wb = make_xlsx({"S": [["a"]]}, doctype='<!DOCTYPE x [<!ENTITY a "aaaa">]>')
        with self.assertRaisesRegex(SchemaError, "DTD"):
            xlsx.sheet_rows(wb, "S", "w")

    def test_refuses_a_missing_sheet(self):
        wb = make_xlsx({"S": [["a"]]})
        with self.assertRaisesRegex(SchemaError, "no worksheet named 'T'"):
            xlsx.sheet_rows(wb, "T", "w")

    def test_refuses_cells_out_of_order(self):
        wb = make_xlsx({"S": []}, sheet_xml='<row r="1"><c r="C1"><v>1</v></c><c r="A1"><v>2</v></c></row>')
        with self.assertRaisesRegex(SchemaError, "out of order"):
            xlsx.sheet_rows(wb, "S", "w")

    def test_refuses_a_utf16_part_with_a_dtd(self):
        wb = make_xlsx({"S": [["a"]]})
        src = zipfile.ZipFile(io.BytesIO(wb))
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as out:
            for n in src.namelist():
                data = src.read(n)
                if n == "xl/worksheets/sheet1.xml":
                    data = ('<!DOCTYPE x [<!ENTITY a "aaaa">]>' + data.decode()).encode("utf-16")
                out.writestr(n, data)
        with self.assertRaisesRegex(SchemaError, "not UTF-8"):
            xlsx.sheet_rows(buf.getvalue(), "S", "w")

    def test_refuses_a_declared_non_utf8_encoding(self):
        wb = make_xlsx({"S": [["a"]]}, doctype='<?xml version="1.0" encoding="UTF-16"?>')
        with self.assertRaisesRegex(SchemaError, "not UTF-8"):
            xlsx.sheet_rows(wb, "S", "w")

    def test_refuses_an_escaping_member_name(self):
        wb = make_xlsx({"S": [["a"]]})
        buf = io.BytesIO(wb)
        with zipfile.ZipFile(buf, "a") as zf:
            zf.writestr("../x", "x")
        with self.assertRaisesRegex(SchemaError, "unsafe zip member"):
            xlsx.sheet_rows(buf.getvalue(), "S", "w")

    def test_bad_shared_string_index_is_a_schema_error(self):
        for v in ("99", "x"):
            wb = make_xlsx({"S": []}, sheet_xml=f'<row r="1"><c r="A1" t="s"><v>{v}</v></c></row>')
            with self.assertRaisesRegex(SchemaError, "shared-string"):
                xlsx.sheet_rows(wb, "S", "w")

    def test_not_a_workbook_is_a_schema_error(self):
        with self.assertRaises(SchemaError):
            xlsx.sheet_rows(b"not a zip", "S", "w")


if __name__ == "__main__":
    unittest.main()
