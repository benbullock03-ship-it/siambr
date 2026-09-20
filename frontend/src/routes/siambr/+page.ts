import { error } from '@sveltejs/kit';
import { loadIndex, loadMembersIndex, loadSitting, loadSittingsIndex, loadTerm } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
	try {
		const index = await loadIndex(fetch);
		const [term, members, sittings, sitting] = await Promise.all([
			loadTerm(fetch, index.current_term),
			loadMembersIndex(fetch),
			loadSittingsIndex(fetch),
			index.latest_sitting ? loadSitting(fetch, index.latest_sitting) : Promise.resolve(null)
		]);
		return { index, term, members, sittings, sitting };
	} catch {
		error(502, 'The chamber data could not be loaded.');
	}
};
