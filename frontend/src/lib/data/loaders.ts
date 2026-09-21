import { browser } from '$app/environment';
import type {
	DivisionRow,
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

/** How many files of a kind stay parsed in memory; `Infinity` for the small indexes, 0 for never. */
type Kind = 'index' | 'sitting' | 'term' | 'member' | 'stats' | 'search';
const KEEP: Record<Kind, number> = { index: Infinity, sitting: 3, term: 3, member: 3, stats: 3, search: 0 };

/**
 * Every route loads data through one store. In the browser it keeps one promise per path, so
 * concurrent callers share a fetch and a revisit reuses the parse. During prerender it caches
 * nothing: SvelteKit inlines only what each page's own `fetch` requested.
 */
export function createDataStore(enabled: boolean) {
	const held = new Map<string, { kind: Kind; value: Promise<unknown> }>();

	function evict(kind: Kind) {
		const same = [...held].filter(([, e]) => e.kind === kind);
		for (let i = 0; i < same.length - KEEP[kind]; i++) held.delete(same[i][0]);
	}

	function get<T>(fetch: Fetch, kind: Kind, path: string): Promise<T> {
		const hit = held.get(path);
		if (hit) {
			held.delete(path);
			held.set(path, hit);
			return hit.value as Promise<T>;
		}
		const value = fetch(path).then((res) => {
			if (!res.ok) throw new DataError(res.status, path);
			return res.json() as Promise<T>;
		});
		if (!enabled || KEEP[kind] === 0) return value;
		held.set(path, { kind, value });
		value.catch(() => held.get(path)?.value === value && held.delete(path));
		evict(kind);
		return value;
	}

	const enc = encodeURIComponent;
	const loadSitting = (fetch: Fetch, date: string) => get<Sitting>(fetch, 'sitting', `/data/sittings/${enc(date)}.json`);

	return {
		loadIndex: (fetch: Fetch) => get<SiteIndex>(fetch, 'index', '/data/index.json'),
		loadSittingsIndex: (fetch: Fetch) => get<SittingSummary[]>(fetch, 'index', '/data/sittings/index.json'),
		loadSitting,
		loadMembersIndex: (fetch: Fetch) => get<MemberLight[]>(fetch, 'index', '/data/members/index.json'),
		loadMember: (fetch: Fetch, id: string) => get<MemberFile>(fetch, 'member', `/data/members/${enc(id)}.json`),
		loadTerm: (fetch: Fetch, term: number) => get<TermFile>(fetch, 'term', `/data/terms/${term}.json`),
		loadDivisionsIndex: (fetch: Fetch) => get<DivisionRow[]>(fetch, 'index', '/data/divisions/index.json'),
		loadSearchIndex: (fetch: Fetch) => get<SearchIndexFile>(fetch, 'search', '/data/search/index.json'),
		loadSittingStats: (fetch: Fetch, date: string) => get<SittingStats>(fetch, 'stats', `/data/stats/sittings/${enc(date)}.json`),
		loadTermStats: (fetch: Fetch, term: number) => get<TermStats>(fetch, 'stats', `/data/stats/terms/${term}.json`),

		/** The sitting and its term, as the Stage needs them. */
		async loadStage(fetch: Fetch, date: string): Promise<{ sitting: Sitting; term: TermFile }> {
			const sitting = await loadSitting(fetch, date);
			return { sitting, term: await get<TermFile>(fetch, 'term', `/data/terms/${sitting.term}.json`) };
		},

		/** The sitting that holds `itemId`, or null when no sitting file names it. */
		async loadSittingForItem(fetch: Fetch, index: SittingSummary[], itemId: string): Promise<Sitting | null> {
			const date = sittingDateForItem(index, itemId);
			if (!date) return null;
			const sitting = await loadSitting(fetch, date);
			return sitting.items.some((i) => i.id === itemId) ? sitting : null;
		}
	};
}

export function sittingDateForItem(index: SittingSummary[], itemId: string): string | null {
	return index.find((s) => s.items.some((i) => i.id === itemId))?.date ?? null;
}

export const {
	loadIndex,
	loadSittingsIndex,
	loadSitting,
	loadMembersIndex,
	loadMember,
	loadTerm,
	loadDivisionsIndex,
	loadSearchIndex,
	loadSittingStats,
	loadTermStats,
	loadStage,
	loadSittingForItem
} = createDataStore(browser);
