// T-34 gate: prerendered sitting pages are shells. Run after `npm run build`.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGE_MAX = 250 * 1024;
const INLINED_MAX = 16 * 1024;
const dir = join('build', 'sitting');

const pages = readdirSync(dir).filter((f) => f.endsWith('.html'));
if (pages.length === 0) {
	console.error(`no sitting pages under ${dir}; run npm run build first`);
	process.exit(1);
}

let failures = 0;
let largest = 0;
for (const name of pages) {
	const html = readFileSync(join(dir, name), 'utf8');
	const size = Buffer.byteLength(html);
	largest = Math.max(largest, size);
	if (size > PAGE_MAX) {
		console.error(`${name}: ${size} B, over ${PAGE_MAX}`);
		failures++;
	}
	for (const [block] of html.matchAll(/<script[^>]*data-sveltekit-fetched[^>]*>[\s\S]*?<\/script>/g)) {
		const bytes = Buffer.byteLength(block);
		if (bytes > INLINED_MAX) {
			console.error(`${name}: inlined fetch of ${bytes} B, over ${INLINED_MAX}: ${block.match(/data-url="([^"]*)"/)?.[1] ?? '?'}`);
			failures++;
		}
	}
}

console.log(`${pages.length} sitting pages, largest ${largest} B`);
process.exit(failures ? 1 : 0);
