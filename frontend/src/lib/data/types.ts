/** Shapes of frontend/static/data/**.json as written by pipeline/export.py. Keep in step. */

export const PROVENANCE_DERIVED = 'PROVENANCE_DERIVED' as const;
export type ProvenanceDerived = typeof PROVENANCE_DERIVED;

export type Lang = 'en' | 'cy';
export type VoteCast = 'for' | 'against' | 'abstain' | 'did_not_vote';
export type DivisionOutcome = 'agreed' | 'negatived';

export interface TermSummary {
	term: number;
	label_en: string;
	label_cy: string;
	start_date: string;
	end_date: string | null;
	seat_count: number;
}

export interface PolicyDomain {
	id: string;
	name_en: string;
	name_cy: string;
}

/** index.json */
export interface SiteIndex {
	terms: TermSummary[];
	current_term: number;
	policy_domains: PolicyDomain[];
	latest_sitting: string | null;
	sitting_count: number;
	/** Senedd's newest record-published stamp among the exported sittings. */
	generated_at: string | null;
	/** When pipeline.sync last finished checking the Record, UTC. */
	checked_at: string | null;
}

/** A Member as the sitting or index files carry them. party_id and role_* are derived for a date. */
export interface MemberLight {
	id: string;
	canonical_name: string;
	cymraeg_name: string | null;
	honorific: string | null;
	party_id: string | null;
	constituency_name_en: string;
	constituency_name_cy: string;
	gss_constituency_code: string | null;
	is_regional_member: boolean;
	region_name: string | null;
	portrait_url: string | null;
	official_profile_url: string;
	current_status: 'active' | 'former' | 'deceased';
	role_title_en: string | null;
	role_title_cy: string | null;
}

export interface ItemSummary {
	id: string;
	order: number;
	type: string;
	title_en: string;
	title_cy: string;
	policy_domain_id: string;
	classification_provenance: ProvenanceDerived;
	speaker_ids: string[];
}

/** sittings/index.json rows, newest first. */
export interface SittingSummary {
	date: string;
	id: string;
	meeting_id: number | null;
	term: number;
	title_en: string;
	title_cy: string;
	source_xml_url: string;
	record_published_at: string | null;
	meeting_start_time: string | null;
	item_count: number;
	contribution_count: number;
	items: ItemSummary[];
}

export interface SittingItem {
	id: string;
	order: number;
	type: string;
	title_en: string;
	title_cy: string;
	policy_domain_id: string;
	classification_provenance: ProvenanceDerived;
	clip_url: string | null;
	origin_type: string | null;
	origin_ref_id: string | null;
	contribution_count: number;
}

export interface Contribution {
	id: string;
	item_id: string;
	seq: number;
	member_id: string;
	lang: Lang;
	/** Verbatim from Y Cofnod. Never edited. */
	text_original: string;
	text_english: string;
	/** Senedd's own startPos in seconds; null when untimed. */
	t_start: number | null;
	/** The next timed contribution's start. Derived; never a Senedd figure. */
	t_end_derived: number | null;
	tv_url: string | null;
}

export interface Division {
	id: string;
	item_id: string;
	motion_text: string;
	votes_for: number;
	votes_against: number;
	votes_abstain: number;
	/** The Presiding Officer's casting vote on a tie, as the Record lists it; outside the tally. */
	casting_vote: 'for' | 'against' | null;
	result: DivisionOutcome;
	votes: Record<string, VoteCast>;
}

/** sittings/{date}.json */
export interface Sitting {
	date: string;
	id: string;
	meeting_id: number | null;
	term: number;
	title_en: string;
	title_cy: string;
	presiding_officer_id: string | null;
	source_xml_url: string;
	xml_sha256: string;
	record_published_at: string | null;
	meeting_start_time: string | null;
	clip_url: string | null;
	items: SittingItem[];
	contributions: Contribution[];
	divisions: Division[];
	speakers: Record<string, MemberLight>;
	provenance: Record<string, ProvenanceDerived>;
}

export interface Tenure {
	senedd_term: number;
	party_id: string;
	party_label: string | null;
	party_provenance: string | null;
	is_regional_member: boolean;
	region_name: string | null;
	seat_name: string | null;
	seat_gss_code: string | null;
	start_date: string;
	end_date: string | null;
	source_url: string | null;
}

export interface MinisterialRole {
	title_en: string;
	title_cy: string;
	cabinet_level: string | null;
	start_date: string;
	end_date: string | null;
	start_date_precision: string | null;
	provenance: string | null;
	source_url: string | null;
}

export interface MemberContribution {
	id: string;
	item_id: string;
	item_title_en: string;
	t_start: number | null;
	tv_url: string | null;
	lang: Lang;
	text_original: string;
	text_english: string;
}

export interface MemberBallot {
	division_id: string;
	item_id: string;
	item_title_en: string;
	date: string;
	motion_text: string;
	result: DivisionOutcome;
	vote_cast: VoteCast;
}

/** members/{id}.json */
export interface MemberFile extends MemberLight {
	tenures: Tenure[];
	roles: MinisterialRole[];
	contribution_count: number;
	contributions_by_date: { date: string; contributions: MemberContribution[] }[];
	ballots: MemberBallot[];
}

export interface PresidingOfficer {
	member_id: string;
	office: 'llywydd' | 'deputy_presiding_officer';
	start_date: string;
	end_date: string | null;
	provenance: string;
	source_url: string;
}

/** terms/{n}.json */
export interface TermFile extends TermSummary {
	presiding_officers: PresidingOfficer[];
	members: MemberLight[];
}

/** search/index.json: documents the browser indexes with MiniSearch. Text is verbatim. */
export interface SearchDocument {
	id: string;
	date: string;
	item_id: string;
	item: string;
	member_id: string;
	member: string;
	lang: Lang;
	t: number | null;
	text: string;
	text_cy: string;
}

export interface SearchIndexFile {
	engine: 'minisearch';
	fields: string[];
	store_fields: string[];
	documents: SearchDocument[];
}

