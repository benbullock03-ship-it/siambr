import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function violations(page: Page) {
	await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
	return (await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze()).violations;
}

test('the chamber renders with its HUD and zero axe violations', async ({ page }) => {
	await page.goto('/siambr');
	await expect(page.getByRole('heading', { level: 1, name: 'Y Siambr' })).toBeVisible();
	await expect(page.getByText('Seventh Senedd')).toBeVisible();
	await expect(page.getByText('Desk positions arranged by Siambr engine')).toBeVisible();
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 20_000 });
	await expect(page).toHaveURL(/\/siambr$/);
	expect(await violations(page)).toEqual([]);
});

test('a Member record opens from the chamber as an accessible dossier', async ({ page }) => {
	await page.goto('/siambr?member=ms-jane-doe');
	const dialog = page.getByRole('dialog', { name: /Jane Doe/ });
	// A cold Vite compiles three.js on the first hit, so the record can take a while to arrive.
	await expect(dialog).toBeVisible({ timeout: 20_000 });
	await expect(dialog.getByText('NHS dentistry waiting lists in Wales remain unacceptably long.')).toBeVisible();
	await expect(dialog.getByRole('cell', { name: 'For' })).toBeVisible();
	await expect(dialog.getByRole('link', { name: 'Official Senedd profile' })).toHaveAttribute(
		'href',
		'https://senedd.wales/people/jane-doe/'
	);
	expect(await violations(page)).toEqual([]);
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(page).toHaveURL(/\/siambr$/);
});

test('reduced motion keeps the stage, hides the walk toggle and offers the Register', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/siambr');
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 20_000 });
	await expect(page.getByRole('group', { name: 'Camera' })).toBeVisible();
	await expect(page.getByRole('switch', { name: 'Walk the floor' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Open the Register' })).toBeVisible();
});

test('a kiosk hides the walk toggle', async ({ page }) => {
	await page.goto('/siambr?kiosk=1');
	await expect(page.getByRole('group', { name: 'Camera' })).toBeVisible({ timeout: 20_000 });
	await expect(page.getByRole('switch', { name: 'Walk the floor' })).toHaveCount(0);
});

test('the guided camera frames a desk on the first click and opens the Member on the second', async ({ page }) => {
	await page.goto('/siambr');
	const canvas = page.locator('canvas');
	await expect(canvas).toHaveCount(1, { timeout: 20_000 });
	await page.getByRole('button', { name: 'Floor' }).click();
	// Give the software renderer a few frames so the click raycasts against a drawn scene.
	await page.waitForTimeout(1500);
	const box = (await canvas.boundingBox())!;
	// Scan a horizontal band across the middle of the view until a desk answers with a nametag.
	let framed = false;
	for (let i = 0; i < 12 && !framed; i++) {
		const x = box.x + box.width * (0.2 + i * 0.05);
		const y = box.y + box.height * 0.6;
		await page.mouse.click(x, y);
		framed = (await page.locator('.nametag').count()) > 0;
	}
	expect(framed).toBe(true);
	const name = await page.locator('.nametag .name').textContent();
	// A second click on the same desk opens the Member record; the desk is now framed, so click the screen centre.
	await page.waitForTimeout(800);
	await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.62);
	await expect(page.getByRole('dialog', { name: new RegExp(name!.trim()) })).toBeVisible({ timeout: 10_000 });
});

test('the sitting clock plays and lights a desk', async ({ page }) => {
	await page.goto('/siambr');
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 20_000 });
	const play = page.getByRole('button', { name: 'Play' });
	await expect(play).toBeVisible();
	await play.click();
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
	await expect(page.getByRole('group', { name: 'Sitting clock' }).locator('.live')).not.toHaveText('No one holds the floor.');
});

test('a device without WebGL falls back to the Register', async ({ page }) => {
	await page.addInitScript(() => {
		const original = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
			if (type.startsWith('webgl')) return null;
			return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
		} as typeof original;
		Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
	});
	await page.goto('/siambr');
	await expect(page).toHaveURL(/\/register\?from=siambr&reason=no-webgl/);
});

test('a low-memory device falls back to the Register', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'deviceMemory', { value: 1, configurable: true });
	});
	await page.goto('/siambr');
	await expect(page).toHaveURL(/\/register\?from=siambr&reason=low-memory/);
});

test('a debate deep link opens its dossier over the chamber', async ({ page }) => {
	await page.goto('/siambr?item=item-1');
	const dialog = page.getByRole('dialog', { name: /NHS Dentistry Waiting Times/ });
	await expect(dialog).toBeVisible({ timeout: 20_000 });
	await expect(dialog.getByText('NHS dentistry waiting lists in Wales remain unacceptably long.')).toBeVisible();
	await expect(dialog.getByRole('link', { name: 'Official Record of Proceedings' })).toHaveAttribute(
		'href',
		'https://record.senedd.wales/Plenary/2026-06-10.xml'
	);
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 20_000 });
	expect(await violations(page)).toEqual([]);
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(page).toHaveURL(/\/siambr$/);
});
