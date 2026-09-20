// Screenshots the three review vantages (T-23) from a running dev server with headed Chrome,
// so the real GPU draws them. Usage: node scripts/chamber-review.mjs <pass-label> [baseUrl]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const label = process.argv[2] ?? 'pass';
const base = process.argv[3] ?? 'http://127.0.0.1:5176';
const date = process.env.SITTING ?? '2026-09-16';
const out = resolve('../docs/chamber-review');
mkdirSync(out, { recursive: true });

// The three scan-matched poses first (wSTA7sLq856 from a gallery seat, CwNsp65StxL facing the
// dais, 2VhcBCECD73 from the well), then the product vantages and the WebGL2 pair.
const shots = [
	{ name: 'gallery-seat', query: 'pose=3.12,6.25,-15.49,-0.59,3.2,2.94' },
	{ name: 'dais', query: 'pose=0,1.4,2.8,0,1.1,-4.6' },
	{ name: 'well', query: 'pose=0.75,1.35,-2.07,-2.7,0.9,7.5' },
	{ name: 'gallery', query: 'vantage=gallery' },
	{ name: 'llywydd', query: 'vantage=llywydd' },
	{ name: 'floor', query: 'vantage=floor' },
	// Over the shoulder of a second-row desk at bearing 200°, as speakerPose frames it.
	{ name: 'speaker', query: 'pose=-3.6,2.3,8.3,-1.9,0.95,5.2' },
	{ name: 'gallery-webgl2', query: 'vantage=gallery&renderer=webgl2' }
];

const browser = await chromium.launch({
	channel: 'chrome',
	headless: false,
	args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--window-size=1560,1000']
});
const page = await browser.newPage({ viewport: { width: 1518, height: 854 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
for (const s of shots) {
	await page.goto(`${base}/sitting/${date}?t=0&${s.query}`);
	await page.waitForSelector('canvas', { timeout: 60_000 });
	await page.addStyleTag({ content: '.stage > :not(.chamber), .chamber > :not(.canvas) { visibility: hidden !important; }' });
	await page.waitForTimeout(4000);
	const file = resolve(out, `${label}-${s.name}.png`);
	await page.locator('canvas').screenshot({ path: file });
	const backend = await page.evaluate(() => document.querySelector('.engine')?.textContent ?? 'no badge');
	console.log('wrote', file, backend);
}

// Performance gate (T-17, re-checked by T-23): Gallery view, sitting playing, frames over 10 s.
if (process.env.PERF) {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(`${base}/sitting/${date}?vantage=gallery`);
	await page.waitForSelector('canvas', { timeout: 60_000 });
	await page.getByRole('button', { name: 'Play' }).first().click();
	// Shader compilation and the environment build land in the first seconds; the gate is steady state.
	await page.waitForTimeout(6000);
	const stats = await page.evaluate(
		() =>
			new Promise((resolve) => {
				const frames = [];
				let last = performance.now();
				const end = last + 10_000;
				const tick = () => {
					const now = performance.now();
					frames.push(now - last);
					last = now;
					if (now < end) requestAnimationFrame(tick);
					else {
						const sorted = [...frames].sort((a, b) => a - b);
						resolve({
							frames: frames.length,
							fps: frames.length / 10,
							median: sorted[Math.floor(sorted.length / 2)],
							p95: sorted[Math.floor(sorted.length * 0.95)],
							max: Math.max(...frames),
							over33: frames.filter((f) => f > 33.4).length
						});
					}
				};
				requestAnimationFrame(tick);
			})
	);
	console.log('perf', JSON.stringify(stats));
}
await browser.close();
