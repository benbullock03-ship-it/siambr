/** HUD plates a visitor has closed, remembered per browser. Kiosks never read or write it: each walk-up visitor starts fresh. */
const KEY = 'siambr.hud.dismissed';

export type Plate = 'controls' | 'seating';

function read(): Set<string> {
	try {
		return new Set((localStorage.getItem(KEY) ?? '').split(',').filter(Boolean));
	} catch {
		return new Set();
	}
}

export function wasDismissed(plate: Plate, kiosk: boolean): boolean {
	return !kiosk && read().has(plate);
}

export function rememberDismissed(plate: Plate, kiosk: boolean): void {
	if (kiosk) return;
	try {
		const set = read();
		set.add(plate);
		localStorage.setItem(KEY, [...set].sort().join(','));
	} catch {
		// Storage blocked: the plate stays closed for this page only.
	}
}
