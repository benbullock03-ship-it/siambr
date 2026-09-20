import type { PageLoad } from './$types';

export const prerender = true;

/** The index is fetched lazily by the page, on the first query, so the route itself is a light shell. */
export const load: PageLoad = () => ({});
