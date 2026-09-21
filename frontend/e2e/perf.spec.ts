import { expect, test } from '@playwright/test';

/**
 * T-17 performance gate: 30 s of the Gallery view with the floor light active on Chromium's
 * software renderer. Frames are capped at 30 fps by the harness; no frame may exceed 33 ms
 * of render work and the p95 frame must stay at or under 20 ms (T-24).
 */
// Runs alone with `npm run test:perf` (or PERF=1); it takes over half a minute.
const PERF = !!process.env.PERF || process.env.npm_lifecycle_event === 'test:perf';
test.skip(!PERF, 'run npm run test:perf for the 30 s frame trace');

const REAL_STREAM_GUID = '895772f3-294c-4f28-bc78-74f224e2e3c6';

test('gallery view, floor light active, no frame over 33 ms in 30 s on the software renderer', async ({ page }) => {
	test.setTimeout(120_000);
	// The fixture sitting's stream is served from the 2026-07-15 sitting, so the trace includes the
	// wall-screen video; offline, the screens stay dark and the trace runs without it.
	await page.route(/\/m\/fixture\//, (route) => {
		const url = route.request().url().replace('/m/fixture/', `/m/${REAL_STREAM_GUID}/`);
		return route.continue({ url: url.endsWith('/interpretation.m3u8') ? `${url}?t=2026-07-15T12:30:07` : url });
	});
	await page.goto('/siambr');
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 });
	await page.getByRole('button', { name: 'Play' }).click();
	await page.waitForTimeout(3_000);
	const stats = await page.evaluate(
		() =>
			new Promise<{ frames: number; max: number; over: number; p95: number }>((resolve) => {
				const frames: number[] = [];
				let last = performance.now();
				const end = last + 30_000;
				const tick = () => {
					const now = performance.now();
					frames.push(now - last);
					last = now;
					if (now < end) requestAnimationFrame(tick);
					else {
						const sorted = [...frames].sort((a, b) => a - b);
						resolve({
							frames: frames.length,
							max: Math.max(...frames),
							over: frames.filter((f) => f > 33.4).length,
							p95: sorted[Math.floor(sorted.length * 0.95)]
						});
					}
				};
				requestAnimationFrame(tick);
			})
	);
	console.log(`perf: ${stats.frames} frames in 30 s, max ${stats.max.toFixed(1)} ms, p95 ${stats.p95.toFixed(1)} ms, ${stats.over} over 33 ms`);
	expect(stats.over).toBe(0);
	expect(stats.p95).toBeLessThanOrEqual(20);
});
