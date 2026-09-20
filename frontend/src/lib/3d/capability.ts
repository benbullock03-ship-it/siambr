export interface DeviceReport {
	webgl2: boolean;
	webgpu: boolean;
	deviceMemoryGb: number | null;
	reducedMotion: boolean;
}

export type SceneDecision =
	| { mode: 'webgpu' | 'webgl2'; reducedMotion: boolean }
	| { mode: 'register'; reason: 'no-webgl' | 'low-memory' };

/** Devices reporting under this much RAM go straight to the 2D Register. */
export const MIN_DEVICE_MEMORY_GB = 2;

/** Reduced motion keeps the stage (cuts instead of eased camera moves, no walk mode); only capability sends a visitor to the Register. */
export function decideMode(r: DeviceReport): SceneDecision {
	if (!r.webgl2 && !r.webgpu) return { mode: 'register', reason: 'no-webgl' };
	if (r.deviceMemoryGb !== null && r.deviceMemoryGb < MIN_DEVICE_MEMORY_GB) {
		return { mode: 'register', reason: 'low-memory' };
	}
	return { mode: r.webgpu ? 'webgpu' : 'webgl2', reducedMotion: r.reducedMotion };
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
