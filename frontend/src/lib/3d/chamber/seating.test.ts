import { describe, expect, it } from 'vitest';
import type { MemberLight, TermFile } from '$lib/data/types';
import { buildDesks } from './layout';
import { assignChamberSeats, assignSeats, frontBench, SEATING_PROVENANCE } from './seating';

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
		members: allMembers,
		ministers: []
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


describe('front bench', () => {
	const desks = buildDesks(96);
	const fm = member('fm', 'plaid_cymru');
	const cab = member('cab', 'plaid_cymru');
	const dep = member('dep', 'plaid_cymru');
	const gone = member('gone', 'labour');
	const others = Array.from({ length: 92 }, (_, i) => member(`m${i}`, i < 40 ? 'plaid_cymru' : 'reform_uk'));
	const members = [dep, cab, gone, fm, ...others];
	const term: TermFile = {
		term: 7,
		label_en: 'Seventh Senedd',
		label_cy: 'Y Seithfed Senedd',
		start_date: '2026-05-07',
		end_date: null,
		seat_count: 96,
		presiding_officers: [],
		members,
		ministers: [
			{ member_id: 'gone', cabinet_level: 'first_minister', start_date: '2024-08-06', end_date: '2026-05-12' },
			{ member_id: 'fm', cabinet_level: 'first_minister', start_date: '2026-05-12', end_date: null },
			{ member_id: 'cab', cabinet_level: 'cabinet_minister', start_date: '2026-05-13', end_date: null },
			{ member_id: 'dep', cabinet_level: 'deputy_minister', start_date: '2026-05-13', end_date: null }
		]
	};
	const facing = (d: { bearing: number }) => Math.abs(Math.atan2(Math.sin(d.bearing - Math.PI), Math.cos(d.bearing - Math.PI)));

	it('lists the Ministers in office on the date, First Minister first', () => {
		expect(frontBench(term, members, '2026-06-10').map((m) => m.id)).toEqual(['fm', 'cab', 'dep']);
		expect(frontBench(term, members, '2026-05-10').map((m) => m.id)).toEqual(['gone']);
	});

	it('seats the First Minister at the centre of the inner row facing the Chair, Ministers beside', () => {
		const seats = assignChamberSeats(members, desks, term, null, '2026-06-10');
		expect(seats).toHaveLength(96);
		expect(new Set(seats.map((s) => s.desk.id)).size).toBe(96);
		const inner = Math.min(...desks.map((d) => d.row));
		const at = (id: string) => seats.find((s) => s.member.id === id)!.desk;
		for (const id of ['fm', 'cab', 'dep']) expect(at(id).row).toBe(inner);
		const nearest = Math.min(...desks.filter((d) => d.row === inner).map(facing));
		expect(facing(at('fm'))).toBe(nearest);
		expect(facing(at('cab'))).toBeLessThanOrEqual(facing(at('dep')));
		expect(at('gone').row === inner && facing(at('gone')) <= facing(at('dep'))).toBe(false);
	});

	it('keeps the party wedges when no date is given', () => {
		const seats = assignChamberSeats(members, desks, term, null);
		expect(seats.map((s) => s.member.id)).toEqual(assignSeats(members, desks).map((s) => s.member.id));
	});
});
