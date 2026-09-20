import { describe, expect, it } from 'vitest';
import {
	apportion,
	bearingOf,
	bearingToXZ,
	buildDesks,
	CHAMBER,
	CHAMBER_DOORS,
	chamberColliders,
	chamberWallSegments,
	DEG,
	floorHeightAt,
	isInOpening,
	rowArc,
	tierCapacity,
	tiersFor,
	wallSegments
} from './layout';

describe('bearings', () => {
	it('north is -Z and east is +X', () => {
		const [nx, nz] = bearingToXZ(1, 0);
		expect(nx).toBeCloseTo(0);
		expect(nz).toBeCloseTo(-1);
		const [ex, ez] = bearingToXZ(1, 90 * DEG);
		expect(ex).toBeCloseTo(1);
		expect(ez).toBeCloseTo(0);
	});

	it('bearingOf inverts bearingToXZ across the full circle', () => {
		for (const deg of [0, 45, 90, 179, 180, 181, 270, 359]) {
			const [x, z] = bearingToXZ(3, deg * DEG);
			expect(bearingOf(x, z) / DEG).toBeCloseTo(deg, 6);
		}
	});
});

describe('floor', () => {
	it('is flat across the well and ramps gently to the wall', () => {
		expect(floorHeightAt(0)).toBe(0);
		expect(floorHeightAt(CHAMBER.wellRadius)).toBe(0);
		expect(floorHeightAt(CHAMBER.wallRadius)).toBeCloseTo(
			(CHAMBER.wallRadius - CHAMBER.wellRadius) * CHAMBER.rampGradient
		);
		expect(floorHeightAt(50)).toBe(floorHeightAt(CHAMBER.wallRadius));
	});
});

describe('apportion', () => {
	it('distributes proportionally and exactly', () => {
		expect(apportion(10, [10, 10])).toEqual([5, 5]);
		expect(apportion(7, [3, 6])).toEqual([3, 4]);
		expect(apportion(0, [3, 6])).toEqual([0, 0]);
	});

	it('never exceeds a bucket capacity', () => {
		expect(apportion(5, [1, 10])).toEqual([1, 4]);
		expect(() => apportion(12, [1, 10])).toThrow();
	});
});

describe('desk tiers', () => {
	it('uses three rows for the 60-seat chamber and all four for 96', () => {
		expect(tiersFor(60)).toHaveLength(3);
		expect(tiersFor(96)).toHaveLength(4);
		expect(() => tiersFor(500)).toThrow();
	});

	it('outer tiers hold more desks', () => {
		const caps = CHAMBER.rowRadii.map((r, row) => tierCapacity(r, row));
		for (let i = 1; i < caps.length; i++) expect(caps[i]).toBeGreaterThan(caps[i - 1]);
	});
});

describe.each([60, 96])('buildDesks(%i)', (seats) => {
	const desks = buildDesks(seats);

	it('lays out exactly one desk per seat with unique ids', () => {
		expect(desks).toHaveLength(seats);
		expect(new Set(desks.map((d) => d.id)).size).toBe(seats);
	});

	it('keeps every desk on its tier radius, inside the arc, off the aisles', () => {
		for (const d of desks) {
			expect(Math.hypot(d.x, d.z)).toBeCloseTo(CHAMBER.rowRadii[d.row], 6);
			expect(d.bearing).toBeGreaterThanOrEqual(rowArc(d.row).start);
			expect(d.bearing).toBeLessThanOrEqual(rowArc(d.row).end);
			for (const aisle of CHAMBER.aisleBearingsDeg) {
				const gap = Math.abs(d.bearing - aisle * DEG) * CHAMBER.rowRadii[d.row];
				expect(gap).toBeGreaterThanOrEqual(CHAMBER.aisleWidth / 2 + CHAMBER.desk.width / 2 - 1e-6);
			}
			expect(d.y).toBeCloseTo(floorHeightAt(CHAMBER.rowRadii[d.row]));
		}
	});

	it('never places two desks closer than the pitch', () => {
		for (let i = 0; i < desks.length; i++) {
			for (let j = i + 1; j < desks.length; j++) {
				const a = desks[i];
				const b = desks[j];
				if (a.row !== b.row) continue;
				expect(Math.abs(a.bearing - b.bearing) * CHAMBER.rowRadii[a.row]).toBeGreaterThanOrEqual(CHAMBER.deskPitch - 1e-6);
			}
		}
	});

	it('turns each desk to face the centre', () => {
		for (const d of desks) {
			const fx = -Math.sin(d.yaw);
			const fz = -Math.cos(d.yaw);
			const toCentre = Math.hypot(d.x, d.z);
			expect(fx).toBeCloseTo(-d.x / toCentre, 6);
			expect(fz).toBeCloseTo(-d.z / toCentre, 6);
		}
	});

	it('leaves the inner row open around Y Llywydd', () => {
		const inner = desks.filter((d) => d.row === 0);
		expect(inner.length).toBeGreaterThan(0);
		for (const d of inner) {
			expect(d.bearing).toBeGreaterThanOrEqual(CHAMBER.innerArcStartDeg * DEG);
			expect(d.bearing).toBeLessThanOrEqual(CHAMBER.innerArcEndDeg * DEG);
		}
	});

	it('produces one merged collider per tier segment plus the dais and clerks', () => {
		const colliders = chamberColliders(desks);
		const arcs = colliders.filter((c) => c.kind === 'arc');
		const circles = colliders.filter((c) => c.kind === 'circle');
		expect(circles).toHaveLength(2);
		expect(arcs.length).toBeLessThanOrEqual(tiersFor(seats).length * (CHAMBER.aisleBearingsDeg.length + 1));
		for (const arc of arcs) {
			if (arc.kind !== 'arc') continue;
			expect(arc.end).toBeGreaterThan(arc.start);
			expect(arc.outer).toBeGreaterThan(arc.inner);
		}
	});
});

describe('wall openings', () => {
	it('splits the chamber wall into one arc per stretch between doorways', () => {
		const segs = chamberWallSegments();
		// Three doorways; the 270° door's stretch to the 45° door crosses north, so it splits in two.
		expect(segs).toHaveLength(4);
		for (const s of segs) {
			expect(s.start).toBeGreaterThanOrEqual(0);
			expect(s.end).toBeLessThanOrEqual(Math.PI * 2 + 1e-9);
			expect(s.end).toBeGreaterThan(s.start);
		}
	});

	it('leaves a full circle when there are no openings', () => {
		expect(wallSegments(10, [])).toEqual([{ start: 0, end: Math.PI * 2 }]);
	});

	it('tells whether a bearing falls inside a doorway, with a margin', () => {
		expect(isInOpening(270, CHAMBER_DOORS, CHAMBER.wallRadius)).toBe(true);
		expect(isInOpening(277, CHAMBER_DOORS, CHAMBER.wallRadius)).toBe(false);
		expect(isInOpening(277, CHAMBER_DOORS, CHAMBER.wallRadius, 0.5)).toBe(true);
		expect(isInOpening(0, CHAMBER_DOORS, CHAMBER.wallRadius)).toBe(false);
	});
});
