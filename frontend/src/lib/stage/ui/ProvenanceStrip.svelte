<script lang="ts">
	import { SEATING_NOTICE } from '$lib/3d/chamber/seating';

	let { recordPublishedAt, sourceXmlUrl }: { recordPublishedAt: string | null; sourceXmlUrl: string } = $props();
	const stamp = $derived(recordPublishedAt ? recordPublishedAt.replace('T', ' ') : 'date not stated');
</script>

<aside class="provenance small" aria-label="Provenance">
	<p>{SEATING_NOTICE}</p>
	<p>Record as published <a href={sourceXmlUrl} rel="external"><time data-numeric datetime={recordPublishedAt ?? undefined}>{stamp}</time></a>.</p>
</aside>

<style>
	.provenance {
		position: absolute;
		left: 0.75rem;
		bottom: 0.75rem;
		max-width: min(26rem, calc(100% - 1.5rem));
		padding: 0.45rem 0.7rem;
		background: rgb(247 246 242 / 0.92);
		color: var(--color-body-text);
		font-family: var(--font-sans);
		pointer-events: auto;
		z-index: 2;
	}

	.provenance p {
		margin: 0;
	}
</style>
