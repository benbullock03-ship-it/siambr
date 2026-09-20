import type { SeatAssignment } from './chamber/seating';

/** Where a Member's desk projects on screen, for the DOM nametag. */
export interface ScreenAnchor {
	x: number;
	y: number;
	visible: boolean;
}

/** State shared between the Threlte scene and the DOM HUD. */
export class SiambrState {
	/** The seat within reach, if any. */
	focus = $state<SeatAssignment | null>(null);
	anchor = $state<ScreenAnchor>({ x: 0, y: 0, visible: false });
	pointerLocked = $state(false);
	touch = $state(false);
	/** Set by the page; the scene calls it when a seat is activated. */
	onopen: (seat: SeatAssignment) => void = () => {};
}

/** How far a desk under the crosshair or pointer still shows its nametag. */
export const LOOK_RANGE_M = 6;
export const FOCUS_RANGE_M = 2.5;
