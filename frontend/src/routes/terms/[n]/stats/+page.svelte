<script lang="ts">
	import { BADGE, PROVENANCE_DERIVED } from '$lib/data/provenance';
	import { partyLabel } from '$lib/dossier/parties';
	import { count, duration, share } from '$lib/stats/format';
	import MemberTable from '$lib/stats/MemberTable.svelte';
	import PartyBars from '$lib/stats/PartyBars.svelte';

	let { data } = $props();

	const s = $derived(data.stats);
	const t = $derived(data.stats.totals);
	const matrix = $derived(data.stats.party_by_domain);
	const domainName = $derived(new Map((data.index?.policy_domains ?? []).map((d) => [d.id, d.name_en])));

	const cell = $derived.by(() => {
		const byKey = new Map(matrix.cells.map((c) => [`${c.party_id ?? ''}|${c.domain_id}`, c]));
		return (party: string | null, domain: string) => byKey.get(`${party ?? ''}|${domain}`) ?? null;
	});
	const rowTotal = $derived((party: string | null) =>
		matrix.cells.filter((c) => c.party_id === party).reduce((n, c) => n + c.contributions, 0)
	);
	const columnTotal = $derived((domain: string) =>
		matrix.cells.filter((c) => c.domain_id === domain).reduce((n, c) => n + c.contributions, 0)
	);
	const matrixTotal = $derived(matrix.cells.reduce((n, c) => n + c.contributions, 0));
</script>

<svelte:head>
	<title>Speaking time · {s.label_en} · Siambr</title>
</svelte:head>

<main id="main">
	<p class="kicker">Siambr · Register · Derived figures</p>
	<header class="head">
		<h1>Speaking time in the {s.label_en}</h1>
		<p class="badge" data-provenance={PROVENANCE_DERIVED}>{BADGE.timestamps}</p>
		<p class="method">{s.method}</p>
		<p class="small links">
			<a href="/register?term={s.term}">Sittings of this term</a>
			<a href="/members">Members</a>
		</p>
	</header>

	<section aria-labelledby="totals">
		<h2 id="totals">The term in figures</h2>
		<dl class="totals">
			<div><dt>Sittings on record</dt><dd data-numeric>{count(s.sitting_count)}</dd></div>
			<div><dt>Speaking time counted</dt><dd data-numeric>{duration(t.speaking_seconds)}</dd></div>
			<div><dt>Contributions</dt><dd data-numeric>{count(t.contributions)}</dd></div>
			<div>
				<dt>Spoken in Welsh</dt>
				<dd data-numeric>{count(t.welsh_contributions)}</dd>
				<p class="small">{share(t.welsh_contributions, t.contributions)} of {count(t.contributions)} contributions.</p>
			</div>
			<div>
				<dt>Untimed contributions</dt>
				<dd data-numeric>{count(t.untimed_contributions)}</dd>
				<p class="small">The Record publishes no broadcast offset for these, so they carry no speaking time.</p>
			</div>
			<div><dt>Roll-call divisions</dt><dd data-numeric>{count(t.divisions)}</dd></div>
		</dl>
	</section>

	<section aria-labelledby="parties">
		<h2 id="parties">Speaking time by party</h2>
		<PartyBars rows={s.by_party} caption="Seconds on the floor across every sitting of this term, summed from Senedd TV offsets." />
	</section>

	<section aria-labelledby="members">
		<h2 id="members">Speaking time by Member</h2>
		<MemberTable rows={s.by_member} caption="Every Member who spoke in this term. Select a column heading to sort." />
	</section>

	<section aria-labelledby="matrix">
		<h2 id="matrix">Contributions by party by policy domain</h2>
		<p class="small">
			Counts of contributions, not shares. {BADGE.topic}: the policy domain is a Siambr grouping of the agenda item, and the speech
			itself is verbatim.
		</p>
		<div class="scroll">
			<table class="matrix">
				<caption class="small">Rows are parties as recorded on each sitting date; columns are policy domains.</caption>
				<thead>
					<tr>
						<th scope="col">Party</th>
						{#each matrix.domains as d (d)}<th scope="col">{domainName.get(d) ?? d}</th>{/each}
						<th scope="col">All domains</th>
					</tr>
				</thead>
				<tbody>
					{#each matrix.parties as p (p ?? 'none')}
						<tr>
							<th scope="row">{partyLabel(p)}</th>
							{#each matrix.domains as d (d)}
								<td data-numeric>{count(cell(p, d)?.contributions ?? 0)}</td>
							{/each}
							<td data-numeric class="total">{count(rowTotal(p))}</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr>
						<th scope="row">All parties</th>
						{#each matrix.domains as d (d)}<td data-numeric class="total">{count(columnTotal(d))}</td>{/each}
						<td data-numeric class="total">{count(matrixTotal)}</td>
					</tr>
				</tfoot>
			</table>
		</div>
	</section>

	<section aria-labelledby="sittings">
		<h2 id="sittings">By sitting</h2>
		<table>
			<caption class="small">Sittings of this term, newest first.</caption>
			<thead>
				<tr>
					<th scope="col">Sitting</th>
					<th scope="col">Speaking time</th>
					<th scope="col">Contributions</th>
					<th scope="col">Untimed</th>
					<th scope="col">Divisions</th>
				</tr>
			</thead>
			<tbody>
				{#each s.by_sitting as row (row.date)}
					<tr>
						<th scope="row"><a href="/sitting/{row.date}/stats"><time datetime={row.date}>{row.date}</time></a></th>
						<td data-numeric>{duration(row.speaking_seconds)}</td>
						<td data-numeric>{count(row.contributions)}</td>
						<td data-numeric>{count(row.untimed_contributions)}</td>
						<td data-numeric>{count(row.divisions)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<footer class="citation small">
		Figures derived by Siambr from the Records of Proceedings of this term. Speaking time is a sum of the Senedd's own broadcast
		offsets; policy domains are Siambr groupings.
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

	.totals p {
		margin: 0.15rem 0 0;
		color: var(--color-body-text);
	}

	.scroll {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-small);
	}

	.matrix {
		min-width: 40rem;
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

	tfoot th,
	.total {
		font-weight: 600;
		color: var(--color-ink);
	}

	tfoot td,
	tfoot th {
		border-top: 1px solid var(--color-rule-strong);
		border-bottom: 0;
	}

	.citation {
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
		color: var(--color-body-text);
	}
</style>
