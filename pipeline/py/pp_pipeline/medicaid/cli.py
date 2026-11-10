"""Entry point for the Medicaid pins that have no `run.py` command (the scenarios themselves are `run.py medicaid build`):

    python3 -I pipeline/py/pp_pipeline/medicaid/cli.py safety-net-pin <HOSP10FY2023.ZIP> <hosp10-reports.zip> <out.csv>

Puts the two package roots on the path the way run.py does (isolated mode keeps the script's folder off it).
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path[:0] = [str(ROOT / "engine" / "py"), str(ROOT / "pipeline" / "py")]


def main(argv):
    if argv[:1] == ["safety-net-pin"]:
        from pp_pipeline.medicaid import safety_net
        return safety_net.main(argv[1:])
    print(__doc__.strip(), file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
