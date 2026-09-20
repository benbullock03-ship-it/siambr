import type { MemberSummary, ParliamentaryTerm } from '$lib/api/types';
import { bearingToXZ, CHAMBER, DEG, type Desk } from './layout';

/**
 * The official seating plan of the Siambr is not published as open data, so
 * desk positions are arranged by Siambr and must always be labelled as such.
 */
export const SEATING_PROVENANCE = 'PROVENANCE_DERIVED' as const;
export const SEATING_NOTICE = 'Desk positions arranged by Siambr engine — not the official seating plan.';

export interface SeatAssignment {
	desk: Desk;
	member: MemberSummary;
	provenance: typeof SEATING_PROVENANCE;
}

const partyKey = (m: MemberSummary) => m.party_id ?? 'independent';

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
 * Seat Members in contiguous party blocs sweeping the arc from Y Llywydd's
 * left to right, largest party first, alphabetical within a party. Blocs run
 * across all tiers so a party occupies a wedge, as in a real chamber.
 */
export function assignSeats(members: MemberSummary[], desks: Desk[]): SeatAssignment[] {
	if (members.length > desks.length) {
		throw new Error(`${members.length} Members but only ${desks.length} desks`);
	}
	const blocs = new Map<string, MemberSummary[]>();
	for (const m of members) blocs.set(partyKey(m), [...(blocs.get(partyKey(m)) ?? []), m]);
	const ordered = [...blocs.entries()]
		.sort(([ka, a], [kb, b]) => b.length - a.length || ka.localeCompare(kb))
		.flatMap(([, ms]) => ms.sort((a, b) => a.canonical_name.localeCompare(b.canonical_name, 'en-GB')));

	// A left-to-right sweep by bearing; ties across tiers resolve inner first.
	const byBearing = [...desks].sort((a, b) => a.bearing - b.bearing || a.row - b.row);
	// Spread any empty desks evenly so a short house does not leave a gap at one end.
	const stride = byBearing.length / ordered.length;
	return ordered.map((member, i) => ({
		desk: byBearing[Math.min(byBearing.length - 1, Math.floor(i * stride))],
		member,
		provenance: SEATING_PROVENANCE
	}));
}
