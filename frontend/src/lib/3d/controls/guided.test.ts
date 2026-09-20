import { describe, expect, it } from 'vitest';
import { buildDesks, isInsideEnvelope, speakerPose, VANTAGES } from '../chamber/layout';
import { DRIFT_LOOP_MS, driftPoseAt, GuidedRig, MOVE_MS, ORBIT, poseFromSpherical, sphericalOf } from './guided.svelte';

const desks = buildDesks(96);

describe('GuidedRig', () => {
	it('starts at the gallery and cuts straight to a vantage with zero duration', () => {
		const rig = new GuidedRig();
		expect(rig.position).toEqual(VANTAGES.gallery.position);
		rig.setVantage('floor', 0);
		expect(rig.position).toEqual(VANTAGES.floor.position);
		expect(rig.vantage).toBe('floor');
	});

	it('eases to a desk over 600 ms with a cubic ease-out and ends on the speaker pose', () => {
		const rig = new GuidedRig();
		const desk = desks[40];
		rig.frameDesk(desk, MOVE_MS, 1000);
		expect(rig.framedDeskId).toBe(desk.id);
		expect(rig.moving).toBe(true);
		expect(rig.update(1300)).toBe(true);
		const mid = rig.position;
		const want = speakerPose(desk);
		// Ease-out: past halfway at half time.
		const travelled = Math.hypot(mid[0] - VANTAGES.gallery.position[0], mid[2] - VANTAGES.gallery.position[2]);
		const total = Math.hypot(want.position[0] - VANTAGES.gallery.position[0], want.position[2] - VANTAGES.gallery.position[2]);
		expect(travelled / total).toBeGreaterThan(0.6);
		expect(rig.update(1600)).toBe(false);
		expect(rig.position.map((v) => +v.toFixed(6))).toEqual(want.position.map((v) => +v.toFixed(6)));
		expect(rig.target).toEqual(want.target);
	});

	it('cuts under reduced motion', () => {
		const rig = new GuidedRig();
		rig.reducedMotion = true;
		rig.frameDesk(desks[3]);
		expect(rig.moving).toBe(false);
		expect(rig.position).toEqual(speakerPose(desks[3]).position);
	});

	it('frameDesk yields a camera looking at the desk', () => {
		const rig = new GuidedRig();
		const desk = desks[70];
		rig.frameDesk(desk, 0);
		const look = [rig.target[0] - rig.position[0], rig.target[1] - rig.position[1], rig.target[2] - rig.position[2]];
		const toDesk = [desk.x - rig.position[0], desk.y + 0.8 - rig.position[1], desk.z - rig.position[2]];
		const cos = (look[0] * toDesk[0] + look[1] * toDesk[1] + look[2] * toDesk[2]) / (Math.hypot(...look) * Math.hypot(...toDesk));
		expect(Math.acos(cos)).toBeLessThan(0.55);
	});

	it('orbit and zoom clamp to their limits and never leave the envelope', () => {
		const rig = new GuidedRig();
		rig.setVantage('floor', 0);
		for (let i = 0; i < 50; i++) rig.orbit(0, 400);
		expect(sphericalOf(rig.pose).pitch).toBeLessThanOrEqual(ORBIT.maxPitch + 1e-9);
		expect(isInsideEnvelope(rig.position)).toBe(true);
		for (let i = 0; i < 50; i++) rig.orbit(0, -400);
		expect(sphericalOf(rig.pose).pitch).toBeGreaterThanOrEqual(ORBIT.minPitch - 0.3);
		expect(isInsideEnvelope(rig.position)).toBe(true);
		for (let i = 0; i < 40; i++) rig.zoom(1.5);
		expect(sphericalOf(rig.pose).distance).toBeLessThanOrEqual(ORBIT.maxDistance + 1e-9);
		expect(isInsideEnvelope(rig.position)).toBe(true);
		for (let i = 0; i < 40; i++) rig.zoom(0.5);
		expect(sphericalOf(rig.pose).distance).toBeGreaterThanOrEqual(ORBIT.minDistance - 1e-9);
		for (let i = 0; i < 200; i++) rig.orbit(37, 0);
		expect(isInsideEnvelope(rig.position)).toBe(true);
	});

	it('orbit cancels a move in flight', () => {
		const rig = new GuidedRig();
		rig.setVantage('llywydd', MOVE_MS, 0);
		rig.update(100);
		rig.orbit(10, 0);
		expect(rig.moving).toBe(false);
	});

	it('speaker with no desk falls back to the gallery', () => {
		const rig = new GuidedRig();
		rig.setVantage('floor', 0);
		rig.speaker(null, 0);
		expect(rig.vantage).toBe('gallery');
		rig.speaker(desks[1], 0);
		expect(rig.vantage).toBe('speaker');
		expect(rig.framedDeskId).toBe(desks[1].id);
	});

	it('drift loop is 40 s, continuous, closed, and always stays inside the envelope', () => {
		expect(DRIFT_LOOP_MS).toBe(40_000);
		const start = driftPoseAt(0);
		expect(start.position.map((v) => +v.toFixed(3))).toEqual(VANTAGES.gallery.position.map((v) => +v.toFixed(3)));
		const end = driftPoseAt(1);
		expect(end.position.map((v) => +v.toFixed(3))).toEqual(start.position.map((v) => +v.toFixed(3)));

		let lastPos = start.position;
		for (let i = 1; i <= 200; i++) {
			const u = i / 200;
			const pose = driftPoseAt(u);
			expect(isInsideEnvelope(pose.position)).toBe(true);
			const stepDist = Math.hypot(pose.position[0] - lastPos[0], pose.position[1] - lastPos[1], pose.position[2] - lastPos[2]);
			// Step must be smooth and bounded, no sudden teleportation
			expect(stepDist).toBeLessThan(1.0);
			lastPos = pose.position;
		}
	});

	it('GuidedRig starts and stops drift, and holds gallery under reduced motion', () => {
		const rig = new GuidedRig();
		rig.startDrift(0);
		expect(rig.drifting).toBe(true);
		expect(rig.moving).toBe(true);

		rig.update(10_000); // 10s into 40s loop
		const midPos = [...rig.position];
		expect(midPos).not.toEqual(VANTAGES.gallery.position);
		expect(isInsideEnvelope(rig.position)).toBe(true);

		rig.stopDrift(10_000);
		expect(rig.drifting).toBe(false);
		expect(rig.vantage).toBe('gallery');

		// Reduced motion holds gallery
		const rmRig = new GuidedRig();
		rmRig.reducedMotion = true;
		rmRig.startDrift(0);
		expect(rmRig.drifting).toBe(false);
		expect(rmRig.position).toEqual(VANTAGES.gallery.position);
		rmRig.update(10_000);
		expect(rmRig.position).toEqual(VANTAGES.gallery.position);
	});
});

describe('spherical helpers', () => {
	it('round-trip', () => {
		const pose = { position: [3, 4, -5] as [number, number, number], target: [0, 1, 0] as [number, number, number] };
		const s = sphericalOf(pose);
		const back = poseFromSpherical(pose.target, s.yaw, s.pitch, s.distance);
		back.position.forEach((v, i) => expect(v).toBeCloseTo(pose.position[i], 9));
	});
});
