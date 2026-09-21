/**
 * The sitting clock: one scalar t (seconds on the Senedd TV clip) driven by tick(dt).
 * Svelte 5 runes, so this file is .svelte.ts. No DOM, no three.js; the stage hangs off it.
 *
 * Keyboard map (bound by the Stage HUD, T-18; see keys.ts):
 *   Space              play / pause
 *   ArrowLeft / Right  previous / next contribution beat
 *   Shift+ArrowLeft / Right   previous / next agenda item
 *   [  /  ]            slower / faster (1x, 4x, 16x)
 */
import { floorState, type FloorState } from './floor';
import { lastBeatStartingBy, type Timeline } from './timeline';

export const SPEEDS = [1, 4, 16] as const;
export type Speed = (typeof SPEEDS)[number];

const DAY = 86_400;

/** meeting_start_time ('HH:MM:SS') plus t, as 'HH:MM:SS'; null when the record gives no start. */
export function wallClockAt(meetingStartTime: string | null, t: number): string | null {
	if (!meetingStartTime) return null;
	const [h, m, s] = meetingStartTime.split(':').map(Number);
	if ([h, m, s].some((n) => !Number.isFinite(n))) return null;
	const total = (((h * 3600 + m * 60 + s + Math.floor(t)) % DAY) + DAY) % DAY;
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

export class SittingClock {
	readonly timeline: Timeline;
	readonly meetingStartTime: string | null;

	t = $state(0);
	playing = $state(false);
	speed = $state<Speed>(1);
	/** Counts seek() calls, so followers can tell a jump from playback. */
	seeks = $state(0);

	floor: FloorState;
	wallClock: string | null;
	atEnd: boolean;

	/** Starts paused at t0, else at the first timed contribution, else at 0. */
	constructor(timeline: Timeline, meetingStartTime: string | null = null, t0?: number) {
		this.timeline = timeline;
		this.meetingStartTime = meetingStartTime;
		this.t = this.clamp(t0 ?? timeline.firstTimedT ?? 0);
		this.floor = $derived.by(() => floorState(this.timeline, this.t));
		this.wallClock = $derived(wallClockAt(this.meetingStartTime, this.t));
		this.atEnd = $derived(this.t >= this.timeline.tEnd);
	}

	private clamp(t: number): number {
		return Math.min(Math.max(0, t), this.timeline.tEnd);
	}

	play(): void {
		if (this.t < this.timeline.tEnd) this.playing = true;
	}

	pause(): void {
		this.playing = false;
	}

	toggle(): void {
		if (this.playing) this.pause();
		else this.play();
	}

	seek(t: number): void {
		this.t = this.clamp(Number.isFinite(t) ? t : 0);
		this.seeks++;
	}

	setSpeed(speed: Speed): void {
		this.speed = speed;
	}

	faster(): void {
		this.speed = SPEEDS[Math.min(SPEEDS.indexOf(this.speed) + 1, SPEEDS.length - 1)];
	}

	slower(): void {
		this.speed = SPEEDS[Math.max(SPEEDS.indexOf(this.speed) - 1, 0)];
	}

	/** Advances t by dt * speed; clamps at the end of the sitting and pauses there. */
	tick(dtSeconds: number): void {
		if (!this.playing || !(dtSeconds > 0)) return;
		const next = this.t + dtSeconds * this.speed;
		if (next >= this.timeline.tEnd) {
			this.t = this.timeline.tEnd;
			this.playing = false;
		} else {
			this.t = next;
		}
	}

	/** Seeks to the next (+1) or previous (-1) beat start, counting distinct starts only. */
	stepContribution(direction: 1 | -1): void {
		const { beats } = this.timeline;
		if (!beats.length) return;
		const i = lastBeatStartingBy(this.timeline, this.t);
		if (direction > 0) {
			const here = i < 0 ? -Infinity : beats[i].t;
			const next = beats.find((b) => b.t > here);
			if (next) this.seek(next.t);
		} else {
			const here = i < 0 || beats[i].tEnd <= this.t ? this.t : beats[i].t;
			for (let k = i; k >= 0; k--) {
				if (beats[k].t < here) return this.seek(beats[k].t);
			}
			this.seek(beats[0].t);
		}
	}

	/** Seeks to the start of the next (+1) or previous (-1) item, skipping empty items. */
	stepItem(direction: 1 | -1): void {
		const { items } = this.timeline;
		if (!items.length) return;
		let current = -1;
		for (let k = 0; k < items.length; k++) if (items[k].t <= this.t) current = k;
		if (direction > 0) {
			const here = current < 0 ? -Infinity : items[current].t;
			const next = items.find((it) => it.t > here);
			if (next) this.seek(next.t);
		} else {
			const here = current < 0 ? this.t : items[current].t;
			for (let k = current; k >= 0; k--) {
				if (items[k].t < here) return this.seek(items[k].t);
			}
			this.seek(items[0].t);
		}
	}
}
