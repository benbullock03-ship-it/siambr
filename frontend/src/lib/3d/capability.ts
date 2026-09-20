export interface DeviceReport {
	webgl2: boolean;
	webgpu: boolean;
	deviceMemoryGb: number | null;
	reducedMotion: boolean;
}

export type SceneDecision =
	| { mode: 'webgpu' | 'webgl2' }
	| { mode: 'register'; reason: 'reduced-motion' | 'no-webgl' | 'low-memory' };

/** Devices reporting under this much RAM go straight to the 2D Register. */
export const MIN_DEVICE_MEMORY_GB = 2;

export function decideMode(r: DeviceReport): SceneDecision {
	if (r.reducedMotion) return { mode: 'register', reason: 'reduced-motion' };
	if (!r.webgl2 && !r.webgpu) return { mode: 'register', reason: 'no-webgl' };
	if (r.deviceMemoryGb !== null && r.deviceMemoryGb < MIN_DEVICE_MEMORY_GB) {
		return { mode: 'register', reason: 'low-memory' };
	}
	return { mode: r.webgpu ? 'webgpu' : 'webgl2' };
}

export function probeDevice(win: Window & typeof globalThis): DeviceReport {
	let webgl2 = false;
	try {
		webgl2 = win.document.createElement('canvas').getContext('webgl2') !== null;
	} catch {
		webgl2 = false;
	}
	const nav = win.navigator as Navigator & { gpu?: unknown; deviceMemory?: number };
	return {
		webgl2,
		webgpu: nav.gpu !== undefined && nav.gpu !== null,
		deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
		reducedMotion: win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
	};
}
