import { expect, test, type Page } from '@playwright/test';

/** T-35 gate: frames are drawn on demand, so a paused, settled chamber draws none. */
const DATE = '2026-06-10';

const frames = (page: Page) => page.evaluate(() => (window as unknown as { __siambr?: { frames: number } }).__siambr?.frames ?? -1);

test('a paused chamber draws no frames; playback draws them', async ({ page }) => {
	test.slow();
	await page.goto(`/sitting/${DATE}`);
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 20_000 });
	await expect.poll(() => frames(page), { timeout: 20_000 }).toBeGreaterThan(0);

	const play = page.getByRole('button', { name: 'Play' }).first();
	await play.click();
	const playing = await frames(page);
	// Poll rather than sample after a fixed wait: SwiftShader draws slowly, so the frame count
	// that proves playback is not a function of wall-clock time.
	await expect.poll(() => frames(page), { timeout: 20_000 }).toBeGreaterThan(playing + 5);

	await page.getByRole('button', { name: 'Pause' }).first().click();
	// Let the floor light and camera settle, then count.
	await page.waitForTimeout(1_500);
	const settled = await frames(page);
	await page.waitForTimeout(3_000);
	expect(await frames(page)).toBe(settled);
});
