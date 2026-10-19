<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { afterNavigate, replaceState } from '$app/navigation';
	import type MiniSearch from 'minisearch';
	import { loadSearchIndex, loadSittingsIndex } from '$lib/data/loaders';
	import { BADGE } from '$lib/data/provenance';
	import type { SearchDocument } from '$lib/data/types';
	import ExternalLink from '$lib/hud/ExternalLink.svelte';
	import { itemTitle } from '$lib/stage/votes';

	type Hit = SearchDocument & { terms: string[] };
	type Engine = MiniSearch<SearchDocument>;

	let query = $state(browser ? (page.url.searchParams.get('q') ?? '') : '');
	let engine = $state<Engine | null>(null);
	let loading = $state(false);
	let failed = $state(false);
	let hits = $state<Hit[]>([]);
	let recordByDate = $state<Record<string, string | null>>({});
	let searched = $state('');
	const LIMIT = 50;

	async function ensureEngine(): Promise<Engine | null> {
		if (engine) return engine;
		if (loading) return null;
		loading = true;
		try {
			const [{ default: MiniSearch }, file, sittings] = await Promise.all([
				import('minisearch'),
				loadSearchIndex(fetch),
				loadSittingsIndex(fetch)
			]);
			recordByDate = Object.fromEntries(sittings.map((s) => [s.date, s.record_page_url]));
			const built = new MiniSearch<SearchDocument>({
				fields: file.fields,
				storeFields: file.store_fields,
				searchOptions: { prefix: true, fuzzy: 0.15, boost: { member: 2, item: 1.5 } }
			});
			built.addAll(file.documents);
			engine = built;
			return built;
		} catch {
			failed = true;
			return null;
		} finally {
			loading = false;
		}
	}

	async function run() {
		const q = query.trim();
		searched = q;
		if (browser) {
			const url = new URL(page.url);
			if (q) url.searchParams.set('q', q);
			else url.searchParams.delete('q');
			// A ?q= arrival already carries the query, and the router may not be started yet.
			if (url.search !== page.url.search) replaceState(url, page.state);
		}
		if (!q) {
			hits = [];
			return;
		}
		const e = await ensureEngine();
		if (!e) return;
		hits = e.search(q).slice(0, LIMIT).map((r) => ({ ...(r as unknown as SearchDocument), id: String(r.id), terms: r.terms }));
	}

	/** The matched passage with each matched term marked; verbatim text either side, never rewritten. */
	function snippet(doc: SearchDocument, terms: string[]): { before: string; parts: { text: string; mark: boolean }[]; after: string } {
		const source = doc.type !== 'division' && doc.lang === 'cy' && terms.some((t) => doc.text_cy.toLowerCase().includes(t.toLowerCase())) ? doc.text_cy : doc.text;
		const lower = source.toLowerCase();
		let at = -1;
		for (const t of terms) {
			const i = lower.indexOf(t.toLowerCase());
			if (i >= 0 && (at < 0 || i < at)) at = i;
		}
		const start = Math.max(0, (at < 0 ? 0 : at) - 120);
		const end = Math.min(source.length, (at < 0 ? 0 : at) + 200);
		const window = source.slice(start, end);
		const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
		const parts = window.split(pattern).filter((s) => s.length).map((text) => ({ text, mark: pattern.test(text) && terms.some((t) => t.toLowerCase() === text.toLowerCase()) }));
		return { before: start > 0 ? '…' : '', parts, after: end < source.length ? '…' : '' };
	}

	const stageHref = (d: SearchDocument) =>
		d.type === 'division'
			? `/sitting/${d.date}?division=${encodeURIComponent(d.division_id)}`
			: `/sitting/${d.date}${d.t === null ? `?item=${encodeURIComponent(d.item_id)}` : `?t=${d.t}`}`;

	// A ?q= arrival searches once the router is ready (replaceState needs it).
	afterNavigate(() => {
		if (query && !searched) run();
	});
</script>

<svelte:head>
	<title>Search · Siambr</title>
</svelte:head>

<main id="main">
	<p class="kicker">Siambr · Search the Record</p>
	<h1>Search contributions</h1>
	<p class="lede">Every Plenary contribution and division on record, searched in your browser. Results quote the Record of Proceedings verbatim.</p>

	<form class="search" onsubmit={(e) => (e.preventDefault(), run())} role="search">
		<label for="q">Search words, a Member or an item title</label>
		<div class="row">
			<input id="q" type="search" bind:value={query} autocomplete="off" spellcheck="false" />
			<button type="submit" class="button-primary" disabled={loading}>Search</button>
		</div>
		{#if loading}<p class="small" role="status">Loading the index…</p>{/if}
		{#if failed}<p class="error" role="alert">The search index could not be loaded.</p>{/if}
	</form>

	<div aria-live="polite">
		{#if searched && !loading && !failed}
			{#if hits.length}
				<p class="small"><span data-numeric>{hits.length}</span>{hits.length === LIMIT ? '+' : ''} results for “{searched}”. {BADGE.verbatim}.</p>
				<ol class="results">
					{#each hits as h (h.id)}
						{@const s = snippet(h, h.terms)}
						{#if h.type === 'division'}
							<li class="vote">
								<p class="small where">
									<span class="kicker-vote">Vote</span>
									<time datetime={h.date}>{h.date}</time> · <span>{itemTitle(h.item)}</span> · <span>{h.target}</span>
									<span class="result" class:agreed={h.result === 'agreed'}>{h.result === 'agreed' ? 'Agreed' : 'Not agreed'}</span>
								</p>
								<blockquote lang="en">
									<p>{s.before}{#each s.parts as part, i (i)}{#if part.mark}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}{s.after}</p>
								</blockquote>
								<p class="small links">
									<a href={stageHref(h)}>Watch it in the chamber</a>
									<a href="/register?item={encodeURIComponent(h.item_id)}">{h.has_debate ? 'Read the debate' : 'Read the division'}</a>
									{#if recordByDate[h.date]}<ExternalLink href={recordByDate[h.date]!}>Read this in the Record</ExternalLink>{/if}
								</p>
							</li>
						{:else}
						<li>
							<p class="small where">
								<time datetime={h.date}>{h.date}</time> ·
								{#if h.member_id}<a href="/members/{encodeURIComponent(h.member_id)}">{h.member}</a>{:else}<span class="unattributed">{h.member}</span>{/if} ·
								<a href="/register?item={encodeURIComponent(h.item_id)}">{h.item}</a>
								<span class="lang">{h.lang}</span>
							</p>
							<blockquote lang={h.lang === 'cy' && s.parts.some((p) => p.mark) && h.text_cy ? 'cy' : 'en'}>
								<p>{s.before}{#each s.parts as part, i (i)}{#if part.mark}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}{s.after}</p>
							</blockquote>
							<p class="small links">
								<a href={stageHref(h)}>See it in the chamber</a>
								<a href="/register?item={encodeURIComponent(h.item_id)}">Register item</a>
								{#if recordByDate[h.date]}<ExternalLink href={recordByDate[h.date]!}>Read this in the Record</ExternalLink>{/if}
							</p>
						</li>
						{/if}
					{/each}
				</ol>
			{:else}
				<p>No contribution on record matches “{searched}”.</p>
			{/if}
		{/if}
	</div>
</main>

<style>
	main {
		max-width: 60rem;
		margin: 0 auto;
		padding: 3rem 1rem 4rem;
	}

	.lede {
		max-width: 60ch;
	}

	.search {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-width: 36rem;
		margin: 1.5rem 0 2rem;
	}

	.row {
		display: flex;
		gap: 0.5rem;
	}

	label {
		font-size: var(--text-small);
		font-weight: 600;
	}

	input {
		flex: 1;
		min-width: 0;
		min-height: var(--tap-min);
		padding: 0 0.6rem;
		font: inherit;
		color: var(--color-ink);
		background: var(--color-ground);
		border: 1px solid var(--color-rule-strong);
		border-radius: var(--rounded-none);
	}

	.results {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.results li {
		padding: 0.9rem 0;
		border-bottom: 1px solid var(--color-border);
	}

	.where,
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0 0 0.35rem;
	}

	.links {
		margin: 0.4rem 0 0;
	}

	.lang {
		padding: 0 0.35rem;
		border: 1px solid var(--color-border);
		font-family: var(--font-mono);
	}

	blockquote {
		margin: 0;
		padding-left: 1rem;
		border-left: 2px solid var(--color-timber-cedar);
	}

	blockquote p {
		margin: 0;
		font-family: var(--font-serif);
		line-height: 1.6;
	}

	.kicker-vote {
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-accent-plum-dark);
	}

	.result {
		font-weight: 600;
		color: var(--color-body-text);
	}

	.result.agreed {
		color: var(--color-ink);
	}

	mark {
		background: #f6e3b4;
		color: var(--color-ink);
	}

	.error {
		color: var(--color-error);
	}
</style>
