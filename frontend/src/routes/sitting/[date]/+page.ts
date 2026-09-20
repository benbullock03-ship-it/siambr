import { error } from '@sveltejs/kit';
import { loadIndex, loadSitting, loadSittingsIndex, loadTerm } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch, params }) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) error(404, 'No sitting on that date.');
	const sitting = await loadSitting(fetch, params.date).catch(() => null);
	if (!sitting) error(404, 'No sitting on that date.');
	try {
		const [index, term, sittings] = await Promise.all([loadIndex(fetch), loadTerm(fetch, sitting.term), loadSittingsIndex(fetch)]);
		return { index, term, members: term.members, sittings, sitting };
	} catch {
		error(502, 'The chamber data could not be loaded.');
	}
};
