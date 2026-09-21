<script lang="ts">
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { BADGE, PROVENANCE_DERIVED } from '$lib/data/provenance';
	import type { DivisionRow } from '$lib/data/types';
	import VoteChip from '$lib/hud/VoteChip.svelte';
	import VoteLegend from '$lib/hud/VoteLegend.svelte';
	import { itemTitle } from '$lib/stage/votes';

	let { data } = $props();

	const params = $derived(browser ? page.url.searchParams : new URLSearchParams());
	let selectedTerm = $state('');
	let selectedResult = $state('');
	let query = $state('');

	$effect(() => {
		selectedTerm = params.get('term') ?? '';
		selectedResult = params.get('result') ?? '';
		query = params.get('q') ?? '';
	});

	// Filters apply as they change; the URL follows without a navigation, as on the Register.
	$effect(() => {
		if (!browser) return;
		const url = new URL(page.url);
		for (const [k, v] of [['term', selectedTerm], ['result', selectedResult], ['q', query]]) {
			if (v) url.searchParams.set(k, v);
			else url.searchParams.delete(k);
		}
		if (url.search !== page.url.search) replaceState(url, page.state);
	});

	const title = (d: DivisionRow) => itemTitle(d.debate_item_title_en ?? d.item_title_en);
	const terms = $derived(new Map(data.index.terms.map((t) => [t.term, t.label_en])));
	const shownTerms = $derived([...new Set(data.divisions.map((d) => d.term))].sort((a, b) => b - a));

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return data.divisions.filter(
			(d) =>
				(!selectedTerm || String(d.term) === selectedTerm) &&
				(!selectedResult || d.result === selectedResult) &&
				(!q || title(d).toLowerCase().includes(q))
		);
	});

	const days = $derived.by(() => {
		const out: { date: string; rows: DivisionRow[] }[] = [];
		for (const d of filtered) {
			const last = out[out.length - 1];
			if (last?.date === d.date) last.rows.push(d);
			else out.push({ date: d.date, rows: [d] });
		}
		return out;
	});

	function clearFilters() {
		selectedTerm = selectedResult = query = '';
	}
</script>

<svelte:head>
	<title>Votes · Siambr</title>
</svelte:head>

<main id="main">
	<p class="kicker">Siambr · Votes</p>
	<h1>Divisions</h1>
	<p class="lede">Every roll-call division on record, newest first. Counts and results are the publisher’s, verbatim.</p>

	<form class="filters" role="search" aria-label="Filter divisions" onsubmit={(e) => e.preventDefault()}>
		<div class="field">
			<label for="d-term">Term</label>
			<select id="d-term" bind:value={selectedTerm}>
				<option value="">All terms</option>
				{#each shownTerms as t (t)}<option value={String(t)}>{terms.get(t) ?? `Term ${t}`}</option>{/each}
			</select>
		</div>
		<div class="field">
			<label for="d-result">Result</label>
			<select id="d-result" bind:value={selectedResult}>
				<option value="">Any result</option>
				<option value="agreed">Agreed</option>
				<option value="negatived">Not agreed</option>
			</select>
		</div>
		<div class="field grow">
			<label for="d-q">Debate title</label>
			<input id="d-q" type="search" bind:value={query} autocomplete="off" spellcheck="false" />
		</div>
		<button type="button" class="link-clear" onclick={clearFilters}>Clear filters</button>
	</form>

	<VoteLegend />
	<p class="small count" aria-live="polite">
		<strong data-numeric>{filtered.length}</strong>
		{filtered.length === 1 ? 'division' : 'divisions'} on
		<span data-numeric>{days.length}</span>
		{days.length === 1 ? 'sitting day' : 'sitting days'}. {BADGE.division}.
	</p>
	<p class="small badge" data-provenance={PROVENANCE_DERIVED}>
		{BADGE.arranged}: each vote’s debate is read from its motion text, and votes are grouped by sitting day.
	</p>

	{#if !days.length}
		<p>No division on record matches these filters.</p>
	{/if}

	{#each days as day (day.date)}
		<section class="day" aria-labelledby="day-{day.date}">
			<h2 id="day-{day.date}"><time datetime={day.date}>{day.date}</time></h2>
			<table data-provenance={PROVENANCE_DERIVED}>
				<thead>
					<tr>
						<th scope="col">Debate</th>
						<th scope="col">Vote on</th>
						<th scope="col" class="n"><VoteChip vote="for" /></th>
						<th scope="col" class="n"><VoteChip vote="against" /></th>
						<th scope="col" class="n"><VoteChip vote="abstain" /></th>
						<th scope="col">Result</th>
						<th scope="col"><span class="visually-hidden">Links</span></th>
					</tr>
				</thead>
				<tbody>
					{#each day.rows as d (d.id)}
						<tr>
							<th scope="row">{title(d)}</th>
							<td>
								{d.target}{#if d.tabled_by}{' '}<span class="tabled">tabled in the name of {d.tabled_by}</span>{/if}
							</td>
							<td class="n" data-label="For" data-numeric>{d.votes_for}</td>
							<td class="n" data-label="Against" data-numeric>{d.votes_against}</td>
							<td class="n" data-label="Abstain" data-numeric>{d.votes_abstain}</td>
							<td><span class="result" class:agreed={d.result === 'agreed'}>{d.result === 'agreed' ? 'Agreed' : 'Not agreed'}</span></td>
							<td class="links">
								<a href="/sitting/{d.date}?division={encodeURIComponent(d.id)}">Watch it in the chamber</a>
								<a href="/register?item={encodeURIComponent(d.debate_item_id ?? d.item_id)}">{d.debate_item_id ? 'Read the debate' : 'Read the division'}</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/each}
</main>

<style>
	main {
		max-width: 75rem;
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
		gap: 0.75rem 1rem;
		margin: 1.5rem 0 1.25rem;
		padding: 1rem;
		background: var(--color-panel);
		border: 1px solid var(--color-border);
		border-radius: 6px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.grow {
		flex: 1 1 14rem;
	}

	label {
		font-size: var(--text-small);
		font-weight: 600;
	}

	select,
	input {
		min-height: var(--tap-min);
		padding: 0 0.6rem;
		font: inherit;
		color: var(--color-ink);
		background: var(--color-ground);
		border: 1px solid var(--color-rule-strong);
		border-radius: var(--rounded-none);
	}

	.link-clear {
		min-height: var(--tap-min);
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

	.count {
		margin: 0.75rem 0 0.25rem;
	}

	.badge {
		margin: 0 0 1rem;
		color: var(--color-body-text);
	}

	.day h2 {
		margin: 2rem 0 0.5rem;
		font-size: 1.15rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-small);
	}

	th,
	td {
		padding: 0.5rem 0.75rem 0.5rem 0;
		text-align: left;
		vertical-align: top;
		border-bottom: 1px solid var(--color-border);
	}

	thead th {
		font-weight: 600;
		border-bottom: 1px solid var(--color-rule-strong);
	}

	tbody th {
		font-weight: 600;
		color: var(--color-ink);
	}

	.n {
		text-align: right;
		white-space: nowrap;
	}

	.tabled {
		color: var(--color-body-text);
	}

	.result {
		font-weight: 600;
		white-space: nowrap;
		color: var(--color-body-text);
	}

	.result.agreed {
		color: var(--color-ink);
	}

	.links a {
		display: flex;
		align-items: center;
		min-height: 1.75rem;
		white-space: nowrap;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	/* Below 720 px each division is a card: the header row hides and each count carries its label. */
	@media (max-width: 720px) {
		thead {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
		}

		table,
		tbody,
		tr,
		th,
		td {
			display: block;
		}

		tr {
			padding: 0.75rem 0;
			border-bottom: 1px solid var(--color-border);
		}

		th,
		td {
			padding: 0.15rem 0;
			border: 0;
		}

		td.n {
			display: inline-block;
			margin-right: 1rem;
			text-align: left;
		}

		td.n::before {
			content: attr(data-label) ' ';
			color: var(--color-body-text);
		}

		.links a {
			display: inline-flex;
			align-items: center;
			min-height: var(--tap-min);
			margin-right: 1rem;
		}
	}
</style>
