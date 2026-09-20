import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { kiosk } from './kiosk.svelte';

describe('kiosk persistence & sync', () => {
	beforeEach(() => {
		localStorage.clear();
		kiosk.active = false;
	});

	afterEach(() => {
		localStorage.clear();
	});

	it('?kiosk=1 sets localStorage.siambr.kiosk = "1" and activates kiosk', () => {
		const url = new URL('https://siambr.test/sitting/2026-06-10?kiosk=1');
		kiosk.sync(url);

		expect(kiosk.active).toBe(true);
		expect(localStorage.getItem('siambr.kiosk')).toBe('1');
		expect((localStorage as Record<string, unknown>)['siambr.kiosk']).toBe('1');
	});

	it('?kiosk=0 clears localStorage.siambr.kiosk and deactivates kiosk', () => {
		localStorage.setItem('siambr.kiosk', '1');
		(localStorage as Record<string, unknown>)['siambr.kiosk'] = '1';
		kiosk.active = true;

		const url = new URL('https://siambr.test/register?kiosk=0');
		kiosk.sync(url);

		expect(kiosk.active).toBe(false);
		expect(localStorage.getItem('siambr.kiosk')).toBeNull();
		expect((localStorage as Record<string, unknown>)['siambr.kiosk']).toBeUndefined();
	});

	it('reads existing kiosk state on subsequent route navigations without query param', () => {
		localStorage.setItem('siambr.kiosk', '1');

		const url1 = new URL('https://siambr.test/members');
		kiosk.sync(url1);
		expect(kiosk.active).toBe(true);

		const url2 = new URL('https://siambr.test/sitting/2026-06-10');
		kiosk.sync(url2);
		expect(kiosk.active).toBe(true);
	});
});
