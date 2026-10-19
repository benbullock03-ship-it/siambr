/**
 * The chamber screens' Senedd TV video, driven by the sitting clock (T-32). The clock leads:
 * the video is steered towards t and never holds it. No DOM here; ChamberScreen applies the plan.
 */
import type { Speed } from './clock.svelte';

/** Re-snap the video to t only when it has wandered further than this. */
export const DRIFT_SECONDS = 0.5;

/** HTMLMediaElement.readyState values, so this module needs no DOM. */
export const HAVE_METADATA = 1;
export const HAVE_CURRENT_DATA = 2;
export const HAVE_FUTURE_DATA = 3;

export interface VideoState {
	time: number;
	seeking: boolean;
	readyState: number;
}

export interface ScreenState {
	t: number;
	/** Seconds to add to t to reach the stream's own timeline (Senedd TV began before the Record's origin). */
	offset: number;
	playing: boolean;
	speed: Speed;
	/** A division tally holds the screens. */
	division: boolean;
	/** The clock jumped since the last frame: a seek, or a return to 1x. */
	jumped: boolean;
	/** A jump's seek has not landed yet. */
	blank: boolean;
	video: VideoState;
}

export interface ScreenPlan {
	show: 'video' | 'dark' | 'tally';
	play: boolean;
	seekTo: number | null;
	/** Sound follows the picture: silent at 4x/16x, paused, buffering or before a jump lands. A tally does not mute it. */
	audible: boolean;
}

export interface ClockMark {
	seeks: number;
	speed: Speed;
}

export function jumpedSince(prev: ClockMark | null, now: ClockMark): boolean {
	return prev === null || now.seeks !== prev.seeks || (now.speed === 1 && prev.speed !== 1);
}

export function screenPlan(s: ScreenState): ScreenPlan {
	const live = s.speed === 1;
	const waiting = s.video.seeking || s.video.readyState < HAVE_FUTURE_DATA;
	// The video runs on the stream's timeline, which may begin a few seconds before the sitting's.
	const target = s.t + s.offset;
	// A stalled video keeps its last frame; re-snapping it mid-stall would only blank the screen.
	const drifted = live && !waiting && Math.abs(s.video.time - target) > DRIFT_SECONDS;
	const seekTo = s.jumped || drifted ? target : null;
	const blank = s.jumped || s.blank || s.video.readyState < HAVE_CURRENT_DATA;
	return {
		show: s.division ? 'tally' : live && !blank ? 'video' : 'dark',
		play: live && s.playing,
		seekTo,
		audible: live && s.playing && !waiting && !blank
	};
}

/** The 360p variant's absolute URL from a master playlist; null when the master has none. */
export function variant360(master: string, masterUrl: string): string | null {
	const lines = master.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		if (!lines[i].startsWith('#EXT-X-STREAM-INF:') || !/RESOLUTION=\d+x360(,|$)/.test(lines[i])) continue;
		const uri = lines.slice(i + 1).find((l) => l.trim() && !l.startsWith('#'));
		return uri ? new URL(uri.trim(), masterUrl).href : null;
	}
	return null;
}
