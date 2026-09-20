import { error } from '@sveltejs/kit';
import { loadIndex, loadMembersIndex } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
	try {
		const [index, members] = await Promise.all([loadIndex(fetch), loadMembersIndex(fetch)]);
		return { index, members };
	} catch {
		error(502, 'The Members data could not be loaded.');
	}
};
