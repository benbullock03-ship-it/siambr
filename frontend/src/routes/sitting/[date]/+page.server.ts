import { error } from '@sveltejs/kit';
import type { SittingSummary } from '$lib/data/types';
import type { PageServerLoad } from './$types';

export const prerender = true;

/**
 * Build time only. The page is a shell: this data is what enters the HTML, and the Stage
 * fetches the sitting and its term in the browser.
 */
export const load: PageServerLoad = async ({ fetch, params }) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) error(404, 'No sitting on that date.');
	const res = await fetch('/data/sittings/index.json');
	if (!res.ok) error(502, 'The chamber data could not be loaded.');
	const sittings = (await res.json()) as SittingSummary[];
	const s = sittings.find((x) => x.date === params.date);
	if (!s) error(404, 'No sitting on that date.');
	return {
		summary: { date: s.date, term: s.term, title_en: s.title_en, title_cy: s.title_cy },
		dates: sittings.map((x) => x.date)
	};
};
