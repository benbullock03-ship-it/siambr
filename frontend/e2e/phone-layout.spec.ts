import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/** T-27: at phone width the HUD plates sit clear of the transcript sheet, and the header nav fits. */
const DATE = '2026-06-10';
const SHOTS = '../docs/chamber-review/phone';

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function plateBoxes(page: Page) {
	return page.locator('.bottom-stack > *').evaluateAll((els) =>
		els.map((el) => {
			const r = el.getBoundingClientRect();
			return { x: r.x, y: r.y, width: r.width, height: r.height };
		})
	);
}

test.describe('phone stage', () => {
	test.slow();
	test.use({ viewport: { width: 390, height: 844 } });

	test('no plate intersects the sheet at ?t=13320', async ({ page }) => {
		await page.goto(`/sitting/${DATE}?t=13320`);
		await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 });
		const sheet = (await page.getByRole('region', { name: 'Sitting' }).boundingBox())!;
		const plates = await plateBoxes(page);
		expect(plates.length).toBeGreaterThan(0);
		for (const p of plates) expect(overlaps(p, sheet)).toBe(false);
		await expect(page.getByLabel('Controls', { exact: true })).toContainText('Press Play below · drag to orbit · tap a desk');
		mkdirSync(SHOTS, { recursive: true });
		await page.waitForTimeout(1000);
		await page.screenshot({ path: `${SHOTS}/t27-stage-390.png` });
	});

	test('during a division the vote colours sit in the sheet header, not on the chamber', async ({ page }) => {
		await page.goto(`/sitting/${DATE}?item=item-1`);
		await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 });
		await page.getByRole('tab', { name: 'Running order' }).click();
		await page.getByRole('navigation', { name: 'Running order' }).getByRole('button', { name: /^Vote/ }).first().click();
		const sheet = page.getByRole('region', { name: 'Sitting' });
		await expect(sheet.locator('.handle-row').getByText('Unlit desk: did not vote')).toBeVisible();
		await expect(page.locator('.bottom-stack').getByText('Unlit desk: did not vote')).toHaveCount(0);
		const box = (await sheet.boundingBox())!;
		for (const p of await plateBoxes(page)) expect(overlaps(p, box)).toBe(false);
		await page.getByRole('tab', { name: 'Transcript' }).click();
		await page.waitForTimeout(1000);
		await page.screenshot({ path: `${SHOTS}/t27-division-390.png` });
	});

	test('the plates hide when the sheet fills the screen', async ({ page }) => {
		await page.goto(`/sitting/${DATE}`);
		await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 });
		await expect(page.locator('.bottom-stack')).toBeVisible();
		await page.getByRole('button', { name: 'Expand the transcript' }).press('ArrowUp');
		await expect(page.locator('.bottom-stack')).toBeHidden();
		await page.getByRole('button', { name: 'Shrink the transcript' }).press('ArrowDown');
		await expect(page.locator('.bottom-stack')).toBeVisible();
	});

	test('the seating and record notice opens from one "i" button', async ({ page }) => {
		await page.goto(`/sitting/${DATE}`);
		await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 });
		const info = page.getByRole('button', { name: 'Seating and record notice' });
		expect((await info.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		await expect(page.getByText('Desk positions arranged by Siambr engine')).toBeHidden();
		await info.click();
		await expect(page.getByText('Desk positions arranged by Siambr engine')).toBeVisible();
		await expect(page.getByText(/Record as published/)).toBeVisible();
	});
});

test('kiosk portrait keeps the desktop plates', async ({ page }) => {
	test.slow();
	await page.setViewportSize({ width: 1080, height: 1920 });
	await page.goto(`/sitting/${DATE}?kiosk=1`);
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 });
	await expect(page.getByRole('button', { name: 'Dismiss seating notice' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Seating and record notice' })).toHaveCount(0);
	mkdirSync(SHOTS, { recursive: true });
	await page.waitForTimeout(1000);
	await page.screenshot({ path: `${SHOTS}/t27-kiosk-portrait-1080.png` });
});

test('header nav fits at 390 px on /members, with a full-height Guide button', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/members');
	await page.waitForLoadState('networkidle');
	const links = page.locator('.nav-link');
	await expect(links).toHaveCount(5);
	for (const box of await links.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect))) {
		expect(box.left).toBeGreaterThanOrEqual(0);
		expect(box.right).toBeLessThanOrEqual(390);
		expect(box.top).toBeGreaterThanOrEqual(0);
	}
	const guide = page.getByRole('banner').getByRole('button', { name: 'Guide' });
	expect((await guide.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	expect(await guide.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
	expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
	await page.screenshot({ path: `${SHOTS}/t27-members-header-390.png` });
});
