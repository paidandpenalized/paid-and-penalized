"""CMS table readers, on synthetic files (invented names, synthetic CCNs)."""
import unittest

from pp_engine.parse import (CONDITIONS, SUPP_LABELS, SchemaError, impact_fy, num, read_cbsa_names, read_hgi,
                              read_impact, read_points, read_pos, read_supplemental, read_table15, read_zcta, rows,
                              table, zip5)

HGI_HEADER = ('"Facility ID","Facility Name","Address","City/Town","State","ZIP Code","County/Parish",'
              '"Hospital Type","Hospital Ownership","Hospital overall rating"\n')
IMPACT_HEADER = "Provider Number\tName\tGeographic Labor Market Area\tFIPS County Code\tFY 2027 Wage Index\tURGEO\tResident to Bed Ratio\tBeds\tOwnership Control Type\tProvider Type\tMDH Flag\n"
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

    def test_a_starred_column_matches_any_header_ending_in_the_rest(self):
        text = "FIPS County Code\tFY 2025 CBSA Name\tFY 2025 CBSA\n01001\tx\t33860\n"
        self.assertEqual(table(rows(text, "\t"), "FIPS County Code", {"code": "*cbsa", "name": "*cbsa name"}, "f"),
                         [{"code": "33860", "name": "x"}])
        with self.assertRaisesRegex(SchemaError, "'\\*metro', found 0"):
            table(rows(text, "\t"), "FIPS County Code", {"x": "*metro"}, "f")
        two_years = "FIPS County Code\tFY 2025 CBSA\tFY 2026 CBSA\n"
        with self.assertRaisesRegex(SchemaError, "found 2"):  # never silently the older year
            table(rows(two_years, "\t"), "FIPS County Code", {"code": "*cbsa"}, "f")

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
                                         "state": "ZZ", "zip": "01234", "county": "X",
                                         "type": "Acute Care Hospitals", "ownership": "Government - State"})

    def test_malformed_and_duplicate_ccns_raise(self):
        with self.assertRaisesRegex(SchemaError, "malformed CCN '10001'"):
            read_hgi(HGI_HEADER + "10001,A,B,C,ZZ,1,X,T,O,1\n")
        with self.assertRaisesRegex(SchemaError, "duplicate CCN 990001"):
            read_hgi(HGI_HEADER + "990001,A,B,C,ZZ,1,X,T,O,1\n990001,A,B,C,ZZ,1,X,T,O,1\n")


class Impact(unittest.TestCase):
    def test_a_blank_fips_is_none(self):
        text = IMPACT_HEADER + "990001\tInvented Hospital\t\t\t1.0\tLURBAN\t0\t10\t3\t1\tN\n"
        self.assertEqual((read_impact(text)["990001"]["fips"], read_impact(text)["990001"]["cbsa_geo"]), (None, ""))

    def test_reads_rows_and_fy(self):
        text = "Title\n" + IMPACT_HEADER + "990001\tInvented Hospital\t99999\t1001\t1.0\tLURBAN\t0.3\t120\t3\t16\tN\n"
        self.assertEqual(impact_fy(text), 2027)
        self.assertEqual(read_impact(text)["990001"], {"name": "Invented Hospital", "urgeo": "LURBAN", "irb": 0.3, "beds": 120,
                                                       "own": "3", "ptype": 16, "mdh": False, "fips": "01001",
                                                       "cbsa_geo": "99999"})

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


class GeoFiles(unittest.TestCase):
    def test_zcta_centroids(self):
        text = ("GEOID\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG                                  \n"
                "00601\t1\t2\t3\t4\t18.180555\t     -66.749961\n99999\t1\t2\t3\t4\t-1.5\t2.25\n")
        self.assertEqual(read_zcta(text), {"00601": (18.180555, -66.749961), "99999": (-1.5, 2.25)})
        with self.assertRaises(SchemaError):
            read_zcta(text.replace("-1.5", "nan"))

    def test_cbsa_names(self):
        text = ("FY 2027 FR Crosswalk\t\t\t\t\r\nFIPS County Code\tCounty Name\tState\tFY 2025 CBSA \tFY 2025 CBSA Name \r\n"
                '01001\tAUTAUGA\tAL\t99901\t"Invented, AL"\r\n01003\tX\tAL\t99901\t"Invented, AL"\r\n'
                "01005\tY\tAL\t01\t\r\n")
        self.assertEqual(read_cbsa_names(text), {"99901": "Invented, AL"})  # a rural code with no name is left out


class Points(unittest.TestCase):
    HEADER = "ccn,lat,lon,match,source\n"

    def test_reads_points_by_ccn(self):
        self.assertEqual(read_points(self.HEADER + "990001,31.21566,-85.36145,Exact,hgi\n00001F,1,2,Non_Exact,pos\n"),
                         {"990001": (31.21566, -85.36145), "00001F": (1.0, 2.0)})

    def test_bad_rows_raise(self):
        for row in ("990001,x,2,Exact,hgi", "990001,1,2,Exact,hgi\n990001,1,2,Exact,hgi", "99001,1,2,Exact,hgi",
                    "990001,nan,2,Exact,hgi", "990001,1,inf,Exact,hgi", "AB0001,1,2,Exact,hgi", "990001,91,2,Exact,hgi", "990001,1,181,Exact,hgi"):
            with self.assertRaises(SchemaError, msg=row):
                read_points(self.HEADER + row + "\n")
        with self.assertRaises(SchemaError):
            read_points("id,lat,lon\n990001,1,2\n")


def supp_header(extra=()):
    head = ["Hospital CCN", "Payment adjustment factor", "Dual proportion", "Peer group assignment",
            "Neutrality modifier"]
    for label in SUPP_LABELS.values():
        head += [f"Number of eligible discharges for {label}", f"ERR for {label}",
                 f"Peer group median ERR for {label}", f"Penalty indicator for {label}",
                 f"DRG payment ratio for {label}"]
    return head + list(extra)


def supp_row(ccn, flag="N", n="100", err="0.9", rounded=False):
    paf = "0.9876" if rounded else "0.98765432109876"
    row = [ccn, paf, "0.2", "3", "1.01"]
    for _ in SUPP_LABELS:
        row += [n, err, "1", flag, "0.04"]
    return row


class Supplemental(unittest.TestCase):
    def test_conditions_follow_the_labels(self):
        self.assertEqual(CONDITIONS, ("AMI", "COPD", "HF", "PN", "CABG", "THA_TKA"))

    def test_supplemental_full_precision_and_export_agree_on_shape(self):
        full = [["Title line"], supp_header(), supp_row("990001", rounded=False), ["Footnote text"]]
        export_text = "\n".join("\t".join(r) for r in [["Title line"], supp_header(),
                                                       supp_row("990001", rounded=True), ["Footnote text"]]) + "\n"
        a = read_supplemental(full, "w")
        b = read_supplemental(rows(export_text, "\t"), "e")
        self.assertEqual(set(a), {"990001"})
        self.assertEqual(set(a), set(b))
        self.assertEqual(set(a["990001"]), {"paf", "dual", "peer", "nm", "c"})
        self.assertEqual(a["990001"]["paf"], 0.98765432109876)
        self.assertEqual(b["990001"]["paf"], 0.9876)
        self.assertEqual(list(a["990001"]["c"]), list(CONDITIONS))
        self.assertEqual(set(a["990001"]["c"]["HF"]), {"n", "err", "med", "flag", "ratio"})
        self.assertEqual(a["990001"]["c"]["PN"], {"n": 100, "err": 0.9, "med": 1.0, "flag": 0, "ratio": 0.04})

    def test_supplemental_flag_and_missing_values(self):
        r = supp_row("990001", flag="Y", n=".", err=".")
        c = read_supplemental([supp_header(), r], "w")["990001"]["c"]["AMI"]
        self.assertEqual((c["flag"], c["n"], c["err"]), (1, None, None))
        r = supp_row("990002", flag="N")
        self.assertEqual(read_supplemental([supp_header(), r], "w")["990002"]["c"]["AMI"]["flag"], 0)

    def test_supplemental_duplicate_column_raises(self):
        with self.assertRaisesRegex(SchemaError, "found 2"):
            read_supplemental([supp_header(["Dual proportion"]), supp_row("990001") + ["0.1"]], "w")

    def test_supplemental_missing_column_raises(self):
        head = [h for h in supp_header() if h != "Neutrality modifier"]
        with self.assertRaises(SchemaError):
            read_supplemental([head], "w")


class Table15(unittest.TestCase):
    TEXT = ("Hospital CMS Certification Number (CCN)\tFY 2027 Payment Adjustment Factor\n"
            "990001\t0.9951\n990002\t1.0000\nFootnote\t\n")

    def test_table15_reads_the_fy_column(self):
        self.assertEqual(read_table15(self.TEXT, 2027), {"990001": 0.9951, "990002": 1.0})

    def test_table15_duplicate_column_raises(self):
        text = self.TEXT.replace("0.9951", "0.9951\t1").replace("\n", "\t\n", 1)
        text = text.replace("Factor\t\n", "Factor\tFY 2027 Payment Adjustment Factor\n")
        with self.assertRaisesRegex(SchemaError, "found 2"):
            read_table15(text, 2027)

    def test_table15_wrong_fy_raises(self):
        with self.assertRaises(SchemaError):
            read_table15(self.TEXT, 2026)


if __name__ == "__main__":
    unittest.main()
