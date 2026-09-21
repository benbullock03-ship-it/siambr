import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

/** T-29: every division is reachable without knowing its date. */
const DATE = '2026-06-10';

function exportedDivisions(): { id: string; date: string }[] {
	return JSON.parse(readFileSync(resolve('e2e/static/data/divisions/index.json'), 'utf-8'));
}

test('/divisions lists every division in the export, with both links', async ({ page }) => {
	const rows = exportedDivisions();
	expect(rows.length).toBeGreaterThan(0);
	await page.goto('/divisions');
	await expect(page.getByRole('heading', { level: 1, name: 'Divisions' })).toBeVisible();
	await expect(page.locator('tbody tr')).toHaveCount(rows.length);
	for (const d of rows) {
		await expect(page.locator(`a[href="/sitting/${d.date}?division=${encodeURIComponent(d.id)}"]`)).toHaveText('Watch it in the chamber');
	}
	const row = page.locator('tbody tr').first();
	await expect(row.getByRole('rowheader')).toHaveText('NHS Dentistry Waiting Times');
	await expect(row.getByText('Not agreed')).toBeVisible();
	await expect(row.getByRole('link', { name: /^Read the (debate|division)$/ })).toHaveAttribute('href', '/register?item=item-1');
});

test('/divisions filters apply as they change', async ({ page }) => {
	await page.goto('/divisions');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Result').selectOption('agreed');
	await expect(page).toHaveURL(/result=agreed/);
	await expect(page.getByText('No division on record matches these filters.')).toBeVisible();
	await page.getByLabel('Result').selectOption('');
	await page.getByLabel('Debate title').fill('dentistry');
	await expect(page.locator('tbody tr')).toHaveCount(1);
	await expect(page.getByRole('button', { name: /Apply/ })).toHaveCount(0);
});

test('/divisions stacks to cards at 390 px without sideways scroll', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/divisions');
	await expect(page.locator('tbody tr').first()).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
	const link = page.getByRole('link', { name: 'Watch it in the chamber' }).first();
	expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test('a division link opens the stage at that vote', async ({ page }) => {
	test.slow();
	await page.goto(`/sitting/${DATE}?division=division-1`);
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 20_000 });
	await expect(page.getByRole('region', { name: 'Transcript' }).getByLabel('Result')).toHaveText('Not agreed');
});

test('search returns a vote with its result and both links', async ({ page }) => {
	await page.goto('/search?q=report');
	const vote = page.locator('.results > li.vote').first();
	await expect(vote).toBeVisible({ timeout: 15_000 });
	await expect(vote.getByText('Vote', { exact: true })).toBeVisible();
	await expect(vote.getByText('Not agreed')).toBeVisible();
	await expect(vote.getByRole('link', { name: 'Watch it in the chamber' })).toHaveAttribute('href', `/sitting/${DATE}?division=division-1`);
	await expect(vote.getByRole('link', { name: /^Read the (debate|division)$/ })).toHaveAttribute('href', '/register?item=item-1');
});

test('the header links Votes', async ({ page }) => {
	await page.goto('/members');
	await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Votes' }).click();
	await expect(page).toHaveURL(/\/divisions$/);
	await expect(page.getByRole('link', { name: 'Votes' })).toHaveAttribute('aria-current', 'page');
});
