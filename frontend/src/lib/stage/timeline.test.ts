import { describe, expect, it } from 'vitest';
import type { Sitting } from '$lib/data/types';
import { PROVENANCE_DERIVED } from '$lib/data/types';
import real from '../../../static/data/sittings/2026-05-12.json';
import realWithTies from '../../../static/data/sittings/2026-09-15.json';
import realWithDivisions from '../../../static/data/sittings/2026-06-24.json';
import { buildTimeline, DIVISION_BEAT_SECONDS, FIXED_BEAT_SECONDS, type Beat } from './timeline';
import { division, item, sitting, speech, syntheticSitting } from './fixtures';

const realSitting = real as unknown as Sitting;
const tieSitting = realWithTies as unknown as Sitting;
const divisionSitting = realWithDivisions as unknown as Sitting;

function expectSortedAndDisjoint(beats: Beat[]) {
	for (let i = 0; i < beats.length; i++) {
		expect(beats[i].index).toBe(i);
		expect(beats[i].tEnd).toBeGreaterThanOrEqual(beats[i].t);
		if (i > 0) {
			expect(beats[i].t).toBeGreaterThanOrEqual(beats[i - 1].t);
			expect(beats[i].t).toBeGreaterThanOrEqual(beats[i - 1].tEnd);
		}
	}
}

describe('buildTimeline on the real sitting of 12 May 2026', () => {
	const timeline = buildTimeline(realSitting);

	it('makes one timed beat per contribution, sorted and non-overlapping', () => {
		expect(timeline.beats).toHaveLength(27);
		expect(timeline.beats.every((b) => b.kind === 'contribution' && b.timed)).toBe(true);
		expectSortedAndDisjoint(timeline.beats);
	});

	it('spans [t_start, t_end_derived) and gives the last contribution a fixed beat', () => {
		for (const beat of timeline.beats) {
			if (beat.kind !== 'contribution') continue;
			expect(beat.t).toBe(beat.contribution.t_start);
			if (beat.contribution.t_end_derived !== null) expect(beat.tEnd).toBe(beat.contribution.t_end_derived);
			else expect(beat.tEnd).toBe(beat.t + FIXED_BEAT_SECONDS);
		}
		expect(timeline.firstTimedT).toBe(3);
		expect(timeline.tEnd).toBe(2915 + FIXED_BEAT_SECONDS);
	});

	it('exposes item boundaries in order', () => {
		expect(timeline.items.map((i) => [i.id, i.t, i.tEnd, i.beatCount])).toEqual([
			['item-16033-260512-1', 3, 2827, 20],
			['item-16033-260512-2', 2827, 2919, 7]
		]);
		expect(timeline.items[1].firstTimedT).toBe(2827);
		expect(timeline.provenance.tEnd).toBe(PROVENANCE_DERIVED);
	});
});

describe('buildTimeline on the real sitting of 15 September 2026 (tied and out-of-order starts)', () => {
	const timeline = buildTimeline(tieSitting);

	it('keeps every contribution, sorted by clip time, non-overlapping', () => {
		expect(timeline.beats).toHaveLength(tieSitting.contributions.length);
		expectSortedAndDisjoint(timeline.beats);
		const untimed = timeline.beats.filter((b) => b.kind === 'contribution' && !b.timed);
		expect(untimed).toHaveLength(12);
	});

	it('splits a shared startPos equally rather than overlapping', () => {
		const tied = timeline.beats.filter((b) => b.kind === 'contribution' && b.contribution.t_start === 5248);
		expect(tied.map((b) => [b.t, b.tEnd])).toEqual([
			[5248, 5250],
			[5250, 5252]
		]);
	});

	it('never lets an untimed beat pass the next timed start', () => {
		for (const beat of timeline.beats) {
			if (beat.kind !== 'contribution' || beat.timed) continue;
			const nextTimed = timeline.beats.find((b) => b.index > beat.index && b.kind === 'contribution' && b.timed);
			if (nextTimed) expect(beat.tEnd).toBeLessThanOrEqual(nextTimed.t);
		}
	});
});

describe('buildTimeline on the synthetic sitting', () => {
	const timeline = buildTimeline(syntheticSitting());
	const spans = timeline.beats.map((b) => [b.kind === 'contribution' ? b.contribution.id : b.division.id, b.t, b.tEnd]);

	it('inserts untimed runs at the preceding timed beat end, shortened from that beat', () => {
		expect(spans.slice(0, 3)).toEqual([
			['a0', 10, 92],
			['a1', 92, 96],
			['a2', 96, 100]
		]);
	});

	it('squeezes an untimed run into at most half a short gap', () => {
		expect(spans.slice(3, 5)).toEqual([
			['a3', 100, 101],
			['a4', 101, 102]
		]);
	});

	it('places a division beat at the end of its item, then the next item leading untimed rows', () => {
		expect(spans.slice(5, 9)).toEqual([
			['a5', 102, 200],
			['a6', 200, 276],
			['dA', 276, 296],
			['c0', 296, 300]
		]);
		const dA = timeline.beats[7];
		expect(dA.kind).toBe('division');
		expect(dA.itemId).toBe('A');
		expect(dA.kind === 'division' && dA.placement).toBe(PROVENANCE_DERIVED);
		expect(dA.tEnd - dA.t).toBe(DIVISION_BEAT_SECONDS);
	});

	it('treats a negative startPos as untimed', () => {
		const c0 = timeline.beats[8];
		expect(c0.kind === 'contribution' && c0.timed).toBe(false);
	});

	it('gives the last timed beat a fixed length and trailing untimed beats after it', () => {
		expect(spans.slice(9)).toEqual([
			['c1', 300, 304],
			['c2', 304, 308]
		]);
		expect(timeline.tEnd).toBe(308);
		expectSortedAndDisjoint(timeline.beats);
	});

	it('exposes an empty item at the previous item end with no beats', () => {
		expect(timeline.items.map((i) => [i.id, i.t, i.tEnd, i.beatCount, i.firstTimedT])).toEqual([
			['A', 10, 296, 8, 10],
			['B', 296, 296, 0, null],
			['C', 296, 308, 3, 300]
		]);
		expect(timeline.items[1].beatStart).toBe(timeline.items[1].beatEnd);
	});

	it('indexes beats by contribution and division id', () => {
		expect(timeline.beatIndexByContributionId.get('a4')).toBe(4);
		expect(timeline.beatIndexByDivisionId.get('dA')).toBe(7);
	});
});

describe('buildTimeline edge cases', () => {
	it('sits untimed contributions before the first timed one at t = 0 without passing it', () => {
		const timeline = buildTimeline(
			sitting({ items: [item('A', 0, 3)], contributions: [speech('u0', 'A', 0, null), speech('u1', 'A', 1, null), speech('x', 'A', 2, 3)] })
		);
		expect(timeline.beats.map((b) => [b.t, b.tEnd])).toEqual([
			[0, 1.5],
			[1.5, 3],
			[3, 7]
		]);
		expect(timeline.firstTimedT).toBe(3);
	});

	it('plays a sitting with no timestamps as fixed beats from t = 0', () => {
		const timeline = buildTimeline(
			sitting({ items: [item('A', 0, 3)], contributions: [speech('u0', 'A', 0, null), speech('u1', 'A', 1, null), speech('u2', 'A', 2, -1)] })
		);
		expect(timeline.beats.map((b) => [b.t, b.tEnd])).toEqual([
			[0, 4],
			[4, 8],
			[8, 12]
		]);
		expect(timeline.firstTimedT).toBeNull();
		expect(timeline.tEnd).toBe(12);
	});

	it('handles an empty sitting', () => {
		const timeline = buildTimeline(sitting({}));
		expect(timeline.beats).toEqual([]);
		expect(timeline.tEnd).toBe(0);
	});

	it('orders beats by clip time when the Record order runs backwards', () => {
		const timeline = buildTimeline(
			sitting({ items: [item('A', 0, 3)], contributions: [speech('p', 'A', 0, 50), speech('q', 'A', 1, 40), speech('r', 'A', 2, 60)] })
		);
		expect(timeline.beats.map((b) => [b.kind === 'contribution' && b.contribution.id, b.t, b.tEnd])).toEqual([
			['q', 40, 50],
			['p', 50, 60],
			['r', 60, 64]
		]);
	});
});

describe('divisions on the real sitting of 24 June 2026', () => {
	const timeline = buildTimeline(divisionSitting);
	const beats = timeline.beats.filter((b) => b.kind === 'division');

	it('places every division from the export on the timeline', () => {
		expect(divisionSitting.divisions.length).toBeGreaterThan(0);
		expect(beats).toHaveLength(divisionSitting.divisions.length);
		expect(timeline.beatIndexByDivisionId.size).toBe(divisionSitting.divisions.length);
	});

	it('sits each division beat inside the bounds of its own agenda item', () => {
		for (const beat of beats) {
			const item = timeline.items.find((i) => i.id === beat.itemId)!;
			expect(beat.itemId).toBe(beat.division.item_id);
			expect(beat.t).toBeGreaterThanOrEqual(item.t);
			expect(beat.tEnd).toBeLessThanOrEqual(item.tEnd);
			expect(beat.index).toBeGreaterThanOrEqual(item.beatStart);
			expect(beat.index).toBeLessThan(item.beatEnd);
		}
	});

	it('follows the contribution that calls it and badges its placement derived', () => {
		for (const beat of beats) {
			expect(beat.calledBy).not.toBeNull();
			const caller = timeline.beats[timeline.beatIndexByContributionId.get(beat.calledBy!)!];
			expect(caller.kind).toBe('contribution');
			expect(beat.t).toBeGreaterThanOrEqual(caller.tEnd);
			// Nothing else of the item speaks between the call and the vote.
			const between = timeline.beats.slice(caller.index + 1, beat.index).filter((b) => b.kind === 'contribution' && b.timed);
			expect(between).toEqual([]);
			expect(beat.placement).toBe(PROVENANCE_DERIVED);
		}
	});

	it('keeps the whole timeline sorted and non-overlapping with the divisions in it', () => {
		expectSortedAndDisjoint(timeline.beats);
	});
});

describe('the length of a division beat', () => {
	it('runs the full 20 s when the Record leaves room after the item', () => {
		const built = buildTimeline(
			sitting({ items: [item('A', 0, 1), item('B', 1, 1)], contributions: [speech('a', 'A', 0, 0), speech('b', 'B', 0, 500)], divisions: [division('d', 'A')] })
		);
		const beat = built.beats.find((b) => b.kind === 'division')!;
		expect(beat.tEnd - beat.t).toBe(DIVISION_BEAT_SECONDS);
	});

	/**
	 * Ten divisions in one Voting Time against a nine-second gap to the next item: the beats
	 * share what the Record leaves rather than overrun the next published startPos. The desk
	 * tints outlast the beat by the fade (floor.ts), which is what keeps a squeezed run readable.
	 */
	it('shares the gap when the Record leaves less than the whole run asks for', () => {
		const built = buildTimeline(
			sitting({
				items: [item('A', 0, 1), item('B', 1, 1)],
				contributions: [speech('a', 'A', 0, 0), speech('b', 'B', 0, 10)],
				divisions: [division('d1', 'A'), division('d2', 'A')]
			})
		);
		const beats = built.beats.filter((b) => b.kind === 'division');
		expect(beats).toHaveLength(2);
		expect(beats[1].tEnd).toBe(10);
		expect(beats.every((b) => b.tEnd - b.t < DIVISION_BEAT_SECONDS)).toBe(true);
		expectSortedAndDisjoint(built.beats);
	});
});
