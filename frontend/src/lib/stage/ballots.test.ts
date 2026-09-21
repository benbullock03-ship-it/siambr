import { describe, expect, it } from 'vitest';
import { PROVENANCE_DERIVED } from '$lib/data/types';
import type { MemberBallot } from '$lib/data/types';
import { groupBallots, tallyBallots } from './ballots';

const ballot = (over: Partial<MemberBallot>): MemberBallot => ({
	division_id: 'd',
	item_id: 'voting-time',
	item_title_en: '7. Voting Time',
	date: '2026-06-10',
	motion_text: 'Item 5. Reform UK Debate - grooming gangs. Motion without amendment',
	result: 'negatived',
	vote_cast: 'for',
	debate_item_id: null,
	debate_item_title_en: null,
	...over
});

describe('tallyBallots', () => {
	it('sums the publisher’s rows and badges the sum derived', () => {
		const t = tallyBallots([ballot({}), ballot({ vote_cast: 'against' }), ballot({ vote_cast: 'did_not_vote' }), ballot({ vote_cast: 'for' })]);
		expect(t).toEqual({ for: 2, against: 1, abstain: 0, did_not_vote: 1, provenance: PROVENANCE_DERIVED });
	});
});

describe('groupBallots', () => {
	it('groups newest day first, then by debate, rows in export order', () => {
		const days = groupBallots([
			ballot({ division_id: 'a1', date: '2026-06-03', motion_text: 'Item 5. Debate A. Amendment 1, tabled in the name of Jane Doe' }),
			ballot({ division_id: 'a2', date: '2026-06-03', motion_text: 'Item 5. Debate A. Motion as amended' }),
			ballot({ division_id: 'b1', date: '2026-06-03', motion_text: 'Item 6. Debate B. Motion without amendment' }),
			ballot({ division_id: 'c1', date: '2026-06-10', debate_item_id: 'item-3', debate_item_title_en: '3. Debate C', motion_text: 'Item 3. Debate C. Motion' })
		]);
		expect(days.map((d) => [d.date, d.count])).toEqual([
			['2026-06-10', 1],
			['2026-06-03', 3]
		]);
		const [, older] = days;
		expect(older.debates.map((d) => d.title)).toEqual(['Debate A', 'Debate B']);
		expect(older.debates[0].rows.map((r) => r.targetLabel)).toEqual(['Amendment 1', 'Motion as amended']);
		expect(older.debates[0].rows[0].tabledBy).toBe('Jane Doe');
		expect(older.debates[0].fallback).toBe(true);
		expect(older.debates[0].itemId).toBe('voting-time');
		expect(days[0].debates[0]).toMatchObject({ itemId: 'item-3', title: 'Debate C', fallback: false });
	});

	it('keeps two debates apart when neither has an exported item', () => {
		const [day] = groupBallots([
			ballot({ division_id: 'x', motion_text: 'Item 5. Debate X. Motion' }),
			ballot({ division_id: 'y', motion_text: 'Item 6. Debate Y. Motion' })
		]);
		expect(day.debates).toHaveLength(2);
	});

	it('never alters the motion text', () => {
		const text = 'Item 5. Reform UK Debate - grooming gangs. Amendment 1, tabled in the name of Jane Doe';
		const [day] = groupBallots([ballot({ motion_text: text })]);
		expect(day.debates[0].rows[0].ballot.motion_text).toBe(text);
	});
});
