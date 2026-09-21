import type { MemberLight as MemberSummary, TermFile as ParliamentaryTerm } from '$lib/data/types';
import { bearingToXZ, CHAMBER, DEG, type Desk } from './layout';

/**
 * The official seating plan of the Siambr is not published as open data, so
 * desk positions are arranged by Siambr and must always be labelled as such.
 * What the Senedd does publish is followed: Ministers in the front row facing
 * the Chair, the First Minister at its centre, other Members in party groups.
 * https://senedd.wales/senedd-business/plenary/about-the-siambr/
 */
export const SEATING_PROVENANCE = 'PROVENANCE_DERIVED' as const;
export const SEATING_NOTICE = 'Desk positions arranged by Siambr engine — not the official seating plan.';

export interface SeatAssignment {
	desk: Desk;
	member: MemberSummary;
	provenance: typeof SEATING_PROVENANCE;
	officeTitle?: string;
}

const partyKey = (m: MemberSummary) => m.party_id ?? 'independent';

const MINISTER_RANK = ['first_minister', 'deputy_first_minister', 'cabinet_secretary', 'cabinet_minister', 'counsel_general', 'minister', 'deputy_minister'];

/** Members holding a ministerial role on `date`, First Minister first, then by rank and name. */
export function frontBench(term: ParliamentaryTerm, members: MemberSummary[], date: string): MemberSummary[] {
	const rank = new Map<string, number>();
	for (const r of term.ministers ?? []) {
		if (r.start_date > date || (r.end_date !== null && r.end_date < date)) continue;
		const level = MINISTER_RANK.indexOf(r.cabinet_level);
		const k = level < 0 ? MINISTER_RANK.length : level;
		rank.set(r.member_id, Math.min(rank.get(r.member_id) ?? k, k));
	}
	return members
		.filter((m) => rank.has(m.id))
		.sort((a, b) => rank.get(a.id)! - rank.get(b.id)! || a.canonical_name.localeCompare(b.canonical_name, 'en-GB'));
}

/** Inner-row desks facing the dais, nearest the centre line first. */
function frontRow(desks: Desk[], n: number): Desk[] {
	const facing = CHAMBER.dais.bearingDeg * DEG + Math.PI;
	const off = (d: Desk) => Math.abs(Math.atan2(Math.sin(d.bearing - facing), Math.cos(d.bearing - facing)));
	const inner = Math.min(...desks.map((d) => d.row));
	return desks
		.filter((d) => d.row === inner)
		.sort((a, b) => off(a) - off(b) || a.bearing - b.bearing)
		.slice(0, n);
}

/** The Member holding the office of Llywydd for the term today, if the term records one. */
export function llywyddOf(term: ParliamentaryTerm, members: MemberSummary[]): MemberSummary | null {
	const office = term.presiding_officers.find((o) => o.office === 'llywydd' && o.end_date === null);
	return (office && members.find((m) => m.id === office.member_id)) ?? null;
}

/** Y Llywydd's place at the dais, shaped like a desk so the walker and picker treat it as one. */
export function llywyddDesk(): Desk {
	const bearing = CHAMBER.dais.bearingDeg * DEG;
	const [x, z] = bearingToXZ(CHAMBER.dais.radius, bearing);
	return { id: 'llywydd', row: -1, index: 0, bearing, x, y: CHAMBER.dais.height, z, yaw: Math.PI - bearing };
}

/**
 * Seat `bench` (in order) in the front row from its centre outwards, then the
 * rest in contiguous party blocs sweeping the arc from Y Llywydd's left to
 * right, largest party first, alphabetical within a party. Blocs run across
 * all tiers so a party occupies a wedge, as in a real chamber.
 */
export function assignSeats(members: MemberSummary[], desks: Desk[], bench: MemberSummary[] = []): SeatAssignment[] {
	if (members.length > desks.length) {
		throw new Error(`${members.length} Members but only ${desks.length} desks`);
	}
	const front = frontRow(desks, bench.length);
	const benchSeats: SeatAssignment[] = front.map((desk, i) => ({ desk, member: bench[i], provenance: SEATING_PROVENANCE }));
	const seated = new Set(benchSeats.map((s) => s.member.id));
	const taken = new Set(front.map((d) => d.id));
	const rest = members.filter((m) => !seated.has(m.id));
	const restDesks = desks.filter((d) => !taken.has(d.id));
	const blocs = new Map<string, MemberSummary[]>();
	for (const m of rest) blocs.set(partyKey(m), [...(blocs.get(partyKey(m)) ?? []), m]);
	const ordered = [...blocs.entries()]
		.sort(([ka, a], [kb, b]) => b.length - a.length || ka.localeCompare(kb))
		.flatMap(([, ms]) => ms.sort((a, b) => a.canonical_name.localeCompare(b.canonical_name, 'en-GB')));

	// A left-to-right sweep by bearing; ties across tiers resolve inner first.
	const byBearing = [...restDesks].sort((a, b) => a.bearing - b.bearing || a.row - b.row);
	// Spread any empty desks evenly so a short house does not leave a gap at one end.
	const stride = byBearing.length / ordered.length;
	return [
		...benchSeats,
		...ordered.map((member, i) => ({
			desk: byBearing[Math.min(byBearing.length - 1, Math.floor(i * stride))],
			member,
			provenance: SEATING_PROVENANCE
		}))
	];
}

/** Official title in English and Welsh for Presiding Officers. */
export function presidingOfficeTitle(office?: 'llywydd' | 'deputy_presiding_officer' | string | null): string {
	if (office === 'deputy_presiding_officer') {
		return 'Y Dirprwy Lywydd · Deputy Presiding Officer';
	}
	return 'Y Llywydd · Presiding Officer';
}

/**
 * Chamber seating plan for a sitting:
 * - All Members are allocated stable home desks across the floor by party bloc.
 * - The active Presiding Officer occupies the dais, leaving their home floor desk vacant.
 * - If another Presiding Officer is not currently in the chair, they occupy their normal floor desk.
 */
export function assignChamberSeats(
	members: MemberSummary[],
	desks: Desk[],
	term: ParliamentaryTerm,
	activePresidingMemberId?: string | null,
	date?: string
): SeatAssignment[] {
	const baseFloorSeats = assignSeats(members, desks, date ? frontBench(term, members, date) : []);
	const activePoRecord = term.presiding_officers.find((o) => o.member_id === activePresidingMemberId);
	const activePoMember = activePresidingMemberId ? members.find((m) => m.id === activePresidingMemberId) : null;
	const fallbackLlywydd = llywyddOf(term, members);

	const poMember = activePoMember ?? fallbackLlywydd;
	const office =
		activePoRecord?.office ??
		(poMember && term.presiding_officers.find((o) => o.member_id === poMember.id)?.office) ??
		'llywydd';

	const seats = baseFloorSeats.filter((s) => s.member.id !== poMember?.id);
	if (poMember) {
		seats.push({
			desk: llywyddDesk(),
			member: poMember,
			provenance: SEATING_PROVENANCE,
			officeTitle: presidingOfficeTitle(office)
		});
	}
	return seats;
}
