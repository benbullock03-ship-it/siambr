<script lang="ts">
	import type { Division, MemberLight, VoteCast } from '$lib/data/types';
	import { divisionAnchor } from '$lib/dossier/anchors';
	import { ballotsByParty } from '$lib/dossier/divisions';
	import { partyColor, partyLabel } from '$lib/dossier/parties';

	let {
		division,
		speakers,
		members = false
	}: {
		division: Division;
		speakers: Record<string, MemberLight>;
		/** Also list every Member's own ballot under their party. */
		members?: boolean;
	} = $props();

	const VOTE_LABEL: Record<VoteCast, string> = {
		for: 'For',
		against: 'Against',
		abstain: 'Abstain',
		did_not_vote: 'Did not vote'
	};

	const rows = $derived(ballotsByParty(division, speakers));
	const headingId = $derived(`${divisionAnchor(division.id)}-heading`);
</script>

<section id={divisionAnchor(division.id)} tabindex="-1" class="division" aria-labelledby={headingId}>
	<p class="kicker">Division · Official division result</p>
	<h3 id={headingId}>{division.motion_text}</h3>
	<p class="tally">
		<span data-numeric>{division.votes_for} For / {division.votes_against} Against / {division.votes_abstain} Abstain</span>
		<strong>{division.result === 'agreed' ? 'Agreed' : 'Not agreed'}</strong>
	</p>

	{#if rows.length}
		<div class="table-wrap">
			<table>
				<caption class="small">Recorded ballots by party on the day of the vote</caption>
				<thead>
					<tr>
						<th scope="col">Party</th>
						<th scope="col">For</th>
						<th scope="col">Against</th>
						<th scope="col">Abstain</th>
						<th scope="col">Did not vote</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as r (r.partyId)}
						<tr>
							<th scope="row"><span class="swatch" style:background={partyColor(r.partyId)}></span>{partyLabel(r.partyId)}</th>
							<td data-numeric>{r.for}</td>
							<td data-numeric>{r.against}</td>
							<td data-numeric>{r.abstain}</td>
							<td data-numeric>{r.didNotVote}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if members}
			{#each rows as r (r.partyId)}
				<details class="ballots">
					<summary><span class="swatch" style:background={partyColor(r.partyId)}></span>{partyLabel(r.partyId)}<span class="small" data-numeric>{r.members.length}</span></summary>
					<ul>
						{#each r.members as b (b.memberId)}
							<li><a href={`/members/${b.memberId}`}>{b.name}</a><span class="small">{VOTE_LABEL[b.vote]}</span></li>
						{/each}
					</ul>
				</details>
			{/each}
		{/if}
	{:else}
		<p class="small">No member-level ballots on record for this division.</p>
	{/if}
</section>

<style>
	.division {
		padding: 1.25rem 0;
		border-top: 1px solid var(--color-rule-strong);
		scroll-margin-top: 1rem;
	}

	h3 {
		font-family: var(--font-serif);
	}

	.tally {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		color: var(--color-ink);
	}

	.table-wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	caption {
		text-align: left;
		color: var(--color-body-text);
		padding-bottom: 0.4rem;
	}

	th,
	td {
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid var(--color-border);
		text-align: right;
	}

	th[scope='row'],
	th[scope='col']:first-child {
		text-align: left;
	}

	thead th {
		font-size: var(--text-small);
		color: var(--color-body-text);
		font-weight: 600;
	}

	.ballots summary {
		display: flex;
		gap: 0.45rem;
		align-items: baseline;
		min-height: var(--tap-min);
		padding: 0.3rem 0;
		cursor: pointer;
		font-weight: 600;
	}

	.ballots summary .small {
		margin-left: auto;
		color: var(--color-muted);
	}

	.ballots ul {
		list-style: none;
		margin: 0 0 0.5rem;
		padding: 0 0 0 1.15rem;
	}

	.ballots li {
		display: flex;
		gap: 0.6rem;
		justify-content: space-between;
		padding: 0.15rem 0;
		border-bottom: 1px solid var(--color-border);
	}

	.swatch {
		display: inline-block;
		width: 0.7em;
		height: 0.7em;
		margin-right: 0.45em;
	}
</style>
