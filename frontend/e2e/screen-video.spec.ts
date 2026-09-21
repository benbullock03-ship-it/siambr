import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// The fixture export gives this sitting a stream on the CDN host, which is routed here and never fetched.
const DATE = '2026-06-10';
const MASTER = readFileSync(resolve('../tests/fixtures/senedd_tv_16086_master.m3u8'), 'utf8');
const VARIANT = readFileSync(resolve('../tests/fixtures/senedd_tv_16086_variant.m3u8'), 'utf8');

const HLS_MODULE = /hls[._]js|hls__js/i;
const CDN = /vustreams\.com/;

async function watch(page: Page): Promise<string[]> {
	const requests: string[] = [];
	page.on('request', (r) => requests.push(r.url()));
	await page.route(CDN, (route) => {
		const url = route.request().url();
		if (url.includes('interpretation.m3u8')) return route.fulfill({ body: MASTER, contentType: 'application/vnd.apple.mpegurl', headers: { 'access-control-allow-origin': '*' } });
		if (url.includes('.m3u8')) return route.fulfill({ body: VARIANT, contentType: 'application/vnd.apple.mpegurl', headers: { 'access-control-allow-origin': '*' } });
		return route.abort();
	});
	return requests;
}

async function playFor(page: Page, path: string) {
	await page.goto(path);
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 20_000 });
	await page.getByRole('button', { name: 'Play' }).first().click();
	await expect(page.getByRole('button', { name: 'Pause' }).first()).toBeVisible();
	await page.waitForTimeout(3_000);
}

test('desktop loads nothing before Play, then the 360p stream', async ({ page }) => {
	const requests = await watch(page);
	await page.goto(`/sitting/${DATE}`);
	await expect(page.locator('canvas')).toHaveCount(1, { timeout: 20_000 });
	await page.waitForTimeout(2_000);
	expect(requests.filter((u) => CDN.test(u) || HLS_MODULE.test(u))).toEqual([]);

	await page.getByRole('button', { name: 'Play' }).click();
	await expect.poll(() => requests.filter((u) => CDN.test(u)), { timeout: 10_000 }).toContainEqual(expect.stringContaining('video=499968.m3u8'));
	expect(requests.some((u) => /video=(1299968|2499968)/.test(u))).toBe(false);
});

test('/register requests no hls.js', async ({ page }) => {
	const requests = await watch(page);
	await page.goto('/register');
	await expect(page.getByRole('heading', { name: 'Plenary Register' })).toBeVisible();
	await page.waitForTimeout(1_000);
	expect(requests.filter((u) => HLS_MODULE.test(u) || CDN.test(u))).toEqual([]);
});

test('phone viewport plays with no video', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const requests = await watch(page);
	await playFor(page, `/sitting/${DATE}`);
	expect(requests.filter((u) => HLS_MODULE.test(u) || CDN.test(u))).toEqual([]);
});

test('reduced motion plays with no video', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const requests = await watch(page);
	await playFor(page, `/sitting/${DATE}`);
	expect(requests.filter((u) => HLS_MODULE.test(u) || CDN.test(u))).toEqual([]);
});

test('?kiosk=1 plays with no video', async ({ page }) => {
	const requests = await watch(page);
	await playFor(page, `/sitting/${DATE}?kiosk=1`);
	expect(requests.filter((u) => HLS_MODULE.test(u) || CDN.test(u))).toEqual([]);
});
