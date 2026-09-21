/** What the chamber shows at sitting time t, for everything that draws it. DOMAIN_MODEL.md 3.3. Pure; no DOM, no three.js. */
import type { Desk } from '$lib/3d/chamber/layout';
import { assignChamberSeats, llywyddDesk, type SeatAssignment } from '$lib/3d/chamber/seating';
import type { MemberLight, Sitting, TermFile } from '$lib/data/types';
import { floorState, steadyFloor, type FloorState } from './floor';
import { buildPresidingSpans, presidingAt, type PresidingSpan } from './presiding';
import type { Timeline } from './timeline';

export interface ChamberView {
	floor: FloorState;
	presidingId: string | null;
	/** Derived seating for the presiding officer in the chair; changes only when the chair does. */
	seats: SeatAssignment[];
	/** The seat the floor light is on: the speaker's own, else the presiding officer's. */
	liveSeat: SeatAssignment | null;
	/** The desk the floor light is on: the speaker's own, else Y Llywydd's place. Null outside a contribution. */
	liveDesk: Desk | null;
}

interface Seating {
	seats: SeatAssignment[];
	byMember: Map<string, SeatAssignment>;
	chair: SeatAssignment | null;
}

export class ChamberFloor {
	private readonly spans: PresidingSpan[];
	private readonly seatings = new Map<string | null, Seating>();
	private readonly dais = llywyddDesk();
	private last: ChamberView | null = null;

	constructor(
		private readonly timeline: Timeline,
		private readonly sitting: Sitting,
		private readonly term: TermFile,
		private readonly members: MemberLight[],
		private readonly desks: Desk[]
	) {
		this.spans = buildPresidingSpans(sitting, term, timeline);
	}

	private seating(presidingId: string | null): Seating {
		let s = this.seatings.get(presidingId);
		if (!s) {
			const seats = assignChamberSeats(this.members, this.desks, this.term, presidingId, this.sitting.date);
			s = { seats, byMember: new Map(seats.map((x) => [x.member.id, x])), chair: seats.find((x) => x.desk.row < 0) ?? null };
			this.seatings.set(presidingId, s);
		}
		return s;
	}

	/** The same object back while nothing shown has changed. */
	at(t: number): ChamberView {
		const floor = steadyFloor(this.last?.floor ?? null, floorState(this.timeline, t));
		const presidingId = presidingAt(this.spans, t);
		const { seats, byMember, chair } = this.seating(presidingId);
		const live = floor.live?.kind === 'contribution' ? floor.live.contribution : null;
		const id = live?.member_id ?? null;
		const liveSeat = live ? ((id && id !== presidingId && byMember.get(id)) || chair) : null;
		const liveDesk = live ? (liveSeat?.desk ?? this.dais) : null;
		const l = this.last;
		if (l && l.floor === floor && l.presidingId === presidingId && l.seats === seats && l.liveSeat === liveSeat && l.liveDesk?.id === liveDesk?.id) return l;
		return (this.last = { floor, presidingId, seats, liveSeat, liveDesk });
	}
}
