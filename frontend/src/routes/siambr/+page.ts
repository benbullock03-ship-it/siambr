import { error } from '@sveltejs/kit';
import { loadIndex, loadMembersIndex, loadSittingsIndex, loadTerm } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
	try {
		const index = await loadIndex(fetch);
		const [term, members, sittings] = await Promise.all([
			loadTerm(fetch, index.current_term),
			loadMembersIndex(fetch),
			loadSittingsIndex(fetch)
		]);
		return { index, term, members, sittings };
	} catch {
		error(502, 'The chamber data could not be loaded.');
	}
};
