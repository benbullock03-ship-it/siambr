import { describe, expect, it } from 'vitest';
import type { DivisionResult, MemberVoteCast } from '$lib/api/types';
import { ballotsByParty } from './divisions';
import { member } from './fixtures';

const ballot = (id: string, party: string | null, cast: MemberVoteCast['vote_cast']): MemberVoteCast => ({
	member: member(id),
	party_id_at_date: party,
	vote_cast: cast
});

const division = (ballots: MemberVoteCast[]): DivisionResult => ({
	id: 'd1',
	motion_text: 'x',
	votes_for: 0,
	votes_against: 0,
	votes_abstain: 0,
	result: 'agreed',
	ballots
});

describe('ballotsByParty', () => {
	it('tallies each party, largest delegation first', () => {
		const rows = ballotsByParty(
			division([
				ballot('a', 'plaid_cymru', 'against'),
				ballot('b', 'labour', 'for'),
				ballot('c', 'labour', 'for'),
				ballot('d', 'labour', 'abstain'),
				ballot('e', 'plaid_cymru', 'did_not_vote')
			])
		);
		expect(rows).toEqual([
			{ partyId: 'labour', for: 2, against: 0, abstain: 1, didNotVote: 0 },
			{ partyId: 'plaid_cymru', for: 0, against: 1, abstain: 0, didNotVote: 1 }
		]);
	});

	it('keeps members with no recorded party in their own row, last', () => {
		const rows = ballotsByParty(
			division([ballot('a', null, 'for'), ballot('b', null, 'for'), ballot('c', 'greens', 'against')])
		);
		expect(rows.map((r) => r.partyId)).toEqual(['greens', null]);
	});
});
