"""Geocode the master's hospitals that Thirty Day Readmissions didn't, with the U.S. Census Bureau Geocoder ->
data/pinned/census-geocodes-2026-10/geocodes.csv.

`python3 -I pipeline/py/run.py geocode` CALLS THE NETWORK (one batch request to geocoding.geo.census.gov). It is run
by hand, once, when the hospital list changes; the build and the tests never call it. The service can't reproduce a
result byte for byte later, so its output is committed as a pinned input.

Ported from Thirty Day Readmissions (pipeline/geocode.py at 80f3659), with one change: a single request carries each
hospital's Care Compare address and, when it differs, its Provider of Services address (ids `<ccn>-1`, `<ccn>-2`),
and the first one that matches wins. The response is untrusted: a row counts only if it echoes a requested id once,
says Match with an Exact/Non_Exact type, names the requested state, and carries well-formed coordinates inside U.S.
bounds. Everything else is ignored, and those hospitals keep the build's ZIP/county placement.

Who is sent: every master hospital with a street address, except those with a TDR point and TDR's HRRP hospitals
(TDR's own call already tried both their addresses with the same benchmark; a new point would break the TDR check).
"""
import csv
import io
import re
import urllib.request
import uuid

from pp_engine.master import universe
from pp_pipeline.emit_hospital import tables, tdr_data, tdr_points
from pp_pipeline.files import PINNED_DIR, REPO_ROOT

URL = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch"
BENCHMARK = "Public_AR_Current"
USER_AGENT = "paid-and-penalized hospital master geocoding (https://paidandpenalized.org)"
MAX_ROWS = 10_000  # the service's batch limit
MAX_RESPONSE = 10_000_000  # bytes
MIN_MATCHED = 0.5  # share of hospitals that must match before the CSV is written
OUT = PINNED_DIR / "census-geocodes-2026-10" / "geocodes.csv"
FIELDS = ["ccn", "lat", "lon", "match", "source"]
# (south, north, west, east): conterminous US, Alaska, Hawaii, Puerto Rico and the U.S. Virgin Islands,
# Guam and the Northern Mariana Islands, American Samoa
US_BOUNDS = [(24.3, 49.5, -125.0, -66.8), (51.0, 71.6, -180.0, -129.9), (18.8, 22.4, -160.6, -154.7),
             (17.6, 18.6, -67.4, -64.5), (13.2, 20.6, 144.6, 146.1), (-14.6, -11.0, -171.2, -168.1)]
COORD = re.compile(r"-?\d{1,3}\.\d{1,15}")


def in_us(lat, lon):
    return any(s <= lat <= n and w <= lon <= e for s, n, w, e in US_BOUNDS)


def hrrp_ids():
    return {h["id"] for h in tdr_data()["hospitals"]}


def gap():
    """The master's CCNs with no TDR point that aren't HRRP hospitals, sorted."""
    t = tables()
    return sorted(universe(t["hgi"], t["impact"], t["programs"]) - set(tdr_points()) - hrrp_ids())


def candidates(ccns, hgi, pos):
    """{ccn: [(source, street, city, st, zip), ...]}: Care Compare first, then a differing POS address."""
    out = {}
    for c in ccns:
        addrs = [(src, r["street"], r["city"], r["state"], r["zip"])
                 for src, r in (("hgi", hgi.get(c)), ("pos", pos.get(c))) if r and r["street"]]
        if len(addrs) == 2 and [a.upper() for a in addrs[0][1:]] == [a.upper() for a in addrs[1][1:]]:
            addrs.pop()
        if addrs:
            out[c] = addrs
    return out


def batch_file(batch):
    """The service's CSV: id, street, city, state, ZIP; no header."""
    buf = io.StringIO()
    csv.writer(buf, lineterminator="\n").writerows([i, *a[1:]] for i, a in batch.items())
    return buf.getvalue().encode("utf-8")


def post(batch, timeout=1800):
    """POST one batch as multipart/form-data; the response body as text."""
    boundary = uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="benchmark"\r\n\r\n{BENCHMARK}\r\n'
            f'--{boundary}\r\nContent-Disposition: form-data; name="addressFile"; filename="addresses.csv"\r\n'
            f"Content-Type: text/csv\r\n\r\n").encode() + batch_file(batch) + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}",
                                                         "User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read(MAX_RESPONSE + 1)
    if len(data) > MAX_RESPONSE:
        raise SystemExit(f"geocoder response over {MAX_RESPONSE:,} bytes; refusing it")
    return data.decode("utf-8", errors="replace")


def parse_response(text, batch):
    """{id: (lat, lon, match type)} from the service's CSV, keeping only well-formed, in-bounds, same-state matches
    for ids in `batch` that appear exactly once."""
    rows = [r for r in csv.reader(io.StringIO(text)) if r and r[0] in batch]
    seen = {}
    for r in rows:
        seen[r[0]] = seen.get(r[0], 0) + 1
    out = {}
    for r in rows:
        if seen[r[0]] != 1 or len(r) < 6 or r[2] != "Match" or r[3] not in ("Exact", "Non_Exact"):
            continue
        parts = r[5].split(",")
        matched = r[4].split(", ")
        if len(parts) != 2 or not all(COORD.fullmatch(p) for p in parts) or len(matched) < 3:
            continue
        lon, lat = float(parts[0]), float(parts[1])
        if matched[-2] == batch[r[0]][3].upper() and in_us(lat, lon):
            out[r[0]] = (lat, lon, r[3])
    return out


def geocode(cands, send=post):
    """{ccn: (lat, lon, match, source)}: every candidate address in one request; each hospital's first matched
    address wins."""
    batch = {f"{c}-{n}": a for c, addrs in cands.items() for n, a in enumerate(addrs, 1)}
    if len(batch) > MAX_ROWS:
        raise SystemExit(f"{len(batch)} addresses exceed the geocoder's {MAX_ROWS:,}-row batch limit")
    got = parse_response(send(batch), batch)
    found = {}
    for c, addrs in cands.items():
        n = next((n for n in range(1, len(addrs) + 1) if f"{c}-{n}" in got), None)
        if n:
            lat, lon, kind = got[f"{c}-{n}"]
            found[c] = (lat, lon, kind, addrs[n - 1][0])
    print(f"one request: {len(batch)} addresses for {len(cands)} hospitals; {len(found)} hospitals matched")
    return found


def write(found, attempted, path=OUT):
    """Write the CSV sorted by CCN, unless fewer than MIN_MATCHED of `attempted` hospitals matched (an outage or an
    error page must not wipe the points)."""
    if len(found) < MIN_MATCHED * attempted:
        raise SystemExit(f"only {len(found)} of {attempted} hospitals matched; {path.name} left unchanged")
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(FIELDS)
        w.writerows([c, f"{lat:.5f}", f"{lon:.5f}", kind, src] for c, (lat, lon, kind, src) in sorted(found.items()))


def main(send=post):
    ccns = gap()
    t = tables()
    cands = candidates(ccns, t["hgi"], t["pos"])
    found = geocode(cands, send)
    write(found, len(cands))
    kinds = {k: sum(1 for v in found.values() if v[2] == k) for k in ("Exact", "Non_Exact")}
    srcs = {k: sum(1 for v in found.values() if v[3] == k) for k in ("hgi", "pos")}
    print(f"wrote {OUT.relative_to(REPO_ROOT)}: {len(found)} of {len(ccns)} hospitals {kinds} {srcs}; "
          f"no address {len(ccns) - len(cands)}, unmatched {len(cands) - len(found)}")
    return 0
