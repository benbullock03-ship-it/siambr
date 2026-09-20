import { members, terms } from '$lib/api/client';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const [current, allTerms] = await Promise.all([members(fetch, { current: true }), terms(fetch)]);
	const term = allTerms.find((t) => t.end_date === null) ?? allTerms[allTerms.length - 1];
	return { members: current, term };
};
