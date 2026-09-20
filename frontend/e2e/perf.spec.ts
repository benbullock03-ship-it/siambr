import { expect, test } from '@playwright/test';

/**
 * T-17 performance gate: 30 s of the Gallery view with the floor light active on Chromium's
 * software renderer. Frames are capped at 30 fps by the harness; no frame may exceed 33 ms
 * of render work. Run with PERF=1 (it takes over half a minute).
 */
test.skip(!process.env.PERF, 'set PERF=1 to run the 30 s frame trace');

test('gallery view, floor light active, no frame over 33 ms in 30 s on the software renderer', async ({ page }) => {
	test.setTimeout(120_000);
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
});
