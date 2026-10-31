"""`make refresh SITE=<site> [PR=1]` (`python3 -I pipeline/py/run.py refresh <site> [--pr]`): bring a site's pinned
CMS inputs up to date and prepare the pull request that publishes them. It CALLS THE NETWORK (refresh_sources.fetch)
and is run by hand in a working session; the build and the tests never run it.

Steps, each reported as it goes:
  1. every pinned file against its manifest entry (a mismatch stops the run: the tree isn't what the manifest says);
  2. each of the site's sources (refresh_sites.py) fetched, checked and pinned (refresh_sources.py); a failure stops
     the run;
  3. `make emit`, 4. the site's reproduction report, 5. `make test`: a failure is reported with its output and the run
     goes on, so the report shows everything, and exits 1;
  6. the golden diff: data/emitted/ in the working tree against the merge base with `main` (golden_diff.py), and the
     pins against that base's manifest;
  7. the pull request's text, written with each step's log to a new temporary folder, and printed.
A dry run (the default) stops there. It changes only data/pinned/ and data/emitted/, and makes no branch, commit, push
or pull request. With --pr (PR=1) the run starts only on `main` (as GitHub has it: it fetches origin's and compares) or
on a refresh-<site>- branch it made, with no uncommitted change outside data/pinned/ and data/emitted/, so the pull
request is what was tested. When steps 3-5 pass and something differs from `main`, it commits data/pinned/ and
data/emitted/ and nothing else on refresh-<site>-<date> (made from `main`), runs CI's change gate on that commit,
pushes the branch and opens a draft pull request with `gh` (or, when the branch has one, updates its title and text).
When a step fails it moves to that branch and stops: fix the code there, commit, and run it again; it finds the pins
already current and goes on from the rebuild. Merging is the owner's call, and nothing publishes until then.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path
from typing import Callable, NamedTuple

from pp_pipeline import golden_diff
from pp_pipeline import refresh_sources as rs
from pp_pipeline.files import REPO_ROOT, mismatched_pins, read_json, read_manifest, write_manifest
from pp_pipeline.refresh_sites import SITES

BASE = "main"
PINNED, EMITTED = "data/pinned", "data/emitted"
MANIFEST = f"{PINNED}/manifest.json"
LOG_TAIL = 25  # lines of a failed step's output in the pull request's text


class Env(NamedTuple):
    """What a run touches: the repo, every command (run(argv, extra_env) -> (exit code, output)), the network (fetch(url,
    cap) -> bytes), the date the pins are retrieved on, and the folder for the run's report. Tests pass fakes."""
    root: Path
    run: Callable
    fetch: Callable
    today: str
    out: Path


class Step(NamedTuple):
    ok: bool
    output: str


def run_command(root):
    """Env.run for a repo: argv run from root, never through a shell; stdout and stderr together, as text."""
    def run(argv, extra_env=None):
        p = subprocess.run(list(argv), cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False,
                           env={**os.environ, **(extra_env or {})})
        return p.returncode, p.stdout.decode("utf-8", errors="replace")
    return run


def say(text):
    print(text, flush=True)


def git(env, *args):
    code, out = env.run(["git", *args])
    if code:
        raise rs.RefreshError(f"git {' '.join(args)} failed: {out.strip()}")
    return out


def step(env, name, argv):
    """Run one checked step, keep its whole output in <name>.log, and report it."""
    code, out = env.run(argv)
    log = env.out / f"{name}.log"
    log.write_text(out, encoding="utf-8")
    say(f"{name}: ok" if code == 0 else f"{name}: FAILED (exit {code}); see {log}")
    return Step(code == 0, out)


def preflight(env, site_name):
    """--pr only: refuse a branch other than `main` or one of this site's refresh branches, a local `main` that isn't
    origin's, a tree with uncommitted changes outside data/pinned/ and data/emitted/, or no GitHub sign-in."""
    branch = git(env, "rev-parse", "--abbrev-ref", "HEAD").strip()
    if branch != BASE and not branch.startswith(f"refresh-{site_name}-"):
        raise rs.RefreshError(f"on branch {branch!r}: run PR=1 from {BASE}, or from the refresh-{site_name}-<date> "
                              "branch an earlier run made, so the pull request holds only the refresh")
    git(env, "fetch", "-q", "origin", BASE)
    if git(env, "rev-parse", BASE) != git(env, "rev-parse", f"origin/{BASE}"):
        raise rs.RefreshError(f"the local {BASE} is not origin's: update it (git pull --ff-only on {BASE}) first, so "
                              "the diff and the branch start from what is published")
    changed = git(env, "diff", "--name-only", "-z", "HEAD").split("\0")
    changed += git(env, "ls-files", "--others", "--exclude-standard", "-z").split("\0")
    others = sorted(p for p in changed if p and not p.startswith((f"{PINNED}/", f"{EMITTED}/")))
    if others:
        raise rs.RefreshError(f"uncommitted changes outside {PINNED}/ and {EMITTED}/ ({', '.join(others[:5])}): commit or "
                              "set them aside first, so the pull request is exactly what was tested")
    code, out = env.run(["gh", "auth", "status"])
    if code:
        raise rs.RefreshError(f"gh is not signed in to GitHub: {out.strip()}")


def emitted_at(env, rev):
    """{path: parsed file} for every .json under data/emitted/ at a revision."""
    paths = [p for p in git(env, "ls-tree", "-r", "-z", "--name-only", rev, "--", EMITTED).split("\0") if p.endswith(".json")]
    return {p: json.loads(git(env, "show", f"{rev}:{p}")) for p in paths}


def emitted_now(env):
    """{path: parsed file} for every .json under data/emitted/ in the working tree."""
    root = env.root / EMITTED
    return {p.relative_to(env.root).as_posix(): read_json(p) for p in sorted(root.rglob("*.json"))} if root.is_dir() else {}


def pin_changes(before, after):
    """[(id, change, entry before, entry after)] between two manifests, in the newer one's order: "re-pinned" (new
    bytes), "added", "archived" (a new id for a file the base pinned under another id: the previous year, kept), and
    "removed"."""
    old = {e["id"]: e for e in before}
    rows = []
    for e in after:
        was = old.get(e["id"])
        if was is None:
            prev = next((x for x in before if x["sha256"] == e["sha256"] and x["path"] == e["path"]), None)
            rows.append((e["id"], "archived" if prev else "added", prev, e))
        elif was["sha256"] != e["sha256"]:
            rows.append((e["id"], "re-pinned", was, e))
    ids = {e["id"] for e in after}
    return rows + [(i, "removed", e, None) for i, e in old.items() if i not in ids]


def pin_text(entry):
    if entry is None:
        return "none"
    released = f", CMS released {entry['pdcReleased']}" if entry.get("pdcReleased") else ""
    return f"`{entry['path']}`, {entry['bytes']:,} bytes, SHA-256 `{entry['sha256'][:12]}…`{released}"


def pins_markdown(rows):
    if not rows:
        return "None: CMS's files are the pinned ones, and the pins are `main`'s."
    lines = ["| Pin | Change | Before | After |", "|---|---|---|---|"]
    for pin, change, was, now in rows:
        label = f"archived (was `{was['id']}`)" if change == "archived" else change
        lines.append(f"| `{pin}` | {label} | {pin_text(was if change != 'archived' else None)} | {pin_text(now)} |")
    return "\n".join(lines)


def test_summary(output):
    """`make test`'s counts in a line, and the names of failing tests (at most 15)."""
    node = dict(re.findall(r"^ℹ (pass|fail) (\d+)$", output, re.M))
    ran = re.search(r"^Ran (\d+) tests?", output, re.M)
    verdict = re.search(r"^(OK|FAILED)\b.*$", output, re.M)
    python = (f"{ran.group(1)} tests, {verdict.group(0) if verdict else 'no verdict'}" if ran
              else "not run (make stops at the first failing command)")
    line = f"Node: {node.get('pass', '?')} passed, {node.get('fail', '?')} failed. Python: {python}."
    failing = [re.sub(r" \([\d.]+m?s\)$", "", m) for m in re.findall(r"^\s*✖ (.+)$", output, re.M)
               if m != "failing tests:"]  # the reporter's heading over its repeat of the failures
    failing += re.findall(r"^(?:FAIL|ERROR): (.+)$", output, re.M)
    return line, list(dict.fromkeys(failing))[:15]


def tail(output):
    lines = output.rstrip().splitlines()[-LOG_TAIL:]
    return "````text\n" + "\n".join(lines).replace("````", "'''") + "\n````"


def body(site_name, site, env, base, pinned, rows, steps, now, diffs, checked):
    """The pull request's text. now: the working tree's emitted files (emitted_now)."""
    out = [f"Refreshes the **{site_name}** site's pinned CMS inputs. Made by `make refresh SITE={site_name}` on "
           f"{env.today}, against `{BASE}` at `{base[:7]}`; nothing is published until this is merged.", ""]
    out += ["## Pins", "", pins_markdown(rows), ""]
    fetched = ", ".join(f"`{p.before['id']}` ({p.status})" for p in pinned)
    out += [f"Every pinned file ({checked}) matched its manifest SHA-256 before the run. Fetched from CMS: {fetched}."]
    out += [f"- `{p.before['id']}`: CMS's record moved, same bytes (not written): {'; '.join(p.drift)}"
            for p in pinned if p.drift]
    out += ["", "## Reproduction", ""]
    emit, report, test = steps["emit"], steps["report"], steps["test"]
    if not emit.ok:
        out += ["`make emit` **failed**; its last lines:", "", tail(emit.output), ""]
    out += [report.output.strip() if report.ok else
            f"The reproduction report **failed** (`{' '.join(site.report)}`):\n\n{tail(report.output)}", ""]
    line, failing = test_summary(test.output)
    out += ["## Tests", "", f"`make test` {'passed' if test.ok else '**failed**'}. {line}"]
    out += [f"- {name}" for name in failing]
    out += ["", f"## Golden diff against `{BASE}`", "", golden_diff.markdown(diffs), ""]
    new_year = any(change == "archived" for _, change, _, _ in rows)
    out += ["## Still to do by hand", ""] + [f"- [ ] {s}" for s in site.always]
    if new_year:
        out += ["", "A source moved to a new fiscal year, so also:", ""] + [f"- [ ] {s}" for s in site.new_year]
    fetched_ids = {s.dataset for s in site.sources}
    others = sorted({i for d in now.values() for i in d.get("sources", [])} - fetched_ids)
    if others:
        out += ["", "<details><summary>The emitted data's other inputs, which make refresh does not fetch (re-pinned by "
                "hand when CMS moves them)</summary>", "", ", ".join(f"`{i}`" for i in others), "", "</details>"]
    return "\n".join(out) + "\n"


def title_for(site_name, rows):
    moved = [pin for pin, change, _, _ in rows if change != "archived"]
    return f"Refresh {site_name}: new CMS data for {', '.join(moved)}" if moved else f"Refresh {site_name}"


def refresh_branch(env, site_name):
    """The branch a --pr run commits on: the current one when it is already a refresh branch (preflight allows no
    other), else refresh-<site>-<date>, made from `main` and switched to (uncommitted data comes along)."""
    branch = git(env, "rev-parse", "--abbrev-ref", "HEAD").strip()
    if branch == BASE:
        branch = f"refresh-{site_name}-{env.today}"
        git(env, "switch", "-c", branch)
    return branch


def open_pr(env, site_name, base, title, body_path):
    """Commit the data on the refresh branch, run CI's change gate on it, push, and open a draft pull request (or update
    the one the branch has); its URL."""
    branch = refresh_branch(env, site_name)
    git(env, "add", "-A", "--", PINNED, EMITTED)
    if env.run(["git", "diff", "--cached", "--quiet"])[0]:
        git(env, "commit", "-q", "-m", title, "-m", f"Made by make refresh SITE={site_name}; the pull request has the report.")
    code, out = env.run(["node", "tools/ci/change-gate.js"], {"GATE_BASE": base})
    if code:
        raise rs.RefreshError(f"CI's change gate refuses the commit, so nothing was pushed: {out.strip()}")
    git(env, "push", "-u", "origin", branch)
    code, url = env.run(["gh", "pr", "view", branch, "--json", "url", "--jq", ".url"])
    if code == 0 and url.strip():  # a rerun: the branch's pull request gets this run's text
        argv = ["gh", "pr", "edit", branch, "--title", title, "--body-file", str(body_path)]
    else:
        argv = ["gh", "pr", "create", "--draft", "--base", BASE, "--head", branch, "--title", title,
                "--body-file", str(body_path)]
    code, out = env.run(argv)
    if code:
        raise rs.RefreshError(f"{' '.join(argv[:3])} failed (the branch {branch} is pushed): {out.strip()}")
    return url.strip() if argv[2] == "edit" else out.strip()


def refresh(site_name, env, pr=False, sites=SITES):
    """One run (the module docstring); returns the exit code."""
    site = sites[site_name]
    pinned_dir = env.root / PINNED
    if pr:
        preflight(env, site_name)
    base = git(env, "merge-base", "HEAD", BASE).strip()
    manifest = read_manifest(pinned_dir)
    bad = mismatched_pins(manifest, pinned_dir)
    if bad:
        raise rs.RefreshError(f"pinned files that don't match the manifest: {', '.join(bad)}; `git status` shows what "
                              "changed them")
    checked = len(manifest)  # before this run adds any
    say(f"pins: all {checked} pinned files match their manifest SHA-256")
    pinned = []
    for source in site.sources:
        manifest, result = rs.refresh_source(manifest, source, env.fetch, env.today, pinned_dir, env.out)
        if result.status != "unchanged":
            write_manifest(manifest, pinned_dir)
        pinned.append(result)
        say(f"{source.dataset}: {result.status}: {result.after['path']}"
            + (f"; CMS's record moved, same bytes: {'; '.join(result.drift)}" if result.drift else ""))
    steps = {"emit": step(env, "emit", ["make", "emit"])}
    steps["report"] = step(env, "report", site.report) if steps["emit"].ok else Step(False, "not run: make emit failed")
    steps["test"] = step(env, "test", ["make", "test"])
    now = emitted_now(env)
    diffs = golden_diff.diff_emitted(emitted_at(env, base), now)
    rows = pin_changes(json.loads(git(env, "show", f"{base}:{MANIFEST}")), manifest)
    moved = len(golden_diff.moved(diffs))
    say(f"golden diff against {BASE}: {moved} emitted files changed; pins changed: {len(rows)}")
    text = body(site_name, site, env, base, pinned, rows, steps, now, diffs, checked)
    body_path = env.out / "pr-body.md"
    body_path.write_text(text, encoding="utf-8")
    say(f"\n{text}\n\npull request text: {body_path}")
    ok = all(s.ok for s in steps.values())
    changed = bool(rows or moved)
    if not pr:
        where = (f"The refresh is in the working tree's {PINNED}/ and {EMITTED}/ (`git status`); `git restore {PINNED} "
                 f"{EMITTED}` and deleting the new files git lists there undo it." if changed else
                 f"Nothing differs from {BASE}: CMS's files are the pinned ones.")
        say(f"dry run: no branch, commit, push or pull request. {'Every step passed.' if ok else 'A step FAILED (above).'} "
            + where)
        return 0 if ok else 1
    if not ok:
        branch = refresh_branch(env, site_name) if changed else git(env, "rev-parse", "--abbrev-ref", "HEAD").strip()
        say(f"not committed: a step failed. On {branch}: fix it there and commit the fix (only data/pinned/ and "
            f"data/emitted/ may stay uncommitted), then run make refresh SITE={site_name} PR=1 again; it finds the pins "
            "already current and goes on from the rebuild.")
        return 1
    if not changed:
        say(f"nothing to refresh: CMS's files are the pinned ones and the emitted data is {BASE}'s; no pull request.")
        return 0
    say(f"draft pull request: {open_pr(env, site_name, base, title_for(site_name, rows), body_path)}")
    return 0


def main(site_name, pr=False):
    if site_name not in SITES:
        print(f"make refresh: unknown site {site_name!r}; one of {', '.join(sorted(SITES))}", file=sys.stderr)
        return 2
    out = Path(tempfile.mkdtemp(prefix=f"pp-refresh-{site_name}-"))
    env = Env(REPO_ROOT, run_command(REPO_ROOT), rs.fetch, date.today().isoformat(), out)  # local, as the manifest's
    say(f"make refresh SITE={site_name}{' PR=1' if pr else ' (dry run)'}; report and downloads in {out}")
    try:
        return refresh(site_name, env, pr)
    except (rs.RefreshError, OSError) as e:  # urllib's HTTP and network errors are OSErrors
        print(f"make refresh stopped: {e}", file=sys.stderr)
        return 1
