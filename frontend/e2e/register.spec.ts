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

test('policy domain filter narrows the register as it changes', async ({ page }) => {
	await page.goto('/register');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Policy domain').selectOption('transport');
	await expect(page).toHaveURL(/domain=transport/);
	await expect(page.getByRole('link', { name: 'Rural Bus Routes' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'NHS Dentistry Waiting Times' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Apply filters' })).toHaveCount(0);
});

test('T-30: a Speaker filter applies with no submit, keeps focus, and survives a reload', async ({ page }) => {
	await page.goto('/register');
	await page.waitForLoadState('networkidle');
	const count = page.locator('.results-count');
	await expect(count).toHaveAttribute('aria-live', 'polite');
	await expect(count).toHaveText(/^\s*2 sittings,\s+3 debates/);
	const speaker = page.getByLabel('Speaker');
	await speaker.focus();
	await speaker.selectOption('ms-john-smith');
	await expect(count).toHaveText(/^\s*1 sitting,\s+1 debate\b/);
	await expect(speaker).toBeFocused();
	await expect(page).toHaveURL(/speaker=ms-john-smith/);
	await page.reload();
	await expect(page.getByLabel('Speaker')).toHaveValue('ms-john-smith');
	await expect(page.locator('.results-count')).toHaveText(/^\s*1 sitting,\s+1 debate\b/);
	await page.getByRole('button', { name: 'Clear filters' }).click();
	await expect(page.locator('.results-count')).toHaveText(/^\s*2 sittings,\s+3 debates/);
	await expect(page).not.toHaveURL(/speaker=/);
});

test('T-30: the text filter keeps its caret while it filters', async ({ page }) => {
	await page.goto('/register');
	await page.waitForLoadState('networkidle');
	const box = page.getByLabel('Search debates');
	await box.click();
	await page.keyboard.type('bus');
	await expect(box).toBeFocused();
	await expect(box).toHaveValue('bus');
	await expect(page).toHaveURL(/q=bus/);
	await expect(page.getByRole('link', { name: 'Rural Bus Routes' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'NHS Dentistry Waiting Times' })).toHaveCount(0);
});

test('T-30: only the newest sitting opens, and a closed one previews its debates', async ({ page }) => {
	await page.goto('/register');
	await page.waitForLoadState('networkidle');
	const cards = page.locator('details.session-card');
	await expect(cards).toHaveCount(2);
	await expect(cards.nth(0)).toHaveAttribute('open', '');
	await expect(cards.nth(1)).not.toHaveAttribute('open', '');
	await expect(cards.nth(1).locator('.session-preview')).toHaveText('Free Prescriptions');
	await expect(cards.nth(0).locator('.session-preview')).toHaveText('NHS Dentistry Waiting Times · Rural Bus Routes');
});

test('T-30: ?item= opens that sitting and scrolls to the item', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 600 });
	await page.goto('/register?item=item-0');
	await expect(page.getByRole('dialog', { name: 'Free Prescriptions' })).toBeVisible();
	const cards = page.locator('details.session-card');
	await expect(cards.nth(1)).toHaveAttribute('open', '');
	await expect(page.locator('#item-link-item-0')).toBeInViewport();
});

test('T-30: phone summary rows wrap to two lines at most with 12 px badges', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/register');
	await page.waitForLoadState('networkidle');
	for (const summary of await page.locator('.session-summary').all()) {
		// Rows of the summary's children, and no child wraps inside itself.
		const lines = await summary.evaluate((el) => {
			const tops: number[] = [];
			for (const child of el.children) {
				const r = child.getBoundingClientRect();
				if (r.height > 40) return 99;
				if (!tops.some((t) => Math.abs(t - r.top) < 12)) tops.push(r.top);
			}
			return tops.length;
		});
		expect(lines).toBeLessThanOrEqual(2);
	}
	const sizes = await page.locator('.pill-badge, .type-badge, .domain-badge').evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
	expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
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

test('a sitting row links to the stage, stats, and every item opens its dossier from JSON alone', async ({ page }) => {
	await page.goto('/register');
	await expect(page.getByRole('link', { name: 'Watch it play' }).first()).toHaveAttribute('href', '/sitting/2026-06-10');
	await expect(page.getByRole('link', { name: 'Session stats →' }).first()).toHaveAttribute('href', '/sitting/2026-06-10/stats');
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
