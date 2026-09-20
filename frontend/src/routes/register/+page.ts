import { error } from '@sveltejs/kit';
import { members, policyDomains, sessions } from '$lib/api/client';
import { parseFilters } from '$lib/register/labels';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url }) => {
	const filters = parseFilters(url.searchParams);
	try {
		const [sessionList, domains, memberList] = await Promise.all([
			sessions(fetch, filters),
			policyDomains(fetch),
			members(fetch)
		]);
		return { filters, sessions: sessionList, domains, members: memberList };
	} catch {
		error(502, 'The Siambr API is unavailable.');
	}
};
