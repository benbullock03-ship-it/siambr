import { error } from '@sveltejs/kit';
import { loadIndex, loadMember } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const prerender = true;
// The register of record is plain HTML: no hydration, so a Member with hundreds of contributions loads light.
export const csr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	if (!/^[a-z0-9-]+$/.test(params.id)) error(404, 'No Member with that id.');
	const record = await loadMember(fetch, params.id).catch(() => null);
	if (!record) error(404, 'No Member with that id.');
	const index = await loadIndex(fetch).catch(() => null);
	return { record, index };
};
