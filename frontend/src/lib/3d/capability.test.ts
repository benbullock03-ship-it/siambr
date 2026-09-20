import { describe, expect, it } from 'vitest';
import { decideMode, type DeviceReport } from './capability';

const base: DeviceReport = { webgl2: true, webgpu: false, deviceMemoryGb: 8, reducedMotion: false };

describe('decideMode', () => {
	it('prefers WebGPU, then WebGL2', () => {
		expect(decideMode({ ...base, webgpu: true })).toEqual({ mode: 'webgpu' });
		expect(decideMode(base)).toEqual({ mode: 'webgl2' });
	});

	it('sends reduced-motion visitors to the Register before anything else', () => {
		expect(decideMode({ ...base, webgpu: true, reducedMotion: true })).toEqual({
			mode: 'register',
			reason: 'reduced-motion'
		});
	});

	it('falls back when no GPU context is available', () => {
		expect(decideMode({ ...base, webgl2: false })).toEqual({ mode: 'register', reason: 'no-webgl' });
	});

	it('falls back on low-memory devices but tolerates unknown memory', () => {
		expect(decideMode({ ...base, deviceMemoryGb: 1 })).toEqual({ mode: 'register', reason: 'low-memory' });
		expect(decideMode({ ...base, deviceMemoryGb: null })).toEqual({ mode: 'webgl2' });
	});
});
