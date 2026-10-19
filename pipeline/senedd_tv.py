"""Senedd TV stream lookup (T-31): meeting ID -> player GUID -> HLS master playlist.

Usage: python -m pipeline.senedd_tv [--meeting-id N ...] [--db PATH]

senedd.tv/en/{meeting_id} embeds player.senedd.tv/Player/Index/{guid}, and that page names the
meeting's master playlist: the interpretation feed. senedd.tv/cy/{meeting_id} embeds a second player
that names the verbatim feed, the floor audio as spoken, over the same pictures. The player page, the master and its first variant playlist are
mirrored to data/bronze/senedd_tv/{year}/ beside a SHA-256 manifest. No URL is built by hand;
export publishes one when its first segment starts within MAX_STREAM_OFFSET_S of the Record's
MeetingDate, the origin of every startPos, together with the measured difference. The player adds
that offset, so a broadcast that began a few seconds before the Record's origin still lines up
frame for frame instead of being withheld.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sqlite3
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

from pipeline.adapters.http import BRONZE_DIR, SourceUnavailable, fetch
from pipeline.apply_migrations import apply_migrations
from pipeline.db import DEFAULT_DB_PATH, create_connection

TV_PAGE = "https://www.senedd.tv/{lang}/{meeting_id}"
# Feed -> the senedd.tv language page whose player names it, and the columns it is stored in.
FEEDS = {
    "interpretation": ("en", "stream_url", "stream_vbegin"),
    "verbatim": ("cy", "stream_url_verbatim", "stream_vbegin_verbatim"),
}
PLAYER_PAGE = "https://player.senedd.tv/Player/Index/{guid}"
# player.senedd.tv redirects to /Player/Error unless the agent names a browser, and at times anyway.
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 Siambr/0.1"
PLAYER_TRIES = 4
SENEDD_TV_BRONZE = BRONZE_DIR / "senedd_tv"
# How far the first segment may sit from the Record's MeetingDate before the stream is refused
# outright: beyond this it is more likely the wrong meeting than a broadcast that began early.
# Observed real offsets are under 10 s, and the player applies the measured value.
MAX_STREAM_OFFSET_S = 300.0
LONDON = ZoneInfo("Europe/London")

_GUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
_PLAYER_GUID = re.compile(rf"player\.senedd\.tv/Player/Index/({_GUID})")
_PLAYER_SRC = re.compile(r'\bsrc:\s*"(https?://[^"]+\.m3u8[^"]*)"')
_PDT = re.compile(rb"^#EXT-X-PROGRAM-DATE-TIME:(\S+)", re.M)


@dataclass(frozen=True)
class Stream:
    url: str
    vbegin: float | None


def http_get(url: str) -> bytes:
    return fetch(url, headers={"User-Agent": USER_AGENT}, retries=3, timeout=30.0)


def player_guid(tv_page: bytes) -> str:
    m = _PLAYER_GUID.search(tv_page.decode("utf-8", "replace"))
    if not m:
        raise SourceUnavailable("senedd.tv page embeds no player")
    return m.group(1)


def master_url(player_page: bytes) -> str:
    """The playlist the player names, on https: the site is https and the CDN serves both."""
    m = _PLAYER_SRC.search(player_page.decode("utf-8", "replace"))
    if not m:
        raise SourceUnavailable("player page names no playlist")
    return re.sub(r"^http://", "https://", m.group(1))


def first_variant_url(master: bytes, url: str) -> str:
    if not master.startswith(b"#EXTM3U"):
        raise SourceUnavailable(f"{url}: not an HLS playlist")
    for line in master.decode("utf-8", "replace").splitlines():
        if line and not line.startswith("#"):
            return urljoin(url, line.strip())
    raise SourceUnavailable(f"{url}: master lists no variant")


def first_segment_time(variant: bytes) -> float | None:
    """Unix seconds of the first EXT-X-PROGRAM-DATE-TIME; None for an uploaded file with no wall clock."""
    m = _PDT.search(variant)
    if not m:
        return None
    return datetime.fromisoformat(m.group(1).decode().replace("Z", "+00:00")).timestamp()


def sitting_start(session_date: str, meeting_start_time: str) -> float:
    return datetime.fromisoformat(f"{session_date}T{meeting_start_time}").replace(tzinfo=LONDON).timestamp()


ANCHORED = "anchored"
UNANCHORED = "unanchored"
REFUSED = "refused"


def stream_placement(vbegin: float | None, session_date: str, meeting_start_time: str | None) -> tuple[str, float | None]:
    """How a stream can be placed on the sitting clock, and the offset the player adds.

    - ``anchored``: the first segment's own wall clock gives the offset exactly.
    - ``unanchored``: the playlist carries no wall clock at all (the publisher never mapped one),
      so the file is played from its own first frame and the page says it is not clock-anchored.
      2026-07-14 is the only sitting like this.
    - ``refused``: there is a wall clock but it is too far from the Record's start to be this
      meeting, or the Record states no start to measure against.
    """
    if not meeting_start_time:
        return REFUSED, None
    if vbegin is None:
        return UNANCHORED, 0.0
    offset = sitting_start(session_date, meeting_start_time) - vbegin
    return (ANCHORED, offset) if abs(offset) <= MAX_STREAM_OFFSET_S else (REFUSED, None)


def stream_offset_s(vbegin: float | None, session_date: str, meeting_start_time: str | None) -> float | None:
    """Seconds to add to sitting time to reach the stream's own timeline; None when refused.

    The stream's first segment is at ``vbegin``; the Record's origin is ``meeting_start_time`` on
    ``session_date``. Positive when the broadcast began before the Record's origin.
    """
    placement, offset = stream_placement(vbegin, session_date, meeting_start_time)
    return offset if placement == ANCHORED else None


def is_aligned(vbegin: float | None, session_date: str, meeting_start_time: str | None) -> bool:
    """True when the stream's placement is measured from its own wall clock."""
    return stream_placement(vbegin, session_date, meeting_start_time)[0] == ANCHORED


def mirror(session_date: str, meeting_id: int, files: list[tuple[str, str, bytes]], feed: str = "interpretation") -> None:
    """Write (suffix, source_url, body) triples and their manifest; unchanged bytes are not rewritten."""
    folder = SENEDD_TV_BRONZE / session_date[:4]
    folder.mkdir(parents=True, exist_ok=True)
    stem = f"{session_date}-{meeting_id}" + ("" if feed == "interpretation" else f"-{feed}")
    lines = []
    for suffix, url, body in files:
        path = folder / f"{stem}-{suffix}"
        if not (path.exists() and path.read_bytes() == body):
            path.write_bytes(body)
        lines.append(f"{hashlib.sha256(body).hexdigest()}  {path.name}  {url}\n")
    manifest = folder / f"{stem}.sha256"
    text = "".join(lines).encode()
    if not (manifest.exists() and manifest.read_bytes() == text):
        manifest.write_bytes(text)


def resolve(meeting_id: int, session_date: str, *, get: Callable[[str], bytes] | None = None,
            feed: str = "interpretation") -> Stream:
    """Raises SourceUnavailable when any step of the lookup fails."""
    get = get or http_get
    guid = player_guid(get(TV_PAGE.format(lang=FEEDS[feed][0], meeting_id=meeting_id)))
    player_url = PLAYER_PAGE.format(guid=guid)
    for attempt in range(PLAYER_TRIES):
        player = get(player_url)
        try:
            url = master_url(player)
            break
        except SourceUnavailable:
            if attempt == PLAYER_TRIES - 1:
                raise
    master = get(url)
    variant_url = first_variant_url(master, url)
    variant = get(variant_url)
    mirror(session_date, meeting_id, [
        ("player.html", player_url, player),
        ("master.m3u8", url, master),
        ("variant.m3u8", variant_url, variant),
    ], feed)
    return Stream(url, first_segment_time(variant))


def store_stream(conn: sqlite3.Connection, session_id: str, stream: Stream, feed: str = "interpretation") -> bool:
    """True when the stored stream changed."""
    _, url_col, vbegin_col = FEEDS[feed]
    row = conn.execute(f"SELECT {url_col}, {vbegin_col} FROM plenary_sessions WHERE id = ?", (session_id,)).fetchone()
    if row is None or (row[0], row[1]) == (stream.url, stream.vbegin):
        return False
    with conn:
        conn.execute(f"UPDATE plenary_sessions SET {url_col} = ?, {vbegin_col} = ? WHERE id = ?",
                     (stream.url, stream.vbegin, session_id))
    return True


def refresh_stream(conn: sqlite3.Connection, meeting_id: int, *, get: Callable[[str], bytes] | None = None,
                   log=print) -> bool:
    """Resolve and store one sitting's streams, each feed on its own. A failed lookup keeps what is stored."""
    session_id = f"plenary-{meeting_id}"
    row = conn.execute("SELECT session_date, meeting_start_time FROM plenary_sessions WHERE id = ?", (session_id,)).fetchone()
    if row is None:
        return False
    session_date, start = row
    changed = False
    for feed in FEEDS:
        label = "stream" if feed == "interpretation" else f"{feed} stream"
        try:
            stream = resolve(meeting_id, session_date, get=get, feed=feed)
        except (SourceUnavailable, ValueError) as e:
            log(f"meeting {meeting_id} ({session_date}): {label} lookup unavailable ({e})")
            continue
        if not store_stream(conn, session_id, stream, feed):
            continue
        changed = True
        placement, offset = stream_placement(stream.vbegin, session_date, start)
        if placement == UNANCHORED:
            log(f"meeting {meeting_id} ({session_date}): {label} has no wall clock, ships unanchored")
        elif placement == REFUSED:
            log(f"meeting {meeting_id} ({session_date}): {label} more than {MAX_STREAM_OFFSET_S:.0f} s out, will not ship")
        else:
            log(f"meeting {meeting_id} ({session_date}): {label} "
                f"first segment {stream.vbegin - sitting_start(session_date, start):+.1f} s from the Record start, "
                f"aligned, offset {offset:+.1f} s")
    return changed


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--meeting-id", type=int, action="append", default=[], help="default: every sitting in Gold")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    args = parser.parse_args(argv)
    conn = create_connection(args.db)
    try:
        apply_migrations(conn)
        ids = args.meeting_id or [int(r[0].removeprefix("plenary-"))
                                  for r in conn.execute("SELECT id FROM plenary_sessions ORDER BY session_date")]
        changed = sum(refresh_stream(conn, mid) for mid in ids)
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    finally:
        conn.close()
    print(f"streams: {len(ids)} looked up, {changed} changed; re-run python -m pipeline.export")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
