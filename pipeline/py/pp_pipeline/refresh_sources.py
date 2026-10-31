"""What `make refresh SITE=<site>` fetches for each site, and how a fetched file becomes a pin (pp_pipeline/refresh.py
runs the rest). `fetch` CALLS THE NETWORK; the build and the tests never do.

Each site's sources are in pp_pipeline/refresh_sites.py. A dataset's metastore record names the file CMS serves now; the file
is downloaded, checked and compared with the pin:
  - the same bytes: nothing is written (CMS's URL or dates moving with the bytes unchanged is reported, not written);
  - new bytes for the year pinned (a correction): the file and its manifest entry are replaced in place;
  - new bytes for a later year: the pinned entry is renamed to the source's archive id (the scheme the earlier years
    already use, e.g. hacrp-fy2025) and keeps its file, and the new year's file is pinned under the dataset id in its
    own year folder.
Everything a download says is untrusted: requests go to https://data.cms.gov only (redirects too); the file name must
fully match the source's pattern before it becomes a path; the text must be UTF-8 CSV with the key columns the site
reads; dates are copied only as YYYY-MM-DD. Nothing from a download is run.
"""
import csv
import hashlib
import http.client
import json
import re
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import NamedTuple, Optional, Tuple

from pp_engine.parse import rows as rows_of
from pp_pipeline.files import pin_matches

HOST = "data.cms.gov"
METASTORE = "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/{}"
LANDING = "https://data.cms.gov/provider-data/dataset/{}"
RESOURCES = "/provider-data/sites/default/files/resources/"  # where the catalog serves a dataset's current file
MAX_RECORD = 1_000_000  # a metastore record is about 2 KB
MAX_PIN = 10 * 1024 * 1024 - 1  # a pin of 10 MiB or more never goes in git: the pre-commit hook and a test refuse it
TIMEOUT = 30  # seconds per request, in all: a server dripping bytes can't stretch it
DATE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")  # ASCII digits: Python's \d matches any script's
YEAR = re.compile(r"[0-9]{4}")


class RefreshError(Exception):
    """A refresh step that can't go on: the message says why and what to look at."""


class PdcSource(NamedTuple):
    """One Provider Data Catalog dataset a site pins. Its current file's manifest id is the dataset id."""
    dataset: str
    file: str  # a pattern CMS's file name must fully match; a group named fy, when the name carries the year
    folder: str  # its folder under data/pinned/; "{fy}" is the file's fiscal year
    columns: Tuple[str, ...]  # the header must have these (the key ones; the site's reader checks the rest at emit)
    fy_column: Optional[str] = None  # the column holding the file's one fiscal year
    title: Optional[str] = None  # the manifest title, "{fy}" filled; None keeps the entry's own
    archive: Optional[str] = None  # the pinned entry's id when a later year replaces it, "{fy}" its year


class Found(NamedTuple):
    """Where a dataset's current file is, from its metastore record."""
    url: str
    name: str  # the file name, already matched against the source's pattern
    fy: Optional[int]  # the year in the file name, when the pattern has one
    modified: Optional[str]
    released: Optional[str]


def check_url(url):
    """Raise unless url is https on HOST (default port, no credentials): the only place a refresh reads from."""
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != "https" or parts.hostname != HOST or parts.port not in (None, 443) or parts.username is not None:
        raise RefreshError(f"refusing {url!r}: a refresh reads only https://{HOST}/")


class _SameHost(urllib.request.HTTPRedirectHandler):
    """Follows a redirect only to HOST over https."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        check_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_OPENER = urllib.request.build_opener(_SameHost)


def fetch(url, cap, timeout=TIMEOUT):
    """url's body, refused unless it answers 200 within `timeout` seconds in all with at most `cap` bytes. No
    User-Agent is set, so urllib's own goes out: data.cms.gov's CDN refuses browser-like and custom agents."""
    check_url(url)
    deadline = time.monotonic() + timeout
    try:
        with _OPENER.open(urllib.request.Request(url), timeout=timeout) as r:
            check_url(r.geturl())
            if r.status != 200:
                raise RefreshError(f"{url}: HTTP {r.status}")
            chunks, size = [], 0
            while True:
                chunk = r.read1(65536)  # what one receive brings, so the deadline is checked as bytes arrive
                if not chunk:
                    return b"".join(chunks)
                size += len(chunk)
                if size > cap:
                    raise RefreshError(f"{url}: more than {cap:,} bytes")
                if time.monotonic() > deadline:
                    raise RefreshError(f"{url}: over {timeout} s")
                chunks.append(chunk)
    except (OSError, http.client.HTTPException) as e:  # urllib's HTTP, network and timeout errors
        raise RefreshError(f"{url}: {e}") from None


def _date(value):
    return value if isinstance(value, str) and DATE.fullmatch(value) else None


def locate(source, record):
    """A Found from a dataset's metastore record (bytes). Raises unless the record is the dataset's and its first
    distribution is a file under RESOURCES on HOST whose name fully matches the source's pattern."""
    try:
        meta = json.loads(record)
    except ValueError as e:
        raise RefreshError(f"{source.dataset}: the metastore record is not JSON ({e})") from None
    if not isinstance(meta, dict) or meta.get("identifier") != source.dataset:
        raise RefreshError(f"{source.dataset}: the metastore record is not this dataset's")
    dist = meta.get("distribution")
    url = dist[0].get("downloadURL") if isinstance(dist, list) and dist and isinstance(dist[0], dict) else None
    if not isinstance(url, str):
        raise RefreshError(f"{source.dataset}: the metastore record names no download URL")
    check_url(url)
    parts = urllib.parse.urlsplit(url)
    segments = urllib.parse.unquote(parts.path).split("/")
    if not parts.path.startswith(RESOURCES) or parts.query or parts.fragment or {".", ".."} & set(segments):
        raise RefreshError(f"{source.dataset}: the download URL {url!r} is not a catalog file")
    name = urllib.parse.unquote(parts.path.rsplit("/", 1)[1])
    m = re.fullmatch(source.file, name, re.ASCII)
    if not m:
        raise RefreshError(f"{source.dataset}: CMS's file name {name!r} doesn't match {source.file!r}; if CMS renamed "
                           "the file, update its entry in pp_pipeline/refresh_sites.py")
    fy = int(m.group("fy")) if "fy" in m.groupdict() else None
    return Found(url, name, fy, _date(meta.get("modified")), _date(meta.get("released")))


def _table(source, data):
    """(header, non-empty rows) of a source's file (bytes); raises unless it is UTF-8 CSV with a row."""
    label = source.dataset
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as e:
        raise RefreshError(f"{label}: not UTF-8 text ({e.reason} at byte {e.start})") from None
    try:
        reader = rows_of(text, ",")  # the pipeline's reader: a byte-order mark is dropped, as the site's reader drops it
        header = next(reader, None) or []
        rows = [r for r in reader if r]
    except csv.Error as e:
        raise RefreshError(f"{label}: not readable as CSV ({e})") from None
    if not rows:
        raise RefreshError(f"{label}: no rows")
    return header, rows


def file_year(source, data):
    """The one four-digit fiscal year in a source's file (bytes); None for a source without a year column."""
    if source.fy_column is None:
        return None
    header, rows = _table(source, data)
    if source.fy_column not in header:
        raise RefreshError(f"{source.dataset}: the header lacks {source.fy_column!r}")
    col = header.index(source.fy_column)
    years = {r[col] if col < len(r) else "" for r in rows}
    if len(years) != 1 or not YEAR.fullmatch(next(iter(years))):
        raise RefreshError(f"{source.dataset}: expected one fiscal year in {source.fy_column!r}, found {sorted(years)[:5]}")
    return int(years.pop())


def check_csv(source, data, name_fy=None):
    """The fiscal year of a source's file (bytes), None for a source without one. Raises unless it is UTF-8 CSV whose
    header has the source's columns, with at least one row and, with a year column, one four-digit year that agrees
    with the year in the file name (name_fy), when that is given."""
    header, _ = _table(source, data)
    missing = [c for c in source.columns if c not in header]
    if missing:
        raise RefreshError(f"{source.dataset}: the header lacks {missing}")
    fy = file_year(source, data)
    label = source.dataset
    if name_fy is not None and fy != name_fy:
        raise RefreshError(f"{label}: the file is named for FY{name_fy} but holds FY{fy}")
    return fy


class Pinned(NamedTuple):
    """What pinning one source did: status unchanged, replaced or new-year (the archived entry is in the manifest, right
    after the new one); the dataset's entry before and after; and CMS's record moving with the bytes unchanged (`drift`,
    not written)."""
    status: str
    before: dict
    after: dict
    drift: Tuple[str, ...] = ()


def _inside(root, path):
    """The file at a manifest path, refused unless it resolves under root (the pinned folder, resolved)."""
    target = (root / path).resolve()
    if root not in target.parents:
        raise RefreshError(f"refusing pinned path {path!r}: outside data/pinned/")
    return target


def apply_pin(manifest, source, found, data, today, pinned_dir):
    """Pin a checked download: (the new manifest, Pinned). Writes the file when it is new; the caller writes the
    manifest. data: the file's bytes; today: YYYY-MM-DD, the entry's `retrieved`. A new entry is built afresh from
    CMS's record: anything else the old one carried (a note, an archive copy's URL) described the old bytes."""
    index = next((i for i, e in enumerate(manifest) if e["id"] == source.dataset), None)
    if index is None:
        raise RefreshError(f"{source.dataset}: no manifest entry to refresh (a first pin is made by hand)")
    before = manifest[index]
    if pin_matches(before, data):
        drift = tuple(f"{key} {before.get(key)} -> {value}" for key, value in
                      (("downloadUrl", found.url), ("pdcModified", found.modified), ("pdcReleased", found.released))
                      if value is not None and before.get(key) != value)
        return manifest, Pinned("unchanged", before, before, drift=drift)

    root = Path(pinned_dir).resolve()
    fy = check_csv(source, data, found.fy)
    pinned_fy = file_year(source, _inside(root, before["path"]).read_bytes())  # only its year: columns may have moved
    path = f"{source.folder.format(fy=fy)}/{found.name}"
    target = _inside(root, path)
    entry = {
        "id": source.dataset,
        "title": source.title.format(fy=fy) if source.title else before["title"],
        "path": path,
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "downloadUrl": found.url,
        "landingPage": before.get("landingPage") or LANDING.format(source.dataset),
        "pdcModified": found.modified,
        "pdcReleased": found.released,
        "retrieved": today,
    }
    entry = {k: v for k, v in entry.items() if v is not None}
    taken = {e["path"] for i, e in enumerate(manifest) if i != index}
    if path in taken:
        raise RefreshError(f"{source.dataset}: {path} is already another entry's pin")
    out = list(manifest)
    out[index] = entry
    archived = None
    if pinned_fy is not None and fy != pinned_fy:
        if fy < pinned_fy or source.archive is None:
            raise RefreshError(f"{source.dataset}: CMS's file is FY{fy}, the pin FY{pinned_fy}; only a later year "
                               "with an archive id is pinned automatically")
        archived = {**before, "id": source.archive.format(fy=pinned_fy),
                    "note": f"The current year's pin ({source.dataset}) until {today}, when FY{fy} replaced it."}
        if any(e["id"] == archived["id"] for e in manifest):
            raise RefreshError(f"{source.dataset}: the archive id {archived['id']} is already in the manifest")
        if path == before["path"]:
            raise RefreshError(f"{source.dataset}: FY{fy}'s file would overwrite FY{pinned_fy}'s at {path}")
        out.insert(index + 1, archived)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    if not archived and before["path"] != path and before["path"] not in taken:
        _inside(root, before["path"]).unlink()  # replaced under a new name; the old bytes stay in git history
    return out, Pinned("new-year" if archived else "replaced", before, entry)


def refresh_source(manifest, source, get, today, pinned_dir, downloads):
    """Fetch one source's current file and pin it: (the new manifest, Pinned). get: fetch, or a test's fake. Each
    download is also kept, untouched, in its own new folder under `downloads`, for a person to look at."""
    found = locate(source, get(METASTORE.format(source.dataset), MAX_RECORD))
    data = get(found.url, MAX_PIN)
    (Path(tempfile.mkdtemp(prefix=f"download-{source.dataset}-", dir=downloads)) / found.name).write_bytes(data)
    return apply_pin(manifest, source, found, data, today, pinned_dir)
