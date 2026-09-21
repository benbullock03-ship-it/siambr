import { error } from '@sveltejs/kit';
import { loadDivisionsIndex, loadIndex } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
	try {
		const [index, divisions] = await Promise.all([loadIndex(fetch), loadDivisionsIndex(fetch)]);
		return { index, divisions };
	} catch {
		error(502, 'The divisions data could not be loaded.');
	}
};
