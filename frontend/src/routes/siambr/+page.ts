import { redirect } from '@sveltejs/kit';
import { building } from '$app/environment';
import { loadIndex } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const prerender = true;

/** The old chamber address; the stage lives at /sitting/{date}. */
export const load: PageLoad = async ({ fetch, url }) => {
	const index = await loadIndex(fetch).catch(() => null);
	redirect(307, index?.latest_sitting ? `/sitting/${index.latest_sitting}${building ? '' : url.search}` : '/');
};
