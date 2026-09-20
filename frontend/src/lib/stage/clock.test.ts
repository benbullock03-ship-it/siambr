import { describe, expect, it } from 'vitest';
import type { Sitting } from '$lib/data/types';
import real from '../../../static/data/sittings/2026-05-12.json';
import { SittingClock, wallClockAt } from './clock.svelte';
import { syntheticSitting } from './fixtures';
import { applyAction, keyboardAction } from './keys';
import { buildTimeline } from './timeline';

const realSitting = real as unknown as Sitting;
const realTimeline = buildTimeline(realSitting);
const synthetic = buildTimeline(syntheticSitting());

describe('SittingClock', () => {
	it('starts paused at the first timed contribution', () => {
		const clock = new SittingClock(realTimeline, realSitting.meeting_start_time);
		expect(clock.t).toBe(3);
		expect(clock.playing).toBe(false);
		expect(clock.speed).toBe(1);
		expect(clock.floor.live?.kind === 'contribution' && clock.floor.live.contribution.seq).toBe(0);
	});

	it('advances by dt * speed only while playing', () => {
		const clock = new SittingClock(realTimeline, null, 100);
		clock.tick(1);
		expect(clock.t).toBe(100);
		clock.play();
		clock.tick(0.5);
		expect(clock.t).toBe(100.5);
		clock.setSpeed(16);
		clock.tick(0.25);
		expect(clock.t).toBe(104.5);
		clock.tick(-1);
		expect(clock.t).toBe(104.5);
	});

	it('clamps at the end of the sitting and pauses', () => {
		const clock = new SittingClock(synthetic, null, 300);
		clock.play();
		clock.tick(100);
		expect(clock.t).toBe(synthetic.tEnd);
		expect(clock.playing).toBe(false);
		expect(clock.atEnd).toBe(true);
		clock.play();
		expect(clock.playing).toBe(false);
	});

	it('seeks within [0, tEnd]', () => {
		const clock = new SittingClock(synthetic);
		clock.seek(-4);
		expect(clock.t).toBe(0);
		clock.seek(1e9);
		expect(clock.t).toBe(308);
		clock.seek(Number.NaN);
		expect(clock.t).toBe(0);
		clock.seek(280);
		expect(clock.floor.division?.division.id).toBe('dA');
	});

	it('steps contributions by distinct beat start, through untimed beats', () => {
		const clock = new SittingClock(synthetic, null, 93);
		clock.stepContribution(1);
		expect(clock.t).toBe(96);
		clock.stepContribution(-1);
		expect(clock.t).toBe(92);
		clock.stepContribution(-1);
		expect(clock.t).toBe(10);
		clock.stepContribution(-1);
		expect(clock.t).toBe(10);
		clock.seek(308);
		clock.stepContribution(1);
		expect(clock.t).toBe(308);
		clock.stepContribution(-1);
		expect(clock.t).toBe(304);
	});

	it('steps items across boundaries, skipping the empty item', () => {
		const clock = new SittingClock(synthetic, null, 250);
		clock.stepItem(1);
		expect(clock.t).toBe(296);
		expect(clock.floor.live?.itemId).toBe('C');
		clock.stepItem(1);
		expect(clock.t).toBe(296);
		clock.stepItem(-1);
		expect(clock.t).toBe(10);
		clock.stepItem(-1);
		expect(clock.t).toBe(10);
	});

	it('steps items on the real sitting', () => {
		const clock = new SittingClock(realTimeline, null, 500);
		clock.stepItem(1);
		expect(clock.t).toBe(2827);
		clock.stepItem(-1);
		expect(clock.t).toBe(3);
	});

	it('cycles speed 1x, 4x, 16x and clamps', () => {
		const clock = new SittingClock(synthetic);
		clock.faster();
		clock.faster();
		expect(clock.speed).toBe(16);
		clock.faster();
		expect(clock.speed).toBe(16);
		clock.slower();
		expect(clock.speed).toBe(4);
		clock.slower();
		clock.slower();
		expect(clock.speed).toBe(1);
	});

	it('derives the wall clock from meeting_start_time + t', () => {
		const clock = new SittingClock(realTimeline, realSitting.meeting_start_time, 2685);
		expect(clock.wallClock).toBe('14:44:46');
		expect(new SittingClock(realTimeline, null).wallClock).toBeNull();
	});
});

describe('wallClockAt', () => {
	it('formats and wraps past midnight', () => {
		expect(wallClockAt('13:30:01', 0)).toBe('13:30:01');
		expect(wallClockAt('13:30:01', 59.9)).toBe('13:31:00');
		expect(wallClockAt('23:59:59', 2)).toBe('00:00:01');
		expect(wallClockAt('bad', 2)).toBeNull();
	});
});

describe('keyboard map', () => {
	it('maps the documented keys and nothing else', () => {
		expect(keyboardAction({ key: ' ', shiftKey: false })).toBe('toggle');
		expect(keyboardAction({ key: 'ArrowRight', shiftKey: false })).toBe('nextContribution');
		expect(keyboardAction({ key: 'ArrowLeft', shiftKey: true })).toBe('previousItem');
		expect(keyboardAction({ key: '[', shiftKey: false })).toBe('slower');
		expect(keyboardAction({ key: ']', shiftKey: false })).toBe('faster');
		expect(keyboardAction({ key: 'a', shiftKey: false })).toBeNull();
		expect(keyboardAction({ key: ' ', shiftKey: true })).toBeNull();
	});

	it('applies actions to the clock', () => {
		const clock = new SittingClock(synthetic, null, 93);
		applyAction(clock, 'toggle');
		expect(clock.playing).toBe(true);
		applyAction(clock, 'nextItem');
		expect(clock.t).toBe(296);
		applyAction(clock, 'previousContribution');
		expect(clock.t).toBe(276);
		applyAction(clock, 'faster');
		expect(clock.speed).toBe(4);
	});
});
