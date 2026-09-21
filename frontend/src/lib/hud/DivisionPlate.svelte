<script lang="ts">
	import type { Division, MemberLight, SittingItem, TabledText } from '$lib/data/types';
	import { BADGE } from '$lib/data/provenance';
	import { divisionAnchor } from '$lib/dossier/anchors';
	import { ballotsByParty } from '$lib/dossier/divisions';
	import { partyColor, partyLabel } from '$lib/dossier/parties';
	import { agreedAmendmentTexts, debateItemOf, itemTitle, memberNamed, readMotion, tabledTextFor, targetLabel } from '$lib/stage/votes';
	import VoteChip from './VoteChip.svelte';
	import VoteLegend from './VoteLegend.svelte';

	let {
		division,
		speakers,
		members = false,
		items = [],
		divisions = [],
		tabledTexts = [],
		date = '',
		context = true
	}: {
		division: Division;
		speakers: Record<string, MemberLight>;
		/** Also list every Member's own ballot under their party. */
		members?: boolean;
		items?: SittingItem[];
		/** Sibling divisions of the sitting, to read which amendments were agreed. */
		divisions?: Division[];
		/** The sitting's printed motions and amendments; with none, no text is shown. */
		tabledTexts?: TabledText[];
		date?: string;
		/** Show the debate the vote belongs to; off when the surround already says. */
		context?: boolean;
	} = $props();

	const reading = $derived(readMotion(division.motion_text));
	const debateItem = $derived(debateItemOf(division, items));
	const rows = $derived(ballotsByParty(division, speakers));
	const votedText = $derived(context ? tabledTextFor(division, { items, tabled_texts: tabledTexts }) : null);
	const agreedTexts = $derived(context && reading.target.kind === 'motion_as_amended' ? agreedAmendmentTexts(division, divisions, { items, tabled_texts: tabledTexts }) : []);
	const lines = (t: TabledText) => t.text_english.split(/\n+/).map((l) => l.trim()).filter(Boolean);
	const partyOf = (head: string) => memberNamed(head.replace(/^(?:Amendment\s+\d+|Motion\s+\S+)\s*[—–-]?\s*/i, ''), speakers)?.party_id ?? null;
	const headingId = $derived(`${divisionAnchor(division.id)}-heading`);
</script>

<section id={divisionAnchor(division.id)} tabindex="-1" class="division" aria-labelledby={headingId}>
	<p class="kicker">Division · Official division result</p>
	<h3 id={headingId}>{division.motion_text}</h3>

	{#if context}
		<div class="debate-context">
			<p class="context-line">
				<span class="context-kicker">{targetLabel(reading.target)}</span>
				{#if reading.tabledBy}<span class="small">tabled in the name of <strong>{reading.tabledBy}</strong></span>{/if}
			</p>
			<p class="context-item-title">{debateItem ? itemTitle(debateItem.title_en) : reading.topic}</p>
			{#if debateItem}
				<div class="context-actions">
					<a href="/register?item={encodeURIComponent(debateItem.id)}" class="context-link">Read the debate ({debateItem.contribution_count} contributions)</a>
					{#if date}
						<a href="/sitting/{date}?item={encodeURIComponent(debateItem.id)}" class="context-link secondary">Watch it in the chamber</a>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	{#if votedText}
		{@const [head, ...body] = lines(votedText)}
		{@const motionParty = partyOf(head)}
		<details class="voted">
			<summary>What was voted on <span class="badge small">{BADGE.verbatim} · as tabled</span></summary>
			{#if reading.target.kind === 'motion_as_amended'}
				<p class="small as-amended">
					The Record prints no merged text. The Senedd agreed the motion as changed by
					{agreedTexts.length ? `amendment${agreedTexts.length > 1 ? 's' : ''} ${agreedTexts.map((t) => t.amendment_number).join(', ')}` : 'no agreed amendment'}
					(from the division results). Each agreed amendment is printed first, then the motion as tabled.
				</p>
				{#each agreedTexts as t (t.id)}
					{@const [ahead, ...abody] = lines(t)}
					{@const party = partyOf(ahead)}
					<article class="tabled-item">
						<p class="voted-head">
							<span>{ahead}</span>
							{#if party}<span class="party-tag" style:--party={partyColor(party)} title="Derived by Siambr from the Members register">{partyLabel(party)}</span>{/if}
							<span class="outcome">Agreed</span>
						</p>
						<div class="text" lang="en">{#each abody as para, i (i)}<p>{para}</p>{/each}</div>
					</article>
				{/each}
				<p class="kicker sub">The motion as tabled</p>
			{/if}
			<p class="voted-head">
				<span>{head}</span>
				{#if motionParty}<span class="party-tag" style:--party={partyColor(motionParty)} title="Derived by Siambr from the Members register">{partyLabel(motionParty)}</span>{/if}
			</p>
			<div class="text" lang="en">{#each body as para, i (i)}<p>{para}</p>{/each}</div>
			{#if votedText.lang === 'cy'}
				<details class="cy">
					<summary class="small">Yn Gymraeg · as printed</summary>
					<div class="text" lang="cy">{#each votedText.text_original.split(/\n+/).filter((l) => l.trim()) as para, i (i)}<p>{para}</p>{/each}</div>
				</details>
			{/if}
		</details>
	{/if}

	<p class="tally">
		<span data-numeric>{division.votes_for} For / {division.votes_against} Against / {division.votes_abstain} Abstain</span>
		<strong>{division.result === 'agreed' ? 'Agreed' : 'Not agreed'}</strong>
	</p>
	<VoteLegend />

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
							<li><a href={`/members/${b.memberId}`}>{b.name}</a><VoteChip vote={b.vote} /></li>
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

	.context-line {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
		margin: 0 0 0.2rem;
	}

	.context-kicker {
		font-size: var(--text-kicker);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-timber-cedar-dark);
	}

	.context-item-title {
		margin: 0;
		font-family: var(--font-serif);
		font-weight: 600;
		color: var(--color-ink);
		font-size: 1.05rem;
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

	.voted {
		margin: 0 0 1rem;
		border-left: 3px solid var(--color-border);
		padding-left: 0.75rem;
	}

	.voted > summary {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: baseline;
		min-height: var(--tap-min);
		cursor: pointer;
		font-weight: 600;
	}

	.voted-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin: 0.5rem 0;
		font: 600 1rem var(--font-serif);
		color: var(--color-ink);
	}

	.party-tag {
		padding: 0 0.45rem;
		font: 600 var(--text-kicker) var(--font-sans);
		color: var(--color-ground);
		background: var(--party);
		border-radius: var(--rounded-pill);
	}

	.outcome {
		padding: 0.1rem 0.5rem;
		background: var(--color-success);
		color: var(--color-ground);
		font: 700 var(--text-kicker) var(--font-sans);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.as-amended {
		margin: 0.5rem 0;
		color: var(--color-body-text);
	}

	.tabled-item {
		padding: 0.25rem 0 0.25rem 0.75rem;
		border-left: 3px solid var(--color-timber-cedar);
		margin-bottom: 0.75rem;
	}

	.kicker.sub {
		margin: 0.25rem 0 0;
	}

	.text p {
		font-size: 0.95rem;
		line-height: 1.55;
		margin: 0 0 0.6em;
	}

	.cy summary {
		cursor: pointer;
		color: var(--color-body-text);
	}

	.tally {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		margin-bottom: 0.5rem;
		color: var(--color-ink);
	}

	.division > :global(.legend) {
		margin-bottom: 1rem;
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
