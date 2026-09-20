import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import type { FloorState } from '$lib/stage/floor';
import { syntheticSitting } from '$lib/stage/fixtures';
import { buildTimeline } from '$lib/stage/timeline';
import { floorState } from '$lib/stage/floor';
import { Eased, FLOOR_LIGHT, liveDeskId, mixInto } from './floorLight';

const timeline = buildTimeline(syntheticSitting());
const deskByMember = new Map([
	['ms-a0', 'r1-s1'],
	['ms-a1', 'r1-s2']
]);
const presiding = new Set(['ms-a1']);

describe('liveDeskId', () => {
	it('lights a seated speaker at their own desk', () => {
		expect(liveDeskId(floorState(timeline, 11), deskByMember, presiding)).toBe('r1-s1');
	});

	it('lights the dais for a presiding or unseated speaker', () => {
		expect(liveDeskId(floorState(timeline, 93), deskByMember, presiding)).toBe('llywydd');
		expect(liveDeskId(floorState(timeline, 97), deskByMember, presiding)).toBe('llywydd');
	});

	it('lights nothing outside a contribution beat', () => {
		expect(liveDeskId(floorState(timeline, 5), deskByMember, presiding)).toBeNull();
		expect(liveDeskId(floorState(timeline, 280), deskByMember, presiding)).toBeNull();
		const empty: FloorState = { live: null, spokenMemberIds: new Set(), division: null, divisionTint: null };
		expect(liveDeskId(empty, deskByMember, presiding)).toBeNull();
	});
});

describe('Eased', () => {
	it('reaches its target in the given time and no sooner', () => {
		const e = new Eased();
		e.set(1);
		e.step(0.15, 300);
		expect(e.value).toBeCloseTo(0.5);
		e.step(0.15, 300);
		expect(e.value).toBe(1);
		expect(e.step(0.1, 300)).toBe(false);
	});

	it('cuts under a zero duration', () => {
		const e = new Eased(1);
		e.set(0);
		e.step(0.001, 0);
		expect(e.value).toBe(0);
	});
});

describe('mixInto', () => {
	it('returns the endpoints at 0 and 1', () => {
		const out = new Color();
		expect(mixInto(out, FLOOR_LIGHT.worktop, FLOOR_LIGHT.worktopLit, 0).getHexString()).toBe(FLOOR_LIGHT.worktop.slice(1));
		expect(mixInto(out, FLOOR_LIGHT.worktop, FLOOR_LIGHT.worktopLit, 1).getHexString()).toBe(FLOOR_LIGHT.worktopLit.slice(1));
	});
});
