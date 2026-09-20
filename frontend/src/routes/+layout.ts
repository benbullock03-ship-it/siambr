import { loadIndex } from '$lib/data/loaders';
import type { LayoutLoad } from './$types';

export const prerender = true;

export const load: LayoutLoad = async ({ fetch }) => {
	try {
		return { site: await loadIndex(fetch) };
	} catch {
		return { site: null };
	}
};
