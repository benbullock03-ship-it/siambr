/** Keyboard map for the sitting clock. Documented here; bound to the DOM by the Stage HUD (T-18). */
import type { SittingClock } from './clock.svelte';

export type ClockAction =
	| 'toggle'
	| 'previousContribution'
	| 'nextContribution'
	| 'previousItem'
	| 'nextItem'
	| 'slower'
	| 'faster';

export const KEYBOARD_MAP: { key: string; shift: boolean; action: ClockAction; label: string }[] = [
	{ key: ' ', shift: false, action: 'toggle', label: 'Space: play or pause' },
	{ key: 'ArrowLeft', shift: false, action: 'previousContribution', label: 'Left: previous contribution' },
	{ key: 'ArrowRight', shift: false, action: 'nextContribution', label: 'Right: next contribution' },
	{ key: 'ArrowLeft', shift: true, action: 'previousItem', label: 'Shift+Left: previous item' },
	{ key: 'ArrowRight', shift: true, action: 'nextItem', label: 'Shift+Right: next item' },
	{ key: '[', shift: false, action: 'slower', label: '[: slower' },
	{ key: ']', shift: false, action: 'faster', label: ']: faster' }
];

/** The action for a key press, or null. Takes the two KeyboardEvent fields it needs. */
export function keyboardAction(event: { key: string; shiftKey: boolean }): ClockAction | null {
	return KEYBOARD_MAP.find((k) => k.key === event.key && k.shift === event.shiftKey)?.action ?? null;
}

export function applyAction(clock: SittingClock, action: ClockAction): void {
	switch (action) {
		case 'toggle':
			return clock.toggle();
		case 'previousContribution':
			return clock.stepContribution(-1);
		case 'nextContribution':
			return clock.stepContribution(1);
		case 'previousItem':
			return clock.stepItem(-1);
		case 'nextItem':
			return clock.stepItem(1);
		case 'slower':
			return clock.slower();
		case 'faster':
			return clock.faster();
	}
}
