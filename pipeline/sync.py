"""The one command the scheduler runs (siambr-spec.md 8.1, 8.4).

Usage: python -m pipeline.sync [--window-days 21] [--db PATH] [--out frontend/static/data]

Lists the XMLExport index for the window, fetches every listed plenary fresh (Bronze cache
bypassed), replaces sessions whose checksum changed, relinks divisions for the changed dates,
looks up each listed sitting's Senedd TV stream, exports if anything changed, and records one sync_runs row. Idempotent: a run with no upstream
change touches no file. Exit 0 whether or not anything changed; non-zero on an unhandled error.
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
import traceback
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from pipeline import senedd_tv
from pipeline.adapters import plenary_votes, plenary_xml
from pipeline.adapters.http import SourceUnavailable
from pipeline.apply_migrations import apply_migrations
from pipeline.db import DEFAULT_DB_PATH, create_connection
from pipeline.divisions_petitions import upsert_divisions
from pipeline.plenary import known_member_ids
from pipeline.export import DEFAULT_OUT, export_connection
from pipeline.plenary import known_member_ids, normalise, write_session
from pipeline.seed import seed_baseline

WINDOW_DAYS = 21


def utcnow() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass
class SyncResult:
    listed: int = 0
    changed_dates: list[str] = field(default_factory=list)
    unavailable: list[int] = field(default_factory=list)
    divisions: int = 0
    unresolved_divisions: list[str] = field(default_factory=list)
    streams_changed: list[str] = field(default_factory=list)
    exported: bool = False
    error: str | None = None

    @property
    def changed(self) -> int:
        return len(self.changed_dates)

    def summary(self) -> str:
        if self.error:
            return f"sync failed: {self.error}"
        parts = [f"{self.listed} listed", f"{self.changed} changed"]
        if self.changed_dates:
            parts.append("(" + ", ".join(self.changed_dates) + ")")
        if self.unavailable:
            parts.append(f"{len(self.unavailable)} unavailable")
        if self.changed:
            parts.append(f"{self.divisions} divisions relinked")
            if self.unresolved_divisions:
                parts.append(f"{len(self.unresolved_divisions)} divisions unresolved")
        if self.streams_changed:
            parts.append(f"{len(self.streams_changed)} streams changed")
        parts.append("exported" if self.exported else "no export")
        return "sync: " + ", ".join(parts)


def sync(conn: sqlite3.Connection, *, window_days: int = WINDOW_DAYS, today: date | None = None,
         out: Path = DEFAULT_OUT, log=print) -> SyncResult:
    """Run one poll against the live index and return what happened. Raises on an unhandled error."""
    today = today or date.today()
    start = (today - timedelta(days=window_days)).isoformat()
    result = SyncResult()
    apply_migrations(conn)
    seed_baseline(conn)
    known = known_member_ids(conn)

    listed = plenary_xml.list_plenary_meetings(start, today.isoformat())
    result.listed = len(listed)
    changed_meetings: list[tuple[int, str]] = []
    for session_date, meeting_id in listed:
        try:
            body = plenary_xml.fetch_transcript(meeting_id, use_cache=False)
        except SourceUnavailable as e:
            log(f"meeting {meeting_id} ({session_date}): unavailable ({e})")
            result.unavailable.append(meeting_id)
            continue
        n = normalise(body, known, plenary_xml.download_url(meeting_id))
        status = write_session(conn, n)
        if status == "written":
            result.changed_dates.append(n.session_date)
            changed_meetings.append((meeting_id, n.session_date))
            log(f"meeting {meeting_id} ({n.session_date}): replaced; {len(n.items)} items, {len(n.contributions)} speeches")
            for reason in n.skipped:
                log(f"  skipped item {reason}")

    for session_date, meeting_id in listed:
        if meeting_id not in result.unavailable and senedd_tv.refresh_stream(conn, meeting_id, log=log):
            result.streams_changed.append(session_date)

    if result.changed_dates:
        divisions: list[plenary_votes.DivisionRecord] = []
        fetched: set[int] = set()
        for meeting_id, session_date in changed_meetings:
            try:
                divisions.extend(plenary_votes.parse_votes(plenary_votes.fetch_votes(meeting_id, session_date, use_cache=False)))
                fetched.add(meeting_id)
            except SourceUnavailable as e:
                log(f"meeting {meeting_id} ({session_date}): votes unavailable ({e}); its divisions are left as they are")
        counts, unresolved, unmatched = upsert_divisions(conn, divisions, known_member_ids(conn), replace_meetings=fetched)
        result.divisions = counts["divisions"]
        result.unresolved_divisions = unresolved + [f"ballot for {name}" for name in unmatched]
    if result.changed_dates or result.streams_changed:
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        export_connection(conn, out)
        result.exported = True
    return result


def record_run(conn: sqlite3.Connection, started_at: str, result: SyncResult) -> None:
    with conn:
        conn.execute(
            "INSERT INTO sync_runs (started_at, finished_at, sessions_changed, error) VALUES (?, ?, ?, ?)",
            (started_at, utcnow(), result.changed, result.error),
        )
    # The DB file is committed as-is, so nothing may be left in the WAL.
    conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--window-days", type=int, default=WINDOW_DAYS)
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    args = parser.parse_args(argv)

    started_at = utcnow()
    conn = create_connection(args.db)
    try:
        try:
            result = sync(conn, window_days=args.window_days, out=Path(args.out))
        except Exception as e:  # noqa: BLE001 - the row must record whatever went wrong
            result = SyncResult(error=f"{type(e).__name__}: {e}")
            traceback.print_exc(file=sys.stderr)
        apply_migrations(conn)
        record_run(conn, started_at, result)
    finally:
        conn.close()
    print(result.summary())
    return 1 if result.error else 0


if __name__ == "__main__":
    raise SystemExit(main())
