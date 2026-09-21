// Writes the favicon suite and logo lockups from one geometry. Usage: node scripts/brand.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const INK_ROOM = '#111417';
const INK = '#16191D';
const GROUND = '#F7F6F2';
const PLUM = '#C9187E';

const out = resolve('static');
const brand = resolve('static/brand');
mkdirSync(brand, { recursive: true });

const arc = (r, a0, a1) => {
	const p = (a) => [32 + r * Math.sin((a * Math.PI) / 180), 35 - r * Math.cos((a * Math.PI) / 180)];
	const [x0, y0] = p(a0);
	const [x1, y1] = p(a1);
	return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};
// Two tiers of desks seen from above, open towards the Llywydd; one desk on the back tier lit.
const TIERS = `${arc(22, -130, 22)}${arc(22, 68, 130)}${arc(12, -130, 130)}`;
const LIT = arc(22, 28, 62);

const svg = (inner, style = '') =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${style}${inner}</svg>`;
const mark = (tiers, scale = 1) => {
	const body = `<g fill="none" stroke-width="7"><path d="${TIERS}" stroke="${tiers}"/><path d="${LIT}" stroke="${PLUM}"/></g>`;
	return scale === 1 ? body : `<g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${body}</g>`;
};
const tile = (scale) => svg(`<rect width="64" height="64" fill="${INK_ROOM}"/>${mark(GROUND, scale)}`);

// Transparent, so the tiers follow the browser's colour scheme.
const favicon = svg(
	`<g fill="none" stroke-width="7"><path class="tiers" d="${TIERS}"/><path d="${LIT}" stroke="${PLUM}"/></g>`,
	`<style>.tiers{stroke:${INK}}@media (prefers-color-scheme:dark){.tiers{stroke:${GROUND}}}</style>`
);
writeFileSync(`${out}/favicon.svg`, favicon + '\n');
writeFileSync(`${brand}/mark.svg`, svg(mark(INK)) + '\n');
writeFileSync(`${brand}/mark-on-dark.svg`, svg(mark(GROUND)) + '\n');

const font = (pkg, file) =>
	`data:font/woff2;base64,${readFileSync(resolve(`node_modules/@fontsource/${pkg}/files/${file}`)).toString('base64')}`;
const fonts = `@font-face{font-family:Lora;font-weight:600;src:url(${font('lora', 'lora-latin-600-normal.woff2')})}
@font-face{font-family:'DM Sans';font-weight:700;src:url(${font('dm-sans', 'dm-sans-latin-700-normal.woff2')})}`;
const lockup = (fg, sub, tiers) => `<style>${fonts}
body{margin:0}#l{display:inline-flex;align-items:center;gap:22px;padding:24px}
svg{width:112px;height:112px}b{display:block;font:600 84px/0.95 Lora;color:${fg};letter-spacing:-0.01em}
i{display:block;margin-top:10px;font:700 17px 'DM Sans';font-style:normal;letter-spacing:0.14em;text-transform:uppercase;color:${sub}}</style>
<div id="l">${svg(mark(tiers))}<div><b>Siambr</b><i>Senedd Cymru</i></div></div>`;

const browser = await chromium.launch();
const page = await browser.newPage();

async function png(source, size) {
	await page.setViewportSize({ width: size, height: size });
	await page.setContent(`<body style="margin:0">${source.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
	return page.screenshot({ clip: { x: 0, y: 0, width: size, height: size }, omitBackground: true });
}

// Home-screen icons stay opaque: iOS and Android fill transparency with their own colour.
writeFileSync(`${out}/apple-touch-icon.png`, await png(tile(0.86), 180));
writeFileSync(`${out}/icon-192.png`, await png(svg(mark(INK)), 192));
writeFileSync(`${out}/icon-512.png`, await png(svg(mark(INK)), 512));
// Maskable icons are cropped to a centred circle of 80% width.
writeFileSync(`${out}/icon-maskable-512.png`, await png(tile(0.72), 512));

// ICO entries may hold PNG data directly (Vista+).
const sizes = [16, 32, 48];
const images = [];
for (const s of sizes) images.push(await png(svg(mark(INK)), s));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
	const e = 6 + 16 * i;
	header.writeUInt8(s, e);
	header.writeUInt8(s, e + 1);
	header.writeUInt16LE(1, e + 4);
	header.writeUInt16LE(32, e + 6);
	header.writeUInt32LE(images[i].length, e + 8);
	header.writeUInt32LE(offset, e + 12);
	offset += images[i].length;
});
writeFileSync(`${out}/favicon.ico`, Buffer.concat([header, ...images]));

const retina = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 800, height: 300 } });
for (const [name, fg, sub, tiers] of [
	['logo', INK, '#65717C', INK],
	['logo-on-dark', GROUND, '#A7B0B8', GROUND]
]) {
	await retina.setContent(lockup(fg, sub, tiers));
	await retina.evaluate(() => document.fonts.ready);
	await retina.locator('#l').screenshot({ path: `${brand}/${name}.png`, omitBackground: true });
}

await browser.close();
