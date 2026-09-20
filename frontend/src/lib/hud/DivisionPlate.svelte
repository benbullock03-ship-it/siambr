<script lang="ts">
	import type { Division, MemberLight, SittingItem, VoteCast } from '$lib/data/types';
	import { divisionAnchor } from '$lib/dossier/anchors';
	import { ballotsByParty } from '$lib/dossier/divisions';
	import { partyColor, partyLabel } from '$lib/dossier/parties';

	let {
		division,
		speakers,
		members = false,
		items = [],
		date = ''
	}: {
		division: Division;
		speakers: Record<string, MemberLight>;
		/** Also list every Member's own ballot under their party. */
		members?: boolean;
		items?: SittingItem[];
		date?: string;
	} = $props();

	const VOTE_LABEL: Record<VoteCast, string> = {
		for: 'For',
		against: 'Against',
		abstain: 'Abstain',
		did_not_vote: 'Did not vote'
	};

	interface MotionContext {
		itemNumber: number | null;
		topic: string;
		action: string | null;
		tabledBy: string | null;
		debateItem: SittingItem | null;
	}

	function parseContext(text: string, itemsList: SittingItem[]): MotionContext {
		const match = text.match(/^Item\s+(\d+)\.\s*(.*?)(?:\.\s*(.*))?$/i);
		if (!match) {
			return { itemNumber: null, topic: text, action: null, tabledBy: null, debateItem: null };
		}
		const itemNum = parseInt(match[1], 10);
		const topic = match[2].trim();
		const remainder = match[3]?.trim() ?? null;

		let action = remainder;
		let tabledBy: string | null = null;

		if (remainder) {
			const tabledMatch = remainder.match(/tabled\s+in\s+the\s+name\s+of\s+([^.]+)/i);
			if (tabledMatch) {
				tabledBy = tabledMatch[1].trim();
			}
		}

		let debateItem = itemsList.find((i) => i.order + 1 === itemNum) ?? null;
		if (!debateItem && topic) {
			const cleanTopic = topic.toLowerCase().replace(/[^a-z0-9]/g, '');
			debateItem = itemsList.find((i) => i.title_en.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanTopic)) ?? null;
		}

		return { itemNumber: itemNum, topic, action, tabledBy, debateItem };
	}

	const ctx = $derived(parseContext(division.motion_text, items));
	const rows = $derived(ballotsByParty(division, speakers));
	const headingId = $derived(`${divisionAnchor(division.id)}-heading`);
</script>

<section id={divisionAnchor(division.id)} tabindex="-1" class="division" aria-labelledby={headingId}>
	<p class="kicker">Division · Official division result</p>
	<h3 id={headingId}>{division.motion_text}</h3>

	<div class="debate-context">
		<div class="context-pill">
			<span class="context-kicker">Debate Business</span>
			{#if ctx.debateItem}
				<span class="context-item-title">{ctx.debateItem.title_en}</span>
			{:else}
				<span class="context-item-title">{ctx.topic}</span>
			{/if}
		</div>

		{#if ctx.action}
			<p class="context-detail">
				<span class="action-type">{ctx.action}</span>
				{#if ctx.tabledBy}
					· <span class="tabled-by">Tabled by <strong>{ctx.tabledBy}</strong></span>
				{/if}
			</p>
		{/if}

		{#if ctx.debateItem}
			<div class="context-actions">
				<a href="/register?item={encodeURIComponent(ctx.debateItem.id)}" class="context-link">
					Read debate & speeches ({ctx.debateItem.contribution_count} contributions) →
				</a>
				{#if date}
					<a href="/sitting/{date}?item={encodeURIComponent(ctx.debateItem.id)}" class="context-link secondary">
						Watch debate in chamber
					</a>
				{/if}
			</div>
		{/if}
	</div>

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
		margin-bottom: 0.6rem;
	}

	.debate-context {
		background: var(--color-panel);
		border-left: 3px solid var(--color-timber-cedar);
		padding: 0.75rem 1rem;
		margin: 0.75rem 0 1rem;
		border-radius: 2px;
	}

	.context-pill {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.context-kicker {
		font-size: var(--text-kicker);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-timber-cedar-dark);
	}

	.context-item-title {
		font-family: var(--font-serif);
		font-weight: 600;
		color: var(--color-ink);
		font-size: 1.05rem;
	}

	.context-detail {
		margin: 0.2rem 0 0.5rem;
		font-size: var(--text-small);
		color: var(--color-body-text);
	}

	.action-type {
		font-weight: 600;
	}

	.context-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.context-link {
		font-size: var(--text-small);
		font-weight: 600;
		color: var(--color-accent-plum-dark);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.context-link.secondary {
		color: var(--color-body-text);
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
