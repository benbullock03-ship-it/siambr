import { error } from '@sveltejs/kit';
import { loadTermStats } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch, params, parent }) => {
	const term = Number(params.n);
	if (!Number.isInteger(term) || term < 1 || term > 7) error(404, 'No Senedd term with that number.');
	const stats = await loadTermStats(fetch, term).catch(() => null);
	if (!stats) error(404, 'No Senedd term with that number.');
	const index = (await parent()).site;
	return { stats, index };
};
