/**
 * T-21: every figure on the stats pages reconciles to the sitting file the site already ships.
 * The exported stats are recomputed here from `sittings/{date}.json` and compared field by field.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SiteIndex, Sitting, SittingStats } from '$lib/data/types';
import { itemsOf, membersOf, partiesOf, secondsByContribution, totalsOf } from './reconcile';

const DATA = resolve(process.cwd(), 'static', 'data');
const read = <T>(rel: string): T => JSON.parse(readFileSync(resolve(DATA, rel), 'utf-8')) as T;

const date = read<SiteIndex>('index.json').latest_sitting as string;
const sitting = read<Sitting>(`sittings/${date}.json`);
const stats = read<SittingStats>(`stats/sittings/${date}.json`);

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 3);

describe(`stats for ${date}`, () => {
	it('is badged derived and states its method', () => {
		expect(stats.provenance).toBe('PROVENANCE_DERIVED');
		expect(stats.method).toContain('Untimed contributions carry no time.');
		expect(stats.date).toBe(sitting.date);
	});

	it('totals reconcile to the sitting file', () => {
		const t = totalsOf(sitting);
		expect(stats.totals.contributions).toBe(sitting.contributions.length);
		expect(stats.totals.timed_contributions).toBe(t.timed_contributions);
		expect(stats.totals.untimed_contributions).toBe(t.untimed_contributions);
		expect(stats.totals.divisions).toBe(sitting.divisions.length);
		expect(stats.totals.welsh_contributions).toBe(sitting.contributions.filter((c) => c.lang === 'cy').length);
		near(stats.totals.welsh_share, t.welsh_share);
		near(stats.totals.speaking_seconds, t.speaking_seconds);
	});

	it('speaking time is the gap to the next timed start, so it never exceeds the sitting', () => {
		const seconds = secondsByContribution(sitting.contributions);
		const starts = sitting.contributions.map((c) => c.t_start).filter((t): t is number => t !== null && t >= 0);
		near(
			[...seconds.values()].reduce((s, x) => s + x, 0),
			Math.max(...starts) - Math.min(...starts)
		);
		for (const c of sitting.contributions) {
			if (c.t_start === null || c.t_start < 0) expect(seconds.has(c.id)).toBe(false);
		}
	});

	it('by_member reconciles, in the exported order', () => {
		const mine = membersOf(sitting);
		expect(stats.by_member.map((r) => r.member_id)).toEqual(mine.map((r) => r.member_id));
		for (const [i, r] of stats.by_member.entries()) {
			expect(r.canonical_name).toBe(sitting.speakers[r.member_id].canonical_name);
			expect(r.party_id).toBe(sitting.speakers[r.member_id].party_id);
			expect(r.contributions).toBe(sitting.contributions.filter((c) => c.member_id === r.member_id).length);
			expect(r.untimed_contributions).toBe(mine[i].untimed_contributions);
			near(r.seconds, mine[i].seconds);
		}
		// Unattributed speech is reported separately, never as a Member.
		const attributed = sitting.contributions.filter((c) => c.member_id !== null).length;
		expect(stats.by_member.reduce((n, r) => n + r.contributions, 0)).toBe(attributed);
		expect(stats.unattributed.contributions).toBe(sitting.contributions.length - attributed);
		// Member shares cover attributed speech only; the unattributed seconds sit outside them.
		near(
			stats.by_member.reduce((n, r) => n + r.seconds, 0),
			stats.totals.speaking_seconds - stats.totals.unattributed_seconds
		);
	});

	it('by_party reconciles and sums to the same total', () => {
		const mine = partiesOf(sitting);
		expect(stats.by_party.map((r) => r.party_id)).toEqual(mine.map((r) => r.party_id));
		for (const [i, r] of stats.by_party.entries()) {
			expect(r.contributions).toBe(mine[i].contributions);
			expect(r.members).toBe(mine[i].members);
			expect(r.untimed_contributions).toBe(mine[i].untimed_contributions);
			near(r.seconds, mine[i].seconds);
		}
		expect(stats.by_party.reduce((n, r) => n + r.contributions, 0)).toBe(
			sitting.contributions.filter((c) => c.member_id !== null).length
		);
		near(
			stats.by_party.reduce((n, r) => n + r.seconds, 0),
			stats.totals.speaking_seconds - stats.totals.unattributed_seconds
		);
	});

	it('by_item reconciles and covers every item of the sitting', () => {
		const mine = itemsOf(sitting);
		expect(stats.by_item.map((r) => r.item_id)).toEqual(mine.map((r) => r.item_id));
		expect(stats.by_item.map((r) => r.item_id)).toEqual(sitting.items.map((i) => i.id));
		for (const [i, r] of stats.by_item.entries()) {
			expect(r.contributions).toBe(sitting.contributions.filter((c) => c.item_id === r.item_id).length);
			expect(r.untimed_contributions).toBe(mine[i].untimed_contributions);
			near(r.seconds, mine[i].seconds);
		}
		near(
			stats.by_item.reduce((n, r) => n + r.seconds, 0),
			stats.totals.speaking_seconds
		);
	});
});
