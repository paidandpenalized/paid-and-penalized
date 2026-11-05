"""Plan the R2 archive of CMS's raw HCRIS zips (ARCH-17 option (c)): a dry run that changes nothing.

    python3 -I pipeline/py/pp_pipeline/hcris/cli.py archive-plan <dir of zips> [--archived <keys.txt>]

Each zip is stored once under its content address, `sha256/<hex>` in the `pp-sources` bucket, so a zip CMS posts again
byte for byte is never uploaded twice. Beyond that, only changed years are uploaded: a zip whose derived tables (the
cells table and the line-24 table) are byte-identical to the ones pinned for its year is skipped when the pin's own
zip is in the bucket, since that zip already reproduces the pins (CMS regenerates every year's file each posting, so
new bytes alone don't mean new data). `--archived` lists keys already
in the bucket, one per line (from `wrangler r2 object list`, when it exists).

Prints, for each zip, upload or skip and why, the totals against R2's free 10 GB-month, and the exact wrangler
commands it would run. It runs none of them: creating the bucket and uploading need Dalton's OK.
"""
import argparse
import re
from pathlib import Path

from pp_pipeline.files import pin_matches, read_manifest
from pp_pipeline.hcris.extract import sha256
from pp_pipeline.hcris.pins import BUCKET, archive_key, derive, line24_pin_id, pinned_years

WRANGLER = "npx --no-install wrangler@4.151.0"
YEAR = re.compile(r"HOSP10FY(\d{4})\.ZIP")
FREE_BYTES = 10 * 10**9  # R2's free tier: 10 GB-month of storage (developers.cloudflare.com/r2/pricing)


def plan(zips, manifest, archived=frozenset(), derive_fn=derive):
    """[(path, key, bytes, action, why)] for each zip, action `upload` or `skip`. A zip is hashed first; it is parsed
    (`derive_fn`) only when neither the bucket nor the pin already settles it."""
    pinned = pinned_years(manifest)
    by_id = {e["id"]: e for e in manifest}
    out = []
    for z in sorted(zips):
        digest, size = sha256(z)
        key = archive_key(digest)
        year = int(YEAR.fullmatch(Path(z).name.upper()).group(1))
        entry = pinned.get(year)
        if key in archived:
            action, why = "skip", "already in the bucket"
        elif entry is None:
            action, why = "upload", f"FY{year} has no pin yet"
        elif entry["derivedFrom"]["sha256"] == digest:
            action, why = "upload", f"backs the FY{year} pin"
        elif not all(pid in by_id and pin_matches(by_id[pid], data) for pid, data in derive_fn(z)[1].items()):
            action, why = "upload", f"FY{year}'s tables changed: a new pin"
        elif all(archive_key(e["derivedFrom"]["sha256"]) in archived
                 for e in (entry, by_id.get(line24_pin_id(year))) if e is not None):
            action, why = "skip", (f"FY{year}'s tables are unchanged: the archived zip "
                                   f"{entry['derivedFrom']['sha256'][:12]} reproduces it")
        else:  # the pin's own zip is not in the bucket; this one gives the same table
            action, why = "upload", f"FY{year}'s pin has no archived zip; this one reproduces it"
        out.append((str(z), key, size, action, why))
    return out


def commands(rows):
    cmds = [f"{WRANGLER} r2 bucket create {BUCKET}"]
    cmds += [f"{WRANGLER} r2 object put {BUCKET}/{key} --file={path} --content-type=application/zip --remote"
             for path, key, _, action, _ in rows if action == "upload"]
    return cmds


def gb(n):
    return f"{n / 10**9:.2f} GB"


def main(argv):
    parser = argparse.ArgumentParser(prog="cli.py archive-plan", description="Plan the R2 archive (a dry run).")
    parser.add_argument("dir", help="a folder of HOSP10FY<YYYY>.ZIP files")
    parser.add_argument("--archived", help="keys already in the bucket, one per line")
    try:
        args = parser.parse_args(argv)
    except SystemExit as stop:
        return stop.code
    archived = frozenset()
    if args.archived:
        archived = frozenset(line.strip() for line in Path(args.archived).read_text().splitlines() if line.strip())
    zips = sorted(p for p in Path(args.dir).iterdir() if YEAR.fullmatch(p.name.upper()))
    rows = plan(zips, read_manifest(), archived)
    for path, key, size, action, why in rows:
        print(f"{action:6} {Path(path).name:20} {gb(size):>8}  {key[:19]}  {why}")
    up = sum(r[2] for r in rows if r[3] == "upload")
    print(f"\nthis snapshot: {gb(sum(r[2] for r in rows))} in {len(rows)} zips; to upload: {gb(up)}; "
          f"R2 free storage: {gb(FREE_BYTES)} ({up / FREE_BYTES:.0%} of it)")
    print("\ndry run: nothing was created or uploaded. The commands (bucket creation and uploads need Dalton's OK):")
    for c in commands(rows):
        print("  " + c)
    return 0

