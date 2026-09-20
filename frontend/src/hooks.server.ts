import { env } from '$env/dynamic/private';
import type { HandleFetch } from '@sveltejs/kit';

// SSR fetches of /api/* hit SvelteKit itself, not the Vite proxy, so route them to FastAPI here.
export const handleFetch: HandleFetch = async ({ request, fetch, event }) => {
	const url = new URL(request.url);
	if (url.origin === event.url.origin && url.pathname.startsWith('/api/')) {
		const origin = env.API_ORIGIN ?? 'http://127.0.0.1:8000';
		return fetch(new Request(`${origin}${url.pathname}${url.search}`, request));
	}
	return fetch(request);
};
