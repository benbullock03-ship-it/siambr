<script lang="ts">
	import type { Sitting } from '$lib/data/types';
	import { wallClockAt, type SittingClock } from '../clock.svelte';

	let { clock, sitting }: { clock: SittingClock; sitting: Sitting } = $props();

	const timeline = $derived(clock.timeline);
	const live = $derived(clock.floor.live);
	const liveIndex = $derived(live?.index ?? -1);
	const name = (memberId: string) => sitting.speakers[memberId]?.canonical_name ?? memberId;
	/** Record order per item, each contribution paired with its beat. */
	const rows = $derived(
		timeline.items.map((item) => ({
			item,
			beats: sitting.contributions
				.filter((c) => c.item_id === item.id)
				.map((c) => timeline.beats[timeline.beatIndexByContributionId.get(c.id) ?? -1])
				.filter(Boolean),
			divisions: sitting.divisions.filter((d) => d.item_id === item.id).map((d) => timeline.beats[timeline.beatIndexByDivisionId.get(d.id) ?? -1]).filter(Boolean)
		}))
	);
	let open = $state<Record<string, boolean>>({});
	$effect(() => {
		const id = live?.itemId;
		if (id && open[id] === undefined) open[id] = true;
	});
	const isOpen = (id: string) => open[id] ?? id === live?.itemId;
</script>

<nav class="order" aria-label="Running order">
	{#each rows as { item, beats, divisions } (item.id)}
		<details open={isOpen(item.id)} ontoggle={(e) => (open[item.id] = e.currentTarget.open)}>
			<summary class:live={live?.itemId === item.id}>
				<span class="title">{item.title_en}</span>
				<span class="count small" data-numeric>{beats.length}</span>
			</summary>
			{#if !beats.length && !divisions.length}
				<p class="small empty">No contributions on record for this item.</p>
			{/if}
			<ol>
				{#each beats as beat (beat.index)}
					{#if beat.kind === 'contribution'}
						<li>
							<button type="button" class="row" aria-current={beat.index === liveIndex ? 'true' : undefined} onclick={() => clock.seek(beat.t)}>
								<span class="time small" data-numeric>{beat.timed ? (wallClockAt(sitting.meeting_start_time, beat.t) ?? `${beat.t} s`) : 'untimed'}</span>
								<span class="who">{name(beat.contribution.member_id)}</span>
								{#if beat.contribution.lang === 'cy'}<span class="lang small">cy</span>{/if}
							</button>
						</li>
					{/if}
				{/each}
				{#each divisions as beat (beat.index)}
					{#if beat.kind === 'division'}
						<li>
							<button type="button" class="row division" aria-current={beat.index === liveIndex ? 'true' : undefined} onclick={() => clock.seek(beat.t)}>
								<span class="time small">division</span>
								<span class="who">{beat.division.result === 'agreed' ? 'Agreed' : 'Negatived'}: {beat.division.motion_text}</span>
							</button>
						</li>
					{/if}
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

	.empty {
		margin: 0;
		padding: 0.25rem 2rem 0.75rem;
		color: var(--color-muted);
	}
</style>
