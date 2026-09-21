<script lang="ts">
	import type { Sitting } from '$lib/data/types';
	import { wallClockAt, type SittingClock } from '../clock.svelte';
	import { itemNumber, itemTitle, readMotion, targetLabel } from '../votes';

	let { clock, sitting }: { clock: SittingClock; sitting: Sitting } = $props();

	const timeline = $derived(clock.timeline);
	const span = $derived(Math.max(1, timeline.tEnd));
	const frac = (t: number) => Math.min(t, span) / span;
	const pct = (t: number) => `${frac(t) * 100}%`;
	const label = (t: number) => wallClockAt(sitting.meeting_start_time, t) ?? `${Math.floor(t)} s`;
	/** Items with beats; an empty item has no width to tick. */
	const ticks = $derived(timeline.items.filter((i) => i.beatCount > 0));
	const numberOf = $derived(new Map(sitting.items.map((i) => [i.id, itemNumber(i)])));
	const divisions = $derived(timeline.beats.filter((b) => b.kind === 'division'));
	let hover = $state<{ x: number; title: string } | null>(null);

	// The readout: which item, and who or what holds the floor, at the playhead.
	const live = $derived(clock.floor.live);
	const liveItem = $derived(live ? (timeline.items.find((i) => i.id === live.itemId) ?? null) : null);
	const detail = $derived.by(() => {
		if (!live) return null;
		if (live.kind === 'division') {
			const votes = divisions.filter((b) => b.itemId === live.itemId);
			const n = votes.findIndex((b) => b.index === live.index) + 1;
			const q = targetLabel(readMotion(live.division.motion_text).target);
			return votes.length > 1 ? `Vote ${n} of ${votes.length} · ${q}` : q;
		}
		return sitting.speakers[live.contribution.member_id]?.canonical_name ?? live.contribution.member_id;
	});
	let trackWidth = $state(0);
	let readoutWidth = $state(0);
	const readoutLeft = $derived(Math.max(0, Math.min(trackWidth - readoutWidth, frac(clock.t) * trackWidth - readoutWidth / 2)));
</script>

<div class="scrub">
	<div class="track" aria-hidden="true" bind:clientWidth={trackWidth}>
		<span class="played" style:width={pct(clock.t)}></span>
		{#each ticks as item (item.id)}
			<span
				role="presentation"
				class="tick"
				class:live={liveItem?.id === item.id}
				class:done={item.t < clock.t}
				style:left={pct(item.t)}
				style:width={`calc(${pct(item.tEnd)} - ${pct(item.t)})`}
				onpointerenter={(e) => (hover = { x: e.clientX, title: item.title_en })}
				onpointerleave={() => (hover = null)}
			>
				<span class="n">{numberOf.get(item.id) ?? item.order + 1}</span>
			</span>
		{/each}
		{#each divisions as d (d.index)}
			<span class="division" class:agreed={d.division.result === 'agreed'} style:left={pct(d.t)} style:width={`calc(${pct(d.tEnd)} - ${pct(d.t)})`}></span>
		{/each}
		{#if liveItem}
			<p class="readout small" style:left={`${readoutLeft}px`} bind:clientWidth={readoutWidth}>
				<span class="readout-n" data-numeric>{numberOf.get(liveItem.id) ?? liveItem.order + 1}</span>
				<span class="readout-title">{itemTitle(liveItem.title_en)}</span>
				{#if detail}<span class="readout-detail" class:vote={live?.kind === 'division'}>{detail}</span>{/if}
			</p>
		{/if}
	</div>
	<input
		class="slider"
		type="range"
		min="0"
		max={span}
		step="1"
		value={Math.floor(clock.t)}
		aria-label="Sitting position"
		aria-valuetext={`${label(clock.t)}${liveItem ? `, ${liveItem.title_en}` : ''}${detail ? `, ${detail}` : ''}`}
		oninput={(e) => clock.seek(Number(e.currentTarget.value))}
	/>
	{#if hover}
		<span class="label small" style:left={`${hover.x}px`}>{hover.title}</span>
	{/if}
</div>

<style>
	.scrub {
		position: relative;
		height: 2.9rem;
		background: var(--color-panel);
		border-bottom: 1px solid var(--color-border);
	}

	.track {
		position: absolute;
		left: 1rem;
		right: 1rem;
		top: 0.55rem;
		height: 0.7rem;
		background: var(--color-inset-bar);
	}

	.tick {
		position: absolute;
		top: 0;
		bottom: 0;
		border-left: 2px solid var(--color-ground);
		background: transparent;
		overflow: hidden;
	}

	.tick.live {
		background: rgb(200 125 74 / 0.25);
	}

	.n {
		position: absolute;
		left: 0.25rem;
		top: 50%;
		transform: translateY(-50%);
		font: 600 0.6rem var(--font-mono);
		line-height: 1;
		color: var(--color-body-text);
	}

	.tick.done .n {
		color: var(--color-ground);
	}

	.division {
		position: absolute;
		top: -0.2rem;
		bottom: -0.2rem;
		min-width: 3px;
		background: var(--color-timber-cedar-dark);
	}

	.division.agreed {
		background: var(--color-success);
	}

	.played {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		background: var(--color-inset-bar-strong);
		opacity: 0.55;
		pointer-events: none;
	}

	.readout {
		position: absolute;
		top: calc(100% + 0.35rem);
		margin: 0;
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		max-width: 100%;
		white-space: nowrap;
		color: var(--color-body-text);
		pointer-events: none;
		line-height: 1.2;
	}

	.readout-n {
		padding: 0 0.3rem;
		font: 700 var(--text-kicker) var(--font-mono);
		color: var(--color-ground);
		background: var(--color-ink);
	}

	.readout-title {
		overflow: hidden;
		text-overflow: ellipsis;
		font-weight: 600;
		color: var(--color-ink);
	}

	.readout-detail {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.readout-detail::before {
		content: '·';
		margin-right: 0.4rem;
	}

	.readout-detail.vote {
		font-weight: 600;
		color: var(--color-timber-cedar-dark);
	}

	.slider {
		position: absolute;
		left: 1rem;
		top: 0;
		height: 1.8rem;
		width: calc(100% - 2rem);
		margin: 0;
		background: transparent;
		appearance: none;
		cursor: pointer;
	}

	.slider::-webkit-slider-runnable-track {
		height: 100%;
		background: transparent;
	}

	.slider::-webkit-slider-thumb {
		appearance: none;
		width: 1rem;
		height: 1rem;
		margin-top: 0.4rem;
		border-radius: 50%;
		background: var(--color-accent-plum);
		border: 2px solid var(--color-ground);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
	}

	.slider::-moz-range-thumb {
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		background: var(--color-accent-plum);
		border: 2px solid var(--color-ground);
	}

	.slider:focus-visible {
		outline: var(--focus-ring);
		outline-offset: -3px;
	}

	.label {
		position: absolute;
		top: 100%;
		transform: translateX(-50%);
		margin: 0.2rem 0 0;
		padding: 0.15rem 0.5rem;
		background: var(--color-ink);
		color: var(--color-ground);
		white-space: nowrap;
		pointer-events: none;
		z-index: 3;
	}

	@media (max-width: 720px) {
		.readout-detail {
			display: none;
		}
	}
</style>
