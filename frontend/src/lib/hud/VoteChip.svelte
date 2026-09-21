<script lang="ts">
	import type { VoteCast } from '$lib/data/types';
	import { VOTE_LABEL, voteTone } from '$lib/stage/voteTones';

	/** One recorded position as a swatch plus its word; the word carries the meaning, the colour only helps. */
	let { vote }: { vote: VoteCast } = $props();
	const tone = $derived(voteTone(vote));
</script>

<span class="chip" class:unlit={!tone} style:--tone={tone ?? 'transparent'}>{VOTE_LABEL[vote]}</span>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
		padding: 0.1em 0.55em 0.1em 0.4em;
		border: 1px solid var(--color-border);
		border-radius: 2px;
		font: 600 var(--text-small) var(--font-sans);
		color: var(--color-ink);
		white-space: nowrap;
	}

	.chip::before {
		content: '';
		width: 0.75em;
		height: 0.75em;
		background: var(--tone);
		border: 1px solid rgb(0 0 0 / 0.15);
		box-sizing: border-box;
	}

	.unlit::before {
		background: transparent;
		border-style: dashed;
	}
</style>
