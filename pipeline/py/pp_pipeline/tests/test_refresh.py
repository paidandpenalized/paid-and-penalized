"""make refresh end to end on a synthetic site: a temporary git repo with one pinned file (invented hospitals) and its
emitted file on `main`, a fake CMS, and fake make, report, gh and push commands (git itself runs for real). No network,
and nothing leaves the temporary folder."""
import contextlib
import hashlib
import io
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from pp_pipeline import refresh
from pp_pipeline import refresh_sources as rs
from pp_pipeline.refresh_sites import Site

DATASET = "demo-0001"
SOURCE = rs.PdcSource(dataset=DATASET, file=r"FY_(?P<fy>[0-9]{4})_Demo\.csv", folder="demo-fy{fy}",
                      columns=("Facility ID", "Fiscal Year", "Score"), fy_column="Fiscal Year", title="Demo, FY{fy}",
                      archive="demo-fy{fy}")
SITE = Site(sources=(SOURCE,), report=("report",), always=("Read the diff.",), new_year=("Move the year.",))
URL = "https://data.cms.gov/provider-data/sites/default/files/resources/0123abcd_1800000000/{}"
TODAY = "2027-02-03"


def demo_csv(fy, second="0.9"):
    return f"Facility ID,Fiscal Year,Score\n990001,{fy},0.1\n990002,{fy},{second}\n".encode()


def emit(root):
    """The synthetic site's emitter: its current pin's rows, in the data contract's envelope."""
    manifest = json.loads((root / "data/pinned/manifest.json").read_text(encoding="utf-8"))
    entry = next(e for e in manifest if e["id"] == DATASET)
    lines = (root / "data/pinned" / entry["path"]).read_text(encoding="utf-8").splitlines()[1:]
    rows = [line.split(",") for line in lines]
    fy = int(rows[0][1])
    out = {"schema_version": 1, "methods_version": 1, "source_manifest": entry["sha256"], "sources": [DATASET],
           "built_at": "2026-10-20T00:00:00Z", "fy": fy, "hospitals": [{"ccn": c, "score": s} for c, _, s in rows]}
    path = root / f"data/emitted/demo/fy{fy}/demo.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out) + "\n", encoding="utf-8")


class Repo(unittest.TestCase):
    """A synthetic repo on `main` with FY2026's file pinned and emitted."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name) / "repo"
        self.out = Path(tmp.name) / "out"
        self.out.mkdir()
        (Path(tmp.name) / "nohooks").mkdir()
        pinned = self.root / "data/pinned/demo-fy2026"
        pinned.mkdir(parents=True)
        data = demo_csv(2026)
        (pinned / "FY_2026_Demo.csv").write_bytes(data)
        manifest = [{"id": DATASET, "title": "Demo, FY2026", "path": "demo-fy2026/FY_2026_Demo.csv", "bytes": len(data),
                     "sha256": hashlib.sha256(data).hexdigest(), "downloadUrl": URL.format("FY_2026_Demo.csv"),
                     "landingPage": "https://data.cms.gov/provider-data/dataset/demo-0001",
                     "pdcReleased": "2026-08-13", "retrieved": "2026-10-20"}]
        (self.root / "data/pinned/manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        emit(self.root)
        for args in (["init", "-q", "-b", "main"], ["config", "user.email", "test@example.invalid"],
                     ["config", "user.name", "Test"], ["config", "core.hooksPath", str(Path(tmp.name) / "nohooks")],
                     ["add", "-A"], ["commit", "-q", "-m", "FY2026"], ["update-ref", "refs/remotes/origin/main", "HEAD"]):
            self.git(*args)
        self.cms = {}
        self.calls = []
        self.emit_fails = False
        self.open_pr = None  # the URL of a pull request the refresh branch already has
        self.remote_branches = ""  # what git ls-remote --heads origin answers

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.root, check=True, capture_output=True, text=True).stdout

    def serve(self, data, name):
        record = {"identifier": DATASET, "modified": "2027-01-20", "released": "2027-02-01",
                  "distribution": [{"downloadURL": URL.format(name)}]}
        self.cms = {rs.METASTORE.format(DATASET): json.dumps(record).encode(), URL.format(name): data}

    def fetch(self, url, cap):
        self.calls.append(("fetch", url))
        return self.cms[url]

    def run_fake(self, argv, extra_env=None):
        argv = list(argv)
        self.calls.append((argv, extra_env))
        if argv[0] == "git" and argv[1] not in ("push", "fetch", "ls-remote"):
            p = subprocess.run(argv, cwd=self.root, capture_output=True, text=True)
            return p.returncode, p.stdout + p.stderr
        if argv == ["make", "emit"]:
            if self.emit_fails:
                return 1, "emit: the dollar estimates refuse a file of another year\n"
            emit(self.root)
            return 0, "emitted\n"
        if argv == ["make", "test"]:
            return 0, "ℹ pass 5\nℹ fail 0\nRan 3 tests in 0.1s\n\nOK\n"
        if argv == ["report"]:
            return 0, "**Demo** reproduces CMS's published values."
        if argv[:3] == ["gh", "pr", "create"]:
            return 0, "https://github.com/example/demo/pull/7\n"
        if argv[:3] == ["gh", "pr", "view"]:
            return (0, self.open_pr + "\n") if self.open_pr else (1, "no pull requests found\n")
        if argv[:2] == ["git", "ls-remote"]:
            return 0, self.remote_branches
        return 0, ""  # gh auth status, gh pr edit, git fetch and push, the change gate

    def refresh(self, pr=False):
        env = refresh.Env(self.root, self.run_fake, self.fetch, TODAY, self.out)
        printed = io.StringIO()
        with contextlib.redirect_stdout(printed):
            code = refresh.refresh("demo", env, pr=pr, sites={"demo": SITE})
        return code, printed.getvalue(), (self.out / "pr-body.md").read_text(encoding="utf-8")

    def manifest(self):
        return json.loads((self.root / "data/pinned/manifest.json").read_text(encoding="utf-8"))

    def called(self, prefix):
        return [c for c in self.calls if isinstance(c[0], list) and c[0][:len(prefix)] == prefix]


class DryRun(Repo):
    def test_cms_files_equal_to_the_pins_change_nothing(self):
        self.serve(demo_csv(2026), "FY_2026_Demo.csv")
        code, printed, body = self.refresh()
        self.assertEqual(code, 0)
        self.assertIn("pins: all 1 pinned files match", printed)
        self.assertIn(f"{DATASET}: unchanged", printed)
        self.assertIn("None: CMS's files are the pinned ones", body)
        self.assertIn("No emitted file changed", body)
        self.assertEqual(self.git("status", "--porcelain"), "")

    def test_a_corrected_file_is_pinned_rebuilt_diffed_and_written_up_but_not_committed(self):
        head = self.git("rev-parse", "HEAD")
        new = demo_csv(2026, second="0.7")
        self.serve(new, "FY_2026_Demo.csv")
        code, printed, body = self.refresh()
        self.assertEqual(code, 0)
        entry = self.manifest()[0]
        self.assertEqual((entry["sha256"], entry["retrieved"], entry["pdcReleased"]),
                         (hashlib.sha256(new).hexdigest(), TODAY, "2027-02-01"))
        self.assertEqual((self.root / "data/pinned" / entry["path"]).read_bytes(), new)
        self.assertIn(f"| `{DATASET}` | re-pinned |", body)
        self.assertIn("| `data/emitted/demo/fy2026/demo.json` | `source_manifest`; `hospitals` 2 → 2: 1 changed; "
                      "fields: score 1 |", body)
        self.assertIn("**Demo** reproduces CMS's published values.", body)
        self.assertIn("`make test` passed. Node: 5 passed, 0 failed. Python: 3 tests, OK.", body)
        self.assertIn("- [ ] Read the diff.", body)
        self.assertNotIn("Move the year.", body)
        self.assertIn("dry run: no branch, commit, push or pull request", printed)
        self.assertEqual(self.git("rev-parse", "HEAD"), head)
        self.assertEqual(self.git("branch", "--show-current").strip(), "main")
        self.assertEqual(self.called(["git", "push"]) + self.called(["gh"]), [])
        downloads = list(self.out.glob(f"download-{DATASET}-*/FY_2026_Demo.csv"))
        self.assertEqual([p.read_bytes() for p in downloads], [new])

    def test_a_new_year_archives_the_old_pin_and_adds_the_new_years_steps(self):
        self.serve(demo_csv(2027), "FY_2027_Demo.csv")
        code, _, body = self.refresh()
        self.assertEqual(code, 0)
        self.assertEqual([(e["id"], e["path"]) for e in self.manifest()],
                         [(DATASET, "demo-fy2027/FY_2027_Demo.csv"), ("demo-fy2026", "demo-fy2026/FY_2026_Demo.csv")])
        self.assertIn("| `demo-fy2026` | archived (was `demo-0001`) |", body)
        self.assertIn("Every pinned file (1) matched", body)  # counted before the run added one
        self.assertIn("| `data/emitted/demo/fy2027/demo.json` | added (a first emission) |", body)
        self.assertIn("- [ ] Move the year.", body)

    def test_a_failed_emit_is_reported_and_the_run_fails(self):
        self.emit_fails = True
        self.serve(demo_csv(2026, second="0.7"), "FY_2026_Demo.csv")
        code, printed, body = self.refresh()
        self.assertEqual(code, 1)
        self.assertIn("emit: FAILED (exit 1)", printed)
        self.assertIn("`make emit` **failed**", body)
        self.assertIn("refuse a file of another year", body)
        self.assertIn("not run: make emit failed", body)
        self.assertEqual(self.called(["report"]), [])

    def test_a_pin_that_doesnt_match_its_manifest_stops_before_any_fetch(self):
        (self.root / "data/pinned/demo-fy2026/FY_2026_Demo.csv").write_bytes(demo_csv(2026, second="0.5"))
        with self.assertRaises(rs.RefreshError):
            self.refresh()
        self.assertEqual([c for c in self.calls if c[0] == "fetch"], [])


class PullRequest(Repo):
    def test_pr_commits_only_the_data_on_a_branch_then_gates_pushes_and_opens_a_draft(self):
        base = self.git("rev-parse", "HEAD").strip()
        self.serve(demo_csv(2026, second="0.7"), "FY_2026_Demo.csv")
        code, printed, _ = self.refresh(pr=True)
        self.assertEqual(code, 0)
        branch = f"refresh-demo-{TODAY}"
        self.assertEqual(self.git("branch", "--show-current").strip(), branch)
        self.assertEqual(sorted(self.git("diff", "--name-only", f"{base}..HEAD").split()),
                         ["data/emitted/demo/fy2026/demo.json", "data/pinned/demo-fy2026/FY_2026_Demo.csv",
                          "data/pinned/manifest.json"])
        self.assertEqual(self.git("status", "--porcelain"), "")
        self.assertEqual(self.called(["node", "tools/ci/change-gate.js"])[0][1], {"GATE_BASE": base})
        self.assertEqual(self.called(["git", "push"])[0][0], ["git", "push", "-u", "origin", branch])
        create = self.called(["gh", "pr", "create"])[0][0]
        self.assertIn("--draft", create)
        self.assertEqual(create[create.index("--title") + 1], f"Refresh demo: new CMS data for {DATASET}")
        self.assertTrue(Path(create[create.index("--body-file") + 1]).is_file())
        self.assertIn("draft pull request: https://github.com/example/demo/pull/7", printed)
        order = [c[0][:3] for c in self.calls if isinstance(c[0], list) and c[0][0] in ("node", "gh")]
        self.assertEqual(order, [["gh", "auth", "status"], ["node", "tools/ci/change-gate.js"], ["gh", "pr", "view"],
                                 ["gh", "pr", "create"]])

    def test_a_rerun_on_the_refresh_branch_updates_its_pull_request(self):
        self.git("switch", "-q", "-c", f"refresh-demo-{TODAY}")
        self.open_pr = "https://github.com/example/demo/pull/7"
        self.serve(demo_csv(2026, second="0.7"), "FY_2026_Demo.csv")
        code, printed, _ = self.refresh(pr=True)
        self.assertEqual(code, 0)
        self.assertEqual(self.called(["gh", "pr", "create"]), [])
        edit = self.called(["gh", "pr", "edit"])[0][0]
        self.assertEqual(edit[:4], ["gh", "pr", "edit", f"refresh-demo-{TODAY}"])
        self.assertIn("draft pull request: https://github.com/example/demo/pull/7", printed)

    def test_pr_refuses_another_branch_or_a_main_that_isnt_origins(self):
        self.serve(demo_csv(2026, second="0.7"), "FY_2026_Demo.csv")
        self.git("switch", "-q", "-c", "some-feature")
        with self.assertRaises(rs.RefreshError) as caught:
            self.refresh(pr=True)
        self.assertIn("'some-feature'", str(caught.exception))
        self.git("switch", "-q", "main")
        self.git("commit", "-q", "--allow-empty", "-m", "not on origin")
        with self.assertRaises(rs.RefreshError) as caught:
            self.refresh(pr=True)
        self.assertIn("not origin's", str(caught.exception))
        self.assertEqual([c for c in self.calls if c[0] == "fetch"], [])

    def test_pr_refuses_other_uncommitted_changes_before_fetching(self):
        (self.root / "notes.txt").write_text("a session's own edit\n")
        self.serve(demo_csv(2026, second="0.7"), "FY_2026_Demo.csv")
        with self.assertRaises(rs.RefreshError) as caught:
            self.refresh(pr=True)
        self.assertIn("notes.txt", str(caught.exception))
        self.assertEqual([c for c in self.calls if c[0] == "fetch"], [])

    def test_pr_with_a_failed_step_or_nothing_to_refresh_opens_nothing(self):
        self.serve(demo_csv(2026), "FY_2026_Demo.csv")
        code, printed, _ = self.refresh(pr=True)
        self.assertEqual(code, 0)
        self.assertIn("nothing to refresh", printed)
        self.emit_fails = True
        self.serve(demo_csv(2026, second="0.7"), "FY_2026_Demo.csv")
        code, printed, _ = self.refresh(pr=True)
        self.assertEqual(code, 1)
        self.assertIn(f"not committed: a step failed. On refresh-demo-{TODAY}", printed)
        self.assertEqual(self.git("branch", "--show-current").strip(), f"refresh-demo-{TODAY}")  # where the fix goes
        self.assertIn("data/pinned/manifest.json", self.git("status", "--porcelain"))
        self.assertEqual(self.called(["git", "commit"]) + self.called(["git", "push"]) + self.called(["gh", "pr"]), [])

    def test_a_failure_with_nothing_changed_stays_on_main_and_says_whose_it_is(self):
        self.emit_fails = True
        self.serve(demo_csv(2026), "FY_2026_Demo.csv")
        code, printed, _ = self.refresh(pr=True)
        self.assertEqual(code, 1)
        self.assertIn("the failure is main's own", printed)
        self.assertEqual(self.git("branch", "--show-current").strip(), "main")

    def test_pr_from_main_refuses_when_todays_refresh_branch_exists_here_or_on_github(self):
        self.serve(demo_csv(2026, second="0.7"), "FY_2026_Demo.csv")
        self.remote_branches = f"0123abcd\trefs/heads/refresh-demo-{TODAY}\n"
        with self.assertRaises(rs.RefreshError) as caught:
            self.refresh(pr=True)
        self.assertIn("already exists here or on GitHub", str(caught.exception))
        self.remote_branches = ""
        self.git("branch", f"refresh-demo-{TODAY}")
        with self.assertRaises(rs.RefreshError):
            self.refresh(pr=True)
        self.assertEqual([c for c in self.calls if c[0] == "fetch"], [])

    def test_a_change_gate_refusal_stops_before_the_push(self):
        self.serve(demo_csv(2026, second="0.7"), "FY_2026_Demo.csv")
        fake = self.run_fake

        def gate_refuses(argv, extra_env=None):
            if list(argv)[:2] == ["node", "tools/ci/change-gate.js"]:
                self.calls.append((list(argv), extra_env))
                return 1, "change gate: changed without a reason on record"
            return fake(argv, extra_env)
        self.run_fake = gate_refuses
        with self.assertRaises(rs.RefreshError) as caught:
            self.refresh(pr=True)
        self.assertIn("nothing was pushed", str(caught.exception))
        self.assertEqual(self.called(["git", "push"]), [])


class TestSummary(unittest.TestCase):
    def test_counts_and_failing_names_are_read_from_both_runners(self):
        out = ("✖ golden: a fresh build equals the committed file (12.5ms)\nℹ pass 10\nℹ fail 1\n"
               "FAIL: test_every_manifest_entry_matches_its_file (pp_pipeline.tests.test_pins.Pins)\n"
               "Ran 4 tests in 0.2s\n\nFAILED (failures=1)\n")
        line, failing = refresh.test_summary(out)
        self.assertEqual(line, "Node: 10 passed, 1 failed. Python: 4 tests, FAILED (failures=1).")
        self.assertEqual(failing, ["golden: a fresh build equals the committed file",
                                   "test_every_manifest_entry_matches_its_file (pp_pipeline.tests.test_pins.Pins)"])

    def test_the_reporters_heading_is_not_a_failing_test(self):
        _, failing = refresh.test_summary("✖ a check (1ms)\nℹ fail 1\n✖ failing tests:\n\n✖ a check (1ms)\n")
        self.assertEqual(failing, ["a check"])

    def test_tap_output_is_read_too(self):
        line, failing = refresh.test_summary("not ok 3 - a check\n# pass 8\n# fail 1\nRan 2 tests in 0.1s\n\nOK\n")
        self.assertEqual((line, failing), ("Node: 8 passed, 1 failed. Python: 2 tests, OK.", ["a check"]))

    def test_python_tests_that_never_ran_say_so(self):
        line, _ = refresh.test_summary("ℹ pass 9\nℹ fail 1\nmake: *** [test] Error 1\n")
        self.assertEqual(line, "Node: 9 passed, 1 failed. Python: not run (make stops at the first failing command).")


if __name__ == "__main__":
    unittest.main()
