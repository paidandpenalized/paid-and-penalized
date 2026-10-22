"""Python entry point: `python3 -I pipeline/py/run.py <command>`.

Isolated mode (-I) keeps the working directory and user site-packages off sys.path; the two package roots are added
here instead, so nothing needs installing. Commands: `test`, `emit`, `extract-pos <raw POS csv>`,
`extract-hai <zip> <pin id>` (see pp_pipeline/hai_extract.py), and `geocode`, which calls the U.S. Census Bureau
Geocoder over the network (run by hand only; see pp_pipeline/geocode.py).
"""
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PACKAGES = {"pp_engine": REPO_ROOT / "engine" / "py", "pp_pipeline": REPO_ROOT / "pipeline" / "py"}  # name -> root
sys.path[:0] = [str(root) for root in PACKAGES.values()]


def run_tests():
    suite = unittest.TestSuite()
    for package, root in PACKAGES.items():
        suite.addTests(unittest.defaultTestLoader.discover(str(root / package / "tests"), top_level_dir=str(root)))
    return 0 if unittest.TextTestRunner(verbosity=1).run(suite).wasSuccessful() else 1


def main(argv):
    command, args = (argv[0], argv[1:]) if argv else (None, [])
    if command == "test" and not args:
        return run_tests()
    if command == "emit" and not args:
        from pp_pipeline import emit_hospital
        return emit_hospital.main()
    if command == "geocode" and not args:
        from pp_pipeline import geocode
        return geocode.main()
    if command == "extract-pos" and len(args) == 1:
        from pp_pipeline import pos_extract
        return pos_extract.main(args[0])
    if command == "extract-hai" and len(args) == 2:
        from pp_pipeline import hai_extract
        return hai_extract.main(args[0], args[1])
    print(__doc__.strip(), file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
