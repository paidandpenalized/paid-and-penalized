"""Plan the R2 archive of CMS's raw HCRIS zips (ARCH-17 option (c)): a dry run that changes nothing.

    python3 -I pipeline/py/pp_pipeline/hcris/cli.py archive-plan <dir of zips> [--archived <keys.txt>]

Each zip is stored once under its content address, `sha256/<hex>` in the `pp-sources` bucket, so a zip CMS posts again
byte for byte is never uploaded twice. Beyond that, only changed years are uploaded: a zip whose derived cells table
is byte-identical to the one pinned for its year is skipped, since the archived zip already reproduces that pin (CMS
regenerates every year's file each posting, so new bytes alone don't mean new data). `--archived` lists keys already
in the bucket, one per line (from `wrangler r2 object list`, when it exists).

Prints, for each zip, upload or skip and why, the totals against R2's free 10 GB-month, and the exact wrangler
commands it would run. It runs none of them: creating the bucket and uploading need Dalton's OK.
"""
import hashlib
from pathlib import Path

from pp_pipeline.files import read_manifest
from pp_pipeline.hcris.pins import BUCKET, archive_key, derive, pin_id

WRANGLER = "npx --no-install wrangler@4.151.0"
FREE_BYTES = 10 * 10**9  # R2's free tier: 10 GB-month of storage (developers.cloudflare.com/r2/pricing)


def plan(zips, manifest, archived=frozenset(), derive_fn=derive):
    """[(path, key, bytes, action, why)] for each zip, action `upload` or `skip`."""
    by_id = {e["id"]: e for e in manifest}
    out = []
    for z in sorted(zips):
        year, data, source = derive_fn(z)
        key = archive_key(source["sha256"])
        entry = by_id.get(pin_id(year))
        pin_sha = hashlib.sha256(data).hexdigest()
        if key in archived:
            action, why = "skip", "already in the bucket"
        elif entry and entry["derivedFrom"]["sha256"] != source["sha256"] and entry["sha256"] == pin_sha:
            action, why = "skip", (f"FY{year}'s cells table is unchanged: the archived zip "
                                   f"{entry['derivedFrom']['sha256'][:12]} reproduces it")
        elif entry and entry["sha256"] == pin_sha:
            action, why = "upload", f"backs the FY{year} pin"
        elif entry:
            action, why = "upload", f"FY{year}'s cells table changed: a new pin"
        else:
            action, why = "upload", f"FY{year} has no pin yet"
        out.append((str(z), key, source["bytes"], action, why))
    return out


def commands(rows):
    cmds = [f"{WRANGLER} r2 bucket create {BUCKET}"]
    cmds += [f"{WRANGLER} r2 object put {BUCKET}/{key} --file={path} --content-type=application/zip --remote"
             for path, key, _, action, _ in rows if action == "upload"]
    return cmds


def gb(n):
    return f"{n / 10**9:.2f} GB"


def main(argv):
    if not argv or (argv[1:2] == ["--archived"] and len(argv) != 3) or len(argv) not in (1, 3):
        print(__doc__.strip())
        return 2
    archived = set()
    if len(argv) == 3:
        archived = {line.strip() for line in Path(argv[2]).read_text().splitlines() if line.strip()}
    zips = sorted(p for p in Path(argv[0]).iterdir()
                  if p.name.upper().startswith("HOSP10FY") and p.suffix.upper() == ".ZIP")
    rows = plan(zips, read_manifest(), frozenset(archived))
    for path, key, size, action, why in rows:
        print(f"{action:6} {Path(path).name:20} {gb(size):>8}  {key[:19]}  {why}")
    up = sum(r[2] for r in rows if r[3] == "upload")
    print(f"\nthis snapshot: {gb(sum(r[2] for r in rows))} in {len(rows)} zips; to upload: {gb(up)}; "
          f"R2 free storage: {gb(FREE_BYTES)} ({up / FREE_BYTES:.0%} of it)")
    print("\ndry run: nothing was created or uploaded. The commands (bucket creation and uploads need Dalton's OK):")
    for c in commands(rows):
        print("  " + c)
    return 0

