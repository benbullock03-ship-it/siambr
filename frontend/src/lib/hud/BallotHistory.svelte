<script lang="ts">
	import { BADGE } from '$lib/data/provenance';
	import type { MemberBallot } from '$lib/data/types';
	import { groupBallots, tallyBallots } from '$lib/stage/ballots';
	import VoteChip from './VoteChip.svelte';
	import VoteLegend from './VoteLegend.svelte';

	/** A Member's roll-call divisions by sitting day and debate; shared by the Register page and the stage drawer. */
	let {
		ballots,
		openDays = 5,
		headingId
	}: {
		ballots: MemberBallot[];
		/** Sitting days beyond this many start collapsed; every vote is still in the page. */
		openDays?: number;
		headingId: string;
	} = $props();

	const tally = $derived(tallyBallots(ballots));
	const days = $derived(groupBallots(ballots));
</script>

{#if ballots.length}
	<p class="small count" aria-describedby="{headingId}-badge">
		<span data-numeric>{ballots.length.toLocaleString('en-GB')}</span> recorded votes. {BADGE.division}.
	</p>
	<dl class="tally" aria-label="This Member’s votes, counted">
		<div><dt>For</dt><dd data-numeric>{tally.for}</dd></div>
		<div><dt>Against</dt><dd data-numeric>{tally.against}</dd></div>
		<div><dt>Abstain</dt><dd data-numeric>{tally.abstain}</dd></div>
		<div><dt>Did not vote</dt><dd data-numeric>{tally.did_not_vote}</dd></div>
	</dl>
	<p id="{headingId}-badge" class="small badge">{BADGE.counted}: a sum of the official division rows.</p>
	<VoteLegend />

	{#each days as day, i (day.date)}
		<details class="day" open={i < openDays}>
			<summary>
				<time datetime={day.date}>{day.date}</time>
				<span class="small" data-numeric>{day.count} {day.count === 1 ? 'division' : 'divisions'}</span>
			</summary>
			{#each day.debates as debate (debate.itemId + debate.title)}
				<section class="debate">
					<h4>{debate.title}</h4>
					<p class="small links">
						<a href="/sitting/{day.date}?item={encodeURIComponent(debate.itemId)}">Watch it in the chamber</a>
						<a href="/register?item={encodeURIComponent(debate.itemId)}">{debate.fallback ? 'Read the division' : 'Read the debate'}</a>
					</p>
					<ol class="rows">
						{#each debate.rows as row (row.ballot.division_id)}
							<li>
								<span class="target">{row.targetLabel}{#if row.tabledBy}<span class="small tabled"> tabled in the name of {row.tabledBy}</span>{/if}</span>
								<VoteChip vote={row.ballot.vote_cast} />
								<span class="result" class:agreed={row.ballot.result === 'agreed'}>{row.ballot.result === 'agreed' ? 'Agreed' : 'Not agreed'}</span>
							</li>
						{/each}
					</ol>
				</section>
			{/each}
		</details>
	{/each}
{:else}
	<p>No roll-call divisions on record for this Member.</p>
{/if}

<style>
	.count {
		margin: 0 0 0.5rem;
		color: var(--color-body-text);
	}

	.tally {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.5rem;
		margin: 0 0 0.25rem;
	}

	.tally div {
		display: flex;
		flex-direction: column;
	}

	.tally dt {
		font-size: var(--text-small);
		color: var(--color-body-text);
	}

	.tally dd {
		margin: 0;
		font: 600 1.25rem var(--font-sans);
		color: var(--color-ink);
	}

	.badge {
		margin: 0 0 0.6rem;
		color: var(--color-body-text);
	}

	.day {
		content-visibility: auto;
		contain-intrinsic-size: auto 20rem;
	}

	.day summary {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-height: var(--tap-min);
		margin: 1rem 0 0.25rem;
		font: 600 1rem var(--font-sans);
		cursor: pointer;
	}

	.day summary .small {
		color: var(--color-body-text);
	}

	.debate {
		padding: 0.5rem 0 0.75rem;
		border-top: 1px solid var(--color-border);
	}

	.debate h4 {
		margin: 0 0 0.2rem;
		font: 600 1rem var(--font-serif);
		color: var(--color-ink);
	}

	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin: 0 0 0.4rem;
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.rows li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.3rem 0;
		border-top: 1px dashed var(--color-border);
	}

	.target {
		font-weight: 600;
		color: var(--color-ink);
	}

	.tabled {
		font-weight: 400;
		color: var(--color-body-text);
	}

	.result {
		font-size: var(--text-small);
		color: var(--color-body-text);
	}

	.result.agreed {
		color: var(--color-ink);
	}

	@media (max-width: 480px) {
		.rows li {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.result {
			grid-column: 1 / -1;
		}
	}
</style>
