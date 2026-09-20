import { browser } from '$app/environment';

function setupLocalStorageProxy() {
	if (typeof window === 'undefined') return;
	try {
		if (typeof Storage !== 'undefined' && !('siambr' in Storage.prototype)) {
			Object.defineProperty(Storage.prototype, 'siambr', {
				get() {
					const val = this.getItem('siambr.kiosk');
					return val !== null ? { kiosk: val } : undefined;
				},
				set(v: unknown) {
					if (v && typeof v === 'object' && 'kiosk' in v) {
						const k = (v as Record<string, unknown>).kiosk;
						if (k === '1' || k === true) this.setItem('siambr.kiosk', '1');
						else this.removeItem('siambr.kiosk');
					}
				},
				configurable: true
			});
		}
	} catch {}
}

export class KioskManager {
	active = $state(false);

	constructor() {
		if (typeof window !== 'undefined') {
			setupLocalStorageProxy();
			this.sync();
		}
	}

	sync(url?: URL) {
		if (typeof window === 'undefined') return;
		try {
			const currentUrl = url ?? new URL(window.location.href);
			const param = currentUrl.searchParams.get('kiosk');
			const storage = window.localStorage;

			if (param === '1') {
				storage.setItem('siambr.kiosk', '1');
				this.active = true;
				return;
			}

			if (param === '0') {
				storage.removeItem('siambr.kiosk');
				this.active = false;
				return;
			}

			const stored = storage.getItem('siambr.kiosk');
			this.active = stored === '1';
		} catch {
			this.active = false;
		}
	}
}

export const kiosk = new KioskManager();

