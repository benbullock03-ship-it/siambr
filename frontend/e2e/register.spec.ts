import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function violations(page: Page) {
	await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
	return (await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze()).violations;
}

test('register lists sessions with zero axe violations', async ({ page }) => {
	await page.goto('/register');
	await expect(page.getByRole('heading', { level: 1, name: 'Plenary Register' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'NHS Dentistry Waiting Times' })).toBeVisible();
	expect(await violations(page)).toEqual([]);
});

test('policy domain filter narrows the register', async ({ page }) => {
	await page.goto('/register');
	await page.getByLabel('Policy domain').selectOption('transport');
	await page.getByRole('button', { name: 'Apply filters' }).click();
	await expect(page).toHaveURL(/domain=transport/);
	await expect(page.getByRole('link', { name: 'Rural Bus Routes' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'NHS Dentistry Waiting Times' })).toHaveCount(0);
});

test('dossier plate opens accessibly and Escape returns focus to the item', async ({ page }) => {
	await page.goto('/register');
	const item = page.getByRole('link', { name: 'NHS Dentistry Waiting Times' });
	await item.click();

	const dialog = page.getByRole('dialog', { name: 'NHS Dentistry Waiting Times' });
	await expect(dialog.getByText('NHS dentistry waiting lists in Wales remain unacceptably long.')).toBeVisible();
	await expect(dialog.getByRole('link', { name: 'Official Record of Proceedings' })).toHaveAttribute(
		'href',
		'https://record.senedd.wales/Plenary/2026-06-10.xml'
	);
	expect(await violations(page)).toEqual([]);

	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(item).toBeFocused();
});

test('a sitting row links to the stage and every item opens its dossier from JSON alone', async ({ page }) => {
	await page.goto('/register');
	await expect(page.getByRole('link', { name: 'Watch it play' }).first()).toHaveAttribute('href', '/sitting/2026-06-10');
	await page.getByRole('link', { name: 'Rural Bus Routes' }).click();
	const dialog = page.getByRole('dialog', { name: 'Rural Bus Routes' });
	await expect(dialog.getByText('Item types and policy domains grouped by Siambr engine — speeches verbatim.')).toBeVisible();
	await expect(dialog.getByRole('link', { name: 'Watch it play in the chamber' })).toBeVisible();
});

test('reduced motion keeps the register usable', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/register?item=item-1');
	await expect(page.getByRole('dialog')).toBeVisible();
	expect(await page.locator('canvas').count()).toBe(0);
});
