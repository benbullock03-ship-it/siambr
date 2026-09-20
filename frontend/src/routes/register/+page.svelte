<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { dossierFor, type Dossier } from '$lib/data/dossier';
	import { loadSittingForItem } from '$lib/data/loaders';
	import { DERIVED_NOTICE } from '$lib/data/provenance';
	import type { SittingSummary } from '$lib/data/types';
	import DossierPlate from '$lib/hud/DossierPlate.svelte';
	import { itemTypeLabel, parseFilters, SENEDD_TERMS } from '$lib/register/labels';

	let { data } = $props();

	// Filters live in the URL and apply in the browser: the page is prerendered once for every query.
	const params = $derived(browser ? page.url.searchParams : new URLSearchParams());
	const filters = $derived(parseFilters(params));
	const itemId = $derived(params.get('item'));
	let openDossier = $state<Dossier | null>(null);
	let dossierError = $state<string | null>(null);

	const domainName = $derived(new Map(data.index.policy_domains.map((d) => [d.id, d.name_en])));

	const filtered = $derived.by(() => {
		const out: SittingSummary[] = [];
		for (const s of data.sittings) {
			if (filters.term !== null && s.term !== filters.term) continue;
			const items = s.items.filter(
				(i) =>
					(!filters.domain || i.policy_domain_id === filters.domain) &&
					(!filters.speaker || i.speaker_ids.includes(filters.speaker))
			);
			if (items.length || (!filters.domain && !filters.speaker)) out.push({ ...s, items });
		}
		return out;
	});

	const byTerm = $derived.by(() => {
		const terms = new Map<number, SittingSummary[]>();
		for (const s of filtered) terms.set(s.term, [...(terms.get(s.term) ?? []), s]);
		return [...terms.entries()].sort(([a], [b]) => b - a);
	});

	const termLabel = $derived(new Map(data.index.terms.map((t) => [t.term, t.label_en])));

	$effect(() => {
		const id = itemId;
		openDossier = null;
		dossierError = null;
		if (!id) return;
		let live = true;
		loadSittingForItem(fetch, data.sittings, id)
			.then((sitting) => {
				if (!live) return;
				const d = sitting && dossierFor(sitting, id);
				if (d) openDossier = d;
				else dossierError = 'This agenda item is not on record.';
			})
			.catch(() => live && (dossierError = 'This agenda item could not be loaded.'));
		return () => {
			live = false;
		};
	});

	function itemHref(id: string) {
		const next = new URLSearchParams(params);
		next.set('item', id);
		return `?${next}`;
	}

	const itemLinkId = (id: string) => `item-link-${id}`;

	// Focus is gone by the time the async dossier mounts, so return it to the item link by id.
	async function closeDossier() {
		const closing = itemId;
		const url = new URL(page.url);
		url.searchParams.delete('item');
		await goto(url, { noScroll: true, keepFocus: true });
		if (closing) document.getElementById(itemLinkId(closing))?.focus();
	}
</script>

<svelte:head>
	<title>Register · Siambr</title>
</svelte:head>

<main id="main">
	<p class="kicker">Siambr · Civic Register</p>
	<h1>Plenary Register</h1>
	<p class="small">{DERIVED_NOTICE.topic}</p>
	<p class="lede">Plenary sittings of Senedd Cymru, newest first. Every speech is quoted from the Record of Proceedings.</p>
	{#if data.index.generated_at}
		<p class="small currency">
			Latest record published by the Senedd at
			<time data-numeric datetime={data.index.generated_at}>{data.index.generated_at.replace('T', ' ')}</time>.
		</p>
	{/if}

	<form method="GET" class="filters" data-sveltekit-keepfocus data-sveltekit-noscroll>
		<div class="field">
			<label for="f-term">Term</label>
			<select id="f-term" name="term" value={filters.term ?? ''}>
				<option value="">All terms</option>
				{#each SENEDD_TERMS as t (t)}<option value={String(t)}>{termLabel.get(t) ?? `Term ${t}`}</option>{/each}
			</select>
		</div>
		<div class="field">
			<label for="f-domain">Policy domain</label>
			<select id="f-domain" name="domain" value={filters.domain ?? ''}>
				<option value="">All domains</option>
				{#each data.index.policy_domains as d (d.id)}<option value={d.id}>{d.name_en}</option>{/each}
			</select>
		</div>
		<div class="field">
			<label for="f-speaker">Speaker</label>
			<select id="f-speaker" name="speaker" value={filters.speaker ?? ''}>
				<option value="">All Members</option>
				{#each data.members as m (m.id)}<option value={m.id}>{m.canonical_name}</option>{/each}
			</select>
		</div>
		<div class="actions">
			<button type="submit" class="button-primary">Apply filters</button>
			<a href="/register">Clear filters</a>
		</div>
	</form>

	{#if byTerm.length === 0}
		<p class="empty">No plenary sittings on record for these filters.</p>
	{/if}

	{#each byTerm as [term, termSittings] (term)}
		<section aria-labelledby="term-{term}">
			<h2 id="term-{term}">{termLabel.get(term) ?? `Term ${term}`}</h2>
			{#each termSittings as sitting (sitting.id)}
				<article class="session" aria-labelledby="session-{sitting.id}">
					<header class="session-head">
						<h3 id="session-{sitting.id}"><time datetime={sitting.date}>{sitting.date}</time> · {sitting.title_en}</h3>
						<p class="small links">
							<a href="/sitting/{sitting.date}">Watch it play</a>
							<a href={sitting.source_xml_url} rel="external">Record of Proceedings</a>
						</p>
					</header>
					<p class="small published">
						{#if sitting.record_published_at}
							Record published <time data-numeric datetime={sitting.record_published_at}>{sitting.record_published_at.replace('T', ' ')}</time>
						{:else}
							Record publication time not stated
						{/if}
						· <span data-numeric>{sitting.contribution_count}</span> contributions.
					</p>
					<ol class="items">
						{#each sitting.items as item (item.id)}
							<li>
								<span class="order small" data-numeric>{item.order + 1}</span>
								<div class="item-body">
									<a
										id={itemLinkId(item.id)}
										href={itemHref(item.id)}
										data-sveltekit-noscroll
										data-sveltekit-keepfocus
									>{item.title_en}</a>
									<span class="small meta">
										{itemTypeLabel(item.type)} · {domainName.get(item.policy_domain_id) ?? item.policy_domain_id}
										· <a href="/sitting/{sitting.date}?item={encodeURIComponent(item.id)}">Watch it play</a>
									</span>
								</div>
							</li>
						{/each}
					</ol>
				</article>
			{/each}
		</section>
	{/each}

	{#if dossierError}
		<p class="error" role="alert">{dossierError}</p>
	{/if}
</main>

{#if openDossier}
	<DossierPlate dossier={openDossier} onclose={closeDossier} />
{/if}

<style>
	main {
		max-width: 60rem;
		margin: 0 auto;
		padding: 3rem 1rem 4rem;
	}

	.lede {
		max-width: 60ch;
	}

	.currency {
		color: var(--color-body-text);
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 1rem;
		margin: 2rem 0;
		padding: 1rem 0;
		border-block: 1px solid var(--color-border);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 12rem;
		flex: 1;
	}

	label {
		font-size: var(--text-small);
		font-weight: 600;
		color: var(--color-ink);
	}

	select {
		min-height: var(--tap-min);
		padding: 0 0.5rem;
		font: inherit;
		color: var(--color-ink);
		background: var(--color-ground);
		border: 1px solid var(--color-rule-strong);
		border-radius: var(--rounded-none);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.session {
		margin: 0 0 2rem;
	}

	.session-head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.25rem 1rem;
		padding-bottom: 0.4rem;
		border-bottom: 1px solid var(--color-rule-strong);
	}

	.session-head h3,
	.links {
		margin: 0;
	}

	.links {
		display: flex;
		gap: 1rem;
	}

	.items {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.items li {
		display: grid;
		grid-template-columns: 2rem 1fr;
		gap: 0.75rem;
		align-items: baseline;
		padding: 0.6rem 0;
		border-bottom: 1px solid var(--color-border);
	}

	.order,
	.meta,
	.published {
		color: var(--color-body-text);
	}

	.published {
		margin: 0.4rem 0 0.2rem;
	}

	.item-body {
		display: flex;
		flex-direction: column;
	}

	.item-body a {
		font-family: var(--font-serif);
		font-size: 1.05rem;
		font-weight: 600;
	}

	.empty,
	.error {
		padding: 1rem 0;
	}

	.error {
		color: var(--color-error);
	}
</style>
