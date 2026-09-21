import type { SeatAssignment } from './chamber/seating';

/** Where a Member's desk projects on screen, for the DOM nametag. */
export interface ScreenAnchor {
	x: number;
	y: number;
	visible: boolean;
}

/** State shared between the Threlte scene and the DOM HUD. */
export class SiambrState {
	/** The seat within reach (walk) or framed (guided), if any. */
	focus = $state<SeatAssignment | null>(null);
	anchor = $state<ScreenAnchor>({ x: 0, y: 0, visible: false });
	/** The active speaking seat on the chamber floor. */
	liveSpeaker = $state<SeatAssignment | null>(null);
	liveSpeakerAnchor = $state<ScreenAnchor>({ x: 0, y: 0, visible: false });
	pointerLocked = $state(false);
	touch = $state(false);
	/** Free walk is opt-in; the guided camera is the default. */
	walk = $state(false);
	reducedMotion = $state(false);
	kiosk = $state(false);
	drifting = $state(false);
	/** Set by the page; the scene calls it when a seat is activated. */
	onopen: (seat: SeatAssignment) => void = () => {};

	/** Writes an anchor only when it moves half a pixel or changes visibility: every write re-renders the HUD. */
	place(key: 'anchor' | 'liveSpeakerAnchor', x: number, y: number, visible: boolean): void {
		const a = this[key];
		if (a.visible === visible && Math.abs(a.x - x) < 0.5 && Math.abs(a.y - y) < 0.5) return;
		this[key] = { x, y, visible };
	}
}

/** How far a desk under the crosshair or pointer still shows its nametag. */
export const LOOK_RANGE_M = 6;
export const FOCUS_RANGE_M = 2.5;
