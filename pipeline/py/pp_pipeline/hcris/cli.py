"""Entry point for the HCRIS layer until it has a `run.py` command:

    python3 -I pipeline/py/pp_pipeline/hcris/cli.py extract --out <dir> <HOSP10FY<YYYY>.ZIP> ...
    python3 -I pipeline/py/pp_pipeline/hcris/cli.py crosscheck <hcris_wide.csv> <reference csv> <hospital master>

Puts the two package roots on the path the way run.py does (isolated mode keeps the script's folder off it).
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path[:0] = [str(ROOT / "engine" / "py"), str(ROOT / "pipeline" / "py")]


def main(argv):
    command, args = (argv[0], argv[1:]) if argv else (None, [])
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
