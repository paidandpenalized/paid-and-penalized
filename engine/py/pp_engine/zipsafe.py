"""Safety checks on a zip's central directory, before any member is inflated. Pure: takes an open ZipFile.

The member-name rule is ported from the member check in Thirty Day Readmissions' pipeline/fetch.py (33d1959).
"""
from pp_engine.parse import SchemaError

MAX_MEMBER_BYTES = 100_000_000  # a larger declared member is refused rather than inflated
MAX_MEMBERS = 1000  # a CMS zip or workbook holds a few dozen members; far more is not one


def unsafe_member_names(names):
    """The zip member names that could escape a folder they were extracted into: absolute (`/`), a drive letter, a
    `..` part or a backslash."""
    return [n for n in names
            if n.startswith("/") or "\\" in n or ".." in n.split("/") or (len(n) > 1 and n[1] == ":")]


def check_zip(zf, label, max_members=None, max_member_bytes=None):
    """SchemaError, naming `label`, unless every member name is safe, the member count is at most `max_members` and
    no member declares more than `max_member_bytes` uncompressed (defaults: the module's MAX_MEMBERS and
    MAX_MEMBER_BYTES, read at call time). Reads the central directory only."""
    max_members = MAX_MEMBERS if max_members is None else max_members
    max_member_bytes = MAX_MEMBER_BYTES if max_member_bytes is None else max_member_bytes
    infos = zf.infolist()
    if len(infos) > max_members:
        raise SchemaError(f"{label}: zip has {len(infos):,} members")
    bad = unsafe_member_names([i.filename for i in infos])
    if bad:
        raise SchemaError(f"{label}: unsafe zip member name {bad[0]!r}")
    for info in infos:
        if info.file_size > max_member_bytes:
            raise SchemaError(f"{label}: member {info.filename} is {info.file_size:,} bytes")
