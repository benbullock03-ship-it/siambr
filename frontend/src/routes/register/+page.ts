import { error } from '@sveltejs/kit';
import { loadIndex, loadMembersIndex, loadSittingsIndex } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
	try {
		const [index, sittings, members] = await Promise.all([loadIndex(fetch), loadSittingsIndex(fetch), loadMembersIndex(fetch)]);
		return { index, sittings, members };
	} catch {
		error(502, 'The Register data could not be loaded.');
	}
};
