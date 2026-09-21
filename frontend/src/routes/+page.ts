import type { PageLoad } from './$types';

export const prerender = true;

/** The landing page. The front door stays the latest sitting through its primary button and the brand links. */
export const load: PageLoad = async ({ parent }) => {
	return { index: (await parent()).site };
};
