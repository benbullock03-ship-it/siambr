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

export type KioskLink = 'votes' | 'search' | 'stats';

export class KioskManager {
	active = $state(false);
	/** Stage menu links a kiosk opts into with ?kiosk_links=votes,search,stats; Members and Register always show. */
	links = $state<KioskLink[]>([]);

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
			const links = currentUrl.searchParams.get('kiosk_links');
			if (links !== null) {
				if (links) storage.setItem('siambr.kiosk.links', links);
				else storage.removeItem('siambr.kiosk.links');
			}
			this.links = (storage.getItem('siambr.kiosk.links') ?? '')
				.split(',')
				.filter((l): l is KioskLink => l === 'votes' || l === 'search' || l === 'stats');

			if (param === '1') {
				storage.setItem('siambr.kiosk', '1');
				this.active = true;
				return;
			}

			if (param === '0') {
				storage.removeItem('siambr.kiosk');
				storage.removeItem('siambr.kiosk.links');
				this.links = [];
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

