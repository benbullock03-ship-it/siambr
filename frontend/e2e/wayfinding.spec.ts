import { expect, test, type Page } from '@playwright/test';

/** T-26: site navigation on the Stage, the landing page, first-visit orientation and keyboard entry. */
const DATE = '2026-06-10';

async function stage(page: Page, url = `/sitting/${DATE}`) {
	await page.goto(url);
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 });
}

async function inViewport(page: Page, selector: string) {
	const box = await page.locator(selector).first().boundingBox();
	const vp = page.viewportSize()!;
	return !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width && box.y + box.height <= vp.height;
}

test.describe('stage site menu', () => {
	test.slow();

	test('desktop 1440: Members, Search and the Guide are linked and on screen', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await stage(page);
		const site = page.getByRole('navigation', { name: 'Site' });
		for (const [name, href] of [['Members', '/members'], ['Search', '/search'], ['Guide', `/sitting/${DATE}?guide=1`]]) {
			await expect(site.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
			expect(await inViewport(page, `nav[aria-label="Site"] a[href="${href}"]`)).toBe(true);
		}
	});

	test('phone 390: the Menu button opens the same links, each 44 px tall', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await stage(page);
		const menu = page.getByRole('button', { name: 'Menu' });
		expect((await menu.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		await menu.click();
		for (const href of ['/members', '/search', `/sitting/${DATE}?guide=1`]) {
			const link = page.locator(`#stage-menu a[href="${href}"]`);
			await expect(link).toBeVisible();
			expect(await inViewport(page, `#stage-menu a[href="${href}"]`)).toBe(true);
			expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		}
	});

	test('the Register link carries the live item', async ({ page }) => {
		await stage(page, `/sitting/${DATE}?item=item-1`);
		await expect(page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Register' })).toHaveAttribute(
			'href',
			'/register?item=item-1'
		);
	});

	test('the Guide opens on the Stage', async ({ page }) => {
		await stage(page);
		await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Guide' }).click();
		await expect(page.getByRole('dialog', { name: 'How to explore the Senedd' })).toBeVisible();
		await expect(page.getByText('Don’t show this guide on startup')).toHaveCount(0);
	});

	test('a kiosk menu shows Members and Register only, 44 px tall', async ({ page }) => {
		await page.setViewportSize({ width: 1080, height: 1920 });
		await stage(page, `/sitting/${DATE}?kiosk=1`);
		const links = page.getByRole('navigation', { name: 'Site' }).getByRole('link');
		await expect(links).toHaveText(['Members', 'Register']);
		for (const link of await links.all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	});
});

test('the landing page is served at / and its primary button enters the latest sitting', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await page.getByRole('link', { name: 'Enter the chamber' }).click();
	await expect(page).toHaveURL(new RegExp(`/sitting/${DATE}$`));
	await expect(page.getByRole('button', { name: 'Play' })).toHaveCount(1);
});

test.describe('first visit', () => {
	test.slow();

	test('the controls plate says what the page is; dismissals are remembered', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await stage(page);
		const plate = page.getByLabel('Controls', { exact: true });
		await expect(plate).toContainText(`Plenary, ${DATE}. Press Play to start the day; the transcript follows on the right.`);
		await plate.getByRole('button', { name: 'Dismiss controls guide' }).click();
		await page.getByRole('button', { name: 'Dismiss seating notice' }).click();
		expect(await page.evaluate(() => localStorage.getItem('siambr.hud.dismissed'))).toBe('controls,seating');
		await stage(page);
		await expect(page.getByLabel('Controls', { exact: true })).toHaveCount(0);
		await expect(page.getByRole('complementary', { name: 'Provenance' })).toHaveCount(0);
	});

	test('a phone says Play is in the sheet below', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await stage(page);
		await expect(page.getByLabel('Controls', { exact: true })).toContainText('Press Play below');
	});

	test('a kiosk never remembers a dismissal', async ({ page }) => {
		await stage(page, `/sitting/${DATE}?kiosk=1`);
		await page.getByRole('button', { name: 'Dismiss controls guide' }).click();
		expect(await page.evaluate(() => localStorage.getItem('siambr.hud.dismissed'))).toBeNull();
	});
});

test.describe('keyboard entry', () => {
	test.slow();

	test('Tab reaches the skip link first and Play third', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await stage(page);
		await page.keyboard.press('Tab');
		await expect(page.getByRole('link', { name: 'Skip to transport' })).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(page.getByRole('combobox', { name: 'Sitting date' })).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(page.getByRole('button', { name: 'Play' })).toBeFocused();
	});

	test('the skip link lands on Play', async ({ page }) => {
		await stage(page);
		await page.keyboard.press('Tab');
		await page.keyboard.press('Enter');
		await expect(page.getByRole('button', { name: 'Play' })).toBeFocused();
	});

	test('Space and K toggle play on the transport and the transcript body', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await stage(page);
		await page.getByRole('button', { name: 'Play' }).focus();
		await page.keyboard.press('Space');
		await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
		await page.keyboard.press('k');
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
		await page.getByRole('button', { name: 'Next contribution' }).focus();
		await page.keyboard.press('Space');
		await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
		await page.getByRole('group', { name: 'Contribution text' }).focus();
		await page.keyboard.press('Space');
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
		await page.keyboard.press('k');
		await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
	});

	test('the running order is one tab stop, with arrows inside', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await stage(page);
		const order = page.getByRole('navigation', { name: 'Running order' });
		await expect(order.locator('[tabindex="0"]')).toHaveCount(1);
		const before = await order.locator('[tabindex="0"]').getAttribute('data-rove');
		await order.locator('[tabindex="0"]').focus();
		await page.keyboard.press('ArrowDown');
		await expect(order.locator('[tabindex="0"]')).toHaveCount(1);
		await expect(order.locator('[tabindex="0"]')).toBeFocused();
		expect(await order.locator('[tabindex="0"]').getAttribute('data-rove')).not.toBe(before);
	});
});
