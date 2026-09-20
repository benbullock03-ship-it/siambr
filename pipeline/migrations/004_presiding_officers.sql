-- 004: Who presides. The Record carries a presiding officer per session (plenary_sessions),
-- but the chamber needs the office-holder for a term before any session is ingested.
-- Rows are curated from senedd.wales announcements and carry their source.

CREATE TABLE presiding_officers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    senedd_term INTEGER NOT NULL REFERENCES parliamentary_terms(term),
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    office TEXT NOT NULL CHECK(office IN ('llywydd', 'deputy_presiding_officer')),
    start_date TEXT NOT NULL,
    end_date TEXT,
    provenance TEXT NOT NULL DEFAULT 'curated_reference'
        CHECK(provenance IN ('senedd_news', 'senedd_profile', 'curated_reference')),
    source_url TEXT NOT NULL,
    CHECK(end_date IS NULL OR end_date >= start_date),
    UNIQUE(senedd_term, office, start_date)
);

CREATE INDEX idx_presiding_officers_term ON presiding_officers(senedd_term, office);

-- Seventh Senedd, elected at the first Plenary meeting, 12 May 2026:
-- "Members of the Senedd have today elected a new Llywydd (Presiding Officer) and
--  Deputy Presiding Officer at the first Plenary meeting of the new Senedd."
INSERT INTO presiding_officers (senedd_term, member_id, office, start_date, end_date, provenance, source_url)
SELECT 7, 'ms-huw-irranca-davies', 'llywydd', '2026-05-12', NULL, 'senedd_news',
       'https://senedd.wales/senedd-now/news/new-llywydd-and-deputy-presiding-officer-elected/'
WHERE EXISTS (SELECT 1 FROM members WHERE id = 'ms-huw-irranca-davies');

INSERT INTO presiding_officers (senedd_term, member_id, office, start_date, end_date, provenance, source_url)
SELECT 7, 'ms-kerry-ferguson', 'deputy_presiding_officer', '2026-05-12', NULL, 'senedd_news',
       'https://senedd.wales/senedd-now/news/new-llywydd-and-deputy-presiding-officer-elected/'
WHERE EXISTS (SELECT 1 FROM members WHERE id = 'ms-kerry-ferguson');
