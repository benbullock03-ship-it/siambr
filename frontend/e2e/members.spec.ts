import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function violations(page: Page) {
	await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
	return (await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze()).violations;
}

test('the Members index lists the current term by party and links each Member page', async ({ page }) => {
	await page.goto('/members');
	await expect(page.getByRole('heading', { level: 1, name: 'Members of the Senedd' })).toBeVisible();
	const jane = page.getByRole('link', { name: 'Jane Doe' });
	await expect(jane).toHaveAttribute('href', '/members/ms-jane-doe');
	await page.getByLabel('Search by name').fill('smith');
	await expect(page.getByRole('link', { name: 'Jane Doe' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'John Smith' })).toBeVisible();
	expect(await violations(page)).toEqual([]);
});

test('a postcode finds the constituency Members, and a non-Welsh postcode says so', async ({ page }) => {
	await page.route('https://api.postcodes.io/postcodes/*', async (route) => {
		const pc = route.request().url().split('/').pop();
		if (pc === 'SW1A1AA') {
			return route.fulfill({ json: { status: 200, result: { country: 'England', senedd_constituency: null, region: 'London', codes: {} } } });
		}
		if (pc === 'ZZ99ZZ') return route.fulfill({ status: 404, json: { status: 404, error: 'Postcode not found' } });
		const members = (await (await page.request.get('/data/members/index.json')).json()) as { constituency_name_en: string }[];
		return route.fulfill({ json: { status: 200, result: { country: 'Wales', senedd_constituency: members[0].constituency_name_en, region: null, codes: {} } } });
	});
	await page.goto('/members');
	await page.waitForLoadState('networkidle');
	const field = page.getByLabel('Find your Member by postcode');
	await field.fill('CF99 1SN');
	await page.getByRole('button', { name: 'Find' }).click();
	await expect(page.getByRole('heading', { level: 2, name: /.+/ }).first()).toBeVisible();
	await expect(page.locator('.found').getByRole('link').first()).toBeVisible();

	await field.fill('SW1A 1AA');
	await page.getByRole('button', { name: 'Find' }).click();
	await expect(page.getByRole('alert')).toHaveText(/outside Wales/);

	await field.fill('ZZ9 9ZZ');
	await page.getByRole('button', { name: 'Find' }).click();
	await expect(page.getByRole('alert')).toHaveText(/not on record/);
});

test('a Member page is the register of record with chamber links, and passes axe', async ({ page }) => {
	await page.goto('/members/ms-jane-doe');
	await expect(page.getByRole('heading', { level: 1, name: /Jane Doe/ })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Contributions, by sitting day' })).toBeVisible();
	await expect(page.getByText('NHS dentistry waiting lists in Wales remain unacceptably long.')).toBeVisible();
	const chamber = page.getByRole('link', { name: 'See it in the chamber' }).first();
	await expect(chamber).toHaveAttribute('href', /\/sitting\/\d{4}-\d{2}-\d{2}\?t=\d+/);
	// No script on this page: "Read in full" is a checkbox that lifts a CSS clamp.
	const reveal = page.getByRole('checkbox', { name: 'Read in full' }).first();
	const quote = page.locator('.speeches blockquote p').first();
	const clampedHeight = (await quote.boundingBox())!.height;
	await reveal.check();
	expect((await quote.boundingBox())!.height).toBeGreaterThanOrEqual(clampedHeight);
	await expect(reveal).toBeChecked();
	await expect(page.getByRole('heading', { name: 'Roll-call divisions, by sitting day' })).toBeVisible();
	await expect(page.getByText('Counted by Siambr', { exact: false })).toBeVisible();
	await expect(page.locator('.rows .chip', { hasText: 'For' }).first()).toBeVisible();
	await expect(page.getByRole('link', { name: 'Watch it in the chamber' }).first()).toHaveAttribute('href', /\/sitting\/\d{4}-\d{2}-\d{2}\?item=/);
	await expect(page.getByRole('link', { name: 'Official Senedd profile' }).first()).toHaveAttribute('href', 'https://senedd.wales/people/jane-doe/');
	expect(await violations(page)).toEqual([]);
});

test('an unknown Member id is a 404', async ({ page }) => {
	const res = await page.goto('/members/ms-nobody-here');
	expect(res?.status()).toBe(404);
});

test('the Register carries Watch it play per item and the record stamp per sitting', async ({ page }) => {
	await page.goto('/register');
	await expect(page.getByText(/Record publi(shed|cation time not stated)/).first()).toBeVisible();
	const first = page.getByRole('link', { name: 'Watch it play' }).nth(1);
	await expect(first).toHaveAttribute('href', /\/sitting\/2026-06-10\?item=/);
	expect(await violations(page)).toEqual([]);
});

test('search finds a verbatim passage and links to the Register item and the stage moment', async ({ page }) => {
	await page.goto('/search');
	await page.waitForLoadState('networkidle');
	expect(await violations(page)).toEqual([]);
	await page.getByLabel('Search words, a Member or an item title').fill('dentistry');
	await page.getByRole('button', { name: 'Search' }).click();
	const results = page.getByRole('list').filter({ has: page.locator('mark') });
	await expect(results.locator('mark').first()).toHaveText(/dentistry/i, { timeout: 15_000 });
	await expect(page.getByRole('link', { name: 'See it in the chamber' }).first()).toHaveAttribute('href', /\/sitting\/\d{4}-\d{2}-\d{2}\?(t=\d+|item=)/);
	await expect(page.getByRole('link', { name: 'Register item' }).first()).toHaveAttribute('href', /\/register\?item=/);
	await expect(page).toHaveURL(/\?q=dentistry/);
	expect(await violations(page)).toEqual([]);

	await page.getByLabel('Search words, a Member or an item title').fill('zqxjvwk');
	await page.getByRole('button', { name: 'Search' }).click();
	await expect(page.getByText(/No contribution on record matches/)).toBeVisible();
});

test('member page speech links deep-link directly to highlighted speech in register', async ({ page }) => {
	await page.goto('/members/ms-jane-doe');
	const speechLink = page.locator('.where a').first();
	await expect(speechLink).toBeVisible();
	const href = await speechLink.getAttribute('href');
	expect(href).toMatch(/\/register\?item=.+&speech=.+/);

	await speechLink.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	const targetSpeech = dialog.locator('.target-speech');
	await expect(targetSpeech).toBeVisible();
	await expect(targetSpeech.locator('.target-badge')).toHaveText(/Selected Contribution/);
	expect(await violations(page)).toEqual([]);
});

test('global navigation header and onboarding guide modal are accessible', async ({ page }) => {
	await page.goto('/register');
	await page.waitForLoadState('networkidle');
	const header = page.getByRole('banner');
	await expect(header).toBeVisible();
	await expect(header.getByRole('link', { name: 'Chamber Stage' })).toBeVisible();
	await expect(header.getByRole('link', { name: 'Members' })).toBeVisible();

	const guideBtn = header.getByRole('button', { name: 'Guide' });
	await expect(guideBtn).toBeVisible();
	await guideBtn.click();

	const modal = page.getByRole('dialog', { name: /How to explore the Senedd/ });
	await expect(modal).toBeVisible();
	await expect(modal.getByText(/The Chamber Stage/)).toBeVisible();
	await expect(modal.getByText(/Find Your Member/)).toBeVisible();
	await expect(modal.getByText(/Quoted Word for Word/)).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(modal).toBeHidden();
	expect(await violations(page)).toEqual([]);
});
