import { error } from '@sveltejs/kit';
import { loadIndex, loadSittingStats } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch, params }) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) error(404, 'No sitting on that date.');
	const stats = await loadSittingStats(fetch, params.date).catch(() => null);
	if (!stats) error(404, 'No sitting on that date.');
	const index = await loadIndex(fetch).catch(() => null);
	return { stats, index };
};
