import { describe, expect, it } from 'vitest';
import type { Division, MemberLight, VoteCast } from '$lib/data/types';
import { ballotsByParty } from './divisions';
import { member } from './fixtures';

const division = (votes: Record<string, VoteCast>): Division => ({
	id: 'd1',
	item_id: 'item-1',
	motion_text: 'x',
	votes_for: 0,
	votes_against: 0,
	votes_abstain: 0,
	result: 'agreed',
	votes
});

const speakers = (parties: Record<string, string | null>): Record<string, MemberLight> =>
	Object.fromEntries(Object.entries(parties).map(([id, party]) => [id, { ...member(id), party_id: party }]));

describe('ballotsByParty', () => {
	it('tallies each party, largest delegation first', () => {
		const rows = ballotsByParty(
			division({ a: 'against', b: 'for', c: 'for', d: 'abstain', e: 'did_not_vote' }),
			speakers({ a: 'plaid_cymru', b: 'labour', c: 'labour', d: 'labour', e: 'plaid_cymru' })
		);
		expect(rows.map((r) => r.partyId)).toEqual(['labour', 'plaid_cymru']);
		expect(rows[0]).toEqual({ partyId: 'labour', for: 2, against: 0, abstain: 1, didNotVote: 0 });
		expect(rows[1]).toEqual({ partyId: 'plaid_cymru', for: 0, against: 1, abstain: 0, didNotVote: 1 });
	});

	it('keeps Members with no recorded party in a final row rather than dropping them', () => {
		const rows = ballotsByParty(division({ a: 'for', b: 'for' }), speakers({ a: null, b: 'labour' }));
		expect(rows.map((r) => r.partyId)).toEqual(['labour', null]);
	});

	it('returns nothing when the division carries no member-level ballots', () => {
		expect(ballotsByParty(division({}), {})).toEqual([]);
	});
});
