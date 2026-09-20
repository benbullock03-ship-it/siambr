import type { Division, MemberLight } from '$lib/data/types';

export interface PartyTally {
	partyId: string | null;
	for: number;
	against: number;
	abstain: number;
	didNotVote: number;
}

const total = (t: PartyTally) => t.for + t.against + t.abstain + t.didNotVote;

/** Ballots by the party each Member sat for on the day (the sitting file carries that), largest delegation first. */
export function ballotsByParty(division: Division, speakers: Record<string, MemberLight>): PartyTally[] {
	const tallies = new Map<string | null, PartyTally>();
	for (const [memberId, cast] of Object.entries(division.votes)) {
		const party = speakers[memberId]?.party_id ?? null;
		let t = tallies.get(party);
		if (!t) {
			t = { partyId: party, for: 0, against: 0, abstain: 0, didNotVote: 0 };
			tallies.set(party, t);
		}
		if (cast === 'for') t.for++;
		else if (cast === 'against') t.against++;
		else if (cast === 'abstain') t.abstain++;
		else t.didNotVote++;
	}
	return [...tallies.values()].sort((a, b) => {
		if ((a.partyId === null) !== (b.partyId === null)) return a.partyId === null ? 1 : -1;
		return total(b) - total(a) || (a.partyId ?? '').localeCompare(b.partyId ?? '');
	});
}
