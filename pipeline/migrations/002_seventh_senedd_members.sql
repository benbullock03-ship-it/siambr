-- 002: Seventh Senedd (May 2026) party set, cabinet titles, and per-row provenance.
-- SQLite cannot ALTER a CHECK constraint, so both tables are rebuilt.

CREATE TABLE member_tenures_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    party_id TEXT NOT NULL CHECK(party_id IN (
        'labour', 'plaid_cymru', 'conservatives', 'libdems', 'reform_uk', 'greens',
        'ukip', 'independent', 'other')),
    party_label TEXT,
    -- 'profile_current': party as recorded on the Member's official profile at ingest time.
    -- 'curated_reference': backfilled from an independent primary source (see pipeline/reference/)
    -- for First Assembly rows senedd.wales itself carries no party/seat data for.
    party_provenance TEXT NOT NULL DEFAULT 'profile_current'
        CHECK(party_provenance IN ('profile_current', 'moderngov_term', 'curated_reference')),
    senedd_term INTEGER NOT NULL REFERENCES parliamentary_terms(term),
    is_regional_member INTEGER NOT NULL DEFAULT 0 CHECK(is_regional_member IN (0, 1)),
    region_name TEXT,
    -- Seat held during this tenure; members.gss_constituency_code is only the latest seat.
    seat_name TEXT,
    seat_gss_code TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT,
    source_url TEXT,
    CHECK(end_date IS NULL OR end_date >= start_date),
    UNIQUE(member_id, senedd_term, start_date)
);
INSERT INTO member_tenures_new (id, member_id, party_id, senedd_term, is_regional_member, region_name, start_date, end_date)
    SELECT id, member_id, party_id, senedd_term, is_regional_member, region_name, start_date, end_date FROM member_tenures;
DROP TABLE member_tenures;
ALTER TABLE member_tenures_new RENAME TO member_tenures;
CREATE INDEX idx_member_tenures_member ON member_tenures(member_id, senedd_term);

CREATE TABLE ministerial_roles_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    title_en TEXT NOT NULL,
    title_cy TEXT NOT NULL,
    cabinet_level TEXT CHECK(cabinet_level IN (
        'first_minister', 'deputy_first_minister', 'cabinet_secretary', 'cabinet_minister',
        'minister', 'deputy_minister', 'counsel_general')),
    start_date TEXT NOT NULL,
    end_date TEXT,
    provenance TEXT NOT NULL DEFAULT 'senedd_profile'
        CHECK(provenance IN ('senedd_profile', 'gov_wales', 'moderngov', 'curated_reference')),
    source_url TEXT,
    start_date_precision TEXT NOT NULL DEFAULT 'exact' CHECK(start_date_precision IN ('exact', 'term_floor')),
    CHECK(end_date IS NULL OR end_date >= start_date),
    UNIQUE(member_id, title_en, start_date)
);
INSERT INTO ministerial_roles_new (id, member_id, title_en, title_cy, cabinet_level, start_date, end_date)
    SELECT id, member_id, title_en, title_cy, cabinet_level, start_date, end_date FROM ministerial_roles;
DROP TABLE ministerial_roles;
ALTER TABLE ministerial_roles_new RENAME TO ministerial_roles;
CREATE INDEX idx_ministerial_roles_member ON ministerial_roles(member_id, start_date);
