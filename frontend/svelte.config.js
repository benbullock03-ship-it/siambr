import adapter from '@sveltejs/adapter-static';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const staticDir = process.env.SIAMBR_STATIC_DIR ?? 'static';
/** Every exported sitting gets its own prerendered /sitting/{date} page; the SPA fallback covers any other date. */
function sittingEntries() {
	const index = join(staticDir, 'data', 'sittings', 'index.json');
	if (!existsSync(index)) return [];
	return JSON.parse(readFileSync(index, 'utf-8')).map((s) => `/sitting/${s.date}`);
}
/** Every exported Member file, current and former, gets a prerendered /members/{id}. */
function memberEntries() {
	const dir = join(staticDir, 'data', 'members');
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith('.json') && f !== 'index.json')
		.map((f) => `/members/${f.slice(0, -5)}`);
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// Playwright points SIAMBR_STATIC_DIR at a fixture export so /data/* comes from there, in SSR and the browser alike.
		files: { assets: staticDir },
		// No server at runtime: every route is prerendered or served from the SPA fallback.
		adapter: adapter({ fallback: '404.html' }),
		prerender: {
			entries: ['/', '/register', '/members', '/search', '/siambr', ...sittingEntries(), ...memberEntries()]
		}
	}
};

export default config;
