import { Box3 } from 'three';
import { describe, expect, it } from 'vitest';
import { deskProfile, deskRunGeometry } from './deskGeometry';
import { bearingToXZ, buildDesks, CHAMBER, DEG, deskRuns } from './layout';

describe('deskRuns', () => {
	it('groups each tier into one run per aisle gap', () => {
		const runs = deskRuns(buildDesks(96));
		const rows = new Set(runs.map((r) => r.row));
		expect(rows.size).toBe(4);
		for (const row of rows) {
			expect(runs.filter((r) => r.row === row).length).toBeLessThanOrEqual(CHAMBER.aisleBearingsDeg.length + 1);
		}
		expect(runs.reduce((n, r) => n + r.desks.length, 0)).toBe(96);
	});

	it('spans exactly its desks plus half a pitch each side', () => {
		for (const run of deskRuns(buildDesks(60))) {
			const half = CHAMBER.deskPitch / run.radius / 2;
			expect(run.start).toBeCloseTo(run.desks[0].bearing - half);
			expect(run.end).toBeCloseTo(run.desks[run.desks.length - 1].bearing + half);
		}
	});
});

describe('deskRunGeometry', () => {
	it('is a closed profile at desk height around the tier radius', () => {
		const p = deskProfile(6.6);
		expect(p[0].equals(p[p.length - 1])).toBe(true);
		expect(Math.max(...p.map((v) => v.y))).toBeCloseTo(CHAMBER.desk.height);
		expect(Math.min(...p.map((v) => v.x))).toBeGreaterThan(6.6 - CHAMBER.desk.depth);
		expect(Math.max(...p.map((v) => v.x))).toBeLessThan(6.6 + CHAMBER.desk.depth);
	});

	it('sweeps a run through its desk positions', () => {
		const radius = 8.4;
		const start = 100 * DEG;
		const end = 140 * DEG;
		const g = deskRunGeometry(radius, start, end);
		const box = new Box3().setFromBufferAttribute(g.getAttribute('position') as never);
		for (const deg of [100, 120, 140]) {
			const [x, z] = bearingToXZ(radius, deg * DEG);
			expect(x).toBeGreaterThanOrEqual(box.min.x - 0.5);
			expect(x).toBeLessThanOrEqual(box.max.x + 0.5);
			expect(z).toBeGreaterThanOrEqual(box.min.z - 0.5);
			expect(z).toBeLessThanOrEqual(box.max.z + 0.5);
		}
		expect(box.max.y).toBeCloseTo(CHAMBER.desk.height);
		expect(box.min.y).toBeCloseTo(0);
		// Nothing of the run lies outside its bearing span.
		const [ox, oz] = bearingToXZ(radius, 160 * DEG);
		expect(ox < box.min.x - 0.1 || ox > box.max.x + 0.1 || oz < box.min.z - 0.1 || oz > box.max.z + 0.1).toBe(true);
		expect(g.getAttribute('normal')).toBeDefined();
		g.dispose();
	});
});
