-- 008: motions and amendments as the Record prints them. XMLExport carries them as
-- unattributed rows (contribution_type I) at the head of a debate: "Motion NDM9293 …",
-- "Amendment 1—Heledd Fychan / Delete all and replace with: …", plus procedural notes
-- ("Motion moved.", "Voting deferred until voting time."). Verbatim, never speech.
CREATE TABLE tabled_texts (
    id TEXT PRIMARY KEY,
    agenda_item_id TEXT NOT NULL REFERENCES agenda_items(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL CHECK(sequence_number >= 0),
    kind TEXT NOT NULL CHECK(kind IN ('motion', 'amendment', 'note')),
    amendment_number INTEGER CHECK(amendment_number IS NULL OR amendment_number > 0),
    original_language TEXT NOT NULL CHECK(original_language IN ('cy', 'en')),
    text_original TEXT NOT NULL CHECK(length(text_original) > 0),
    text_english TEXT NOT NULL,
    UNIQUE(agenda_item_id, sequence_number)
);
