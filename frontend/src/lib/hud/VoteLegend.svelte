<script lang="ts">
	import VoteChip from './VoteChip.svelte';

	/** What the division tones mean, wherever a division is shown. Static; no motion. */
	let { compact = false }: { compact?: boolean } = $props();
</script>

<p class="legend" class:compact aria-label="Vote colours">
	<VoteChip vote="for" />
	<VoteChip vote="against" />
	<VoteChip vote="abstain" />
	<span class="unlit">Unlit desk: did not vote</span>
</p>

<style>
	.legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.6rem;
		margin: 0;
		font-size: var(--text-small);
		color: var(--color-body-text);
	}

	.compact {
		padding: 0.4rem 0.6rem;
		background: rgb(247 246 242 / 0.94);
		border: 1px solid var(--color-border);
		border-radius: 4px;
	}

	.unlit {
		white-space: nowrap;
	}
</style>
