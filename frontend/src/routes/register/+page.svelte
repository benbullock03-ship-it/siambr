<script lang="ts">
	import { browser } from '$app/environment';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { dossierFor, type Dossier } from '$lib/data/dossier';
	import { loadSittingForItem } from '$lib/data/loaders';
	import { DERIVED_NOTICE } from '$lib/data/provenance';
	import type { SittingSummary } from '$lib/data/types';
	import DossierPlate from '$lib/hud/DossierPlate.svelte';
	import ExternalLink from '$lib/hud/ExternalLink.svelte';
	import { itemTypeLabel, parseFilters, SENEDD_TERMS } from '$lib/register/labels';

	let { data } = $props();

	// Filters live in the URL and apply in the browser: the page is prerendered once for every query.
	const params = $derived(browser ? page.url.searchParams : new URLSearchParams());
	const filters = $derived(parseFilters(params));
	const itemId = $derived(params.get('item'));
	const speechId = $derived(params.get('speech'));

	let selectedTerm = $state('');
	let selectedDomain = $state('');
	let selectedSpeaker = $state('');
	let searchQuery = $state('');

	$effect(() => {
		selectedTerm = filters.term !== null ? String(filters.term) : '';
		selectedDomain = filters.domain ?? '';
		selectedSpeaker = filters.speaker ?? '';
		searchQuery = filters.query ?? '';
	});

	// Every filter applies as it changes; the URL follows without a navigation, so focus and caret stay put.
	const active = $derived(
		parseFilters(new URLSearchParams({ term: selectedTerm, domain: selectedDomain, speaker: selectedSpeaker, q: searchQuery }))
	);
	$effect(() => {
		if (!browser) return;
		const url = new URL(page.url);
		const want: [string, string][] = [['term', selectedTerm], ['domain', selectedDomain], ['speaker', selectedSpeaker], ['q', searchQuery]];
		for (const [k, v] of want) {
			if (v) url.searchParams.set(k, v);
			else url.searchParams.delete(k);
		}
		if (url.search !== page.url.search) replaceState(url, page.state);
	});

	function clearFilters() {
		selectedTerm = selectedDomain = selectedSpeaker = searchQuery = '';
	}

	let openDossier = $state<Dossier | null>(null);
	let dossierError = $state<string | null>(null);

	const domainName = $derived(new Map(data.index.policy_domains.map((d) => [d.id, d.name_en])));
	const termLabel = $derived(new Map(data.index.terms.map((t) => [t.term, t.label_en])));

	// Tracking user accordion toggle state
	let manualToggles = $state<Record<string, boolean>>({});
	let globalExpandState = $state<boolean | null>(null);

	function formatSittingDate(isoDate: string): string {
		const parts = isoDate.split('-');
		if (parts.length !== 3) return isoDate;
		const year = Number(parts[0]);
		const month = Number(parts[1]);
		const day = Number(parts[2]);
		const months = [
			'January', 'February', 'March', 'April', 'May', 'June',
			'July', 'August', 'September', 'October', 'November', 'December'
		];
		if (year && month >= 1 && month <= 12 && day) {
			return `${day} ${months[month - 1]} ${year}`;
		}
		return isoDate;
	}

	const filtered = $derived.by(() => {
		const out: SittingSummary[] = [];
		const q = searchQuery.trim().toLowerCase();
		for (const s of data.sittings) {
			if (active.term !== null && s.term !== active.term) continue;
			const items = s.items.filter((i) => {
				if (active.domain && i.policy_domain_id !== active.domain) return false;
				if (active.speaker && !i.speaker_ids.includes(active.speaker)) return false;
				if (q) {
					const titleEn = i.title_en.toLowerCase();
					const titleCy = (i.title_cy ?? '').toLowerCase();
					const domain = (domainName.get(i.policy_domain_id) ?? '').toLowerCase();
					if (!titleEn.includes(q) && !titleCy.includes(q) && !domain.includes(q)) return false;
				}
				return true;
			});
			if (items.length || (!active.domain && !active.speaker && !q)) {
				out.push({ ...s, items });
			}
		}
		return out;
	});

	const byTerm = $derived.by(() => {
		const terms = new Map<number, SittingSummary[]>();
		for (const s of filtered) terms.set(s.term, [...(terms.get(s.term) ?? []), s]);
		return [...terms.entries()].sort(([a], [b]) => b - a);
	});

	const totalDebatesCount = $derived(
		filtered.reduce((acc, s) => acc + s.items.length, 0)
	);

	/** The sitting that holds ?item=, opened on arrival alongside the newest. */
	const itemSittingId = $derived(itemId ? (data.sittings.find((s) => s.items.some((i) => i.id === itemId))?.id ?? null) : null);

	function isSessionOpen(sittingId: string): boolean {
		if (globalExpandState !== null) return globalExpandState;
		if (sittingId in manualToggles) return manualToggles[sittingId];
		if (searchQuery.trim() || active.domain || active.speaker) return true;
		// A short first paint: only the newest sitting opens by default.
		return sittingId === filtered[0]?.id || sittingId === itemSittingId;
	}

	// Arriving with ?item= scrolls its row into view once, under the dossier.
	let scrolledTo: string | null = null;
	$effect(() => {
		const id = itemId;
		if (!browser || !id || scrolledTo === id) return;
		scrolledTo = id;
		requestAnimationFrame(() => document.getElementById(itemLinkId(id))?.scrollIntoView({ block: 'center' }));
	});

	function handleSessionToggle(sittingId: string, isOpen: boolean) {
		manualToggles[sittingId] = isOpen;
	}

	function toggleAll() {
		if (globalExpandState === true) {
			globalExpandState = false;
		} else {
			globalExpandState = true;
		}
	}

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
	<div class="header-section">
		<p class="kicker">Siambr · Civic Register</p>
		<h1>Plenary Register</h1>
		<p class="small notice">{DERIVED_NOTICE.topic}</p>
		<p class="lede">Plenary sittings of Senedd Cymru, newest first. Every speech is quoted verbatim from the Record of Proceedings.</p>
		{#if data.index.generated_at}
			<p class="small currency">
				Latest record published by the Senedd at
				<time data-numeric datetime={data.index.generated_at}>{data.index.generated_at.replace('T', ' ')}</time>.
			</p>
		{/if}
	</div>

	<form class="filter-panel" onsubmit={(e) => e.preventDefault()}>
		<div class="search-row">
			<div class="search-field">
				<label for="f-search" class="visually-hidden">Search debates</label>
				<div class="search-input-wrap">
					<svg class="search-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="11" cy="11" r="8"></circle>
						<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
					</svg>
					<input
						id="f-search"
						name="q"
						type="search"
						placeholder="Filter debates by title or topic (e.g. Dentistry, Transport, Tourism)…"
						bind:value={searchQuery}
						autocomplete="off"
					/>
					{#if searchQuery}
						<button type="button" class="btn-clear-search" onclick={() => (searchQuery = '')} aria-label="Clear search text">×</button>
					{/if}
				</div>
			</div>
		</div>

		<div class="dropdowns-row">
			<div class="field">
				<label for="f-term">Term</label>
				<select id="f-term" name="term" bind:value={selectedTerm}>
					<option value="">All terms</option>
					{#each SENEDD_TERMS as t (t)}<option value={String(t)}>{termLabel.get(t) ?? `Term ${t}`}</option>{/each}
				</select>
			</div>
			<div class="field">
				<label for="f-domain">Policy domain</label>
				<select id="f-domain" name="domain" bind:value={selectedDomain}>
					<option value="">All domains</option>
					{#each data.index.policy_domains as d (d.id)}<option value={d.id}>{d.name_en}</option>{/each}
				</select>
			</div>
			<div class="field speaker-field">
				<label for="f-speaker">Speaker</label>
				<select id="f-speaker" name="speaker" bind:value={selectedSpeaker}>
					<option value="">All Members</option>
					{#each data.members as m (m.id)}<option value={m.id}>{m.canonical_name}</option>{/each}
				</select>
			</div>
			<div class="actions">
				<button type="button" class="link-clear" onclick={clearFilters}>Clear filters</button>
			</div>
		</div>
	</form>

	<div class="results-bar">
		<p class="small results-count" aria-live="polite">
			<strong data-numeric>{filtered.length}</strong> {filtered.length === 1 ? 'sitting' : 'sittings'},
			<span data-numeric>{totalDebatesCount}</span> {totalDebatesCount === 1 ? 'debate' : 'debates'}
			{#if searchQuery || active.domain || active.speaker || active.term}
				<span class="filtered-tag">Filtered</span>
			{/if}
		</p>
		{#if filtered.length > 0}
			<button type="button" class="btn-toggle-all" onclick={toggleAll}>
				{globalExpandState === true ? 'Collapse all sittings' : 'Expand all sittings'}
			</button>
		{/if}
	</div>

	{#if byTerm.length === 0}
		<div class="empty-state">
			<p class="empty">No Plenary sittings on record for these filters.</p>
			<button type="button" class="button-primary reset-btn" onclick={clearFilters}>Clear all filters</button>
		</div>
	{/if}

	{#each byTerm as [term, termSittings] (term)}
		<section class="term-section" aria-labelledby="term-{term}">
			<header class="term-head">
				<h2 id="term-{term}">{termLabel.get(term) ?? `Term ${term}`}</h2>
				<p class="small"><a class="term-stats-link" href="/terms/{term}/stats">Speaking time in this term →</a></p>
			</header>

			<div class="sittings-container">
				{#each termSittings as sitting (sitting.id)}
					{@const open = isSessionOpen(sitting.id)}
					<details
						class="session-card"
						{open}
						ontoggle={(e) => handleSessionToggle(sitting.id, e.currentTarget.open)}
						aria-labelledby="session-{sitting.id}"
					>
						<summary class="session-summary">
							<div class="session-summary-left">
								<span class="session-chevron" aria-hidden="true">▾</span>
								<h3 id="session-{sitting.id}" class="session-title">
									<time datetime={sitting.date} class="session-date">{formatSittingDate(sitting.date)}</time>
									<span class="session-title-sep">·</span>
									<span class="session-name">{sitting.title_en}</span>
								</h3>
							</div>
							<div class="session-summary-right">
								<span class="pill-badge">{sitting.items.length} {sitting.items.length === 1 ? 'debate' : 'debates'}</span>
								<span class="pill-badge pill-speeches" data-numeric>{sitting.contribution_count} speeches</span>
							</div>
							{#if sitting.items.length}
								<p class="session-preview small">{sitting.items.slice(0, 3).map((i) => i.title_en).join(' · ')}{sitting.items.length > 3 ? ' …' : ''}</p>
							{/if}
						</summary>

						<div class="session-body">
							<div class="session-meta-row">
								<p class="small published">
									{#if sitting.record_published_at}
										Record published <time data-numeric datetime={sitting.record_published_at}>{sitting.record_published_at.replace('T', ' ')}</time>
									{:else}
										Record publication time not stated
									{/if}
									· <span data-numeric>{sitting.contribution_count}</span> contributions.
								</p>
								<p class="small session-actions">
									<a class="session-stats-link" href="/sitting/{sitting.date}/stats">Session stats →</a>
									<a class="session-watch-link" href="/sitting/{sitting.date}">Watch it play</a>
									<ExternalLink href={sitting.source_xml_url}>Record of Proceedings</ExternalLink>
								</p>
							</div>

							{#if sitting.items.length === 0}
								<p class="small empty-sitting-items">No agenda items matched your search in this sitting.</p>
							{:else}
								<ol class="items-list">
									{#each sitting.items as item (item.id)}
										<li class="item-card">
											<span class="item-order-badge" data-numeric>{item.order + 1}</span>
											<div class="item-content">
												<div class="item-top-line">
													<a
														id={itemLinkId(item.id)}
														href={itemHref(item.id)}
														class="item-title-link"
														data-sveltekit-noscroll
														data-sveltekit-keepfocus
													>{item.title_en}</a>
													<div class="item-badges">
														<span class="type-badge">{itemTypeLabel(item.type)}</span>
														<span class="domain-badge">{domainName.get(item.policy_domain_id) ?? item.policy_domain_id}</span>
													</div>
												</div>
												<div class="item-bottom-line">
													<span class="small speaker-info">
														{#if item.speaker_ids && item.speaker_ids.length > 0}
															<span data-numeric>{item.speaker_ids.length}</span> {item.speaker_ids.length === 1 ? 'speaker' : 'speakers'}
														{/if}
													</span>
													<div class="item-button-group">
														<a
															class="btn-item-action btn-read"
															href={itemHref(item.id)}
															data-sveltekit-noscroll
															data-sveltekit-keepfocus
														>
															Read dossier
														</a>
														<a
															class="btn-item-action btn-watch"
															href="/sitting/{sitting.date}?item={encodeURIComponent(item.id)}"
														>
															Watch it play
														</a>
													</div>
												</div>
											</div>
										</li>
									{/each}
								</ol>
							{/if}
						</div>
					</details>
				{/each}
			</div>
		</section>
	{/each}

	{#if dossierError}
		<p class="error" role="alert">{dossierError}</p>
	{/if}
</main>

{#if openDossier}
	<DossierPlate
		dossier={openDossier}
		targetSpeechId={speechId ?? undefined}
		targetSpeakerId={active.speaker ?? undefined}
		onclose={closeDossier}
	/>
{/if}

<style>
	main {
		max-width: 64rem;
		margin: 0 auto;
		padding: 3rem 1.25rem 5rem;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.header-section {
		margin-bottom: 2rem;
	}

	.lede {
		max-width: 62ch;
		font-size: 1.05rem;
		color: var(--color-ink);
		margin: 0.5rem 0 0.75rem;
	}

	.notice {
		margin: 0.25rem 0;
		color: var(--color-muted);
	}

	.currency {
		color: var(--color-body-text);
		margin-top: 0.25rem;
	}

	/* --- Filter Panel --- */
	.filter-panel {
		background: var(--color-panel);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		padding: 1.25rem;
		margin: 2rem 0 1.25rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
	}

	.search-row {
		margin-bottom: 1rem;
	}

	.search-field {
		width: 100%;
	}

	.search-input-wrap {
		position: relative;
		display: flex;
		align-items: center;
		width: 100%;
	}

	.search-icon {
		position: absolute;
		left: 0.85rem;
		font-size: 0.95rem;
		opacity: 0.6;
		pointer-events: none;
	}

	.search-input-wrap input {
		width: 100%;
		height: 2.75rem;
		padding: 0 2.25rem 0 2.4rem;
		font: inherit;
		font-size: 0.95rem;
		color: var(--color-ink);
		background: var(--color-ground);
		border: 1px solid var(--color-rule-strong);
		border-radius: 4px;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.search-input-wrap input:focus {
		outline: 2px solid var(--color-focus);
		outline-offset: 1px;
	}

	.btn-clear-search {
		position: absolute;
		right: 0.75rem;
		background: none;
		border: none;
		font-size: 1.25rem;
		line-height: 1;
		color: var(--color-muted);
		cursor: pointer;
		padding: 0.2rem 0.4rem;
	}

	.btn-clear-search:hover {
		color: var(--color-ink);
	}

	.dropdowns-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.85rem 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 11rem;
		flex: 1;
	}

	.speaker-field {
		min-width: 14rem;
	}

	label {
		font-size: var(--text-small);
		font-weight: 600;
		color: var(--color-ink);
	}

	select {
		min-height: 2.5rem;
		padding: 0 0.6rem;
		font: inherit;
		font-size: 0.9rem;
		color: var(--color-ink);
		background: var(--color-ground);
		border: 1px solid var(--color-rule-strong);
		border-radius: 4px;
	}

	select:focus {
		outline: 2px solid var(--color-focus);
		outline-offset: 1px;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 0.5rem;
	}

	.button-primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 2.5rem;
		padding: 0 1.25rem;
		background: var(--color-accent-plum);
		color: #ffffff;
		border: none;
		border-radius: 4px;
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		text-decoration: none;
		transition: background 0.15s ease;
	}

	.button-primary:hover {
		background: var(--color-accent-plum-dark);
	}

	.link-clear {
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		font: inherit;
		font-size: var(--text-small);
		color: var(--color-body-text);
		text-decoration: underline;
	}

	.link-clear:hover {
		color: var(--color-ink);
	}

	/* --- Results Bar --- */
	.results-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0 1rem;
		border-bottom: 1px solid var(--color-border);
		margin-bottom: 2rem;
	}

	.results-count {
		margin: 0;
		color: var(--color-body-text);
	}

	.filtered-tag {
		display: inline-block;
		margin-left: 0.5rem;
		padding: 0.1rem 0.5rem;
		background: #ebd8e5;
		color: var(--color-accent-plum-dark);
		font-size: 0.75rem;
		font-weight: 600;
		border-radius: 100px;
	}

	.btn-toggle-all {
		background: none;
		border: none;
		font: inherit;
		font-size: var(--text-small);
		color: var(--color-accent-plum);
		font-weight: 600;
		cursor: pointer;
		padding: 0.2rem 0.5rem;
		text-decoration: underline;
	}

	.btn-toggle-all:hover {
		color: var(--color-accent-plum-dark);
	}

	/* --- Terms & Sittings --- */
	.term-section {
		margin-bottom: 3rem;
	}

	.term-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 1rem;
		padding-bottom: 0.4rem;
		border-bottom: 2px solid var(--color-rule-strong);
	}

	.term-head h2 {
		margin: 0;
	}

	.term-stats-link {
		font-size: var(--text-small);
		font-weight: 600;
		color: var(--color-accent-plum);
		text-decoration: none;
	}

	.term-stats-link:hover {
		text-decoration: underline;
	}

	.sittings-container {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	/* --- Collapsible Session Card --- */
	.session-card {
		background: var(--color-ground);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		overflow: hidden;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.session-card[open] {
		border-color: #8c8979;
		box-shadow: 0 3px 12px rgba(0, 0, 0, 0.04);
	}

	.session-summary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		padding: 0.9rem 1.25rem;
		background: var(--color-panel);
		cursor: pointer;
		user-select: none;
		list-style: none;
		transition: background 0.12s ease;
	}

	.session-summary::-webkit-details-marker {
		display: none;
	}

	.session-summary:hover {
		background: #e2dfd6;
	}

	.session-summary-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	/* Its own row under the date and counts, so a closed sitting is still scannable. */
	.session-preview {
		flex-basis: 100%;
		min-width: 0;
		margin: -0.35rem 0 0;
		padding-left: 1.7rem;
		color: var(--color-body-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.session-chevron {
		font-size: 0.95rem;
		color: var(--color-muted);
		transition: transform 0.2s ease;
		display: inline-block;
	}

	.session-card[open] .session-chevron {
		transform: rotate(180deg);
	}

	.session-title {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 600;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.35rem;
	}

	.session-date {
		color: var(--color-ink);
	}

	.session-title-sep {
		color: var(--color-muted);
	}

	.session-name {
		color: var(--color-body-text);
		font-weight: 500;
	}

	.session-summary-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.pill-badge {
		padding: 0.2rem 0.6rem;
		border-radius: 100px;
		font-size: 0.78rem;
		font-weight: 600;
		background: #dad6c8;
		color: var(--color-ink);
	}

	.pill-speeches {
		background: transparent;
		border: 1px solid #c2bead;
		color: var(--color-body-text);
	}

	/* --- Session Body --- */
	.session-body {
		padding: 1.25rem 1.5rem 1.5rem;
		border-top: 1px solid var(--color-border);
	}

	.session-meta-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		margin-bottom: 1.25rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--color-border);
	}

	.published {
		margin: 0;
		color: var(--color-muted);
	}

	.session-actions {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 1.25rem;
	}

	.session-stats-link {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.6rem;
		border-radius: 4px;
		font-weight: 600;
		font-size: var(--text-small);
		color: var(--color-ink);
		background: #dad5c7;
		border: 1px solid var(--color-border);
		text-decoration: none;
		transition: background 0.15s ease, border-color 0.15s ease;
	}

	.session-stats-link:hover {
		background: #cfcaba;
		border-color: #8c8979;
	}

	.session-watch-link {
		font-weight: 600;
		color: var(--color-accent-plum);
		text-decoration: none;
	}

	.session-watch-link:hover {
		text-decoration: underline;
	}

	.empty-sitting-items {
		color: var(--color-muted);
		font-style: italic;
		margin: 0.5rem 0;
	}

	/* --- Agenda Items List --- */
	.items-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.item-card {
		display: grid;
		grid-template-columns: 2.2rem 1fr;
		gap: 0.85rem;
		align-items: start;
		padding: 0.85rem 1rem;
		background: #fdfdfc;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		transition: border-color 0.15s ease, background 0.15s ease;
	}

	.item-card:hover {
		border-color: #9e9a8b;
		background: #ffffff;
	}

	.item-order-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		background: var(--color-panel);
		color: var(--color-ink);
		font-size: 0.85rem;
		font-weight: 700;
		border-radius: 50%;
		border: 1px solid var(--color-border);
		margin-top: 0.1rem;
	}

	.item-content {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	.item-top-line {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.4rem 1rem;
	}

	.item-title-link {
		font-family: var(--font-serif);
		font-size: 1.08rem;
		font-weight: 600;
		color: var(--color-ink);
		text-decoration: none;
		line-height: 1.35;
	}

	.item-title-link:hover {
		color: var(--color-accent-plum);
		text-decoration: underline;
	}

	.item-badges {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		flex-shrink: 0;
	}

	.type-badge {
		padding: 0.15rem 0.55rem;
		border-radius: 100px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: var(--color-panel);
		color: var(--color-ink);
		border: 1px solid var(--color-border);
	}

	.domain-badge {
		padding: 0.15rem 0.55rem;
		border-radius: 100px;
		font-size: 0.75rem;
		font-weight: 500;
		background: #e8e3d5;
		color: var(--color-body-text);
	}

	.item-bottom-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		margin-top: 0.2rem;
	}

	.speaker-info {
		color: var(--color-muted);
	}

	.item-button-group {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.btn-item-action {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.65rem;
		font-size: 0.8rem;
		font-weight: 600;
		border-radius: 3px;
		text-decoration: none;
		transition: all 0.12s ease;
	}

	.btn-read {
		background: var(--color-panel);
		color: var(--color-ink);
		border: 1px solid var(--color-border);
	}

	.btn-read:hover {
		background: #dad5c7;
		border-color: #8c8979;
	}

	.btn-watch {
		background: var(--color-accent-plum);
		color: #ffffff;
		border: 1px solid var(--color-accent-plum);
	}

	.btn-watch:hover {
		background: var(--color-accent-plum-dark);
		border-color: var(--color-accent-plum-dark);
	}

	/* --- Empty & Error States --- */
	.empty-state {
		text-align: center;
		padding: 3rem 1rem;
		background: var(--color-panel);
		border: 1px dashed var(--color-border);
		border-radius: 6px;
		margin: 2rem 0;
	}

	.empty-state p {
		margin: 0 0 1rem;
		color: var(--color-body-text);
		font-size: 1.05rem;
	}

	.reset-btn {
		display: inline-block;
	}

	.error {
		color: var(--color-error);
		padding: 1rem;
		margin: 1rem 0;
	}

	/* Phone: the date and the counts, then the preview; two lines at most. */
	@media (max-width: 640px) {
		.session-summary {
			flex-wrap: wrap;
			padding: 0.6rem 0.9rem;
			gap: 0.5rem;
		}

		.session-summary-left {
			gap: 0.5rem;
		}

		.session-title {
			font-size: 0.9rem;
			white-space: nowrap;
		}

		.session-summary-right {
			margin-left: auto;
			gap: 0.3rem;
		}

		.pill-badge {
			padding: 0.1rem 0.4rem;
			font-size: 0.75rem;
		}

		.session-preview {
			margin-top: -0.25rem;
			padding-left: 1.4rem;
		}

		.session-title-sep,
		.session-name {
			display: none;
		}

		.session-summary-right {
			flex-shrink: 0;
			gap: 0.35rem;
		}

		.item-card {
			grid-template-columns: 1fr;
		}

		.item-order-badge {
			display: none;
		}

		.item-top-line {
			flex-direction: column;
		}
	}
</style>
