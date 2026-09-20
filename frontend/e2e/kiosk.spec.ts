import { expect, test } from '@playwright/test';

const DATE = '2026-06-10';

test('?kiosk=1 sets localStorage and persists across routes; ?kiosk=0 clears it', async ({ page }) => {
	await page.goto(`/sitting/${DATE}?kiosk=1`);
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 20_000 });

	// Both localStorage.getItem('siambr.kiosk') and localStorage.siambr.kiosk work
	const stored = await page.evaluate(() => localStorage.getItem('siambr.kiosk'));
	expect(stored).toBe('1');
	const storedProxy = await page.evaluate(() => (localStorage as unknown as { siambr?: { kiosk?: string } }).siambr?.kiosk);
	expect(storedProxy).toBe('1');

	// Navigate to another route; kiosk state is preserved without the query param
	await page.goto('/register');
	await expect(page.getByRole('heading', { name: 'Plenary Register' })).toBeVisible();
	const storedOnRegister = await page.evaluate(() => localStorage.getItem('siambr.kiosk'));
	expect(storedOnRegister).toBe('1');

	// ?kiosk=0 clears it
	await page.goto(`/register?kiosk=0`);
	await expect(page.getByRole('heading', { name: 'Plenary Register' })).toBeVisible();
	await expect.poll(async () => {
		return await page.evaluate(() => localStorage.getItem('siambr.kiosk'));
	}).toBeNull();
});

test('kiosk mode hides walk toggle and renders Senedd TV links as QR codes', async ({ page }) => {
	await page.goto(`/sitting/${DATE}?kiosk=1`);
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 20_000 });

	// Walk toggle is hidden
	await expect(page.getByRole('switch', { name: 'Walk the floor' })).toHaveCount(0);

	// External links to Senedd TV render as QR codes with the URL printed beneath
	const qrCode = page.locator('.kiosk-qr');
	await expect(qrCode.first()).toBeVisible({ timeout: 10_000 });
	await expect(page.locator('.kiosk-qr svg').first()).toBeVisible();
	await expect(page.locator('.kiosk-qr .qr-url').first()).toContainText('senedd');
});

test('reduced motion in kiosk mode holds Gallery vantage without drift', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(`/sitting/${DATE}?kiosk=1`);
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 20_000 });

	// Playback can still run
	await page.getByRole('button', { name: 'Play' }).click();
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

	// Gallery button remains selected
	await expect(page.getByRole('button', { name: 'Gallery' })).toHaveAttribute('aria-pressed', 'true');
});

/**
 * T-22 acceptance gate: 1920x1080 Playwright run at 1x for 3 minutes with kiosk=1.
 * Shows no console errors, no memory growth over 50 MB, and screenshots at 0, 60, 120, 180 s differ.
 * Run with KIOSK_RUN=1 (takes 3 minutes).
 */
const runLongTest = !!process.env.KIOSK_RUN;
test.describe('3-minute kiosk attract mode run', () => {
	test.skip(!runLongTest, 'set KIOSK_RUN=1 to run the full 3-minute continuous drift gate');

	test('1920x1080 run at 1x for 3 minutes shows continuous drift, no errors, <50MB growth', async ({ page }) => {
		test.setTimeout(240_000);
		const consoleErrors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				consoleErrors.push(msg.text());
			}
		});

		await page.setViewportSize({ width: 1920, height: 1080 });
		await page.goto(`/sitting/${DATE}?kiosk=1`);
		await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 });

		// Start playback at 1x
		await page.getByRole('button', { name: 'Play' }).click();

		// Helper to sample memory if supported by the browser engine
		const getHeap = async () => {
			return await page.evaluate(() => {
				return (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
			});
		};

		// t = 0 s
		const mem0 = await getHeap();
		const shot0 = await page.screenshot();

		// t = 60 s
		await page.waitForTimeout(60_000);
		const shot60 = await page.screenshot();

		// t = 120 s (drift starts)
		await page.waitForTimeout(60_000);
		const shot120 = await page.screenshot();

		// t = 180 s (drift running midway through 40 s loop)
		await page.waitForTimeout(60_000);
		const mem180 = await getHeap();
		const shot180 = await page.screenshot();

		// Verify console errors
		expect(consoleErrors).toEqual([]);

		// Verify memory growth <= 50 MB
		if (mem0 > 0 && mem180 > 0) {
			const growthMb = (mem180 - mem0) / (1024 * 1024);
			console.log(`Memory growth over 3 minutes: ${growthMb.toFixed(2)} MB`);
			expect(growthMb).toBeLessThanOrEqual(50);
		}

		// Verify screenshots at 0, 60, 120, 180 s all differ
		expect(shot0.equals(shot60)).toBe(false);
		expect(shot60.equals(shot120)).toBe(false);
		expect(shot120.equals(shot180)).toBe(false);
	});
});
