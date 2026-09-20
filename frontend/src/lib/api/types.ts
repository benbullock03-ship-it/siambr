/** Wire shapes served by backend/schemas.py. Keep in step with the Pydantic models. */

export interface MemberSummary {
	id: string;
	canonical_name: string;
	cymraeg_name: string | null;
	party_id: string | null;
	constituency_name_en: string;
	portrait_url: string | null;
}

export interface SpeakerContribution {
	id: string;
	sequence_number: number;
	member: MemberSummary;
	party_id_at_date: string | null;
	role_title_en: string | null;
	role_title_cy: string | null;
	spoken_language: 'en' | 'cy';
	verbatim_text_original: string;
	verbatim_text_english: string;
	video_timestamp_start: number | null;
	video_timestamp_end: number | null;
}

export type BallotCast = 'for' | 'against' | 'abstain' | 'did_not_vote';

export interface MemberVoteCast {
	member: MemberSummary;
	party_id_at_date: string | null;
	vote_cast: BallotCast;
}

export interface DivisionResult {
	id: string;
	motion_text: string;
	votes_for: number;
	votes_against: number;
	votes_abstain: number;
	result: 'agreed' | 'negatived';
	ballots: MemberVoteCast[];
}

export interface PetitionLink {
	id: string;
	title_en: string;
	signature_count: number;
	status: string;
	source_url: string;
}

export interface DossierPlate {
	id: string;
	session_id: string;
	session_date: string;
	item_order: number;
	item_type: string;
	title_en: string;
	title_cy: string;
	policy_domain_id: string;
	classification_provenance: 'PROVENANCE_DERIVED';
	senedd_tv_clip_url: string | null;
	source_xml_url: string;
	contributions: SpeakerContribution[];
	divisions: DivisionResult[];
	petitions: PetitionLink[];
}

export interface AgendaItemSummary {
	id: string;
	item_order: number;
	item_type: string;
	title_en: string;
	title_cy: string;
	policy_domain_id: string;
	classification_provenance: 'PROVENANCE_DERIVED';
}

export interface SessionSummary {
	id: string;
	session_date: string;
	senedd_term: number;
	title_en: string;
	title_cy: string;
	source_xml_url: string;
	items: AgendaItemSummary[];
}

export interface PolicyDomain {
	id: string;
	name_en: string;
	name_cy: string;
}

export interface PresidingOfficer {
	member_id: string;
	office: 'llywydd' | 'deputy_presiding_officer';
	start_date: string;
	end_date: string | null;
	provenance: string;
	source_url: string;
}

export interface ParliamentaryTerm {
	term: number;
	label_en: string;
	label_cy: string;
	start_date: string;
	end_date: string | null;
	seat_count: number;
	presiding_officers: PresidingOfficer[];
}

export interface MinisterialRole {
	title_en: string;
	title_cy: string;
	cabinet_level: string | null;
	start_date: string;
	end_date: string | null;
}

export interface MemberTenure {
	senedd_term: number;
	party_id: string;
	is_regional_member: boolean;
	region_name: string | null;
	start_date: string;
	end_date: string | null;
}

export interface MemberProfile {
	id: string;
	canonical_name: string;
	cymraeg_name: string | null;
	honorific: string | null;
	portrait_url: string | null;
	official_profile_url: string;
	current_status: 'active' | 'former' | 'deceased';
	constituency_name_en: string;
	constituency_name_cy: string;
	tenures: MemberTenure[];
	roles: MinisterialRole[];
	contribution_count: number;
}

export interface MemberSpeech {
	id: string;
	agenda_item_id: string;
	agenda_item_title_en: string;
	session_date: string;
	spoken_language: 'en' | 'cy';
	verbatim_text_original: string;
	verbatim_text_english: string;
	video_timestamp_start: number | null;
}

export interface MemberBallot {
	division_id: string;
	agenda_item_id: string;
	agenda_item_title_en: string;
	session_date: string;
	motion_text: string;
	result: 'agreed' | 'negatived';
	vote_cast: BallotCast;
}

export interface MemberRecord {
	member: MemberProfile;
	speeches: MemberSpeech[];
	speech_total: number;
	ballots: MemberBallot[];
	ballot_total: number;
}
