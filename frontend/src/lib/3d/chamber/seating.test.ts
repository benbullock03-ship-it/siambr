import { describe, expect, it } from 'vitest';
import type { MemberLight } from '$lib/data/types';
import { buildDesks } from './layout';
import { assignSeats, SEATING_PROVENANCE } from './seating';

const member = (id: string, party: string | null): MemberLight => ({
	id,
	canonical_name: id,
	cymraeg_name: null,
	honorific: null,
	party_id: party,
	constituency_name_en: 'Somewhere',
	constituency_name_cy: 'Rhywle',
	gss_constituency_code: null,
	is_regional_member: false,
	region_name: null,
	portrait_url: null,
	official_profile_url: 'https://senedd.wales/',
	current_status: 'active',
	role_title_en: null,
	role_title_cy: null
});

describe('assignSeats', () => {
	const desks = buildDesks(96);

	it('seats every Member at a distinct desk and stamps the provenance flag', () => {
		const members = Array.from({ length: 96 }, (_, i) => member(`m${i}`, i < 43 ? 'plaid_cymru' : 'reform_uk'));
		const seats = assignSeats(members, desks);
		expect(seats).toHaveLength(96);
		expect(new Set(seats.map((s) => s.desk.id)).size).toBe(96);
		expect(seats.every((s) => s.provenance === SEATING_PROVENANCE)).toBe(true);
	});

	it('keeps parties in contiguous wedges, largest party at Y Llywydd’s left', () => {
		const members = [
			...Array.from({ length: 5 }, (_, i) => member(`c${i}`, 'conservatives')),
			...Array.from({ length: 20 }, (_, i) => member(`p${i}`, 'plaid_cymru')),
			member('x', null)
		];
		const seats = assignSeats(members, desks);
		const bearings = seats.map((s) => s.desk.bearing);
		expect(seats.slice(0, 20).every((s) => s.member.party_id === 'plaid_cymru')).toBe(true);
		expect(seats[20].member.party_id).toBe('conservatives');
		expect(seats[25].member.id).toBe('x');
		for (let i = 1; i < bearings.length; i++) expect(bearings[i]).toBeGreaterThanOrEqual(bearings[i - 1]);
	});

	it('refuses more Members than desks', () => {
		const members = Array.from({ length: 97 }, (_, i) => member(`m${i}`, 'labour'));
		expect(() => assignSeats(members, desks)).toThrow();
	});
});
