import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { Eased, FLOOR_LIGHT, mixInto } from './floorLight';

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
