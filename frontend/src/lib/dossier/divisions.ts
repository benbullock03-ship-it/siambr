import type { DivisionResult } from '$lib/api/types';

export interface PartyTally {
	partyId: string | null;
	for: number;
	against: number;
	abstain: number;
	didNotVote: number;
}

const total = (t: PartyTally) => t.for + t.against + t.abstain + t.didNotVote;

export function ballotsByParty(division: DivisionResult): PartyTally[] {
	const tallies = new Map<string | null, PartyTally>();
	for (const b of division.ballots) {
		let t = tallies.get(b.party_id_at_date);
		if (!t) {
			t = { partyId: b.party_id_at_date, for: 0, against: 0, abstain: 0, didNotVote: 0 };
			tallies.set(b.party_id_at_date, t);
		}
		if (b.vote_cast === 'for') t.for++;
		else if (b.vote_cast === 'against') t.against++;
		else if (b.vote_cast === 'abstain') t.abstain++;
		else t.didNotVote++;
	}
	return [...tallies.values()].sort((a, b) => {
		if ((a.partyId === null) !== (b.partyId === null)) return a.partyId === null ? 1 : -1;
		return total(b) - total(a) || (a.partyId ?? '').localeCompare(b.partyId ?? '');
	});
}
