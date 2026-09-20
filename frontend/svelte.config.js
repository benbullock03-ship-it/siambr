import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// Playwright points SIAMBR_STATIC_DIR at a fixture export so /data/* comes from there, in SSR and the browser alike.
		files: { assets: process.env.SIAMBR_STATIC_DIR ?? 'static' },
		// No server at runtime: every route is prerendered or served from the SPA fallback.
		adapter: adapter({ fallback: '404.html' }),
		prerender: {
			entries: ['/', '/register', '/members', '/siambr'],
			// /sitting/{date} links are written now; the route arrives with T-18. Drop this filter then.
			handleHttpError: ({ path, message }) => {
				if (path.startsWith('/sitting/')) return;
				throw new Error(message);
			}
		}
	}
};

export default config;
