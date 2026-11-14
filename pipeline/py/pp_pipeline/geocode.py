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

`run.py geocode --changed` sends only the gap's hospitals whose Care Compare address is new: those the newer file added
with no row yet, and those it gave a different street, city, state or ZIP. Their old rows go (a point for an address
Care Compare no longer gives would be called a street-address match); their matches are written in, and a hospital
with none falls back to its ZIP (one the service didn't answer at all keeps its row). Every other row stays as it was: a full re-run would move points the pages already
show, since the service's answers drift.
"""
import csv
import io
import re
from collections import Counter
import urllib.request
import uuid

from pp_engine.master import universe
from pp_engine import parse
from pp_pipeline.emit_hospital import tables, tdr_points
from pp_pipeline.files import PINNED_DIR

URL = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch"
BENCHMARK = "Public_AR_Current"
USER_AGENT = "paid-and-penalized hospital master geocoding (https://paidandpenalized.org)"
MAX_ROWS = 10_000  # the service's batch limit
MAX_RESPONSE = 10_000_000  # bytes
MIN_MATCHED = 0.5  # share of hospitals that must match before the CSV is written
MIN_GATED = 10  # fewer hospitals sent than this and the share isn't checked: a small batch can miss on its own (a
# hospital the service didn't answer keeps its row, so an outage drops nothing)
OUT = PINNED_DIR / "census-geocodes-2026-10" / "geocodes.csv"
FIELDS = ["ccn", "lat", "lon", "match", "source"]
# (south, north, west, east): conterminous US, Alaska, Hawaii, Puerto Rico and the U.S. Virgin Islands,
# Guam and the Northern Mariana Islands, American Samoa
US_BOUNDS = [(24.3, 49.5, -125.0, -66.8), (51.0, 71.6, -180.0, -129.9), (18.8, 22.4, -160.6, -154.7),
             (17.6, 18.6, -67.4, -64.5), (13.2, 20.6, 144.6, 146.1), (-14.6, -11.0, -171.2, -168.1)]
COORD = re.compile(r"-?\d{1,3}\.\d{1,15}")


def in_us(lat, lon):
    return any(s <= lat <= n and w <= lon <= e for s, n, w, e in US_BOUNDS)


def gap():
    """The master's CCNs with no TDR point that aren't HRRP hospitals, sorted."""
    t = tables()
    return sorted(universe(t["hgi"], t["impact"], t["programs"]) - set(tdr_points()) - t["programs"]["hrrp"]["subject"])


def pinned_rows(path):
    """The pinned CSV's rows ([ccn, lat, lon, match, source] text, as written), its header checked."""
    header, *body = parse.rows(path.read_text(encoding="utf-8"), ",")
    if header != FIELDS:
        raise SystemExit(f"{path.name}: unexpected header {header}")
    return body


ADDRESS = ("street", "city", "state", "zip")


def changed(have):
    """(new, moved): the gap's CCNs whose current Care Compare address is new, each sorted. `new`: listed now but not
    in the previous file, and not in `have` (CCNs the pinned CSV already places). `moved`: listed in both, with a
    different address (compared without case, as candidates() compares). It reads the two files, not what a pinned row
    was geocoded from, so run it once per Care Compare re-pin: a second run sends the moved hospitals again."""
    t = tables()
    now, before = t["hgi"], t["hgi_prior"]

    def address(row):
        return [row[k].upper() for k in ADDRESS]
    listed = [c for c in gap() if c in now]
    return ([c for c in listed if c not in before and c not in have],
            [c for c in listed if c in before and address(now[c]) != address(before[c])])


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
    seen = Counter(r[0] for r in rows)
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
    """({ccn: (lat, lon, match, source)}, unanswered CCNs): every candidate address in one request; each hospital's
    first matched address wins. A hospital none of whose addresses the service answered at all (not even No_Match) is
    unanswered: nothing is known about it, so a caller keeps what it had. A response that doesn't end with a line break
    was cut off mid-row and stops the run."""
    batch = {f"{c}-{n}": a for c, addrs in cands.items() for n, a in enumerate(addrs, 1)}
    if not batch:
        return {}, set()
    if len(batch) > MAX_ROWS:
        raise SystemExit(f"{len(batch)} addresses exceed the geocoder's {MAX_ROWS:,}-row batch limit")
    text = send(batch).lstrip("\ufeff")
    if text and not text.endswith("\n"):
        raise SystemExit("the geocoder's answer was cut off mid-row; nothing written")
    answered = {r[0].strip() for r in csv.reader(io.StringIO(text)) if r}
    unanswered = {c for c, addrs in cands.items() if not any(f"{c}-{n}" in answered for n in range(1, len(addrs) + 1))}
    got = parse_response(text, batch)
    found = {}
    for c, addrs in cands.items():
        for n, a in enumerate(addrs, 1):
            if f"{c}-{n}" in got:
                found[c] = (*got[f"{c}-{n}"], a[0])
                break
    print(f"one request: {len(batch)} addresses for {len(cands)} hospitals; {len(found)} hospitals matched"
          + (f"; {len(unanswered)} not answered at all" if unanswered else ""))
    return found, unanswered


def write(found, attempted, path=OUT, keep=()):
    """Write the CSV sorted by CCN, unless fewer than MIN_MATCHED of `attempted` hospitals matched (an outage or an
    error page must not wipe the points; not checked below MIN_GATED, so `--changed` still drops a re-addressed
    hospital's stale row when its few new addresses all miss). `keep` is rows already written ([ccn, lat, lon, match, source] text), kept
    as they are; a CCN in both raises."""
    if attempted >= MIN_GATED and len(found) < MIN_MATCHED * attempted:
        raise SystemExit(f"only {len(found)} of {attempted} hospitals matched; {path.name} left unchanged")
    rows = {r[0]: r for r in keep}
    if rows.keys() & found.keys():
        raise SystemExit(f"already geocoded: {sorted(rows.keys() & found.keys())[:10]}")
    rows.update({c: [c, f"{lat:.5f}", f"{lon:.5f}", kind, src] for c, (lat, lon, kind, src) in found.items()})
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(FIELDS)
        w.writerows(rows[c] for c in sorted(rows))


def main(send=post, only_changed=False, out=OUT):
    t = tables()
    if only_changed:
        pinned = pinned_rows(out)
        have = {r[0] for r in pinned}
        new, moved = changed(have)
        ccns = sorted(new + moved)
        # A moved hospital is sent at its new Care Compare address alone: POS may still give the old one.
        cands = {**candidates(new, t["hgi"], t["pos"]), **candidates(moved, t["hgi"], {})}
    else:
        pinned, have, ccns = [], set(), gap()
        cands = candidates(ccns, t["hgi"], t["pos"])
    found, unanswered = geocode(cands, send)
    replaced = set(ccns) - unanswered  # an unanswered hospital keeps its row: nothing is known about its new address
    dropped = sorted(have & replaced - found.keys())
    if dropped:
        print(f"no match for a new address; old point dropped ({len(dropped)}): {', '.join(dropped)}")
    write(found, len(cands), path=out, keep=[r for r in pinned if r[0] not in replaced])
    kinds, srcs = Counter(v[2] for v in found.values()), Counter(v[3] for v in found.values())
    print(f"wrote {out.name}: {len(found)} of {len(ccns)} hospitals {dict(kinds)} {dict(srcs)}; "
          f"no address {len(ccns) - len(cands)}, unmatched {len(cands) - len(found)}")
    return 0
