-- 001: baseline Siambr schema. Dates are ISO-8601 text (YYYY-MM-DD).

CREATE TABLE parliamentary_terms (
    term INTEGER PRIMARY KEY CHECK(term BETWEEN 1 AND 7),
    label_en TEXT NOT NULL,
    label_cy TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    seat_count INTEGER NOT NULL CHECK(seat_count IN (60, 96))
);

CREATE TABLE policy_domains (
    id TEXT PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_cy TEXT NOT NULL,
    wing_label TEXT NOT NULL,
    bearing_degrees INTEGER NOT NULL UNIQUE CHECK(bearing_degrees BETWEEN 0 AND 359)
);

CREATE TABLE members (
    id TEXT PRIMARY KEY,
    gss_constituency_code TEXT,
    constituency_name_en TEXT NOT NULL,
    constituency_name_cy TEXT NOT NULL,
    canonical_name TEXT NOT NULL,
    cymraeg_name TEXT,
    honorific TEXT,
    portrait_url TEXT,
    official_profile_url TEXT NOT NULL,
    current_status TEXT NOT NULL CHECK(current_status IN ('active', 'former', 'deceased'))
);

CREATE TABLE member_tenures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    party_id TEXT NOT NULL CHECK(party_id IN ('labour', 'plaid_cymru', 'conservatives', 'libdems', 'independent', 'other')),
    senedd_term INTEGER NOT NULL REFERENCES parliamentary_terms(term),
    is_regional_member INTEGER NOT NULL DEFAULT 0 CHECK(is_regional_member IN (0, 1)),
    region_name TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT,
    CHECK(end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE ministerial_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    title_en TEXT NOT NULL,
    title_cy TEXT NOT NULL,
    cabinet_level TEXT CHECK(cabinet_level IN ('first_minister', 'cabinet_secretary', 'deputy_minister', 'counsel_general')),
    start_date TEXT NOT NULL,
    end_date TEXT,
    CHECK(end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE plenary_sessions (
    id TEXT PRIMARY KEY,
    senedd_term INTEGER NOT NULL REFERENCES parliamentary_terms(term),
    session_date TEXT NOT NULL,
    title_en TEXT NOT NULL,
    title_cy TEXT NOT NULL,
    presiding_officer_id TEXT REFERENCES members(id) ON DELETE SET NULL,
    source_xml_url TEXT NOT NULL,
    xml_sha256 TEXT NOT NULL CHECK(length(xml_sha256) = 64)
);

CREATE TABLE agenda_items (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES plenary_sessions(id) ON DELETE CASCADE,
    item_order INTEGER NOT NULL CHECK(item_order >= 0),
    item_type TEXT NOT NULL CHECK(item_type IN ('debate', 'oral_questions', 'statement', 'bill_stage', 'emergency_debate')),
    title_en TEXT NOT NULL,
    title_cy TEXT NOT NULL,
    policy_domain_id TEXT NOT NULL REFERENCES policy_domains(id),
    senedd_tv_clip_id TEXT,
    senedd_tv_clip_url TEXT,
    origin_type TEXT CHECK(origin_type IN ('government_business', 'committee_report', 'petition', 'member_motion')),
    origin_ref_id TEXT,
    UNIQUE(session_id, item_order)
);

CREATE TABLE debate_contributions (
    id TEXT PRIMARY KEY,
    agenda_item_id TEXT NOT NULL REFERENCES agenda_items(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES members(id),
    sequence_number INTEGER NOT NULL CHECK(sequence_number >= 0),
    spoken_language TEXT NOT NULL CHECK(spoken_language IN ('cy', 'en')),
    verbatim_text_original TEXT NOT NULL CHECK(length(verbatim_text_original) > 0),
    verbatim_text_english TEXT NOT NULL,
    video_timestamp_start INTEGER CHECK(video_timestamp_start IS NULL OR video_timestamp_start >= 0),
    video_timestamp_end INTEGER,
    UNIQUE(agenda_item_id, sequence_number),
    CHECK(video_timestamp_end IS NULL OR video_timestamp_start IS NULL OR video_timestamp_end >= video_timestamp_start)
);

CREATE TABLE division_votes (
    id TEXT PRIMARY KEY,
    agenda_item_id TEXT NOT NULL REFERENCES agenda_items(id) ON DELETE CASCADE,
    motion_text TEXT NOT NULL,
    votes_for INTEGER NOT NULL CHECK(votes_for >= 0),
    votes_against INTEGER NOT NULL CHECK(votes_against >= 0),
    votes_abstain INTEGER NOT NULL CHECK(votes_abstain >= 0),
    result TEXT NOT NULL CHECK(result IN ('agreed', 'negatived'))
);

CREATE TABLE member_votes (
    division_id TEXT NOT NULL REFERENCES division_votes(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES members(id),
    vote_cast TEXT NOT NULL CHECK(vote_cast IN ('for', 'against', 'abstain', 'did_not_vote')),
    PRIMARY KEY (division_id, member_id)
) WITHOUT ROWID;

CREATE TABLE citizen_petitions (
    id TEXT PRIMARY KEY,
    title_en TEXT NOT NULL,
    title_cy TEXT,
    petitioner_name TEXT,
    signature_count INTEGER NOT NULL DEFAULT 0 CHECK(signature_count >= 0),
    opened_date TEXT,
    closing_date TEXT,
    status TEXT NOT NULL CHECK(status IN ('open', 'closed', 'rejected', 'debated', 'completed')),
    committee_response TEXT,
    debate_agenda_item_id TEXT REFERENCES agenda_items(id) ON DELETE SET NULL,
    source_url TEXT NOT NULL
);

-- Trails are curated editorial paths, never verbatim record, so provenance is pinned.
CREATE TABLE citizen_trails (
    id TEXT PRIMARY KEY,
    title_en TEXT NOT NULL,
    title_cy TEXT NOT NULL,
    policy_domain_id TEXT NOT NULL REFERENCES policy_domains(id),
    summary_en TEXT NOT NULL,
    summary_cy TEXT NOT NULL,
    provenance TEXT NOT NULL DEFAULT 'PROVENANCE_DERIVED' CHECK(provenance = 'PROVENANCE_DERIVED')
);

CREATE TABLE citizen_trail_stops (
    trail_id TEXT NOT NULL REFERENCES citizen_trails(id) ON DELETE CASCADE,
    stop_order INTEGER NOT NULL CHECK(stop_order >= 0),
    agenda_item_id TEXT NOT NULL REFERENCES agenda_items(id) ON DELETE CASCADE,
    note_en TEXT,
    note_cy TEXT,
    PRIMARY KEY (trail_id, stop_order)
) WITHOUT ROWID;

-- chunk_index = floor(depth_m / 50) matches the 50m frustum streaming chunks.
CREATE TABLE spatial_plinths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agenda_item_id TEXT NOT NULL UNIQUE REFERENCES agenda_items(id) ON DELETE CASCADE,
    wing_id TEXT NOT NULL REFERENCES policy_domains(id),
    coord_x REAL NOT NULL,
    coord_y REAL NOT NULL,
    coord_z REAL NOT NULL,
    depth_m REAL NOT NULL CHECK(depth_m >= 0),
    chunk_index INTEGER NOT NULL CHECK(chunk_index >= 0),
    importance_weight REAL NOT NULL DEFAULT 1.0 CHECK(importance_weight >= 0)
);

CREATE INDEX idx_member_tenures_member ON member_tenures(member_id, senedd_term);
CREATE INDEX idx_ministerial_roles_member ON ministerial_roles(member_id, start_date);
CREATE INDEX idx_plenary_sessions_date ON plenary_sessions(session_date);
CREATE INDEX idx_agenda_items_domain ON agenda_items(policy_domain_id);
CREATE INDEX idx_agenda_items_origin ON agenda_items(origin_type, origin_ref_id);
CREATE INDEX idx_contributions_member ON debate_contributions(member_id);
CREATE INDEX idx_division_votes_item ON division_votes(agenda_item_id);
CREATE INDEX idx_member_votes_member ON member_votes(member_id);
CREATE INDEX idx_petitions_item ON citizen_petitions(debate_agenda_item_id);
CREATE INDEX idx_plinths_wing_chunk ON spatial_plinths(wing_id, chunk_index);
