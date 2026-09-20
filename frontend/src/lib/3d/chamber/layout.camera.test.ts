import { describe, expect, it } from 'vitest';
import { buildDesks, CAMERA_LIMITS, CHAMBER, clampInsideEnvelope, deskPoint, isInsideEnvelope, speakerPose, VANTAGES } from './layout';
import { llywyddDesk } from './seating';

describe('vantage points', () => {
	it('all sit inside the chamber envelope', () => {
		for (const [id, pose] of Object.entries(VANTAGES)) {
			expect(isInsideEnvelope(pose.position), id).toBe(true);
		}
	});

	it('the gallery looks down at the dais from the south', () => {
		const { position, target } = VANTAGES.gallery;
		expect(position[2]).toBeGreaterThan(0);
		expect(position[1]).toBeGreaterThan(CHAMBER.galleryFloorY);
		expect(target[2]).toBeLessThan(0);
	});
});

describe('speakerPose', () => {
	it('frames every desk from behind and above, inside the envelope, with the desk in view', () => {
		for (const d of [...buildDesks(96), llywyddDesk()]) {
			const { position, target } = speakerPose(d);
			expect(isInsideEnvelope(position), d.id).toBe(true);
			expect(position[1]).toBeGreaterThanOrEqual(d.y + 1.5 - 1e-9);
			// Camera is further from the centre than the desk (over the shoulder), except at the dais.
			if (d.row >= 0) expect(Math.hypot(position[0], position[2])).toBeGreaterThan(Math.hypot(d.x, d.z));
			const look = [target[0] - position[0], target[1] - position[1], target[2] - position[2]];
			const toDesk = [d.x - position[0], d.y + 0.8 - position[1], d.z - position[2]];
			const dot = look[0] * toDesk[0] + look[1] * toDesk[1] + look[2] * toDesk[2];
			const angle = Math.acos(dot / (Math.hypot(...look) * Math.hypot(...toDesk)));
			expect(angle, d.id).toBeLessThan(0.55);
		}
	});
});

describe('clampInsideEnvelope', () => {
	it('keeps the camera under the wall when low and over the gallery when high', () => {
		expect(clampInsideEnvelope([30, 2, 0])[0]).toBeCloseTo(CHAMBER.wallRadius - CAMERA_LIMITS.clearance, 5);
		expect(clampInsideEnvelope([30, 6, 0])[0]).toBeCloseTo(CHAMBER.galleryOuterRadius - 0.6, 5);
	});

	it('lifts the camera off the floor and out of the bell', () => {
		expect(clampInsideEnvelope([0, -3, 5])[1]).toBe(CAMERA_LIMITS.minY);
		const high = clampInsideEnvelope([0, 7.5, 0.1]);
		expect(Math.hypot(high[0], high[2])).toBeGreaterThan(CHAMBER.funnelThroatRadius);
		expect(clampInsideEnvelope([0, 40, 5])[1]).toBe(CAMERA_LIMITS.maxY);
	});

	it('leaves an inside point alone', () => {
		expect(clampInsideEnvelope([3, 2, -4])).toEqual([3, 2, -4]);
	});
});

describe('deskPoint', () => {
	it('moves along the desk frame', () => {
		const d = buildDesks(60)[0];
		const [x, , z] = deskPoint(d, 0, 1, 0);
		expect(Math.hypot(x, z)).toBeGreaterThan(Math.hypot(d.x, d.z));
	});
});
