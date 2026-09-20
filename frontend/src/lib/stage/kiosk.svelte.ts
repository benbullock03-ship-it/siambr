import type { GuidedRig } from '$lib/3d/controls/guided.svelte';
import type { SiambrState } from '$lib/3d/state.svelte';
import type { SittingClock } from './clock.svelte';

export interface KioskIdleOptions {
	idleThresholdSeconds?: number;
	resetThresholdSeconds?: number;
}

export class KioskIdleController {
	private clock: SittingClock;
	private rig: GuidedRig;
	private hud: SiambrState;
	private idleThreshold: number;
	private resetThreshold: number;
	private lastInputTime = typeof performance !== 'undefined' ? performance.now() : 0;
	private hasResetSitting = false;
	private intervalId: ReturnType<typeof setInterval> | null = null;
	private cleanupEvents: (() => void) | null = null;

	idleSeconds = $state(0);
	drifting = $state(false);

	constructor(
		clock: SittingClock,
		rig: GuidedRig,
		hud: SiambrState,
		options: KioskIdleOptions = {}
	) {
		this.clock = clock;
		this.rig = rig;
		this.hud = hud;
		this.idleThreshold = options.idleThresholdSeconds ?? 120;
		this.resetThreshold = options.resetThresholdSeconds ?? 600;
	}

	start(): () => void {
		if (typeof window === 'undefined') return () => {};

		let lastPointerX = -1;
		let lastPointerY = -1;

		const onUserInput = (e?: Event) => {
			if (e instanceof PointerEvent && e.type === 'pointermove') {
				if (e.clientX === lastPointerX && e.clientY === lastPointerY) return;
				lastPointerX = e.clientX;
				lastPointerY = e.clientY;
			}
			this.handleUserInput();
		};

		const events = ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart'];
		events.forEach((evt) => window.addEventListener(evt, onUserInput, { capture: true, passive: true }));

		this.intervalId = setInterval(() => this.tick(), 250);

		this.cleanupEvents = () => {
			events.forEach((evt) => window.removeEventListener(evt, onUserInput, { capture: true } as never));
			if (this.intervalId) {
				clearInterval(this.intervalId);
				this.intervalId = null;
			}
		};

		return () => this.destroy();
	}

	handleUserInput(now = typeof performance !== 'undefined' ? performance.now() : 0): void {
		this.lastInputTime = now;
		this.idleSeconds = 0;
		this.hasResetSitting = false;

		if (this.drifting || this.hud.drifting) {
			this.stopDrift(now);
		}
	}

	startDrift(now = typeof performance !== 'undefined' ? performance.now() : 0): void {
		this.drifting = true;
		this.hud.drifting = true;
		this.hud.walk = false;
		if (this.clock.speed !== 1) {
			this.clock.setSpeed(1);
		}
		if (!this.clock.playing) {
			this.clock.play();
		}
		this.rig.startDrift(now);
	}

	stopDrift(now = typeof performance !== 'undefined' ? performance.now() : 0): void {
		this.drifting = false;
		this.hud.drifting = false;
		this.rig.stopDrift(now);
	}

	tick(now = typeof performance !== 'undefined' ? performance.now() : 0): void {
		if (!this.hud.kiosk) return;

		const idle = (now - this.lastInputTime) / 1000;
		this.idleSeconds = idle;

		// 120 s idle -> drift
		if (idle >= this.idleThreshold && !this.drifting) {
			this.startDrift(now);
		}

		// 10 minutes idle -> reset sitting to first timed contribution and keep playing
		if (idle >= this.resetThreshold && !this.hasResetSitting) {
			this.hasResetSitting = true;
			const firstTimedT = this.clock.timeline.firstTimedT ?? 0;
			this.clock.seek(firstTimedT);
			if (!this.clock.playing) {
				this.clock.play();
			}
		}
	}

	destroy(): void {
		if (this.cleanupEvents) {
			this.cleanupEvents();
			this.cleanupEvents = null;
		}
		if (this.drifting) {
			this.stopDrift();
		}
	}
}
