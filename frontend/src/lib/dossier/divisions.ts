import type { Division, MemberLight, VoteCast } from '$lib/data/types';

export interface Ballot {
	memberId: string;
	name: string;
	vote: VoteCast;
}

export interface PartyTally {
	partyId: string | null;
	for: number;
	against: number;
	abstain: number;
	didNotVote: number;
	/** Every Member of this delegation with a row in the division, by name. */
	members: Ballot[];
}

const total = (t: PartyTally) => t.for + t.against + t.abstain + t.didNotVote;

/** Ballots by the party each Member sat for on the day (the sitting file carries that), largest delegation first. */
export function ballotsByParty(division: Division, speakers: Record<string, MemberLight>): PartyTally[] {
	const tallies = new Map<string | null, PartyTally>();
	for (const [memberId, cast] of Object.entries(division.votes)) {
		const party = speakers[memberId]?.party_id ?? null;
		let t = tallies.get(party);
		if (!t) {
			t = { partyId: party, for: 0, against: 0, abstain: 0, didNotVote: 0, members: [] };
			tallies.set(party, t);
		}
		t.members.push({ memberId, name: speakers[memberId]?.canonical_name ?? memberId, vote: cast });
		if (cast === 'for') t.for++;
		else if (cast === 'against') t.against++;
		else if (cast === 'abstain') t.abstain++;
		else t.didNotVote++;
	}
	for (const t of tallies.values()) t.members.sort((a, b) => a.name.localeCompare(b.name));
	return [...tallies.values()].sort((a, b) => {
		if ((a.partyId === null) !== (b.partyId === null)) return a.partyId === null ? 1 : -1;
		return total(b) - total(a) || (a.partyId ?? '').localeCompare(b.partyId ?? '');
	});
}
