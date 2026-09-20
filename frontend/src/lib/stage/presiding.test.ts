import { describe, expect, it } from 'vitest';
import type { Contribution, Sitting, TermFile } from '$lib/data/types';
import realSitting260916 from '../../../static/data/sittings/2026-09-16.json';
import realSitting260708 from '../../../static/data/sittings/2026-07-08.json';
import term7 from '../../../static/data/terms/7.json';
import { buildPresidingSpans, isChairingContribution, presidingAt } from './presiding';
import { buildTimeline } from './timeline';

describe('isChairingContribution', () => {
	const poIds = new Set(['ms-kerry-ferguson', 'ms-huw-irranca-davies']);

	it('returns false for non-presiding members', () => {
		const c: Contribution = {
			id: 'c1',
			item_id: 'i1',
			seq: 1,
			member_id: 'ms-ken-skates',
			lang: 'cy',
			text_original: 'Cwestiwn 1...',
			text_english: 'Question 1...',
			t_start: 10,
			t_end_derived: 20,
			tv_url: null
		};
		expect(isChairingContribution(c, poIds)).toBe(false);
	});

	it('returns true when Kerry Ferguson speaks as Deputy Presiding Officer', () => {
		const c: Contribution = {
			id: 'c2',
			item_id: 'i1',
			seq: 0,
			member_id: 'ms-kerry-ferguson',
			lang: 'cy',
			text_original: 'Prynhawn da. Allaf i gymryd y cyfle hwn i\'ch croesawu chi nôl i\'r tymor?',
			text_english: 'Good afternoon. May I take this opportunity to welcome you back to this new term?',
			t_start: 3,
			t_end_derived: 21,
			tv_url: null
		};
		expect(isChairingContribution(c, poIds)).toBe(true);
	});

	it('returns false when Huw Irranca-Davies speaks from the floor addressing the Chair', () => {
		const c: Contribution = {
			id: 'c3',
			item_id: 'i2',
			seq: 6,
			member_id: 'ms-huw-irranca-davies',
			lang: 'cy',
			text_original: 'Diolch, Ddirprwy Lywydd. Rwy\'n codi heddiw...',
			text_english: 'Diolch, Ddirprwy Lywydd. I rise today to mark a momentous milestone...',
			t_start: 100,
			t_end_derived: 150,
			tv_url: null
		};
		expect(isChairingContribution(c, poIds)).toBe(false);
	});

	it('returns true when Huw Irranca-Davies calls the Chamber or items from the Chair', () => {
		const c: Contribution = {
			id: 'c4',
			item_id: 'i3',
			seq: 0,
			member_id: 'ms-huw-irranca-davies',
			lang: 'en',
			text_original: 'We will now move to this afternoon\'s short debate...',
			text_english: 'We will now move to this afternoon\'s short debate...',
			t_start: 200,
			t_end_derived: 250,
			tv_url: null
		};
		expect(isChairingContribution(c, poIds)).toBe(true);
	});
});

describe('buildPresidingSpans and presidingAt for 2026-09-16', () => {
	const sitting = realSitting260916 as unknown as Sitting;
	const term = term7 as unknown as TermFile;
	const timeline = buildTimeline(sitting);
	const spans = buildPresidingSpans(sitting, term, timeline);

	it('identifies Kerry Ferguson as initial presiding officer for Questions to the Trefnydd / Culture and Sport', () => {
		expect(presidingAt(spans, 0)).toBe('ms-kerry-ferguson');
		expect(presidingAt(spans, 10)).toBe('ms-kerry-ferguson');
		// Item 1 contribution 0 starts at t=3
		expect(presidingAt(spans, 3)).toBe('ms-kerry-ferguson');
	});

	it('switches to Huw Irranca-Davies when he takes the Chair', () => {
		// Huw concludes item 3 at t=6370 and opens item 4
		expect(presidingAt(spans, 6360)).toBe('ms-kerry-ferguson');
		expect(presidingAt(spans, 6380)).toBe('ms-huw-irranca-davies');
		expect(presidingAt(spans, 8000)).toBe('ms-huw-irranca-davies');
	});
});

describe('buildPresidingSpans and presidingAt for 2026-07-08', () => {
	const sitting = realSitting260708 as unknown as Sitting;
	const term = term7 as unknown as TermFile;
	const timeline = buildTimeline(sitting);
	const spans = buildPresidingSpans(sitting, term, timeline);

	it('keeps Kerry Ferguson in the Chair when Huw Irranca-Davies speaks in 90-second statements', () => {
		// In 2026-07-08 item 4 (90-second statements), Kerry Ferguson chairs and calls Huw
		// Find Huw's floor speech contribution
		const huwFloorContribution = sitting.contributions.find(
			(c) => c.item_id === 'item-16084-260708-4' && c.member_id === 'ms-huw-irranca-davies'
		);
		expect(huwFloorContribution).toBeDefined();
		if (huwFloorContribution?.t_start) {
			expect(presidingAt(spans, huwFloorContribution.t_start)).toBe('ms-kerry-ferguson');
		}
	});
});
