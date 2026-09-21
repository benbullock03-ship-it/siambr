<script lang="ts">
	import type { Sitting } from '$lib/data/types';
	import { wallClockAt, type SittingClock } from '../clock.svelte';
	import { debateItemOf, itemTitle, memberNamed, readMotion, targetLabel } from '../votes';
	import { partyLabel } from '$lib/dossier/parties';

	let { clock, sitting }: { clock: SittingClock; sitting: Sitting } = $props();

	const timeline = $derived(clock.timeline);
	const live = $derived(clock.floor.live);
	const liveIndex = $derived(live?.index ?? -1);
	const name = (memberId: string) => sitting.speakers[memberId]?.canonical_name ?? memberId;
	/** Which debate each division decided, by the item number printed in its motion text. Derived. */
	const debateOf = $derived(new Map(sitting.divisions.map((d) => [d.id, debateItemOf(d, sitting.items)])));
	const votesOn = $derived.by(() => {
		const out = new Map<string, number>();
		for (const d of sitting.divisions) {
			const id = debateOf.get(d.id)?.id;
			if (id) out.set(id, (out.get(id) ?? 0) + 1);
		}
		return out;
	});
	/** Record order per item: each contribution paired with its beat, then the item's divisions. */
	const rows = $derived(
		timeline.items.map((item) => {
			const beats = sitting.contributions
				.filter((c) => c.item_id === item.id)
				.map((c) => timeline.beats[timeline.beatIndexByContributionId.get(c.id) ?? -1])
				.filter(Boolean);
			const divisions = sitting.divisions
				.filter((d) => d.item_id === item.id)
				.map((d) => timeline.beats[timeline.beatIndexByDivisionId.get(d.id) ?? -1])
				.filter(Boolean);
			return { item, beats, divisions, all: [...beats, ...divisions].sort((a, b) => a.t - b.t || a.index - b.index) };
		})
	);
	let open = $state<Record<string, boolean>>({});
	$effect(() => {
		const id = live?.itemId;
		if (id && open[id] === undefined) open[id] = true;
	});
	const isOpen = (id: string) => open[id] ?? id === live?.itemId;
	// The live row keeps itself in view as playback moves on.
	let nav = $state<HTMLElement>();
	$effect(() => {
		void liveIndex;
		nav?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
	});
</script>

<nav class="order" aria-label="Running order" bind:this={nav}>
	{#each rows as { item, beats, divisions, all } (item.id)}
		<details open={isOpen(item.id)} ontoggle={(e) => (open[item.id] = e.currentTarget.open)}>
			<summary class:live={live?.itemId === item.id}>
				<span class="title">{item.title_en}</span>
				{#if divisions.length}<span class="votes small" data-numeric>{divisions.length} {divisions.length === 1 ? 'vote' : 'votes'}</span>{/if}
				{#if votesOn.get(item.id)}<span class="votes small">to a vote</span>{/if}
				<span class="count small" data-numeric>{beats.length}</span>
			</summary>
			{#if !beats.length && !divisions.length}
				<p class="small empty">No contributions on record for this item.</p>
			{/if}
			<ol>
				{#each all as beat (beat.index)}
					<li>
						{#if beat.kind === 'contribution'}
							<button type="button" class="row" aria-current={beat.index === liveIndex ? 'true' : undefined} onclick={() => clock.seek(beat.t)}>
								<span class="time small" data-numeric>{beat.timed ? (wallClockAt(sitting.meeting_start_time, beat.t) ?? `${beat.t} s`) : 'untimed'}</span>
								<span class="who">{name(beat.contribution.member_id)}</span>
								{#if beat.contribution.lang === 'cy'}<span class="lang small">cy</span>{/if}
							</button>
						{:else}
							{@const r = readMotion(beat.division.motion_text)}
							{@const debate = debateOf.get(beat.division.id)}
							{@const party = memberNamed(r.tabledBy, sitting.speakers)?.party_id}
							<button type="button" class="row division" class:agreed={beat.division.result === 'agreed'} aria-current={beat.index === liveIndex ? 'true' : undefined} onclick={() => clock.seek(beat.t)}>
								<span class="time small">Vote</span>
								<span class="who">
									<span class="question">{targetLabel(r.target)}{#if r.tabledBy} · {r.tabledBy}{/if}{#if party} <span class="tabler-party">{partyLabel(party)}</span>{/if}</span>
									<span class="topic small">{debate ? itemTitle(debate.title_en) : r.topic}</span>
								</span>
								<span class="result small">{beat.division.result === 'agreed' ? 'Agreed' : 'Not agreed'}</span>
							</button>
						{/if}
					</li>
				{/each}
			</ol>
		</details>
	{/each}
</nav>

<style>
	.order {
		font-family: var(--font-sans);
		background: var(--color-ground);
		border-top: 1px solid var(--color-border);
	}

	details {
		border-bottom: 1px solid var(--color-border);
	}

	summary {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		min-height: var(--tap-min);
		padding: 0.5rem 1.25rem;
		cursor: pointer;
		font: 600 var(--text-small) var(--font-sans);
		color: var(--color-ink);
	}

	summary.live {
		border-left: 3px solid var(--color-timber-cedar);
		padding-left: calc(1.25rem - 3px);
	}

	.count {
		margin-left: auto;
		color: var(--color-muted);
	}

	ol {
		list-style: none;
		margin: 0;
		padding: 0 0 0.5rem;
	}

	.row {
		display: flex;
		gap: 0.6rem;
		align-items: baseline;
		width: 100%;
		min-height: var(--tap-min);
		padding: 0.3rem 1.25rem 0.3rem 2rem;
		border: 0;
		background: none;
		text-align: left;
		font: var(--text-small) var(--font-sans);
		color: var(--color-body-text);
		cursor: pointer;
	}

	.row:hover {
		background: var(--color-panel);
	}

	.row[aria-current='true'] {
		background: var(--color-panel);
		color: var(--color-ink);
		box-shadow: inset 3px 0 0 var(--color-accent-plum);
	}

	.time {
		flex: 0 0 5.2rem;
		font-family: var(--font-mono);
		color: var(--color-body-text);
	}

	.who {
		flex: 1;
	}

	.lang {
		font-family: var(--font-mono);
		color: var(--color-muted);
	}

	.row.division {
		align-items: flex-start;
		border-left: 3px solid var(--color-timber-cedar);
		padding-left: calc(2rem - 3px);
		background: rgb(200 125 74 / 0.08);
	}

	.row.division.agreed {
		border-left-color: var(--color-success);
	}

	.row.division .time {
		color: var(--color-timber-cedar-dark);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.row.division .who {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.question {
		font-weight: 600;
		color: var(--color-ink);
	}

	.topic {
		color: var(--color-body-text);
	}

	.tabler-party {
		font-weight: 400;
		color: var(--color-muted);
	}

	.result {
		flex-shrink: 0;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-timber-cedar-dark);
	}

	.agreed .result {
		color: var(--color-success);
	}

	.votes {
		padding: 0 0.35rem;
		border: 1px solid var(--color-timber-cedar);
		color: var(--color-timber-cedar-dark);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-size: var(--text-kicker);
	}

	.empty {
		margin: 0;
		padding: 0.25rem 2rem 0.75rem;
		color: var(--color-muted);
	}
</style>
