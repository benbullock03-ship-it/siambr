import { describe, expect, it } from 'vitest';
import type { DivisionRow, Sitting } from '$lib/data/types';
import { debateItemOf, readMotion, targetLabel } from './votes';

/** T-29: the divisions index reads each motion text exactly as the stage does. */
const index = (await import('../../../static/data/divisions/index.json')).default as DivisionRow[];
const exported = import.meta.glob<{ default: Sitting }>('../../../static/data/sittings/*-*-*.json', { eager: true });
const sittings = new Map(Object.values(exported).map((m) => [m.default.date, m.default]));

describe('divisions index', () => {
	it('lists every division in the exported sittings, newest first', () => {
		const all = [...sittings.values()].flatMap((s) => s.divisions.map((d) => d.id)).sort();
		expect(index.map((r) => r.id).sort()).toEqual(all);
		const dates = index.map((r) => r.date);
		expect(dates).toEqual([...dates].sort().reverse());
	});

	it.each(index.map((r) => [r.id, r] as const))('%s matches readMotion and the sitting file', (_id, row) => {
		const sitting = sittings.get(row.date)!;
		const division = sitting.divisions.find((d) => d.id === row.id)!;
		const reading = readMotion(row.motion_text);
		expect(row.target).toBe(targetLabel(reading.target));
		expect(row.tabled_by).toBe(reading.tabledBy);
		expect(row.debate_item_id).toBe(debateItemOf(division, sitting.items)?.id ?? null);
		expect([row.motion_text, row.votes_for, row.votes_against, row.votes_abstain, row.result]).toEqual([
			division.motion_text,
			division.votes_for,
			division.votes_against,
			division.votes_abstain,
			division.result
		]);
	});
});
