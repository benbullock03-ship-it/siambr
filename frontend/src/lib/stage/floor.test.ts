import { describe, expect, it } from 'vitest';
import type { Sitting } from '$lib/data/types';
import real from '../../../static/data/sittings/2026-05-12.json';
import { floorState, liveBeat, spokenMemberIds } from './floor';
import { syntheticSitting } from './fixtures';
import { buildTimeline } from './timeline';

const realTimeline = buildTimeline(real as unknown as Sitting);
const synthetic = buildTimeline(syntheticSitting());

const liveId = (t: number) => {
	const beat = liveBeat(synthetic, t);
	return beat === null ? null : beat.kind === 'contribution' ? beat.contribution.id : beat.division.id;
};

describe('liveBeat', () => {
	it('is the timed contribution with the greatest start <= t on the real sitting', () => {
		expect(liveBeat(realTimeline, 0)).toBeNull();
		const at3 = liveBeat(realTimeline, 3);
		expect(at3?.kind === 'contribution' && at3.contribution.seq).toBe(0);
		const at2700 = liveBeat(realTimeline, 2700);
		expect(at2700?.kind === 'contribution' && at2700.contribution.t_start).toBe(2685);
		expect(liveBeat(realTimeline, 2826.9)?.itemId).toBe('item-16033-260512-1');
		expect(liveBeat(realTimeline, 2827)?.itemId).toBe('item-16033-260512-2');
		expect(liveBeat(realTimeline, 2919)).toBeNull();
	});

	it('lands ?t= seeks on untimed and division beats too', () => {
		expect(liveId(9.99)).toBeNull();
		expect(liveId(10)).toBe('a0');
		expect(liveId(93)).toBe('a1');
		expect(liveId(99.999)).toBe('a2');
		expect(liveId(100)).toBe('a3');
		expect(liveId(101.5)).toBe('a4');
		expect(liveId(280)).toBe('dA');
		expect(liveId(297)).toBe('c0');
		expect(liveId(307.9)).toBe('c2');
		expect(liveId(308)).toBeNull();
	});
});

describe('spokenMemberIds', () => {
	it('marks Members whose beat started strictly before t', () => {
		expect([...spokenMemberIds(synthetic, 10)]).toEqual([]);
		expect([...spokenMemberIds(synthetic, 10.1)]).toEqual(['ms-a0']);
		expect([...spokenMemberIds(synthetic, 100)]).toEqual(['ms-a0', 'ms-a1', 'ms-a2']);
		expect([...spokenMemberIds(synthetic, 100.5)]).toEqual(['ms-a0', 'ms-a1', 'ms-a2', 'ms-a3']);
	});

	it('reuses the same Set while nothing new has started', () => {
		expect(spokenMemberIds(synthetic, 95)).toBe(spokenMemberIds(synthetic, 95.5));
		expect(spokenMemberIds(synthetic, 95)).not.toBe(spokenMemberIds(synthetic, 101));
	});

	it('counts a Member once across repeat contributions', () => {
		expect([...spokenMemberIds(synthetic, 400)]).toEqual(['ms-a0', 'ms-a1', 'ms-a2', 'ms-a3', 'ms-a4', 'ms-a5', 'ms-c0', 'ms-c1', 'ms-c2']);
		expect(spokenMemberIds(realTimeline, 3000).size).toBe(7);
	});
});

describe('floorState', () => {
	it('exposes the division only inside its beat', () => {
		expect(floorState(synthetic, 250).division).toBeNull();
		const inside = floorState(synthetic, 290);
		expect(inside.division?.division.id).toBe('dA');
		expect(inside.live).toBe(inside.division);
		expect(floorState(synthetic, 296).division).toBeNull();
	});
});
