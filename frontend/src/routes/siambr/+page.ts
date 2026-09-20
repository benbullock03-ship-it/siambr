import { redirect } from '@sveltejs/kit';
import { building } from '$app/environment';
import type { PageLoad } from './$types';

export const prerender = true;

/** The old chamber address; the stage lives at /sitting/{date} and / picks the latest. */
export const load: PageLoad = ({ url }) => {
	redirect(307, `/${building ? '' : url.search}`);
};
