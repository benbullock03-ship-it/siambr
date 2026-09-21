<script lang="ts">
	import type { ScreenSound } from '../screenVideo.svelte';

	let {
		sound,
		available,
		missing,
		verbatim = false
	}: {
		sound: ScreenSound;
		/** The wall screens carry the stream on this page. */
		available: boolean;
		/** The sitting has no aligned Senedd TV stream. */
		missing: boolean;
		/** The sitting also has the verbatim feed, so the audio can be switched. */
		verbatim?: boolean;
	} = $props();

	const asSpoken = $derived(verbatim && sound.feed === 'verbatim');
</script>

{#if available}
	<div class="audio" role="group" aria-label="Screen audio">
		{#if verbatim}
			<div class="segmented" role="group" aria-label="Audio track">
				<button type="button" class="seg" aria-pressed={!asSpoken} onclick={() => (sound.feed = 'interpretation')}>English</button>
				<button type="button" class="seg" aria-pressed={asSpoken} onclick={() => (sound.feed = 'verbatim')}>As spoken</button>
			</div>
		{/if}
		<button type="button" class="mute" aria-pressed={sound.muted} onclick={() => (sound.muted = !sound.muted)}>Mute</button>
		<p class="caption">
			{#if asSpoken}
				<span>Audio: as spoken in the Siambr (Senedd TV)</span>
			{:else}
				<span>Audio: English interpretation (Senedd TV)</span>
			{/if}
			<span>© Senedd Commission · Senedd TV</span>
		</p>
	</div>
{:else if missing}
	<p class="caption">No Senedd TV stream for this sitting.</p>
{/if}

<style>
	.audio {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.segmented {
		display: inline-flex;
		border: 1px solid var(--color-border);
	}

	.seg,
	.mute {
		min-height: 2.1rem;
		padding: 0 0.7rem;
		background: var(--color-ground);
		color: var(--color-ink);
		font: 600 var(--text-small) var(--font-sans);
		cursor: pointer;
	}

	.seg {
		border: 0;
		border-right: 1px solid var(--color-border);
	}

	.seg:last-child {
		border-right: 0;
	}

	.mute {
		border: 1px solid var(--color-border);
	}

	.seg:hover,
	.mute:hover {
		background: var(--color-panel);
	}

	.seg[aria-pressed='true'],
	.mute[aria-pressed='true'] {
		background: var(--color-ink);
		color: var(--color-ground);
	}

	.caption {
		display: flex;
		flex-direction: column;
		margin: 0;
		font: 500 var(--text-kicker) var(--font-sans);
		color: var(--color-body-text);
		line-height: 1.3;
	}
</style>
