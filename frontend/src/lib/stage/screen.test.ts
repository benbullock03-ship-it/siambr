import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DRIFT_SECONDS, jumpedSince, screenPlan, variant360, type ScreenState } from './screen';
import { ScreenSound } from './screenVideo.svelte';

const playing: ScreenState = {
	t: 100,
	playing: true,
	speed: 1,
	division: false,
	jumped: false,
	blank: false,
	video: { time: 100, seeking: false, readyState: 4 }
};
const at = (patch: Partial<ScreenState>, video: Partial<ScreenState['video']> = {}): ScreenState => ({
	...playing,
	...patch,
	video: { ...playing.video, ...video }
});

describe('screenPlan at 1x', () => {
	it('plays and shows the video when it follows t', () => {
		expect(screenPlan(playing)).toEqual({ show: 'video', play: true, seekTo: null, audible: true });
	});

	it('leaves drift up to 0.5 s alone and re-snaps beyond it', () => {
		expect(screenPlan(at({}, { time: 100 - DRIFT_SECONDS })).seekTo).toBeNull();
		expect(screenPlan(at({}, { time: 100 + DRIFT_SECONDS })).seekTo).toBeNull();
		expect(screenPlan(at({}, { time: 99.4 })).seekTo).toBe(100);
		expect(screenPlan(at({}, { time: 100.6 })).seekTo).toBe(100);
	});

	it('keeps the last frame and does not re-snap while buffering', () => {
		const plan = screenPlan(at({}, { time: 90, readyState: 2 }));
		expect(plan).toEqual({ show: 'video', play: true, seekTo: null, audible: false });
		expect(screenPlan(at({}, { time: 90, seeking: true })).seekTo).toBeNull();
	});

	it('pauses on its frame when the clock pauses', () => {
		expect(screenPlan(at({ playing: false }))).toEqual({ show: 'video', play: false, seekTo: null, audible: false });
	});
});

describe('screenPlan at 4x and 16x', () => {
	it.each([4, 16] as const)('%ix pauses the video and darkens the screens', (speed) => {
		expect(screenPlan(at({ speed }, { time: 40 }))).toEqual({ show: 'dark', play: false, seekTo: null, audible: false });
	});
});

describe('jumps', () => {
	it('a seek, a return to 1x and the first frame are jumps; a speed-up is not', () => {
		expect(jumpedSince(null, { seeks: 0, speed: 1 })).toBe(true);
		expect(jumpedSince({ seeks: 0, speed: 1 }, { seeks: 1, speed: 1 })).toBe(true);
		expect(jumpedSince({ seeks: 0, speed: 16 }, { seeks: 0, speed: 1 })).toBe(true);
		expect(jumpedSince({ seeks: 0, speed: 1 }, { seeks: 0, speed: 4 })).toBe(false);
		expect(jumpedSince({ seeks: 2, speed: 1 }, { seeks: 2, speed: 1 })).toBe(false);
	});

	it('a jump sets currentTime to t and stays dark until the seek lands', () => {
		expect(screenPlan(at({ jumped: true }, { time: 5 }))).toEqual({ show: 'dark', play: true, seekTo: 100, audible: false });
		expect(screenPlan(at({ blank: true }, { seeking: true })).show).toBe('dark');
		expect(screenPlan(at({ jumped: true, speed: 16 }, { time: 5 })).seekTo).toBe(100);
	});

	it('returning to 1x re-snaps to t', () => {
		const mark = { seeks: 3, speed: 16 as const };
		const jumped = jumpedSince(mark, { seeks: 3, speed: 1 });
		expect(screenPlan(at({ jumped }, { time: 40 })).seekTo).toBe(100);
	});

	it('shows nothing before the first frame', () => {
		expect(screenPlan(at({}, { readyState: 1 })).show).toBe('dark');
	});
});

describe('division', () => {
	it('the tally wins while the video keeps following t underneath', () => {
		expect(screenPlan(at({ division: true }))).toEqual({ show: 'tally', play: true, seekTo: null, audible: true });
		expect(screenPlan(at({ division: true }, { time: 90 })).seekTo).toBe(100);
		expect(screenPlan(at({ division: true, speed: 16 })).show).toBe('tally');
	});
});

describe('sound', () => {
	it('is audible after Play at 1x and unmuted by default', () => {
		const plan = screenPlan(playing);
		expect(plan.audible).toBe(true);
		expect(new ScreenSound().muted || !plan.audible).toBe(false);
	});

	it('is silent at 4x and 16x, paused, buffering and before a jump lands', () => {
		expect(screenPlan(at({ speed: 4 })).audible).toBe(false);
		expect(screenPlan(at({ speed: 16 })).audible).toBe(false);
		expect(screenPlan(at({ playing: false })).audible).toBe(false);
		expect(screenPlan(at({}, { readyState: 2 })).audible).toBe(false);
		expect(screenPlan(at({}, { seeking: true })).audible).toBe(false);
		expect(screenPlan(at({ blank: true })).audible).toBe(false);
	});
});

describe('variant360', () => {
	const master = readFileSync(resolve(__dirname, '../../../../tests/fixtures/senedd_tv_16086_master.m3u8'), 'utf8');
	const url = 'https://nafw.cdn.vustreams.com/m/abc/interpretation/interpretation.isml/interpretation.m3u8?t=2026-07-15T12:30:07';

	it('picks the 640x360 variant, resolved against the master URL', () => {
		expect(variant360(master, url)).toBe(
			'https://nafw.cdn.vustreams.com/m/abc/interpretation/interpretation.isml/interpretation-audio_0=96000-video=499968.m3u8?vbegin=1784118607'
		);
	});

	it('is null when there is no 360p variant', () => {
		expect(variant360('#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION=1280x720\nhi.m3u8\n', url)).toBeNull();
	});
});
