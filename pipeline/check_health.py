"""Retrieval watchdog (siambr-spec.md 8.1).

Compares the live XMLExport index for the window against what the export holds. Any meeting the
Senedd lists that Siambr does not hold is a failure, whatever the cause: a poll that never ran, a
fetch that failed, a sitting silently dropped. This is independent of pipeline.sync's own exit code,
so it catches a green-but-stalled scheduler too.

Unattributed speech is reported but does not fail the check: it is published, not lost.

Usage: python -m pipeline.check_health [--window-days 45] [--out frontend/static/data]
Exit 0 when every listed meeting is held; 1 otherwise, with one ::error:: line per gap.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

from pipeline.adapters import plenary_xml
from pipeline.export import DEFAULT_OUT

WINDOW_DAYS = 45


@dataclass
class HealthReport:
    listed: list[tuple[str, int]] = field(default_factory=list)
    missing: list[tuple[str, int]] = field(default_factory=list)
    held: int = 0
    unattributed_contributions: int = 0
    source_unavailable: str | None = None

    @property
    def ok(self) -> bool:
        return self.source_unavailable is None and not self.missing

    def summary(self) -> str:
        if self.source_unavailable:
            return f"watchdog: could not verify retrieval: {self.source_unavailable}"
        parts = [f"{len(self.listed)} listed", f"{self.held} held"]
        if self.missing:
            parts.append(f"{len(self.missing)} MISSING")
        if self.unattributed_contributions:
            parts.append(f"{self.unattributed_contributions} unattributed speeches")
        return "watchdog: " + ", ".join(parts)


def held_meeting_ids(out: Path) -> set[int]:
    """The meeting ids the export actually carries, from each sitting file's own meeting_id."""
    ids: set[int] = set()
    for path in (out / "sittings").glob("*.json"):
        if path.name == "index.json":
            continue
        try:
            meeting_id = json.loads(path.read_text(encoding="utf-8")).get("meeting_id")
        except (OSError, ValueError):
            continue
        if isinstance(meeting_id, int):
            ids.add(meeting_id)
    return ids


def check(*, window_days: int = WINDOW_DAYS, out: Path = DEFAULT_OUT, today: date | None = None) -> HealthReport:
    today = today or date.today()
    start = today - timedelta(days=window_days)
    report = HealthReport()
    try:
        report.listed = plenary_xml.list_plenary_meetings(start.isoformat(), today.isoformat())
    except Exception as e:  # noqa: BLE001 - any failure to reach the index is the finding
        report.source_unavailable = f"{type(e).__name__}: {e}"
        return report
    held = held_meeting_ids(out)
    report.held = len(held)
    report.missing = [(d, mid) for d, mid in report.listed if mid not in held]
    health = out / "health.json"
    if health.exists():
        try:
            report.unattributed_contributions = json.loads(health.read_text(encoding="utf-8"))["unattributed"]["contributions"]
        except (OSError, ValueError, KeyError, TypeError):
            pass
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--window-days", type=int, default=WINDOW_DAYS)
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    args = parser.parse_args(argv)

    report = check(window_days=args.window_days, out=Path(args.out))
    if report.source_unavailable:
        print(f"::error::the Senedd index could not be read, so retrieval is unverified: {report.source_unavailable}")
    for session_date, meeting_id in report.missing:
        print(f"::error::meeting {meeting_id} ({session_date}) is listed by the Senedd but missing from the export")
    print(report.summary())
    return 0 if report.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
