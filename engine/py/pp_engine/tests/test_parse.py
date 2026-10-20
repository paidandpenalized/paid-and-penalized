"""CMS table readers, on synthetic files (invented names, synthetic CCNs)."""
import unittest

from pp_engine.parse import SchemaError, impact_fy, num, read_hgi, read_impact, read_pos, rows, table, zip5

HGI_HEADER = ('"Facility ID","Facility Name","Address","City/Town","State","ZIP Code","County/Parish",'
              '"Hospital Type","Hospital Ownership","Hospital overall rating"\n')
IMPACT_HEADER = "Provider Number\tName\tFY 2027 Wage Index\tURGEO\tResident to Bed Ratio\tBeds\tOwnership Control Type\tProvider Type\tMDH Flag\n"
POS_HEADER = "PRVDR_NUM,PRVDR_CTGRY_SBTYP_CD,FAC_NAME,ST_ADR,CITY_NAME,STATE_CD,ZIP_CD,CRTFD_BED_CNT,PGM_TRMNTN_CD,TRMNTN_EXPRTN_DT\n"


class Helpers(unittest.TestCase):
    def test_num(self):
        self.assertEqual(num('"1,110"'), 1110.0)
        self.assertEqual(num("0.04%"), 0.04)
        self.assertIsNone(num("."))
        self.assertIsNone(num("Too few to report"))
        self.assertIsNone(num(None))

    def test_zip5(self):
        self.assertEqual(zip5("2124"), "02124")
        self.assertEqual(zip5("021241234"), "02124")
        self.assertEqual(zip5(""), "")

    def test_header_found_by_first_cell(self):
        text = "a title line\n\nID,Value\n000001,x\nFootnote: something\n"
        recs = table(rows(text, ","), "id", {"ccn": "ID", "v": " value "}, "f")
        self.assertEqual(recs, [{"ccn": "000001", "v": "x"}, {"ccn": "Footnote: something", "v": ""}])

    def test_missing_column_or_header_raises(self):
        with self.assertRaisesRegex(SchemaError, "'Other'"):
            table(rows("ID,Value\n", ","), "ID", {"x": "Other"}, "f")
        with self.assertRaisesRegex(SchemaError, "header row"):
            table(rows("X,Value\n", ","), "ID", {"x": "Value"}, "f")


class Hgi(unittest.TestCase):
    def test_reads_rows_by_ccn_as_text(self):
        text = "\ufeff" + HGI_HEADER + ('00001F,INVENTED GENERAL HOSPITAL,"1 MAIN  ST",SPRINGFIELD,ZZ,1234,X,'
                                        'Acute Care Hospitals,Government - State,4\n'
                                        'Footnote row,,,,,,,,,\n')
        hgi = read_hgi(text)
        self.assertEqual(list(hgi), ["00001F"])
        self.assertEqual(hgi["00001F"], {"name": "INVENTED GENERAL HOSPITAL", "street": "1 MAIN ST", "city": "SPRINGFIELD",
                                         "state": "ZZ", "zip": "01234", "type": "Acute Care Hospitals",
                                         "ownership": "Government - State"})

    def test_malformed_and_duplicate_ccns_raise(self):
        with self.assertRaisesRegex(SchemaError, "malformed CCN '10001'"):
            read_hgi(HGI_HEADER + "10001,A,B,C,ZZ,1,X,T,O,1\n")
        with self.assertRaisesRegex(SchemaError, "duplicate CCN 990001"):
            read_hgi(HGI_HEADER + "990001,A,B,C,ZZ,1,X,T,O,1\n990001,A,B,C,ZZ,1,X,T,O,1\n")


class Impact(unittest.TestCase):
    def test_reads_rows_and_fy(self):
        text = "Title\n" + IMPACT_HEADER + "990001\tInvented Hospital\t1.0\tLURBAN\t0.3\t120\t3\t16\tN\n"
        self.assertEqual(impact_fy(text), 2027)
        self.assertEqual(read_impact(text)["990001"], {"name": "Invented Hospital", "urgeo": "LURBAN", "irb": 0.3, "beds": 120,
                                                       "own": "3", "ptype": 16, "mdh": False})

    def test_fy_needs_exactly_one_year(self):
        for header in ("Provider Number\tName\n", "Provider Number\tFY 2026 Wage Index\tFY 2027 Wage Index\n"):
            with self.assertRaises(SchemaError):
                impact_fy(header)


class Pos(unittest.TestCase):
    def test_reads_rows(self):
        pos = read_pos(POS_HEADER + "990001,01,INVENTED HOSPITAL,1 MAIN ST,SPRINGFIELD,ZZ,1234,0,01,20250313\n"
                       + "990002,11,INVENTED CAH,2 MAIN ST,SPRINGFIELD,ZZ,1234,25,00,\n")
        self.assertEqual(pos["990001"]["beds"], None)
        self.assertEqual((pos["990001"]["term"], pos["990001"]["termDate"]), ("01", "2025-03-13"))
        self.assertEqual((pos["990002"]["beds"], pos["990002"]["termDate"]), (25, None))

    def test_unknown_code_or_bad_date_raises(self):
        with self.assertRaisesRegex(SchemaError, "termination code '99'"):
            read_pos(POS_HEADER + "990001,01,A,B,C,ZZ,1,1,99,\n")
        with self.assertRaisesRegex(SchemaError, "termination date"):
            read_pos(POS_HEADER + "990001,01,A,B,C,ZZ,1,1,01,2025-03-13\n")


if __name__ == "__main__":
    unittest.main()
