import { beforeEach, describe, expect, it } from 'vitest';
import { rememberDismissed, wasDismissed } from './dismissed';

describe('dismissed plates', () => {
	beforeEach(() => localStorage.clear());

	it('remembers a dismissal per browser', () => {
		expect(wasDismissed('controls', false)).toBe(false);
		rememberDismissed('controls', false);
		expect(wasDismissed('controls', false)).toBe(true);
		expect(wasDismissed('seating', false)).toBe(false);
		expect(localStorage.getItem('siambr.hud.dismissed')).toBe('controls');
	});

	it('never reads or writes in kiosk mode', () => {
		rememberDismissed('seating', true);
		expect(localStorage.getItem('siambr.hud.dismissed')).toBeNull();
		rememberDismissed('seating', false);
		expect(wasDismissed('seating', true)).toBe(false);
	});
});
