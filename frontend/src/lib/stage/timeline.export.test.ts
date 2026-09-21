import { describe, expect, it } from 'vitest';
import type { Sitting } from '$lib/data/types';
import { PROVENANCE_DERIVED } from '$lib/data/types';
import { buildTimeline, isTimed } from './timeline';

/** T-24 timeline gate: the invariants hold on every exported sitting, not only the fixtures. */
const exported = import.meta.glob<{ default: Sitting }>('../../../static/data/sittings/*-*-*.json', { eager: true });
const sittings = Object.entries(exported)
	.map(([path, mod]) => [path.split('/').pop()!.replace('.json', ''), mod.default] as const)
	.sort(([a], [b]) => a.localeCompare(b));

describe('timeline invariants on every exported sitting', () => {
	it('has sittings to check', () => {
		expect(sittings.length).toBeGreaterThan(0);
	});

	it.each(sittings)('%s', (date, sitting) => {
		expect(sitting.date).toBe(date);
		const timeline = buildTimeline(sitting);
		const { beats, items } = timeline;

		expect(timeline.provenance.tEnd).toBe(PROVENANCE_DERIVED);
		expect(timeline.provenance.untimedBeats).toBe(PROVENANCE_DERIVED);
		expect(timeline.provenance.divisionPlacement).toBe(PROVENANCE_DERIVED);

		// Every contribution and division becomes exactly one beat.
		expect(beats.filter((b) => b.kind === 'contribution')).toHaveLength(sitting.contributions.length);
		expect(beats.filter((b) => b.kind === 'division')).toHaveLength(sitting.divisions.length);
		expect(timeline.beatIndexByContributionId.size).toBe(sitting.contributions.length);
		expect(timeline.beatIndexByDivisionId.size).toBe(sitting.divisions.length);

		// Sorted, non-overlapping, half-open.
		for (let i = 0; i < beats.length; i++) {
			const beat = beats[i];
			expect(beat.index).toBe(i);
			expect(beat.tEnd).toBeGreaterThanOrEqual(beat.t);
			if (i > 0) expect(beat.t).toBeGreaterThanOrEqual(beats[i - 1].tEnd);
			if (beat.kind === 'contribution') {
				expect(beat.timed).toBe(isTimed(beat.contribution));
				// Tied starts share the gap to the next start, so a timed beat begins at or after its startPos.
				if (beat.timed) expect(beat.t).toBeGreaterThanOrEqual(beat.contribution.t_start!);
			}
		}

		// An untimed beat never passes the next timed start: it borrows time before the next published startPos.
		for (let i = 0; i < beats.length; i++) {
			const beat = beats[i];
			if (beat.kind !== 'contribution' || beat.timed) continue;
			const nextTimed = beats.slice(i + 1).find((b) => b.kind === 'contribution' && b.timed);
			if (nextTimed) expect(beat.tEnd).toBeLessThanOrEqual(nextTimed.t);
		}

		// Every beat of an item lies inside the item's window (tied starts can interleave items on the clock),
		// and a division beat lies inside the item the Record gives it.
		expect(items.map((i) => i.id)).toEqual([...sitting.items].sort((a, b) => a.order - b.order).map((i) => i.id));
		expect(items.reduce((n, i) => n + i.beatCount, 0)).toBe(beats.length);
		for (const item of items) {
			const own = beats.filter((b) => b.itemId === item.id);
			expect(own).toHaveLength(item.beatCount);
			expect(item.tEnd).toBeGreaterThanOrEqual(item.t);
			for (const beat of own) {
				expect(beat.index).toBeGreaterThanOrEqual(item.beatStart);
				expect(beat.index).toBeLessThan(item.beatEnd);
				expect(beat.t).toBeGreaterThanOrEqual(item.t);
				expect(beat.tEnd).toBeLessThanOrEqual(item.tEnd);
			}
		}
		for (const beat of beats) {
			if (beat.kind !== 'division') continue;
			expect(beat.itemId).toBe(beat.division.item_id);
			expect(beat.placement).toBe(PROVENANCE_DERIVED);
			expect(sitting.items.some((i) => i.id === beat.division.item_id)).toBe(true);
		}

		// The derived end of a timed contribution is the export's t_end_derived, never earlier than its start.
		for (const c of sitting.contributions) {
			if (c.t_end_derived !== null) {
				expect(c.t_start).not.toBeNull();
				expect(c.t_end_derived).toBeGreaterThanOrEqual(c.t_start!);
			}
		}
	});
});
