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
	/** The readable Record page for the meeting; the XML stays the audit source. */
	record_page_url: string | null;
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
	/** Null when the Record attributed the speech to no Member; speaker_name carries its own label. */
	member_id: string | null;
	/** The publisher's own label for an unattributed speaker ("Elfyn Llwyd"); null when attributed. */
	speaker_name: string | null;
	/** The publisher's role for that speaker ("Counsel General"); null when none. */
	speaker_role: string | null;
	/** True when member_id is null: the Record named no Member. Never a Siambr judgement. */
	unattributed: boolean;
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

/** A motion, amendment or procedural note as the Record prints it at the head of a debate. Verbatim. */
export interface TabledText {
	id: string;
	item_id: string;
	seq: number;
	kind: 'motion' | 'amendment' | 'note';
	amendment_number: number | null;
	lang: Lang;
	text_original: string;
	text_english: string;
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
	/** The Record's Votes document for the meeting. */
	source_url: string | null;
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
	record_page_url: string | null;
	xml_sha256: string;
	record_published_at: string | null;
	meeting_start_time: string | null;
	clip_url: string | null;
	/** Senedd TV HLS master playlist; set only when its first frame is within 2 s of meeting_start_time. */
	stream_url: string | null;
	/** The same pictures with the floor audio as spoken; gated like stream_url. */
	stream_url_verbatim: string | null;
	items: SittingItem[];
	contributions: Contribution[];
	tabled_texts: TabledText[];
	divisions: Division[];
	speakers: Record<string, MemberLight>;
	/** Speech the Record attributed to no Member, grouped by the publisher's own label. */
	unattributed: UnattributedSummary;
	provenance: Record<string, ProvenanceDerived>;
}

export interface UnattributedSpeaker {
	name: string;
	role: string | null;
	contributions: number;
}

export interface UnattributedSummary {
	contributions: number;
	speakers: UnattributedSpeaker[];
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
	/** The debate item the division decided, matched by the item number printed in motion_text; null when none matches. Derived. */
	debate_item_id: string | null;
	debate_item_title_en: string | null;
}

/** members/{id}.json */
export interface MemberFile extends MemberLight {
	tenures: Tenure[];
	roles: MinisterialRole[];
	contribution_count: number;
	contributions_by_date: { date: string; record_page_url: string | null; contributions: MemberContribution[] }[];
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
/** A ministerial role held during the term; seats the front bench for a sitting date. */
export interface TermMinister {
	member_id: string;
	cabinet_level: string;
	start_date: string;
	end_date: string | null;
}

export interface TermFile extends TermSummary {
	presiding_officers: PresidingOfficer[];
	members: MemberLight[];
	ministers: TermMinister[];
}

/** search/index.json: documents the browser indexes with MiniSearch. Text is verbatim. */
export interface ContributionDocument {
	id: string;
	type?: undefined;
	date: string;
	item_id: string;
	item: string;
	/** Null for unattributed speech; `member` then carries the publisher's own label. */
	member_id: string | null;
	member: string;
	lang: Lang;
	t: number | null;
	text: string;
	text_cy: string;
}

/** A division in the search index: `item` is the debate title, `text` the motion text, verbatim. */
export interface DivisionDocument {
	id: string;
	type: 'division';
	division_id: string;
	date: string;
	/** The debate the motion text names, else the item the Record files the division under. */
	item_id: string;
	item: string;
	has_debate: boolean;
	target: string;
	result: DivisionOutcome;
	text: string;
}

export type SearchDocument = ContributionDocument | DivisionDocument;

/** divisions/index.json rows, newest first. Counts and motion text are the publisher's; the rest are pointers. */
export interface DivisionRow {
	id: string;
	date: string;
	term: number;
	/** The item the Record files the division under, usually Voting Time. */
	item_id: string;
	item_title_en: string;
	/** The debate the motion text names; null when none matches. Derived. */
	debate_item_id: string | null;
	debate_item_title_en: string | null;
	/** "Motion", "Amendment N" or "Motion as amended", read from the motion text as readMotion reads it. */
	target: string;
	tabled_by: string | null;
	votes_for: number;
	votes_against: number;
	votes_abstain: number;
	result: DivisionOutcome;
	motion_text: string;
}

export interface SearchIndexFile {
	engine: 'minisearch';
	fields: string[];
	store_fields: string[];
	documents: SearchDocument[];
}

/** Totals shared by the sitting and term stats files. Every figure is a count or a sum. */
export interface StatTotals {
	contributions: number;
	timed_contributions: number;
	untimed_contributions: number;
	speaking_seconds: number;
	divisions: number;
	welsh_contributions: number;
	/** Welsh contributions as a share of the contributions counted here. */
	welsh_share: number;
	/** Part of the counts above, and never part of a Member's or party's share. */
	unattributed_contributions: number;
	unattributed_seconds: number;
}

/** Speech the Record attributed to no Member: reported, never folded into a party or a Member. */
export interface UnattributedStat {
	contributions: number;
	seconds: number;
	untimed_contributions: number;
}

export interface MemberStat {
	member_id: string;
	canonical_name: string;
	party_id: string | null;
	seconds: number;
	contributions: number;
	untimed_contributions: number;
}

export interface PartyStat {
	party_id: string | null;
	seconds: number;
	contributions: number;
	untimed_contributions: number;
	members: number;
}

export interface ItemStat {
	item_id: string;
	order: number;
	title_en: string;
	title_cy: string;
	type: string;
	policy_domain_id: string;
	seconds: number;
	contributions: number;
	untimed_contributions: number;
}

/** stats/sittings/{date}.json */
export interface SittingStats {
	provenance: ProvenanceDerived;
	method: string;
	date: string;
	term: number;
	title_en: string;
	title_cy: string;
	source_xml_url: string;
	record_published_at: string | null;
	totals: StatTotals;
	by_member: MemberStat[];
	by_party: PartyStat[];
	unattributed: UnattributedStat;
	by_item: ItemStat[];
}

export interface PartyDomainCell {
	party_id: string | null;
	domain_id: string;
	contributions: number;
	seconds: number;
}

/** stats/terms/{n}.json */
export interface TermStats {
	provenance: ProvenanceDerived;
	method: string;
	term: number;
	label_en: string;
	label_cy: string;
	start_date: string;
	end_date: string | null;
	sitting_count: number;
	totals: StatTotals;
	by_member: MemberStat[];
	by_party: PartyStat[];
	unattributed: UnattributedStat;
	by_sitting: ({ date: string } & StatTotals)[];
	party_by_domain: {
		domain_provenance: ProvenanceDerived;
		parties: (string | null)[];
		domains: string[];
		cells: PartyDomainCell[];
	};
}
