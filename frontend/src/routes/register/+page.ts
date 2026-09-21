import { error } from '@sveltejs/kit';
import { loadMembersIndex, loadSittingsIndex } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch, parent }) => {
	try {
		const [{ site: index }, sittings, members] = await Promise.all([parent(), loadSittingsIndex(fetch), loadMembersIndex(fetch)]);
		if (!index) throw new Error('no site index');
		return { index, sittings, members };
	} catch {
		error(502, 'The Register data could not be loaded.');
	}
};
