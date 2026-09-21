import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * T-24 accessibility gate: axe WCAG 2.2 AA on every route and both drawers, desktop and phone
 * for the stage, plus a reduced-motion run of the Register that must request no three.js chunk.
 * Runs alone with `npm run test:a11y`.
 */

const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
/** The fixture export's latest sitting and its term. */
const DATE = '2026-06-10';
const TERM = 7;
const MEMBER = 'ms-jane-doe';

async function violations(page: Page) {
	await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
	return (await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze()).violations;
}

async function settled(page: Page) {
	await page.waitForLoadState('networkidle');
}

const STATIC_ROUTES: [string, RegExp][] = [
	['/register', /Plenary Register/],
	['/members', /Members of the Senedd/],
	[`/members/${MEMBER}`, /Jane Doe/],
	['/search', /Search contributions/],
	['/divisions', /Divisions/],
	[`/sitting/${DATE}/stats`, /Speaking time on/],
	[`/terms/${TERM}/stats`, /Speaking time in/]
];

test.describe('@a11y register routes', () => {
	for (const [route, heading] of STATIC_ROUTES) {
		test(`${route} passes axe`, async ({ page }) => {
			await page.goto(route);
			await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
			await settled(page);
			expect(await violations(page)).toEqual([]);
		});
	}

	test('/divisions passes axe at 390 px as cards', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/divisions');
		await expect(page.getByRole('heading', { level: 1, name: 'Divisions' })).toBeVisible();
		await settled(page);
		expect(await violations(page)).toEqual([]);
	});

	test('the dossier drawer open on /register passes axe', async ({ page }) => {
		await page.goto('/register?item=item-1');
		const dialog = page.getByRole('dialog', { name: 'NHS Dentistry Waiting Times' });
		await expect(dialog).toBeVisible();
		await settled(page);
		expect(await violations(page)).toEqual([]);
	});
});

test.describe('@a11y stage', () => {
	// A cold Vite compiles three.js on the first stage hit.
	test.slow();

	test('the landing page, the Guide and the stage HUD pass axe at desktop width', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await settled(page);
		expect(await violations(page)).toEqual([]);
		await page.goto('/?guide=1');
		const guide = page.getByRole('dialog', { name: 'How to explore the Senedd' });
		await expect(guide).toBeVisible();
		expect(await violations(page)).toEqual([]);
		await guide.getByRole('link', { name: 'Enter the Chamber' }).click();
		await expect(page).toHaveURL(new RegExp(`/sitting/${DATE}$`));
		await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 });
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
		// The fixture sitting has a stream, so the screen audio toggle and its credit are in the HUD (T-33).
		await expect(page.getByRole('button', { name: 'Mute' })).toHaveAttribute('aria-pressed', 'false');
		await expect(page.getByText('© Senedd Commission · Senedd TV')).toBeVisible();
		await expect(page.getByRole('button', { name: 'As spoken' })).toHaveAttribute('aria-pressed', 'false');
		expect(await violations(page)).toEqual([]);
	});

	test('the stage HUD passes axe at phone width with each sheet tab', async ({ page }) => {
		await page.setViewportSize({ width: 360, height: 740 });
		await page.goto(`/sitting/${DATE}`);
		await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 });
		await expect(page.getByRole('tab', { name: 'Transcript' })).toBeVisible();
		await settled(page);
		expect(await violations(page)).toEqual([]);
		await page.getByRole('tab', { name: 'Running order' }).click();
		await expect(page.getByRole('navigation', { name: 'Running order' })).toBeVisible();
		expect(await violations(page)).toEqual([]);
	});

	test('the Member drawer open on the stage passes axe', async ({ page }) => {
		await page.goto(`/sitting/${DATE}?member=${MEMBER}`);
		const dialog = page.getByRole('dialog', { name: /Jane Doe/ });
		await expect(dialog).toBeVisible({ timeout: 30_000 });
		await expect(dialog.getByText('Counted by Siambr', { exact: false })).toBeVisible();
		expect(await violations(page)).toEqual([]);
	});

	test('the division plate on the stage passes axe', async ({ page }) => {
		await page.goto(`/sitting/${DATE}?item=item-1`);
		await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 });
		await page.getByRole('navigation', { name: 'Running order' }).getByRole('button', { name: /^Vote/ }).first().click();
		const transcript = page.getByRole('region', { name: 'Transcript' });
		await expect(transcript.getByText('Unlit desk: did not vote')).toBeVisible();
		await expect(transcript.locator('section.division')).toBeVisible();
		expect(await violations(page)).toEqual([]);
	});
});

test.describe('@a11y reduced motion', () => {
	for (const route of ['/register', '/members', `/members/${MEMBER}`, '/search', `/sitting/${DATE}/stats`]) {
		test(`${route} loads no three.js under prefers-reduced-motion`, async ({ page }) => {
			const scripts: string[] = [];
			page.on('request', (req) => {
				if (req.resourceType() === 'script' || req.resourceType() === 'fetch') scripts.push(new URL(req.url()).pathname);
			});
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.goto(route);
			await settled(page);
			expect(await page.locator('canvas').count()).toBe(0);
			expect(scripts.filter((p) => /three|threlte/i.test(p))).toEqual([]);
			expect(await violations(page)).toEqual([]);
		});
	}
});
