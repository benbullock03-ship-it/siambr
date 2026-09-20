import { describe, expect, it } from 'vitest';
import { bearingToXZ, buildDesks, CHAMBER, chamberColliders, DEG, SPAWN_BEARING_DEG, spawnPoint, walkRadius } from '../chamber/layout';
import { isClear, pushOut, resolveCollisions } from './collision';

const BODY = 0.28;

describe('pushOut', () => {
	it('leaves a point outside a circle untouched', () => {
		const p = { x: 3, z: 0 };
		expect(pushOut(p, BODY, { kind: 'circle', x: 0, z: 0, radius: 1 })).toEqual(p);
	});

	it('ejects a point radially from a circle', () => {
		const out = pushOut({ x: 0.5, z: 0 }, BODY, { kind: 'circle', x: 0, z: 0, radius: 1 });
		expect(out.x).toBeCloseTo(1 + BODY);
		expect(out.z).toBeCloseTo(0);
	});

	it('ignores an arc when the bearing is outside it', () => {
		const arc = { kind: 'arc' as const, inner: 4, outer: 5, start: 90 * DEG, end: 180 * DEG };
		const [x, z] = bearingToXZ(4.5, 0);
		expect(pushOut({ x, z }, BODY, arc)).toEqual({ x, z });
	});

	it('pushes to the nearer radial face of an arc', () => {
		const arc = { kind: 'arc' as const, inner: 4, outer: 5, start: 90 * DEG, end: 180 * DEG };
		const [ix, iz] = bearingToXZ(4.2, 135 * DEG);
		const inner = pushOut({ x: ix, z: iz }, BODY, arc);
		expect(Math.hypot(inner.x, inner.z)).toBeCloseTo(4 - BODY);
		const [ox, oz] = bearingToXZ(4.9, 135 * DEG);
		const outer = pushOut({ x: ox, z: oz }, BODY, arc);
		expect(Math.hypot(outer.x, outer.z)).toBeCloseTo(5 + BODY);
	});
});

describe('resolveCollisions in the chamber', () => {
	const desks = buildDesks(96);
	const colliders = chamberColliders(desks);
	const limit = walkRadius(BODY);

	it('spawn point and the well are clear', () => {
		const spawn = spawnPoint();
		expect(isClear(spawn, BODY, colliders, limit)).toBe(true);
		expect(isClear({ x: 0, z: 1 }, BODY, colliders, limit)).toBe(true);
	});

	it('every desk position is blocked', () => {
		for (const d of desks) expect(isClear({ x: d.x, z: d.z }, BODY, colliders, limit)).toBe(false);
	});

	it('every aisle is walkable from the wall to the well', () => {
		for (const deg of [...CHAMBER.aisleBearingsDeg, SPAWN_BEARING_DEG]) {
			for (let r = limit; r > CHAMBER.wellRadius; r -= 0.25) {
				const [x, z] = bearingToXZ(r, deg * DEG);
				expect(isClear({ x, z }, BODY, colliders, limit)).toBe(true);
			}
		}
	});

	it('the walkway between tiers is clear', () => {
		const between = (CHAMBER.rowRadii[1] + CHAMBER.deskBlock.outer + CHAMBER.rowRadii[2] + CHAMBER.deskBlock.inner) / 2;
		const [x, z] = bearingToXZ(between, 100 * DEG);
		expect(isClear({ x, z }, BODY, colliders, limit)).toBe(true);
	});

	it('the wall clamps the walker', () => {
		const out = resolveCollisions({ x: 0, z: 40 }, BODY, colliders, limit);
		expect(Math.hypot(out.x, out.z)).toBeCloseTo(limit);
	});

	it('the inner row leaves a walkable gap either side of Y Llywydd', () => {
		for (const deg of [-38, 38]) {
			const [x, z] = bearingToXZ(CHAMBER.rowRadii[0], deg * DEG);
			expect(isClear({ x, z }, BODY, colliders, limit)).toBe(true);
		}
	});

	it('the dais cannot be entered', () => {
		const [x, z] = bearingToXZ(CHAMBER.dais.radius, 0);
		const out = resolveCollisions({ x, z }, BODY, colliders, limit);
		expect(Math.hypot(out.x - x, out.z - z)).toBeGreaterThan(1);
	});
});
