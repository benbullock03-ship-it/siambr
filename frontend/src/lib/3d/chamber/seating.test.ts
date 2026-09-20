import { describe, expect, it } from 'vitest';
import type { MemberLight, TermFile } from '$lib/data/types';
import { buildDesks } from './layout';
import { assignChamberSeats, assignSeats, SEATING_PROVENANCE } from './seating';

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

describe('assignChamberSeats', () => {
	const desks = buildDesks(96);
	const kerry = member('ms-kerry-ferguson', 'plaid_cymru');
	const huw = member('ms-huw-irranca-davies', 'labour');
	const others = Array.from({ length: 94 }, (_, i) => member(`m${i}`, i < 40 ? 'plaid_cymru' : 'labour'));
	const allMembers = [kerry, huw, ...others];

	const term: TermFile = {
		term: 7,
		label_en: 'Seventh Senedd',
		label_cy: 'Y Seithfed Senedd',
		start_date: '2026-05-07',
		end_date: null,
		seat_count: 96,
		presiding_officers: [
			{
				member_id: 'ms-kerry-ferguson',
				office: 'deputy_presiding_officer',
				start_date: '2026-05-12',
				end_date: null,
				provenance: 'test',
				source_url: ''
			},
			{
				member_id: 'ms-huw-irranca-davies',
				office: 'llywydd',
				start_date: '2026-05-12',
				end_date: null,
				provenance: 'test',
				source_url: ''
			}
		],
		members: allMembers
	};

	it('seats Kerry Ferguson at the dais as Deputy Presiding Officer when she is presiding', () => {
		const seats = assignChamberSeats(allMembers, desks, term, 'ms-kerry-ferguson');
		expect(seats).toHaveLength(96);

		const daisSeat = seats.find((s) => s.desk.id === 'llywydd');
		expect(daisSeat).toBeDefined();
		expect(daisSeat?.member.id).toBe('ms-kerry-ferguson');
		expect(daisSeat?.officeTitle).toBe('Y Dirprwy Lywydd · Deputy Presiding Officer');

		const huwSeat = seats.find((s) => s.member.id === 'ms-huw-irranca-davies');
		expect(huwSeat).toBeDefined();
		expect(huwSeat?.desk.row).toBeGreaterThanOrEqual(0); // On the chamber floor
	});

	it('seats Huw Irranca-Davies at the dais as Presiding Officer when he is presiding', () => {
		const seats = assignChamberSeats(allMembers, desks, term, 'ms-huw-irranca-davies');
		expect(seats).toHaveLength(96);

		const daisSeat = seats.find((s) => s.desk.id === 'llywydd');
		expect(daisSeat).toBeDefined();
		expect(daisSeat?.member.id).toBe('ms-huw-irranca-davies');
		expect(daisSeat?.officeTitle).toBe('Y Llywydd · Presiding Officer');

		const kerrySeat = seats.find((s) => s.member.id === 'ms-kerry-ferguson');
		expect(kerrySeat).toBeDefined();
		expect(kerrySeat?.desk.row).toBeGreaterThanOrEqual(0); // On the chamber floor
	});

	it('keeps other Members at identical floor desks when the chair switches', () => {
		const kerryChairs = assignChamberSeats(allMembers, desks, term, 'ms-kerry-ferguson');
		const huwChairs = assignChamberSeats(allMembers, desks, term, 'ms-huw-irranca-davies');

		const kerryDeskMap = new Map(kerryChairs.map((s) => [s.member.id, s.desk.id]));
		const huwDeskMap = new Map(huwChairs.map((s) => [s.member.id, s.desk.id]));

		for (const m of others) {
			expect(kerryDeskMap.get(m.id)).toBe(huwDeskMap.get(m.id));
		}
	});
});

