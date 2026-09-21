import { expect, test } from '@playwright/test';

/** The fixture export's latest sitting. */
const DATE = '2026-06-10';
const RECORD_PAGE = /^https:\/\/record\.senedd\.wales\/Plenary\/\d+$/;

test('T-28: a search result links the Record page on the result itself', async ({ page }) => {
	await page.goto('/search?q=dentistry');
	const first = page.locator('.results > li').first();
	await expect(first.locator('mark').first()).toBeVisible({ timeout: 15_000 });
	await expect(first.getByRole('link', { name: 'Read this in the Record' })).toHaveAttribute('href', RECORD_PAGE);
});

test('T-28: the live Stage contribution links the Record page without a drawer', async ({ page }) => {
	test.slow();
	await page.goto(`/sitting/${DATE}?t=0`);
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 20_000 });
	const link = page.getByRole('region', { name: 'Transcript' }).getByRole('link', { name: 'Read this in the Record' });
	await expect(link).toHaveAttribute('href', RECORD_PAGE);
	await link.scrollIntoViewIfNeeded();
	await expect(link).toBeVisible();
	await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('T-28: every speech on a Member page links the Record page for its day', async ({ page }) => {
	await page.goto('/members/ms-jane-doe');
	const speeches = page.locator('.speeches > li');
	await expect(speeches.first()).toBeVisible();
	const n = await speeches.count();
	expect(n).toBeGreaterThan(0);
	for (let i = 0; i < n; i++) {
		await expect(speeches.nth(i).getByRole('link', { name: 'Read this in the Record' })).toHaveAttribute('href', RECORD_PAGE);
	}
});
