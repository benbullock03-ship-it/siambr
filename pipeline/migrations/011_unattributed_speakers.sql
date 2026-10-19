-- 011: a speech the Record does not attribute to a Member is published, not withheld.
--
-- The Record sometimes gives a speaker who is not an MS (the Counsel General answering questions)
-- or an anonymous label ("Aelod o'r Senedd / Member of the Senedd", Modern.Gov ID 7). The old
-- schema required a member_id, so ingest skipped the whole agenda item. Now member_id may be NULL
-- and the publisher's own speaker label and role are stored verbatim.
--
-- SQLite cannot drop NOT NULL in place, so the table is rebuilt. Rowids are copied explicitly:
-- debate_contributions_fts is keyed by rowid and stays valid. The existing triggers are dropped
-- with the table and recreated below with the unattributed fallbacks.

CREATE TABLE debate_contributions_new (
    id TEXT PRIMARY KEY,
    agenda_item_id TEXT NOT NULL REFERENCES agenda_items(id) ON DELETE CASCADE,
    member_id TEXT REFERENCES members(id),
    -- The publisher's own words for an unattributed speaker; NULL for a Member.
    speaker_name TEXT,
    -- The publisher's job title for that speaker ("Counsel General"); NULL when none is given.
    speaker_role TEXT,
    sequence_number INTEGER NOT NULL CHECK(sequence_number >= 0),
    spoken_language TEXT NOT NULL CHECK(spoken_language IN ('cy', 'en')),
    verbatim_text_original TEXT NOT NULL CHECK(length(verbatim_text_original) > 0),
    verbatim_text_english TEXT NOT NULL,
    video_timestamp_start INTEGER CHECK(video_timestamp_start IS NULL OR video_timestamp_start >= 0),
    video_timestamp_end INTEGER,
    UNIQUE(agenda_item_id, sequence_number),
    CHECK(member_id IS NOT NULL OR speaker_name IS NOT NULL),
    CHECK(video_timestamp_end IS NULL OR video_timestamp_start IS NULL OR video_timestamp_end >= video_timestamp_start)
);

INSERT INTO debate_contributions_new (
    rowid, id, agenda_item_id, member_id, sequence_number, spoken_language,
    verbatim_text_original, verbatim_text_english, video_timestamp_start, video_timestamp_end
)
SELECT rowid, id, agenda_item_id, member_id, sequence_number, spoken_language,
       verbatim_text_original, verbatim_text_english, video_timestamp_start, video_timestamp_end
FROM debate_contributions;

DROP TABLE debate_contributions;
ALTER TABLE debate_contributions_new RENAME TO debate_contributions;

CREATE INDEX idx_contributions_member ON debate_contributions(member_id);

-- The FTS row for a speech carries the Member's canonical name, or the publisher's label when the
-- speaker is not a Member, so unattributed speech stays searchable.
CREATE TRIGGER debate_contributions_fts_ai AFTER INSERT ON debate_contributions BEGIN
    INSERT INTO debate_contributions_fts (rowid, verbatim_text_english, canonical_name, title_en)
    SELECT new.rowid, new.verbatim_text_english,
           COALESCE((SELECT canonical_name FROM members WHERE id = new.member_id), new.speaker_name),
           (SELECT title_en FROM agenda_items WHERE id = new.agenda_item_id);
END;

CREATE TRIGGER debate_contributions_fts_ad AFTER DELETE ON debate_contributions BEGIN
    DELETE FROM debate_contributions_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER debate_contributions_fts_au AFTER UPDATE ON debate_contributions BEGIN
    DELETE FROM debate_contributions_fts WHERE rowid = old.rowid;
    INSERT INTO debate_contributions_fts (rowid, verbatim_text_english, canonical_name, title_en)
    SELECT new.rowid, new.verbatim_text_english,
           COALESCE((SELECT canonical_name FROM members WHERE id = new.member_id), new.speaker_name),
           (SELECT title_en FROM agenda_items WHERE id = new.agenda_item_id);
END;

-- The health watchdog reads what the last poll saw, so the run row records the reconciliation.
ALTER TABLE sync_runs ADD COLUMN meetings_listed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sync_runs ADD COLUMN meetings_unavailable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sync_runs ADD COLUMN unattributed_contributions INTEGER NOT NULL DEFAULT 0;
