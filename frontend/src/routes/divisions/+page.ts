import { error } from '@sveltejs/kit';
import { loadDivisionsIndex } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch, parent }) => {
	try {
		const [{ site: index }, divisions] = await Promise.all([parent(), loadDivisionsIndex(fetch)]);
		if (!index) throw new Error('no site index');
		return { index, divisions };
	} catch {
		error(502, 'The divisions data could not be loaded.');
	}
};
