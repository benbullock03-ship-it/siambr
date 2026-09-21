import { describe, expect, it, vi } from 'vitest';
import { createDataStore, DataError } from './loaders';

function fakeFetch(fail: Set<string> = new Set()) {
	const calls: string[] = [];
	const fn = vi.fn(async (input: RequestInfo | URL) => {
		const path = String(input);
		calls.push(path);
		if (fail.has(path)) return new Response('', { status: 404 });
		const term = path.match(/sittings\/(\d{4})-/) ? 7 : undefined;
		return new Response(JSON.stringify({ path, term, items: [] }), { status: 200 });
	});
	return { fetch: fn as unknown as typeof fetch, calls };
}

describe('data store in the browser', () => {
	it('fetches each path once, however many callers ask', async () => {
		const store = createDataStore(true);
		const { fetch, calls } = fakeFetch();
		await Promise.all([store.loadIndex(fetch), store.loadIndex(fetch)]);
		await store.loadIndex(fetch);
		expect(calls).toEqual(['/data/index.json']);
	});

	it('keeps the last three sittings, least recently used out first', async () => {
		const store = createDataStore(true);
		const { fetch, calls } = fakeFetch();
		for (const d of ['2026-07-01', '2026-07-07', '2026-07-08']) await store.loadSitting(fetch, d);
		await store.loadSitting(fetch, '2026-07-01');
		await store.loadSitting(fetch, '2026-07-14');
		await store.loadSitting(fetch, '2026-07-01');
		await store.loadSitting(fetch, '2026-07-07');
		expect(calls.filter((c) => c.endsWith('2026-07-01.json'))).toHaveLength(1);
		expect(calls.filter((c) => c.endsWith('2026-07-07.json'))).toHaveLength(2);
	});

	it('drops a failed fetch so the next call retries', async () => {
		const store = createDataStore(true);
		const fail = new Set(['/data/sittings/2026-07-01.json']);
		const { fetch, calls } = fakeFetch(fail);
		await expect(store.loadSitting(fetch, '2026-07-01')).rejects.toBeInstanceOf(DataError);
		fail.clear();
		await store.loadSitting(fetch, '2026-07-01');
		expect(calls).toHaveLength(2);
	});

	it('never holds the search index', async () => {
		const store = createDataStore(true);
		const { fetch, calls } = fakeFetch();
		await store.loadSearchIndex(fetch);
		await store.loadSearchIndex(fetch);
		expect(calls).toHaveLength(2);
	});

	it('loads the Stage sitting with its term, both through the cache', async () => {
		const store = createDataStore(true);
		const { fetch, calls } = fakeFetch();
		await store.loadStage(fetch, '2026-07-14');
		await store.loadStage(fetch, '2026-07-14');
		expect(calls).toEqual(['/data/sittings/2026-07-14.json', '/data/terms/7.json']);
	});
});

describe('data store during prerender', () => {
	it('caches nothing, so each page inlines what it fetched', async () => {
		const store = createDataStore(false);
		const { fetch, calls } = fakeFetch();
		await store.loadIndex(fetch);
		await store.loadIndex(fetch);
		expect(calls).toHaveLength(2);
	});
});
