"""Entry point for the HCRIS layer until it has `run.py` commands (shared-files.patch adds them):

    python3 -I pipeline/py/pp_pipeline/hcris/cli.py <command> ...

  pin [--entries <file> --posted <date> --retrieved <date>] <zip> ...   derive the pinned cells tables (pins.py)
  emit                                       write data/emitted/hcris/fy<YYYY>/hcris.json from the pins (emit.py)
  downloads <dir>                            write the wide and long download CSVs (emit.py)
  puf-check <CostReport_<YYYY>_Final.csv> ...   compare the pins with CMS's PUF (puf.py)
  puf-sample <out.csv> <PUF csv> ...         write the offline test's PUF extract (puf.py)
  archive-plan <dir> [--archived <keys>]     the R2 archive dry run (archive.py)
  extract --out <dir> <zip> ...              the spike's table straight from zips (extract.py)
  crosscheck <wide.csv> <year> <puf|nber> <ref.csv> [<master>]   the spike's hospital-year check (crosscheck.py)

Puts the two package roots on the path the way run.py does (isolated mode keeps the script's folder off it).
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path[:0] = [str(ROOT / "engine" / "py"), str(ROOT / "pipeline" / "py")]


def main(argv):
    command, args = (argv[0], argv[1:]) if argv else (None, [])
    if command == "pin":
        from pp_pipeline.hcris import pins
        return pins.main(args)
    if command == "emit" and not args:
        from pp_pipeline.hcris import emit
        return emit.main()
    if command == "downloads" and len(args) == 1:
        from pp_pipeline.hcris import emit
        for year, n in emit.write_downloads(args[0]).items():
            print(f"FY{year}: {n} hospital-years")
        return 0
    if command == "puf-check" and args:
        from pp_pipeline.hcris import puf
        return puf.main_check(args)
    if command == "puf-sample" and len(args) >= 2:
        from pp_pipeline.hcris import puf
        return puf.main_sample(args[0], args[1:])
    if command == "archive-plan":
        from pp_pipeline.hcris import archive
        return archive.main(args)
    if command == "extract":
        from pp_pipeline.hcris import extract
        return extract.main(args)
    if command == "crosscheck":
        from pp_pipeline.hcris import crosscheck
        return crosscheck.main(args)
    print(__doc__.strip(), file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
