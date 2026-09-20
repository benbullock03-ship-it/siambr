import { loadIndex } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
	try {
		return { index: await loadIndex(fetch) };
	} catch {
		return { index: null };
	}
};
