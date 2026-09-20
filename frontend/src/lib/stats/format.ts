/** Seconds as a clock reading, e.g. 1 h 02 m 34 s. Figures on the stats pages are sums, never estimates. */
export function duration(seconds: number): string {
	const whole = Math.round(seconds);
	const h = Math.floor(whole / 3600);
	const m = Math.floor((whole % 3600) / 60);
	const s = whole % 60;
	const pad = (n: number) => String(n).padStart(2, '0');
	if (h) return `${h} h ${pad(m)} m ${pad(s)} s`;
	if (m) return `${m} m ${pad(s)} s`;
	return `${s} s`;
}

export const count = (n: number) => n.toLocaleString('en-GB');

/** A share of a stated total, to the nearest whole percent. */
export const share = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : '0%');
