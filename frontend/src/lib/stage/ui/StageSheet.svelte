<script lang="ts">
	import type { Snippet } from 'svelte';
	import VoteLegend from '$lib/hud/VoteLegend.svelte';
	import type { SittingClock } from '../clock.svelte';
	import Transport from './Transport.svelte';

	let {
		clock,
		transcript,
		order,
		division = false,
		heightVh = $bindable(50)
	}: {
		clock: SittingClock;
		transcript: Snippet;
		order: Snippet;
		/** A division beat is live: the vote colours sit in the header, not on the chamber. */
		division?: boolean;
		/** Bound by the page so the HUD plates can ride on top of the sheet. */
		heightVh?: number;
	} = $props();

	const MIN = 50;
	const MAX = 90;
	let tab = $state<'transcript' | 'order'>('transcript');
	let drag: { y: number; from: number } | null = null;

	function down(e: PointerEvent) {
		drag = { y: e.clientY, from: heightVh };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (!drag) return;
		const delta = ((drag.y - e.clientY) / window.innerHeight) * 100;
		heightVh = Math.min(MAX, Math.max(MIN, drag.from + delta));
	}
	function up() {
		if (!drag) return;
		heightVh = heightVh > (MIN + MAX) / 2 ? MAX : MIN;
		drag = null;
	}
	function keys(e: KeyboardEvent) {
		if (e.key === 'ArrowUp') heightVh = MAX;
		else if (e.key === 'ArrowDown') heightVh = MIN;
		else return;
		e.preventDefault();
	}
</script>

<section class="sheet" style:height={`${heightVh}vh`} aria-label="Sitting">
	<header class="handle-row">
		<button type="button" class="handle" aria-label={heightVh > MIN ? 'Shrink the transcript' : 'Expand the transcript'} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onkeydown={keys}></button>
		<Transport {clock} />
		<div class="tabs" role="tablist" aria-label="Sheet">
			<button type="button" role="tab" aria-selected={tab === 'transcript'} onclick={() => (tab = 'transcript')}>Transcript</button>
			<button type="button" role="tab" aria-selected={tab === 'order'} onclick={() => (tab = 'order')}>Running order</button>
		</div>
		{#if division}
			<div class="legend"><VoteLegend /></div>
		{/if}
	</header>
	<div class="panel" role="tabpanel">
		{#if tab === 'transcript'}
			{@render transcript()}
		{:else}
			{@render order()}
		{/if}
	</div>
</section>

<style>
	.sheet {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		background: var(--color-ground);
		border-top: 1px solid var(--color-border);
		box-shadow: 0 -6px 18px rgb(17 20 23 / 0.18);
		z-index: 4;
		transition: height 160ms ease-out;
	}

	@media (prefers-reduced-motion: reduce) {
		.sheet {
			transition: none;
		}
	}

	.handle-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.75rem;
		padding: 0.35rem 0.75rem 0.5rem;
		border-bottom: 1px solid var(--color-border);
		touch-action: none;
	}

	.handle {
		width: 100%;
		height: 1.25rem;
		border: 0;
		background: linear-gradient(var(--color-border), var(--color-border)) center / 3rem 4px no-repeat;
		cursor: grab;
	}

	.tabs {
		display: flex;
		gap: 0.3rem;
		margin-left: auto;
	}

	.tabs button {
		min-height: var(--tap-min);
		padding: 0 0.7rem;
		border: 1px solid var(--color-border);
		background: var(--color-ground);
		color: var(--color-ink);
		font: 600 var(--text-small) var(--font-sans);
	}

	.tabs button[aria-selected='true'] {
		background: var(--color-ink);
		color: var(--color-ground);
		border-color: var(--color-ink);
	}

	.legend {
		width: 100%;
	}

	.panel {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}

	.panel > :global(*) {
		flex: 1;
		min-height: 0;
	}
</style>
