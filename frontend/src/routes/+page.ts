import { redirect } from '@sveltejs/kit';
import { building } from '$app/environment';
import { loadIndex } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const prerender = true;

/** The front door is the latest sitting, paused at its first timed contribution. ?home=1 opens the landing page. */
export const load: PageLoad = async ({ fetch, url }) => {
	const index = await loadIndex(fetch).catch(() => null);
	// The prerendered file cannot read the query; a client-side arrival keeps it.
	const home = !building && url.searchParams.has('home');
	if (!home && index?.latest_sitting) {
		redirect(307, `/sitting/${index.latest_sitting}${building ? '' : url.search}`);
	}
	return { index };
};
