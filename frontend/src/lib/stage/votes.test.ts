import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Sitting, TabledText } from '$lib/data/types';
import { PROVENANCE_DERIVED } from '$lib/data/types';
import { buildTimeline } from './timeline';
import { agreedAmendmentTexts, calledTarget, debateItemOf, itemNumber, matchDivisionCalls, readMotion, targetLabel } from './votes';
import { division, item, sitting, speech } from './fixtures';

const DATA = resolve(__dirname, '../../../static/data/sittings');
const real = (): Sitting[] =>
	readdirSync(DATA)
		.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
		.map((f) => JSON.parse(readFileSync(resolve(DATA, f), 'utf-8')) as Sitting);

describe('readMotion', () => {
	it('splits the printed item number, the debate and the question', () => {
		const r = readMotion('Item 5. Reform UK Debate - grooming gangs. Amendment 1, tabled in the name of Heledd Fychan.');
		expect(r.itemNumber).toBe(5);
		expect(r.topic).toBe('Reform UK Debate - grooming gangs');
		expect(r.question).toBe('Amendment 1, tabled in the name of Heledd Fychan');
		expect(r.target).toEqual({ kind: 'amendment', number: 1 });
		expect(r.tabledBy).toBe('Heledd Fychan');
		expect(r.provenance).toBe(PROVENANCE_DERIVED);
	});

	it('reads a motion without amendment, a motion as amended and a bare motion', () => {
		expect(readMotion('Item 6. Debate - x. Motion without amendment.').target).toEqual({ kind: 'motion' });
		expect(readMotion('Item 6. Debate - x. Motion as amended.').target).toEqual({ kind: 'motion_as_amended' });
		expect(readMotion('Item 7. Debate: Fair Funding.  Motion.').target).toEqual({ kind: 'motion' });
		expect(readMotion('Item 7. Debate: Fair Funding.  Motion.').topic).toBe('Debate: Fair Funding');
	});

	it('reads the Welsh question the Record sometimes prints in its English field', () => {
		const amended = readMotion("Item 8. Reform UK Debate - access to HMOs. Cynnig wedi’i ddiwygio.");
		expect(amended.itemNumber).toBe(8);
		expect(amended.topic).toBe('Reform UK Debate - access to HMOs');
		expect(amended.target).toEqual({ kind: 'motion_as_amended' });

		const amendment = readMotion('Item 8. Reform UK Debate - access to HMOs. Gwelliant 1, a gyflwynwyd yn enw Heledd Fychan.');
		expect(amendment.target).toEqual({ kind: 'amendment', number: 1 });
		expect(amendment.tabledBy).toBe('Heledd Fychan');

		expect(readMotion("Item 8. Debate - x. Cynnig heb ei ddiwygio.").target).toEqual({ kind: 'motion' });
	});

	it('takes a motion text with no question as a vote on the motion itself', () => {
		const r = readMotion('Item 6. Member Debate under Standing Order 11.21(iv) - ophthalmology services');
		expect(r.itemNumber).toBe(6);
		expect(r.question).toBeNull();
		expect(r.topic).toBe('Member Debate under Standing Order 11.21(iv) - ophthalmology services');
		expect(targetLabel(r.target)).toBe('Motion');
	});
});

describe('itemNumber and debateItemOf', () => {
	const items = [item('a', 0), item('b', 1), item('c', 2)];
	items[0].title_en = '1. Questions to the First Minister';
	items[1].title_en = '2. Business Statement';
	items[2].title_en = '5. Reform UK Debate: Grooming gangs';

	it('reads the printed agenda number, which may skip', () => {
		expect(items.map(itemNumber)).toEqual([1, 2, 5]);
		expect(itemNumber(item('z', 3))).toBe(4);
	});

	it('finds the debate an amendment belongs to by that number, not by position', () => {
		expect(debateItemOf({ motion_text: 'Item 5. Reform UK Debate - grooming gangs. Amendment 1, tabled in the name of X.' }, items)?.id).toBe('c');
		expect(debateItemOf({ motion_text: 'Item 9. Nothing here. Motion.' }, items)).toBeNull();
	});
});

describe('calledTarget', () => {
	it('reads the vote Y Llywydd calls, ignoring the conditional that follows', () => {
		expect(
			calledTarget({
				text_english:
					'I call for a vote on amendment 1, tabled in the name of Lynne Neagle. If amendment 1 is agreed, amendments 2 and 3 will be deselected. Open the vote.'
			})
		).toEqual({ kind: 'amendment', number: 1 });
		expect(
			calledTarget({
				text_english:
					'I first call for a vote on the motion under item 5, the motion tabled in the name of the Member. If the proposal is not agreed, we will vote on the amendments tabled to the motion.'
			})
		).toEqual({ kind: 'motion' });
		expect(calledTarget({ text_english: 'I now call for a vote on the motion as amended.' })).toEqual({ kind: 'motion_as_amended' });
	});

	it('returns null for a result read-out or a stage direction', () => {
		expect(calledTarget({ text_english: 'Open the vote. Close the vote. In favour 61, abstentions one, against 29.' })).toBeNull();
		expect(calledTarget({ text_english: 'We now move to amendment 2.' })).toBeNull();
	});
});

describe('matchDivisionCalls', () => {
	it('walks the calls in Record order against the divisions grouped by printed item', () => {
		const d = (id: string, text: string) => ({ ...division(id, 'V'), motion_text: text });
		const c = (id: string, seq: number, t: number, text: string) => ({ ...speech(id, 'V', seq, t), text_english: text });
		const s = sitting({
			items: [item('V', 0)],
			contributions: [
				c('c0', 0, 100, 'I call for a vote on the motion under item 5. Open the vote. Close the vote.'),
				c('c1', 1, 160, 'I call for a vote on amendment 1. Open the vote. Close the vote.'),
				c('c2', 2, 220, 'I now call for a vote on the motion as amended.'),
				c('c3', 3, 225, 'Open the vote. Close the vote. The motion as amended is agreed.'),
				c('c4', 4, 300, 'We move to item 6. I call for a vote on the motion. Open the vote. Close the vote.'),
				c('c5', 5, 360, 'I call for a vote on amendment 1. Open the vote.')
			],
			divisions: [
				d('v5a1', 'Item 5. Debate one. Amendment 1, tabled in the name of A.'),
				d('v5m', 'Item 5. Debate one. Motion without amendment.'),
				d('v5x', 'Item 5. Debate one. Motion as amended.'),
				d('v6a1', 'Item 6. Debate two. Amendment 1, tabled in the name of B.'),
				d('v6m', 'Item 6. Debate two. Motion without amendment.')
			]
		});
		expect([...matchDivisionCalls(s)]).toEqual([
			['v5m', 'c0'],
			['v5a1', 'c1'],
			['v5x', 'c2'],
			['v6m', 'c4'],
			['v6a1', 'c5']
		]);
		const beats = buildTimeline(s).beats.map((b) => (b.kind === 'division' ? `${b.division.id}<${b.calledBy}` : b.contribution.id));
		expect(beats).toEqual(['c0', 'v5m<c0', 'c1', 'v5a1<c1', 'c2', 'v5x<c2', 'c3', 'c4', 'v6m<c4', 'c5', 'v6a1<c5']);
	});

	it('leaves a division no call names at the end of its item', () => {
		const s = sitting({
			items: [item('V', 0), item('W', 1)],
			contributions: [speech('c0', 'V', 0, 100), speech('w0', 'W', 0, 500)],
			divisions: [division('d', 'V')]
		});
		expect(matchDivisionCalls(s).size).toBe(0);
		const beat = buildTimeline(s).beats.find((b) => b.kind === 'division');
		expect(beat && beat.kind === 'division' && beat.calledBy).toBeNull();
	});

	it('names a call for every division in every exported sitting', () => {
		const sittings = real().filter((s) => s.divisions.length);
		expect(sittings.length).toBeGreaterThan(0);
		const missing: string[] = [];
		for (const s of sittings) {
			const calls = matchDivisionCalls(s);
			for (const d of s.divisions) {
				const c = s.contributions.find((x) => x.id === calls.get(d.id));
				if (!c) missing.push(`${s.date} ${d.motion_text}`);
				else expect(c.item_id).toBe(d.item_id);
			}
			// A division loses its debate only when ingest skipped that item whole because a
			// speaker could not be attributed to a Member (T-13: the Counsel General and the
			// anonymous Modern.Gov 7). Any other miss is a broken link.
			const exported = new Set(s.items.map(itemNumber));
			for (const d of s.divisions) {
				if (debateItemOf(d, s.items)) continue;
				const n = readMotion(d.motion_text).itemNumber;
				expect(n, `${s.date} ${d.motion_text}`).not.toBeNull();
				expect(exported.has(n as number), `${s.date} ${d.motion_text}`).toBe(false);
			}
		}
		expect(missing).toEqual([]);
	});
});

describe('agreedAmendmentTexts', () => {
	const items = [item('debate', 7), item('votes', 8)];
	items[0].title_en = '8. Welsh Conservatives Debate: Deposit-return scheme';
	items[1].title_en = '9. Voting Time';
	const text = (id: string, kind: 'motion' | 'amendment', amendment_number: number | null, text_english: string): TabledText => ({
		id,
		item_id: 'debate',
		seq: 0,
		kind,
		amendment_number,
		lang: 'en',
		text_original: text_english,
		text_english
	});
	const tabled_texts = [
		text('m', 'motion', null, 'Motion NDM1 A B\n\nTo propose'),
		text('a1', 'amendment', 1, 'Amendment 1—C D\n\nDelete all after point 2'),
		text('a2', 'amendment', 2, 'Amendment 2—E F\n\nAdd as new point')
	];
	const d = (id: string, motion_text: string, result: 'agreed' | 'negatived') => ({ ...division(id, 'votes'), motion_text, result });
	const divisions = [
		d('v1', 'Item 8. Welsh Conservatives Debate - deposit return scheme. Motion without amendment.', 'negatived'),
		d('v2', 'Item 8. Welsh Conservatives Debate - deposit return scheme. Amendment 1, tabled in the name of C D.', 'agreed'),
		d('v3', 'Item 8. Welsh Conservatives Debate - deposit return scheme. Amendment 2, tabled in the name of E F.', 'negatived'),
		d('v4', 'Item 8. Welsh Conservatives Debate - deposit return scheme. Motion as amended.', 'agreed'),
		d('v5', 'Item 7. Reform UK Debate - bovine TB. Amendment 1, tabled in the name of G H.', 'agreed')
	];

	it('returns only the agreed amendments of the same debate, as tabled', () => {
		expect(agreedAmendmentTexts(divisions[3], divisions, { items, tabled_texts }).map((t) => t.id)).toEqual(['a1']);
	});

	it('returns nothing when the debate cannot be found', () => {
		expect(agreedAmendmentTexts({ motion_text: 'Item 3. Unknown. Motion as amended.' }, divisions, { items, tabled_texts })).toEqual([]);
	});
});
