import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
/** The fixture export's latest sitting. */
const DATE = '2026-06-10';

async function violations(page: Page) {
	await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
	return (await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze()).violations;
}

test('the front door is the latest sitting, paused, with one Play', async ({ page }) => {
	// Two page loads now: the landing page, then the stage on SwiftShader.
	test.slow();
	await page.goto('/');
	await page.getByRole('link', { name: 'Enter the chamber' }).click();
	await expect(page).toHaveURL(new RegExp(`/sitting/${DATE}$`));
	await expect(page.getByRole('button', { name: 'Play' })).toHaveCount(1);
	await expect(page.getByText('Desk positions arranged by Siambr engine')).toBeVisible();
	await expect(page.getByRole('link', { name: /^Record of Proceedings ·/ })).toBeVisible();
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 20_000 });
	expect(await violations(page)).toEqual([]);
});

test('/siambr still opens the chamber', async ({ page }) => {
	await page.goto('/siambr');
	await expect(page).toHaveURL(new RegExp(`/sitting/${DATE}`));
});

test('the stage HUD passes axe at phone width with the sheet', async ({ page }) => {
	// SwiftShader beside a second worker can take most of the default budget to draw the chamber.
	test.slow();
	await page.setViewportSize({ width: 360, height: 740 });
	await page.goto(`/sitting/${DATE}`);
	await expect(page.getByRole('tab', { name: 'Transcript' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Sitting' }).getByRole('button', { name: 'Play' })).toBeVisible();
	await page.getByRole('tab', { name: 'Running order' }).click();
	await expect(page.getByRole('navigation', { name: 'Running order' })).toBeVisible();
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	expect(overflow).toBeLessThanOrEqual(0);
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 20_000 });
	expect(await violations(page)).toEqual([]);
});

test('a Member record opens from the chamber as an accessible dossier', async ({ page }) => {
	await page.goto(`/sitting/${DATE}?member=ms-jane-doe`);
	const dialog = page.getByRole('dialog', { name: /Jane Doe/ });
	// A cold Vite compiles three.js on the first hit, so the record can take a while to arrive.
	await expect(dialog).toBeVisible({ timeout: 20_000 });
	await expect(dialog.getByText('NHS dentistry waiting lists in Wales remain unacceptably long.')).toBeVisible();
	await expect(dialog.getByText('Counted by Siambr', { exact: false })).toBeVisible();
	await expect(dialog.locator('.rows .chip', { hasText: 'For' })).toBeVisible();
	await expect(dialog.getByRole('link', { name: 'Official Senedd profile' })).toHaveAttribute('href', 'https://senedd.wales/people/jane-doe/');
	expect(await violations(page)).toEqual([]);
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(page).toHaveURL(new RegExp(`/sitting/${DATE}$`));
});

test('reduced motion keeps the stage, hides the walk toggle and offers the Register', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(`/sitting/${DATE}`);
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 20_000 });
	await expect(page.getByRole('group', { name: 'Camera' })).toBeVisible();
	await expect(page.getByRole('switch', { name: 'Walk the floor' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Register' })).toBeVisible();
});

test('a kiosk hides the walk toggle', async ({ page }) => {
	await page.goto(`/sitting/${DATE}?kiosk=1`);
	await expect(page.getByRole('group', { name: 'Camera' })).toBeVisible({ timeout: 20_000 });
	await expect(page.getByRole('switch', { name: 'Walk the floor' })).toHaveCount(0);
});

test('the guided camera frames a desk on the first click and opens the Member on the second', async ({ page }) => {
	// The click loop against the software renderer eats most of the default budget.
	test.slow();
	// With the webfonts loaded the strip wraps at 1280 px and the controls plate covers the click row.
	await page.setViewportSize({ width: 1600, height: 900 });
	await page.goto(`/sitting/${DATE}`);
	const canvas = page.locator('canvas');
	await expect(canvas).toHaveCount(1, { timeout: 20_000 });
	await page.evaluate(() => document.fonts.ready);
	await page.getByRole('button', { name: 'Floor' }).click();
	// Give the software renderer a few frames so the click raycasts against a drawn scene.
	await page.waitForTimeout(1500);
	const box = (await canvas.boundingBox())!;
	let framed = false;
	for (let i = 0; i < 12 && !framed; i++) {
		await page.mouse.click(box.x + box.width * (0.2 + i * 0.05), box.y + box.height * 0.6);
		framed = (await page.locator('.nametag').count()) > 0;
	}
	expect(framed).toBe(true);
	const name = await page.locator('.nametag .name').textContent();
	await page.waitForTimeout(800);
	await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.62);
	const dialog = page.getByRole('dialog', { name: new RegExp(name!.trim()) });
	await expect(dialog).toBeVisible({ timeout: 10_000 });
	// T-25: the record opens over the chamber, beside the transcript column, never under it.
	const column = page.locator('.column');
	await expect(column).toBeVisible();
	const [drawer, col] = await Promise.all([dialog.boundingBox(), column.boundingBox()]);
	expect(drawer!.x + drawer!.width).toBeLessThanOrEqual(col!.x + 1);
	expect(drawer!.width).toBeGreaterThan(200);
	expect(await page.locator('.column').evaluate((el) => document.elementFromPoint(el.getBoundingClientRect().x + 20, el.getBoundingClientRect().y + 200)?.closest('.column') !== null)).toBe(true);
});

test('transport, keyboard and deep links drive the clock', async ({ page }) => {
	test.slow();
	await page.goto(`/sitting/${DATE}`);
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 20_000 });
	const transcript = page.getByRole('region', { name: 'Transcript' });
	await expect(transcript.getByText('Official verbatim record')).toBeVisible();
	await page.getByRole('button', { name: 'Next contribution' }).click();
	await expect(page.getByRole('navigation', { name: 'Running order' }).locator('[aria-current="true"]')).toHaveCount(1);
	await page.getByRole('button', { name: 'Play' }).click();
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
	await expect(page).toHaveURL(/\?t=\d+/, { timeout: 5_000 });
	await page.keyboard.press('Space');
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	await page.keyboard.press(']');
	await expect(page.getByRole('button', { name: '4x' })).toHaveAttribute('aria-pressed', 'true');

	await page.goto(`/sitting/${DATE}?t=0`);
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 20_000 });
	await expect(page.getByRole('region', { name: 'Transcript' }).getByText('Jane Doe')).toBeVisible();
});

test('an untimed contribution says the record gives no timestamp', async ({ page }) => {
	await page.goto(`/sitting/${DATE}`);
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 20_000 });
	await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
	await page.getByRole('navigation', { name: 'Running order' }).getByRole('button', { name: /untimed/ }).first().click();
	await expect(page.getByText('No broadcast timestamp published for this contribution.')).toBeVisible();
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
	await page.goto(`/sitting/${DATE}`);
	await expect(page.getByText('This device cannot draw the chamber.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Open the Register' })).toBeVisible();
	expect(await page.locator('canvas').count()).toBe(0);
});

test('a low-memory device falls back to the Register', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'deviceMemory', { value: 1, configurable: true });
	});
	await page.goto(`/sitting/${DATE}`);
	await expect(page.getByText(/too little memory/)).toBeVisible();
});

test('an item deep link opens at that item, paused', async ({ page }) => {
	const items = (await (await page.request.get('/data/sittings/index.json')).json()) as { date: string; items: { id: string; title_en: string }[] }[];
	const sitting = items.find((s) => s.date === DATE)!;
	const last = sitting.items[sitting.items.length - 1];
	await page.goto(`/sitting/${DATE}?item=${encodeURIComponent(last.id)}`);
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 20_000 });
	await expect(page.getByRole('region', { name: 'Transcript' }).getByText(last.title_en)).toBeVisible();
});
