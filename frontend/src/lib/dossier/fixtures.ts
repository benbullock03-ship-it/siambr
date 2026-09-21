// Test-only builders. Speech text here is placeholder, never shipped to the UI.
import type { Dossier } from '$lib/data/dossier';
import type { Contribution, MemberLight } from '$lib/data/types';

export function member(id: string, name = id, overrides: Partial<MemberLight> = {}): MemberLight {
	return {
		id,
		canonical_name: name,
		cymraeg_name: null,
		honorific: null,
		party_id: null,
		constituency_name_en: 'Test Constituency',
		constituency_name_cy: 'Etholaeth Brawf',
		gss_constituency_code: null,
		is_regional_member: false,
		region_name: null,
		portrait_url: null,
		official_profile_url: 'https://senedd.wales/people/test/',
		current_status: 'active',
		role_title_en: null,
		role_title_cy: null,
		...overrides
	};
}

export function speech(id: string, overrides: Partial<Contribution> = {}): Contribution {
	return {
		id,
		item_id: 'item-1',
		seq: 0,
		member_id: `ms-${id}`,
		lang: 'en',
		text_original: `Fixture text ${id}.`,
		text_english: `Fixture text ${id}.`,
		t_start: null,
		t_end_derived: null,
		tv_url: null,
		...overrides
	};
}

export function dossier(overrides: Partial<Dossier> = {}): Dossier {
	return {
		sitting: {
			date: '2026-06-10',
			id: 'session-1',
			meeting_id: null,
			term: 7,
			source_xml_url: 'https://record.senedd.wales/fixture.xml',
			record_published_at: '2026-06-11T06:00:00',
			meeting_start_time: '13:30:00'
		},
		item: {
			id: 'item-1',
			order: 0,
			type: 'statement',
			title_en: 'Fixture item',
			title_cy: 'Eitem prawf',
			policy_domain_id: 'health',
			classification_provenance: 'PROVENANCE_DERIVED',
			clip_url: null,
			origin_type: null,
			origin_ref_id: null,
			contribution_count: 0
		},
		contributions: [],
		divisions: [],
		tabled_texts: [],
		speakers: {},
		...overrides
	};
}
