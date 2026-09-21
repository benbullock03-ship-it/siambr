<script lang="ts">
	import { BADGE, PROVENANCE_DERIVED } from '$lib/data/provenance';
	import { itemTypeLabel } from '$lib/register/labels';
	import { count, duration, share } from '$lib/stats/format';
	import ExternalLink from '$lib/hud/ExternalLink.svelte';
	import MemberTable from '$lib/stats/MemberTable.svelte';
	import PartyBars from '$lib/stats/PartyBars.svelte';

	let { data } = $props();

	const s = $derived(data.stats);
	const t = $derived(data.stats.totals);
	const termLabel = $derived((data.index?.terms ?? []).find((x) => x.term === s.term)?.label_en ?? `Term ${s.term}`);
	const domainName = $derived(new Map((data.index?.policy_domains ?? []).map((d) => [d.id, d.name_en])));
</script>

<svelte:head>
	<title>Speaking time · {s.date} · Siambr</title>
</svelte:head>

<main id="main">
	<p class="kicker">Siambr · {termLabel} · Derived figures</p>
	<header class="head">
		<h1>Speaking time on <time datetime={s.date}>{s.date}</time></h1>
		<p class="badge" data-provenance={PROVENANCE_DERIVED}>{BADGE.timestamps}</p>
		<p class="method">{s.method}</p>
		<p class="small links">
			<a href="/sitting/{s.date}">Watch this sitting play</a>
			<a href="/terms/{s.term}/stats">Stats for the {termLabel}</a>
			<ExternalLink href={s.source_xml_url}>Record of Proceedings</ExternalLink>
		</p>
	</header>

	<section aria-labelledby="totals">
		<h2 id="totals">The sitting in figures</h2>
		<dl class="totals">
			<div><dt>Speaking time counted</dt><dd data-numeric>{duration(t.speaking_seconds)}</dd></div>
			<div><dt>Contributions</dt><dd data-numeric>{count(t.contributions)}</dd></div>
			<div>
				<dt>Spoken in Welsh</dt>
				<dd data-numeric>{count(t.welsh_contributions)}</dd>
				<dd class="small">{share(t.welsh_contributions, t.contributions)} of {count(t.contributions)} contributions.</dd>
			</div>
			<div>
				<dt>Untimed contributions</dt>
				<dd data-numeric>{count(t.untimed_contributions)}</dd>
				<dd class="small">The Record publishes no broadcast offset for these, so they carry no speaking time.</dd>
			</div>
			<div>
				<dt>Roll-call divisions</dt>
				<dd data-numeric>{count(t.divisions)}</dd>
				{#if t.divisions === 0}<p class="small">No roll-call division was held on this sitting day.</p>{/if}
			</div>
		</dl>
	</section>

	<section aria-labelledby="parties">
		<h2 id="parties">Speaking time by party</h2>
		<PartyBars rows={s.by_party} caption="Seconds on the floor, summed from Senedd TV offsets. Party as recorded on this date." />
	</section>

	<section aria-labelledby="members">
		<h2 id="members">Speaking time by Member</h2>
		<MemberTable rows={s.by_member} caption="Every Member who spoke on this date. Select a column heading to sort." />
	</section>

	<section aria-labelledby="items">
		<h2 id="items">Speaking time by agenda item</h2>
		<table>
			<caption class="small">Items in the order the Record lists them.</caption>
			<thead>
				<tr>
					<th scope="col">Item</th>
					<th scope="col">Speaking time</th>
					<th scope="col">Contributions</th>
					<th scope="col">Untimed</th>
				</tr>
			</thead>
			<tbody>
				{#each s.by_item as i (i.item_id)}
					<tr>
						<th scope="row">
							<a href="/sitting/{s.date}?item={encodeURIComponent(i.item_id)}">{i.title_en}</a>
							<span class="small meta">{itemTypeLabel(i.type)} · {domainName.get(i.policy_domain_id) ?? i.policy_domain_id}</span>
						</th>
						<td data-numeric>{duration(i.seconds)}</td>
						<td data-numeric>{count(i.contributions)}</td>
						<td data-numeric>{count(i.untimed_contributions)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<footer class="citation small">
		Figures derived by Siambr from the
		<ExternalLink href={s.source_xml_url}>Record of Proceedings</ExternalLink> for this date. Speaking time is a sum of the Senedd's own
		broadcast offsets; item types and policy domains are Siambr groupings.
	</footer>
</main>

<style>
	main {
		max-width: 60rem;
		margin: 0 auto;
		padding: 3rem 1rem 4rem;
	}

	.head {
		margin-bottom: 2.5rem;
	}

	.head h1 {
		margin-bottom: 0.5rem;
	}

	.badge {
		display: inline-block;
		margin: 0 0 0.5rem;
		padding: 0.15rem 0.5rem;
		border: 1px solid var(--color-timber-cedar);
		color: var(--color-timber-cedar-dark);
		font: 700 var(--text-kicker) var(--font-sans);
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.method {
		max-width: 60ch;
		margin: 0 0 0.75rem;
	}

	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin: 0;
	}

	section {
		margin: 0 0 2.5rem;
	}

	section h2 {
		font-size: var(--text-h3);
		font-family: var(--font-sans);
		padding-bottom: 0.4rem;
		border-bottom: 1px solid var(--color-rule-strong);
	}

	.totals {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 1rem 1.5rem;
		margin: 0;
	}

	.totals dt {
		color: var(--color-muted);
		font-size: var(--text-kicker);
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.totals dd {
		margin: 0.15rem 0 0;
		font: 600 1.6rem var(--font-mono);
		color: var(--color-ink);
	}

	.totals dd.small {
		font: 400 var(--text-small) / 1.45 var(--font-sans);
		margin: 0.15rem 0 0;
		color: var(--color-body-text);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-small);
	}

	caption {
		text-align: left;
		color: var(--color-body-text);
		padding-bottom: 0.5rem;
	}

	th,
	td {
		padding: 0.45rem 0.5rem 0.45rem 0;
		text-align: left;
		vertical-align: top;
		border-bottom: 1px solid var(--color-border);
	}

	thead th {
		border-bottom: 1px solid var(--color-rule-strong);
	}

	.meta {
		display: block;
		color: var(--color-body-text);
	}

	.citation {
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
		color: var(--color-body-text);
	}
</style>
