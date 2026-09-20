-- 003: FTS5 index over speeches (English text), member name, and agenda title.
-- Self-contained (not external-content) so snippet()/highlight() have text to slice;
-- triggers on debate_contributions keep it in sync, keyed by rowid.

CREATE VIRTUAL TABLE debate_contributions_fts USING fts5(
    verbatim_text_english,
    canonical_name,
    title_en,
    tokenize='porter unicode61'
);

INSERT INTO debate_contributions_fts (rowid, verbatim_text_english, canonical_name, title_en)
SELECT dc.rowid, dc.verbatim_text_english, m.canonical_name, a.title_en
FROM debate_contributions dc
JOIN members m ON m.id = dc.member_id
JOIN agenda_items a ON a.id = dc.agenda_item_id;

CREATE TRIGGER debate_contributions_fts_ai AFTER INSERT ON debate_contributions BEGIN
    INSERT INTO debate_contributions_fts (rowid, verbatim_text_english, canonical_name, title_en)
    SELECT new.rowid, new.verbatim_text_english, m.canonical_name, a.title_en
    FROM members m, agenda_items a
    WHERE m.id = new.member_id AND a.id = new.agenda_item_id;
END;

CREATE TRIGGER debate_contributions_fts_ad AFTER DELETE ON debate_contributions BEGIN
    DELETE FROM debate_contributions_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER debate_contributions_fts_au AFTER UPDATE ON debate_contributions BEGIN
    DELETE FROM debate_contributions_fts WHERE rowid = old.rowid;
    INSERT INTO debate_contributions_fts (rowid, verbatim_text_english, canonical_name, title_en)
    SELECT new.rowid, new.verbatim_text_english, m.canonical_name, a.title_en
    FROM members m, agenda_items a
    WHERE m.id = new.member_id AND a.id = new.agenda_item_id;
END;
