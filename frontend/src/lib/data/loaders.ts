import type {
	MemberFile,
	MemberLight,
	SearchIndexFile,
	SiteIndex,
	Sitting,
	SittingStats,
	SittingSummary,
	TermFile,
	TermStats
} from './types';

type Fetch = typeof fetch;

export class DataError extends Error {
	status: number;

	constructor(status: number, path: string) {
		super(`${status} from ${path}`);
		this.status = status;
	}
}

async function getJson<T>(fetch: Fetch, path: string): Promise<T> {
	const res = await fetch(path);
	if (!res.ok) throw new DataError(res.status, path);
	return res.json() as Promise<T>;
}

const enc = encodeURIComponent;

export const loadIndex = (fetch: Fetch) => getJson<SiteIndex>(fetch, '/data/index.json');
export const loadSittingsIndex = (fetch: Fetch) => getJson<SittingSummary[]>(fetch, '/data/sittings/index.json');
export const loadSitting = (fetch: Fetch, date: string) => getJson<Sitting>(fetch, `/data/sittings/${enc(date)}.json`);
export const loadMembersIndex = (fetch: Fetch) => getJson<MemberLight[]>(fetch, '/data/members/index.json');
export const loadMember = (fetch: Fetch, id: string) => getJson<MemberFile>(fetch, `/data/members/${enc(id)}.json`);
export const loadTerm = (fetch: Fetch, term: number) => getJson<TermFile>(fetch, `/data/terms/${term}.json`);
export const loadSearchIndex = (fetch: Fetch) => getJson<SearchIndexFile>(fetch, '/data/search/index.json');

export function sittingDateForItem(index: SittingSummary[], itemId: string): string | null {
	return index.find((s) => s.items.some((i) => i.id === itemId))?.date ?? null;
}

/** The sitting that holds `itemId`, or null when no sitting file names it. */
export async function loadSittingForItem(fetch: Fetch, index: SittingSummary[], itemId: string): Promise<Sitting | null> {
	const date = sittingDateForItem(index, itemId);
	if (!date) return null;
	const sitting = await loadSitting(fetch, date);
	return sitting.items.some((i) => i.id === itemId) ? sitting : null;
}

export const loadSittingStats = (fetch: Fetch, date: string) => getJson<SittingStats>(fetch, `/data/stats/sittings/${enc(date)}.json`);
export const loadTermStats = (fetch: Fetch, term: number) => getJson<TermStats>(fetch, `/data/stats/terms/${term}.json`);
