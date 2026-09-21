import { error } from '@sveltejs/kit';
import { loadMembersIndex } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch, parent }) => {
	try {
		const [{ site: index }, members] = await Promise.all([parent(), loadMembersIndex(fetch)]);
		if (!index) throw new Error('no site index');
		return { index, members };
	} catch {
		error(502, 'The Members data could not be loaded.');
	}
};
