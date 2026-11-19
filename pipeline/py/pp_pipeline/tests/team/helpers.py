"""Shared, cached builds for the TEAM tests: one fresh build of the file and one parse of the pins per test run."""
import functools

from pp_pipeline import emit_team
from pp_pipeline.files import read_manifest


@functools.lru_cache(maxsize=None)
def fresh():
    """The TEAM file built from the pins now (a fixed `built_at`)."""
    return emit_team.build_with_notes("2000-01-01T00:00:00Z")[0]


@functools.lru_cache(maxsize=None)
def pins():
    """The pins parsed (emit_team.Inputs)."""
    return emit_team.Inputs(read_manifest())
