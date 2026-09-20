// Test-only builders. Speech text here is placeholder, never shipped to the UI.
import type { DossierPlate, MemberSummary, SpeakerContribution } from '$lib/api/types';

export function member(id: string, name = id): MemberSummary {
	return {
		id,
		canonical_name: name,
		cymraeg_name: null,
		party_id: null,
		constituency_name_en: 'Test Constituency',
		portrait_url: null
	};
}

export function speech(
	id: string,
	party: string | null,
	role: string | null = null,
	overrides: Partial<SpeakerContribution> = {}
): SpeakerContribution {
	return {
		id,
		sequence_number: 0,
		member: member(`ms-${id}`),
		party_id_at_date: party,
		role_title_en: role,
		role_title_cy: null,
		spoken_language: 'en',
		verbatim_text_original: `Fixture text ${id}.`,
		verbatim_text_english: `Fixture text ${id}.`,
		video_timestamp_start: null,
		video_timestamp_end: null,
		...overrides
	};
}

export function dossier(overrides: Partial<DossierPlate> = {}): DossierPlate {
	return {
		id: 'item-1',
		session_id: 'session-1',
		session_date: '2026-06-10',
		item_order: 0,
		item_type: 'statement',
		title_en: 'Fixture item',
		title_cy: 'Eitem prawf',
		policy_domain_id: 'health',
		classification_provenance: 'PROVENANCE_DERIVED',
		senedd_tv_clip_url: null,
		source_xml_url: 'https://record.senedd.wales/fixture.xml',
		contributions: [],
		divisions: [],
		petitions: [],
		...overrides
	};
}
