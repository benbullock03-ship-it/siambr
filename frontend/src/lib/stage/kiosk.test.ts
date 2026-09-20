import { describe, expect, it } from 'vitest';
import { GuidedRig } from '$lib/3d/controls/guided.svelte';
import { SiambrState } from '$lib/3d/state.svelte';
import { SittingClock } from './clock.svelte';
import { item, sitting, speech } from './fixtures';
import { KioskIdleController } from './kiosk.svelte';
import { buildTimeline } from './timeline';

const mockSitting = sitting({
	id: 'plenary-2026-06-10',
	date: '2026-06-10',
	meeting_start_time: '13:30:00',
	items: [item('item-1', 1, 2)],
	contributions: [
		{ ...speech('c-1', 'item-1', 1, 120, 'ms-jane-doe'), t_end_derived: 180 },
		{ ...speech('c-2', 'item-1', 2, 180, 'ms-john-smith'), t_end_derived: 240 }
	]
});

describe('KioskIdleController', () => {
	it('triggers drift after 120 s idle and sets playback to 1x playing', () => {
		const timeline = buildTimeline(mockSitting);
		const clock = new SittingClock(timeline, mockSitting.meeting_start_time);
		const rig = new GuidedRig();
		const hud = new SiambrState();
		hud.kiosk = true;

		// Clock starts paused at 4x
		clock.setSpeed(4);
		clock.pause();

		const controller = new KioskIdleController(clock, rig, hud, {
			idleThresholdSeconds: 120,
			resetThresholdSeconds: 600
		});

		const t0 = performance.now();
		controller.handleUserInput(t0);

		// At 60 s, nothing happens
		controller.tick(t0 + 60_000);
		expect(controller.drifting).toBe(false);
		expect(hud.drifting).toBe(false);
		expect(clock.playing).toBe(false);

		// At 120 s, drift starts, clock sets speed 1x and plays
		controller.tick(t0 + 120_000);
		expect(controller.drifting).toBe(true);
		expect(hud.drifting).toBe(true);
		expect(rig.drifting).toBe(true);
		expect(clock.playing).toBe(true);
		expect(clock.speed).toBe(1);

		// User input cancels drift and returns rig to gallery
		controller.handleUserInput(t0 + 125_000);
		expect(controller.drifting).toBe(false);
		expect(hud.drifting).toBe(false);
		expect(rig.drifting).toBe(false);
		expect(rig.vantage).toBe('gallery');
		expect(controller.idleSeconds).toBe(0);
	});

	it('resets sitting to first timed contribution after 10 minutes idle', () => {
		const timeline = buildTimeline(mockSitting);
		const clock = new SittingClock(timeline, mockSitting.meeting_start_time);
		const rig = new GuidedRig();
		const hud = new SiambrState();
		hud.kiosk = true;

		const controller = new KioskIdleController(clock, rig, hud, {
			idleThresholdSeconds: 120,
			resetThresholdSeconds: 600
		});

		const t0 = performance.now();
		controller.handleUserInput(t0);

		// Seek to 160 s (between 120 and 184)
		clock.seek(160);
		expect(clock.t).toBe(160);

		// At 600 s (10 min), resets to first timed contribution (t = 120)
		controller.tick(t0 + 600_000);
		expect(clock.t).toBe(120);
		expect(clock.playing).toBe(true);
	});
});
