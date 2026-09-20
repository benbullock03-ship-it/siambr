import { beforeAll, describe, expect, it } from 'vitest';
import { chamberTextures, displaySurfaceBytes, TEXTURE_BUDGET_BYTES, TEXTURE_SIZES, textureBudgetBytes, textureKeys } from './materials';

// jsdom has no 2D canvas; a no-op context is enough to run every generator and count what it makes.
beforeAll(() => {
	const gradient = { addColorStop() {} };
	const ctx = new Proxy({} as Record<string, unknown>, {
		get: (_, key) => (key === 'createRadialGradient' || key === 'createLinearGradient' ? () => gradient : () => undefined),
		set: () => true
	});
	HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext'];
});

describe('chamber textures (T-23 budget)', () => {
	it('never exceeds 1024 px on a side', () => {
		for (const size of Object.values(TEXTURE_SIZES)) expect(size).toBeLessThanOrEqual(1024);
	});

	it('builds each texture once and stays under 12 MB with the division displays', () => {
		const a = chamberTextures();
		const b = chamberTextures();
		expect(a.joineryA).toBe(b.joineryA);
		expect(a.joineryA).not.toBe(a.joineryB);
		expect(textureKeys().length).toBe(Object.keys(a).length);
		const total = textureBudgetBytes() + displaySurfaceBytes();
		expect(total).toBeLessThanOrEqual(TEXTURE_BUDGET_BYTES);
	});
});
