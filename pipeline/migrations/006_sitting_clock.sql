-- 006: the sitting clock. record_published_at is the transcript's dataroot@generated
-- (Senedd's own publication stamp; it moves on every revision). meeting_start_time is the
-- HH:MM:SS of <MeetingDate>, the wall clock at Senedd TV offset 0.

ALTER TABLE plenary_sessions ADD COLUMN record_published_at TEXT;
ALTER TABLE plenary_sessions ADD COLUMN meeting_start_time TEXT
    CHECK(meeting_start_time IS NULL OR meeting_start_time GLOB '[0-2][0-9]:[0-5][0-9]:[0-5][0-9]');

CREATE TABLE sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    sessions_changed INTEGER NOT NULL DEFAULT 0,
    error TEXT
);
