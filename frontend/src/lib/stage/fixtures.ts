// Test-only builders. Speech text here is placeholder, never shipped to the UI.
import type { Contribution, Division, Sitting, SittingItem } from '$lib/data/types';
import { PROVENANCE_DERIVED } from '$lib/data/types';

export function item(id: string, order: number, contribution_count = 0): SittingItem {
	return {
		id,
		order,
		type: 'debate',
		title_en: `Item ${id}`,
		title_cy: `Eitem ${id}`,
		policy_domain_id: 'devolution',
		classification_provenance: PROVENANCE_DERIVED,
		clip_url: null,
		origin_type: null,
		origin_ref_id: null,
		contribution_count
	};
}

export function speech(id: string, item_id: string, seq: number, t_start: number | null, member_id: string | null = `ms-${id}`): Contribution {
	return {
		id,
		item_id,
		seq,
		member_id,
		speaker_name: member_id ? null : `Unattributed ${id}`,
		speaker_role: null,
		unattributed: member_id === null,
		lang: 'en',
		text_original: `Fixture text ${id}.`,
		text_english: `Fixture text ${id}.`,
		t_start,
		t_end_derived: null,
		tv_url: null
	};
}

export function division(id: string, item_id: string): Division {
	return { id, item_id, motion_text: 'Fixture motion', votes_for: 1, votes_against: 0, votes_abstain: 0, casting_vote: null, result: 'agreed', source_url: 'https://record.senedd.wales/XMLExport/Download?meetingID=1&xmlDownloadType=Votes', votes: { 'ms-a0': 'for' } };
}

export function sitting(overrides: Partial<Sitting>): Sitting {
	return {
		date: '2000-01-01',
		id: 'fixture',
		meeting_id: null,
		term: 7,
		title_en: 'Plenary',
		title_cy: 'Cyfarfod Llawn',
		presiding_officer_id: null,
		source_xml_url: 'https://record.senedd.wales/fixture',
		record_page_url: null,
		xml_sha256: '',
		record_published_at: null,
		meeting_start_time: '13:30:00',
		clip_url: null,
		stream_url: null,
		stream_url_verbatim: null,
		stream_offset_s: null,
		stream_offset_verbatim_s: null,
		items: [],
		contributions: [],
		tabled_texts: [],
		divisions: [],
		speakers: {},
		unattributed: { contributions: 0, speakers: [] },
		provenance: {},
		...overrides
	};
}

/**
 * Item A: timed 10, two untimed, timed 100, one untimed, timed 102, timed 200, then a division.
 * Item B: empty. Item C: a negative-start row, timed 300, a trailing untimed row.
 */
export function syntheticSitting(): Sitting {
	return sitting({
		items: [item('A', 0, 7), item('B', 1), item('C', 2, 3)],
		contributions: [
			speech('a0', 'A', 0, 10),
			speech('a1', 'A', 1, null),
			speech('a2', 'A', 2, null),
			speech('a3', 'A', 3, 100),
			speech('a4', 'A', 4, null),
			speech('a5', 'A', 5, 102),
			speech('a6', 'A', 6, 200, 'ms-a0'),
			speech('c0', 'C', 0, -5),
			speech('c1', 'C', 1, 300),
			speech('c2', 'C', 2, null)
		],
		divisions: [division('dA', 'A')]
	});
}
