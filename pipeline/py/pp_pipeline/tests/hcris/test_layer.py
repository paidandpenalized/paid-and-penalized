"""The HCRIS layer's pipeline (pins, emit, PUF check, archive plan) on a synthetic zip and manifest. Invented CCNs and
report numbers only."""
import contextlib
import csv
import hashlib
import io
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from pp_engine.contract import format_emitted
from pp_engine.hcris import cells, other_income, tidy
from pp_engine.schema import validate
from pp_engine.tests.hcris.test_tidy import cell, report
from pp_pipeline.files import load_schemas
from pp_pipeline.hcris import archive, emit, pins, puf
from pp_pipeline.tests.hcris.test_extract import write_zip

REPORTS = [report("7", "990001", status="3"), report("8", "991300", status="1"),
           report("9", "994001"),  # a psychiatric hospital: outside the layer's scope
           report("10", "990002", "10/01/2023", "06/30/2024"), report("11", "990002", "07/01/2024", "06/30/2025")]
NUMBERS = [cell("7", "net_income", "125"), cell("7", "net_patient_revenue", "2000"), cell("7", "other_income", "500"),
           cell("7", "uncompensated_cost", "40.5"), cell("8", "beds", "12"), cell("9", "beds", "80"),
           cell("10", "net_income", "90"), cell("11", "net_income", "100"),
           # G-3 line 24 and its subscripts: amounts in the numeric file, labels in the alphanumeric one
           ["7", cells.G3, "02400", "00100", "300"], ["7", cells.G3, "02401", "00100", "200"],
           ["7", cells.G3, "02402", "00100", "50"], ["9", cells.G3, "02401", "00100", "70"]]
ALPHA = [["7", cells.G3, "02400", "00000", "PHYSICIAN PRACTICE INCOME"], ["7", cells.G3, "02401", "00000",
                                                                         "INVESTMENT INCOME, NET"],
         ["7", cells.G3, "02403", "00000", "GRANTS"],  # a label with no amount: zero, not pinned
         ["9", cells.G3, "02401", "00000", "PHARMACY"],  # outside the scope
         ["7", cells.S3, "00100", "00000", "ADULTS"]]  # another worksheet


def synthetic_pin(tmp, year=2024):
    """(zip, {pin id: bytes}, {pin id: manifest entry}) for the synthetic zip."""
    z = Path(tmp) / f"HOSP10FY{year}.ZIP"
    write_zip(z, year, REPORTS, NUMBERS, ALPHA)
    year, tables, source = pins.derive(z)
    entries = {pid: pins.new_entry(year, data, source, "2026-10-05", "2026-11-04",
                                   line24=pid == pins.line24_pin_id(year)) for pid, data in tables.items()}
    return z, tables, entries


class Pins(unittest.TestCase):
    def test_derive_keeps_the_scope_and_records_the_zip(self):
        with tempfile.TemporaryDirectory() as tmp:
            z, tables, entries = synthetic_pin(tmp)
            zip_sha = hashlib.sha256(z.read_bytes()).hexdigest()
        data, entry = tables["hcris-fy2024-cells"], entries["hcris-fy2024-cells"]
        rows = list(csv.reader(io.StringIO(data.decode("ascii"))))
        self.assertEqual(rows[0], list(tidy.PIN_COLUMNS))
        self.assertEqual([r[1] for r in rows[1:]], ["990001", "991300", "990002", "990002"])  # by report number
        self.assertEqual((entry["id"], entry["path"]), ("hcris-fy2024-cells", "hcris-fy2024/hcris_fy2024_cells.csv"))
        self.assertEqual((entry["bytes"], entry["sha256"]), (len(data), hashlib.sha256(data).hexdigest()))
        src = entry["derivedFrom"]
        self.assertEqual((src["sha256"], src["archive"], src["lastModified"]),
                         (zip_sha, f"r2://pp-sources/sha256/{zip_sha}", "2026-10-05"))
        self.assertEqual(src["downloadUrl"], "https://downloads.cms.gov/FILES/HCRIS/HOSP10FY2024.ZIP")
        self.assertEqual(src["members"], ["HOSP10_2024_rpt.csv", "HOSP10_2024_nmrc.csv"])

    def test_the_line_24_table(self):
        with tempfile.TemporaryDirectory() as tmp:
            _, tables, entries = synthetic_pin(tmp)
        entry = entries["hcris-fy2024-g3-line24"]
        self.assertEqual(entry["path"], "hcris-fy2024/hcris_fy2024_g3_line24.csv")
        self.assertEqual(entry["derivedFrom"]["members"][-1], "HOSP10_2024_alpha.csv")
        rows = list(csv.reader(io.StringIO(tables["hcris-fy2024-g3-line24"].decode("ascii"))))
        self.assertEqual(rows, [other_income.PIN_COLUMNS, ["7", "02400", "PHYSICIAN PRACTICE INCOME", "300"],
                                ["7", "02401", "INVESTMENT INCOME, NET", "200"],
                                ["7", "02402", "", "50"]])  # an amount with no label; report 9 is out of scope

    def test_a_second_label_for_one_line_stops_the_pin(self):
        scoped = {"7": None}
        row = ["7", cells.G3, "02401", "00000", "GRANTS"]
        self.assertEqual(pins.labels([row], scoped), {("7", "02401"): "GRANTS"})
        with self.assertRaises(tidy.HcrisError):
            pins.labels([row, [*row[:4], "PHARMACY"]], scoped)

    def test_the_same_zip_gives_the_same_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            a = synthetic_pin(tmp)[1]
            b = synthetic_pin(tmp)[1]
        self.assertEqual(len(a), 2)
        self.assertEqual(a, b)

    def test_pin_refuses_a_zip_the_manifest_does_not_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            z, _, entries = synthetic_pin(tmp)
            entry = entries["hcris-fy2024-cells"]
            other = {**entry, "derivedFrom": {**entry["derivedFrom"], "sha256": "0" * 64}}
            out = io.StringIO()
            with mock.patch.object(pins, "read_manifest", return_value=[other]), contextlib.redirect_stdout(out):
                self.assertEqual(pins.main([str(z)]), 1)
            self.assertIn("not the zip", out.getvalue())
            with mock.patch.object(pins, "read_manifest", return_value=[]), contextlib.redirect_stdout(out):
                self.assertEqual(pins.main([str(z)]), 1)
            self.assertIn("no manifest entry", out.getvalue())
            with contextlib.redirect_stdout(out):
                self.assertEqual(pins.main([]), 2)


class Emit(unittest.TestCase):
    def build(self):
        with tempfile.TemporaryDirectory() as tmp:
            _, tables, entries = synthetic_pin(tmp)
        with mock.patch.object(emit, "read_pinned_bytes", side_effect=tables.__getitem__):
            return emit.build(2024, list(entries.values()), "2026-11-05T00:00:00Z"), entries

    def test_the_file_passes_its_schema_and_its_checks(self):
        doc, entries = self.build()
        schemas = load_schemas()
        self.assertEqual(validate(schemas[emit.SCHEMA], doc, schemas), [])
        self.assertEqual(emit.check(doc), [])
        self.assertEqual(doc["sources"], list(entries))
        self.assertEqual(doc["otherIncomeRules"]["path"], "pipeline/py/pp_pipeline/hcris/other_income_rules.csv")
        self.assertEqual(doc["otherIncomeRules"]["sha256"], hashlib.sha256(emit.rules_bytes()).hexdigest())
        self.assertEqual((doc["fy"], doc["label"], doc["periodsBegin"]),
                         (2024, "cost reports beginning in FY2024", ["2023-10-01", "2024-09-30"]))
        self.assertEqual((doc["posted"], doc["filingDueBy"], doc["stillFiling"]), ("2026-10-05", "2026-02-26", False))

    def test_rows(self):
        doc, _ = self.build()
        rows = {r[0]: dict(zip(doc["columns"], r)) for r in doc["hospitals"]}
        self.assertEqual(sorted(rows), ["990001", "990002", "991300"])
        a = rows["990001"]
        self.assertEqual((a["kind"], a["status"], a["status_label"], a["net_income"], a["uncompensated_cost"],
                          a["total_margin"], a["beds"]), ("acute", "3", "settled", 125, 40.5, 0.05, None))
        self.assertEqual((rows["991300"]["kind"], rows["991300"]["status_label"]), ("critical_access", "as filed"))
        self.assertEqual((a["line24_operating"], a["line24_non_operating"], a["line24_unclassified"],
                          a["other_operating_income"], a["income_other_specified"]), (300, 200, 50, 300, 300))
        b = rows["990002"]
        self.assertEqual((b["shape"], b["basis"], b["net_income"], b["period_days"]), ("long", "fullest", 100, 365))
        self.assertEqual((doc["settledShare"], doc["early"]), (0.6667, True))  # 2 of 3 settled

    def test_check_finds_what_the_schema_cannot(self):
        doc, _ = self.build()
        bad = {**doc, "hospitals": doc["hospitals"] + [doc["hospitals"][0], doc["hospitals"][1][:-1]]}
        self.assertEqual(len(emit.check(bad)), 3)  # two repeated CCNs, one short row
        kind = doc["columns"].index("kind")
        out_of_scope = [[*doc["hospitals"][0][:kind], "psychiatric", *doc["hospitals"][0][kind + 1:]]]
        self.assertIn("outside", emit.check({**doc, "hospitals": out_of_scope})[0])
        with mock.patch.object(emit, "MAX_BYTES", len(format_emitted(doc).encode())):
            self.assertIn("10 MiB", emit.check(doc)[-1])

    def test_the_schema_pins_the_columns(self):
        doc, _ = self.build()
        schemas = load_schemas()
        self.assertNotEqual(validate(schemas[emit.SCHEMA], {**doc, "columns": doc["columns"][::-1]}, schemas), [])
        self.assertNotEqual(validate(schemas[emit.SCHEMA], {**doc, "hospitals": [doc["hospitals"][0][:5]]}, schemas),
                            [])

    def run_main(self, tmp, write=None):
        """emit.main over a manifest of FY2023 (a pin that fails its manifest entry) and the synthetic FY2024, writing
        under `tmp`. (exit code, printed text, root)."""
        _, tables, entries = synthetic_pin(tmp)
        stale = [{**e, "id": e["id"].replace("2024", "2023")} for e in entries.values()]
        manifest = stale + list(entries.values())

        def read(pid):
            if pid not in tables:
                raise ValueError(f"pinned input {pid} does not match its manifest entry")
            return tables[pid]

        root = Path(tmp) / "repo"  # a stand-in repo: paths print relative to it, and the rules file is in it
        rules_path = root / emit.RULES_PATH.relative_to(emit.REPO_ROOT)
        rules_path.parent.mkdir(parents=True)
        rules_path.write_bytes(emit.RULES_PATH.read_bytes())
        out = io.StringIO()
        with mock.patch.object(emit, "read_manifest", return_value=manifest), \
                mock.patch.object(emit, "read_pinned_bytes", side_effect=read), \
                mock.patch.object(emit, "REPO_ROOT", root), mock.patch.object(emit, "RULES_PATH", rules_path), \
                mock.patch.object(emit, "EMITTED_DIR", root / "data" / "emitted"), \
                mock.patch.object(emit, "write_emitted", side_effect=write or emit.write_emitted), \
                contextlib.redirect_stdout(out):
            code = emit.main()
        return code, out.getvalue(), root

    def test_main_reports_a_failing_year_and_writes_the_rest(self):
        with tempfile.TemporaryDirectory() as tmp:
            code, printed, root = self.run_main(tmp)
            self.assertEqual(code, 1)
            self.assertIn("not written (data/emitted/hcris/fy2023/hcris.json left as it was): pinned input", printed)
            self.assertIn("wrote data/emitted/hcris/fy2024/hcris.json", printed)  # the bad year stops nothing after it
            self.assertIn("1 of 2 years not written: FY2023", printed)
            self.assertFalse((root / "data/emitted/hcris/fy2023/hcris.json").exists())
            self.assertTrue((root / "data/emitted/hcris/fy2024/hcris.json").exists())

    def test_main_reports_a_schema_failure(self):
        real = emit.write_emitted
        with tempfile.TemporaryDirectory() as tmp:
            code, printed, root = self.run_main(tmp, write=lambda path, doc, schema: real(path, {**doc, "fy": "x"},
                                                                                         schema))
            self.assertEqual(code, 1)
            self.assertIn("fy2024/hcris.json left as it was): hcris.json fails hcris.schema.json", printed)
            self.assertIn("2 of 2 years not written: FY2023, FY2024", printed)
            self.assertFalse((root / "data/emitted/hcris/fy2024/hcris.json").exists())


class RulesFile(unittest.TestCase):
    """The committed rules sort the kinds of label the decision names (DATA-B-03, 2026-11-05): generic label text,
    no hospital's."""

    def test_the_decided_kinds(self):
        rules = emit.rules()
        cases = {
            "PHYSICIAN PRACTICE INCOME": "physician_professional", "PRO FEES": "physician_professional",
            "PRIVATE PRACTICE REVENUE": "physician_professional", "MEDICAL STAFF INCOME": "physician_professional",
            "340B CONTRACT PHARMACY": "pharmacy", "340 B REVENUE": "pharmacy", "RETAIL PHARMACY": "pharmacy",
            "GRANT REVENUE": "grants_research", "RESEARCH GRANTS": "grants_research",
            "UNREALIZED GAIN/LOSS": "investment", "INTEREST INCOME": "investment", "EQUITY IN EARNINGS": "investment",
            "GAIN ON SALE OF PHYSICIAN PRACTICE": "investment",  # investment-type rules come first
            "NET ASSETS RELEASED FROM RESTRICTION": "contributions", "GIFT SHOP": "like_lines_8_22",
            "PROVIDER RELIEF FUND": "relief_funding", "PROPERTY TAX REVENUE": "appropriations_taxes",
            "NON-OPERATING INCOME": "labeled_non_operating", "OTHER OP AND NON OP INC": "mixed",
            "OTHER OPERATING REVENUE": "generic_operating", "MEDICAID DSH": "medicaid_supplemental",
            "SUPPLEMENTAL OPERATING REVENUE": "medicaid_supplemental",  # Medicaid supplemental stays out (11-05)
            "PHYSICIAN UPL": "medicaid_supplemental", "IGT GRANTS": "medicaid_supplemental",  # before the operating kinds
            "CAPITATION REVENUE": "health_plan", "POISON DRUG CENTER CONTRACTS": "other_services",
            "INTERCOMPANY REVENUE": "intercompany", "MALPRACTICE REVENUE": "other", "OTHER REVENUE": "other",
            "PHYSICAL THERAPY": "other", "": "unlabeled"}
        for label, family in cases.items():
            with self.subTest(label=label):
                self.assertEqual(other_income.classify(label, rules)[0], family)
        classes = {r.family: r.cls for r in rules}
        self.assertEqual({f for f, c in classes.items() if c == "operating"},
                         {"pharmacy", "physician_professional", "grants_research", "like_lines_8_22",
                          "generic_operating"})


class Puf(unittest.TestCase):
    def setUp(self):
        reports = tidy.parse_reports(REPORTS, 2024)
        self.reports = {k: r for k, r in reports.items() if tidy.kind_of(r.ccn)}
        self.values = tidy.collect(NUMBERS, reports)

    def record(self, rpt, ccn, begin="2023-10-01", end="2024-09-30", **values):
        return {"year": "2024", "rpt_rec_num": rpt, "ccn": ccn, "period_begin": begin, "period_end": end,
                **{m: "" for m in puf.METRICS}, **values}

    def test_same_report_must_be_equal_replaced_ones_are_counted(self):
        records = [self.record("7", "990001", net_income="125", net_patient_revenue="2,000",
                               other_income="500", uncompensated_cost="40.5"),
                   self.record("8", "991300", beds="13"),  # one cell off
                   self.record("99", "990001"),  # another number, same CCN and period: replaced since
                   self.record("98", "990077")]
        out = puf.compare(self.reports, self.values, records)
        self.assertEqual({k: out[k] for k in ("puf_reports", "same_report", "equal", "replaced", "unmatched")},
                         {"puf_reports": 4, "same_report": 2, "equal": 1, "replaced": 1, "unmatched": 1})
        self.assertEqual(out["differences"], [("8", "beds", "12", "13")])

    def test_puf_records_and_the_sample(self):
        names = dict(zip(puf.METRICS, puf.SPEC["columns"].values()))
        row = {"rpt_rec_num": "100", "Provider CCN": "990001", "Hospital Name": "INVENTED GENERAL",
               "Fiscal Year Begin Date": "10/01/2023", "Fiscal Year End Date": "09/30/2024",
               **{names[m]: "" for m in puf.METRICS}, names["beds"]: " 25 "}
        psych = {**row, "Provider CCN": "994001", "rpt_rec_num": "150"}
        off = {**row, "rpt_rec_num": "101"}
        records = puf.puf_records([row, psych, off], 2024)
        self.assertEqual([r["rpt_rec_num"] for r in records], ["100", "101"])
        self.assertEqual((records[0]["period_begin"], records[0]["beds"]), ("2023-10-01", "25"))
        data = puf.sample_bytes(records)
        self.assertNotIn(b"INVENTED", data)  # no names
        self.assertEqual([r["rpt_rec_num"] for r in puf.sample_by_year(data)[2024]], ["100"])  # multiples of 50


class Archive(unittest.TestCase):
    def test_plan_uploads_only_what_the_bucket_lacks_and_changed_years(self):
        table = b"table"
        pin = {"bytes": len(table), "sha256": hashlib.sha256(table).hexdigest()}
        with tempfile.TemporaryDirectory() as tmp:
            zips = {}
            for y in (2020, 2021, 2022, 2023, 2024, 2025):
                zips[y] = Path(tmp) / f"HOSP10FY{y}.ZIP"
                zips[y].write_bytes(f"zip {y}".encode())
            sha = {y: hashlib.sha256(z.read_bytes()).hexdigest() for y, z in zips.items()}
            manifest = [{"id": f"hcris-fy{y}-cells", **pin, "derivedFrom": {"sha256": d}}
                        for y, d in ((2020, "d" * 64), (2022, "f" * 64), (2023, "e" * 64), (2024, sha[2024]),
                                     (2025, sha[2025]))]
            derived = []

            def fake_derive(z, hashed):
                derived.append(Path(z).name)
                year = int(Path(z).name[8:12])
                self.assertEqual(hashed, (sha[year], zips[year].stat().st_size))  # plan's hash, passed through
                return year, {f"hcris-fy{year}-cells": b"changed" if year == 2023 else table}, None

            archived = frozenset({f"sha256/{sha[2025]}", "sha256/" + "f" * 64})
            rows = archive.plan(list(zips.values()), manifest, archived=archived, derive_fn=fake_derive)
        self.assertEqual([(Path(r[0]).name, r[3]) for r in rows],
                         [("HOSP10FY2020.ZIP", "upload"),  # same table, but the pin's own zip isn't archived
                          ("HOSP10FY2021.ZIP", "upload"),  # no pin yet
                          ("HOSP10FY2022.ZIP", "skip"),  # new bytes, same table, the pin's zip archived
                          ("HOSP10FY2023.ZIP", "upload"),  # a changed table
                          ("HOSP10FY2024.ZIP", "upload"),  # the zip the pin names
                          ("HOSP10FY2025.ZIP", "skip")])  # already in the bucket
        self.assertEqual(derived, ["HOSP10FY2020.ZIP", "HOSP10FY2022.ZIP", "HOSP10FY2023.ZIP"])  # parsed only when the hash can't settle it
        cmds = archive.commands(rows)
        self.assertEqual(cmds[0], "npx --no-install wrangler@4.151.0 r2 bucket create pp-sources")
        self.assertEqual(cmds[2], f"npx --no-install wrangler@4.151.0 r2 object put pp-sources/sha256/{sha[2021]} "
                                  f"--file={zips[2021]} --content-type=application/zip --remote")
        self.assertEqual(len(cmds), 5)

    def test_main_runs_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            synthetic_pin(tmp)
            out = io.StringIO()
            with mock.patch.object(archive, "read_manifest", return_value=[]), \
                    mock.patch("subprocess.run", side_effect=AssertionError("ran a command")), \
                    contextlib.redirect_stdout(out):
                self.assertEqual(archive.main([tmp]), 0)
        self.assertIn("dry run: nothing was created or uploaded", out.getvalue())
        self.assertIn("r2 object put pp-sources/sha256/", out.getvalue())


if __name__ == "__main__":
    unittest.main()
