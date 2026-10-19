import type { Contribution, Division, MemberLight, Sitting, SittingItem, TabledText } from './types';

/** One agenda item with everything the Dossier Plate shows, cut from a sitting file. */
export interface Dossier {
	sitting: Pick<Sitting, 'date' | 'id' | 'meeting_id' | 'term' | 'source_xml_url' | 'record_page_url' | 'record_published_at' | 'meeting_start_time'> & {
		items?: SittingItem[];
	};
	item: SittingItem;
	contributions: Contribution[];
	divisions: Division[];
	tabled_texts: TabledText[];
	speakers: Record<string, MemberLight>;
}

export function dossierFor(sitting: Sitting, itemId: string): Dossier | null {
	const item = sitting.items.find((i) => i.id === itemId);
	if (!item) return null;
	return {
		sitting: {
			date: sitting.date,
			id: sitting.id,
			meeting_id: sitting.meeting_id,
			term: sitting.term,
			source_xml_url: sitting.source_xml_url,
			record_page_url: sitting.record_page_url,
			record_published_at: sitting.record_published_at,
			meeting_start_time: sitting.meeting_start_time,
			items: sitting.items
		},
		item,
		contributions: sitting.contributions.filter((c) => c.item_id === itemId),
		divisions: sitting.divisions.filter((d) => d.item_id === itemId),
		tabled_texts: sitting.tabled_texts.filter((t) => t.item_id === itemId),
		speakers: sitting.speakers
	};
}

/**
 * A speaker as the record names them. The sitting file carries every Member who spoke or voted;
 * a speech the Record attributed to no Member borrows the publisher's own label and role instead.
 */
export function speakerOf(
	speakers: Record<string, MemberLight>,
	c: Pick<Contribution, 'member_id' | 'speaker_name' | 'speaker_role'>
): MemberLight {
	const known = c.member_id ? speakers[c.member_id] : undefined;
	if (known) return known;
	return {
		id: c.member_id ?? 'unattributed',
		canonical_name: c.speaker_name ?? c.member_id ?? 'Speaker not named',
		cymraeg_name: null,
		honorific: null,
		party_id: null,
		constituency_name_en: '',
		constituency_name_cy: '',
		gss_constituency_code: null,
		is_regional_member: false,
		region_name: null,
		portrait_url: null,
		official_profile_url: '',
		current_status: 'former',
		role_title_en: c.speaker_role ?? null,
		role_title_cy: null
	};
}
