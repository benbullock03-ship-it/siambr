<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { dossier as fetchDossier } from '$lib/api/client';
	import type { DossierPlate as Dossier, SessionSummary } from '$lib/api/types';
	import DossierPlate from '$lib/hud/DossierPlate.svelte';
	import { itemTypeLabel, SENEDD_TERMS } from '$lib/register/labels';

	let { data } = $props();

	const itemId = $derived(page.url.searchParams.get('item'));
	let openDossier = $state<Dossier | null>(null);
	let dossierError = $state<string | null>(null);

	const domainName = $derived(new Map(data.domains.map((d) => [d.id, d.name_en])));

	const byTerm = $derived.by(() => {
		const terms = new Map<number, SessionSummary[]>();
		for (const s of [...data.sessions].sort((a, b) => b.session_date.localeCompare(a.session_date))) {
			terms.set(s.senedd_term, [...(terms.get(s.senedd_term) ?? []), s]);
		}
		return [...terms.entries()].sort(([a], [b]) => b - a);
	});

	$effect(() => {
		const id = itemId;
		openDossier = null;
		dossierError = null;
		if (!id) return;
		let live = true;
		fetchDossier(fetch, id)
			.then((d) => live && (openDossier = d))
			.catch(() => live && (dossierError = 'This agenda item could not be loaded.'));
		return () => {
			live = false;
		};
	});

	function itemHref(id: string) {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('item', id);
		return `?${params}`;
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
	<p class="small">Item types and policy domains grouped by Siambr engine — speeches verbatim.</p>
	<p class="lede">Plenary sessions of Senedd Cymru, newest first. Every speech is quoted from the Record of Proceedings.</p>

	<form method="GET" class="filters" data-sveltekit-keepfocus>
		<div class="field">
			<label for="f-term">Term</label>
			<select id="f-term" name="term" value={data.filters.term ?? ''}>
				<option value="">All terms</option>
				{#each SENEDD_TERMS as t (t)}<option value={String(t)}>Term {t}</option>{/each}
			</select>
		</div>
		<div class="field">
			<label for="f-domain">Policy domain</label>
			<select id="f-domain" name="domain" value={data.filters.domain ?? ''}>
				<option value="">All domains</option>
				{#each data.domains as d (d.id)}<option value={d.id}>{d.name_en}</option>{/each}
			</select>
		</div>
		<div class="field">
			<label for="f-speaker">Speaker</label>
			<select id="f-speaker" name="speaker" value={data.filters.speaker ?? ''}>
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
		<p class="empty">No plenary sessions on record for these filters.</p>
	{/if}

	{#each byTerm as [term, termSessions] (term)}
		<section aria-labelledby="term-{term}">
			<h2 id="term-{term}">Term <span data-numeric>{term}</span></h2>
			{#each termSessions as session (session.id)}
				<article class="session" aria-labelledby="session-{session.id}">
					<header class="session-head">
						<h3 id="session-{session.id}"><time datetime={session.session_date}>{session.session_date}</time> · {session.title_en}</h3>
						<a class="small" href={session.source_xml_url} rel="external">Record of Proceedings</a>
					</header>
					<ol class="items">
						{#each session.items as item (item.id)}
							<li>
								<span class="order small" data-numeric>{item.item_order + 1}</span>
								<div class="item-body">
									<a
										id={itemLinkId(item.id)}
										href={itemHref(item.id)}
										data-sveltekit-noscroll
										data-sveltekit-keepfocus
									>{item.title_en}</a>
									<span class="small meta">{itemTypeLabel(item.item_type)} · {domainName.get(item.policy_domain_id) ?? item.policy_domain_id}</span>
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

	.session-head h3 {
		margin: 0;
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
	.meta {
		color: var(--color-body-text);
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
