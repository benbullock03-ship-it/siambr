<script lang="ts">
	import { wallClockAt, type SittingClock } from '../clock.svelte';

	let { clock, meetingStartTime }: { clock: SittingClock; meetingStartTime: string | null } = $props();

	const timeline = $derived(clock.timeline);
	const span = $derived(Math.max(1, timeline.tEnd));
	const pct = (t: number) => `${(Math.min(t, span) / span) * 100}%`;
	const label = (t: number) => wallClockAt(meetingStartTime, t) ?? `${Math.floor(t)} s`;
	/** Items with beats; an empty item has no width to tick. */
	const ticks = $derived(timeline.items.filter((i) => i.beatCount > 0));
	const divisions = $derived(timeline.beats.filter((b) => b.kind === 'division'));
	let hover = $state<{ x: number; title: string } | null>(null);
</script>

<div class="scrub">
	<div class="track" aria-hidden="true">
		{#each ticks as item (item.id)}
			<span
				role="presentation"
				class="tick"
				class:live={clock.floor.live?.itemId === item.id}
				style:left={pct(item.t)}
				style:width={`calc(${pct(item.tEnd)} - ${pct(item.t)})`}
				onpointerenter={(e) => (hover = { x: e.clientX, title: item.title_en })}
				onpointerleave={() => (hover = null)}
			></span>
		{/each}
		{#each divisions as d (d.index)}
			<span class="division" style:left={pct(d.t)} style:width={`calc(${pct(d.tEnd)} - ${pct(d.t)})`}></span>
		{/each}
		<span class="played" style:width={pct(clock.t)}></span>
	</div>
	<input
		class="slider"
		type="range"
		min="0"
		max={span}
		step="1"
		value={Math.floor(clock.t)}
		aria-label="Sitting position"
		aria-valuetext={`${label(clock.t)}${clock.floor.live ? `, ${timeline.items.find((i) => i.id === clock.floor.live?.itemId)?.title_en ?? ''}` : ''}`}
		oninput={(e) => clock.seek(Number(e.currentTarget.value))}
	/>
	{#if hover}
		<span class="label small" style:left={`${hover.x}px`}>{hover.title}</span>
	{/if}
</div>

<style>
	.scrub {
		position: relative;
		height: 1.6rem;
		background: var(--color-panel);
		border-bottom: 1px solid var(--color-border);
	}

	.track {
		position: absolute;
		inset: 0.55rem 1rem;
		height: 0.5rem;
		background: var(--color-inset-bar);
	}

	.tick {
		position: absolute;
		top: 0;
		bottom: 0;
		border-left: 2px solid var(--color-ground);
		background: transparent;
	}

	.tick.live {
		background: rgb(200 125 74 / 0.25);
	}

	.division {
		position: absolute;
		top: -0.15rem;
		bottom: -0.15rem;
		background: var(--color-timber-cedar-dark);
	}

	.played {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		background: var(--color-inset-bar-strong);
		pointer-events: none;
	}

	.slider {
		position: absolute;
		inset: 0 1rem;
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
		width: 0.9rem;
		height: 0.9rem;
		margin-top: 0.35rem;
		border-radius: 50%;
		background: var(--color-accent-plum);
		border: 2px solid var(--color-ground);
	}

	.slider::-moz-range-thumb {
		width: 0.9rem;
		height: 0.9rem;
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
</style>
