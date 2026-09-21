<script lang="ts">
	import { SEATING_NOTICE } from '$lib/3d/chamber/seating';
	import ExternalLink from '$lib/hud/ExternalLink.svelte';
	import { rememberDismissed, wasDismissed } from '$lib/hud/dismissed';
	import { kiosk } from '$lib/kiosk.svelte';

	let { recordPublishedAt, sourceXmlUrl }: { recordPublishedAt: string | null; sourceXmlUrl: string } = $props();
	const stamp = $derived(recordPublishedAt ? recordPublishedAt.replace('T', ' ') : 'date not stated');
	let dismissed = $state(false);
	$effect(() => {
		if (wasDismissed('seating', kiosk.active)) dismissed = true;
	});
	function dismiss() {
		dismissed = true;
		rememberDismissed('seating', kiosk.active);
	}
</script>

{#if !dismissed}
	<aside class="provenance small" aria-label="Provenance">
		<div class="provenance-text">
			<p>{SEATING_NOTICE}</p>
			<p>Record as published <ExternalLink href={sourceXmlUrl}><time data-numeric datetime={recordPublishedAt ?? undefined}>{stamp}</time></ExternalLink>.</p>
		</div>
		<button
			type="button"
			class="btn-dismiss"
			onclick={dismiss}
			aria-label="Dismiss seating notice"
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			</svg>
		</button>
	</aside>
{/if}

<style>
	.provenance {
		position: relative;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		max-width: 100%;
		padding: 0.45rem 0.7rem;
		background: rgb(247 246 242 / 0.94);
		backdrop-filter: blur(6px);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		color: var(--color-body-text);
		font-family: var(--font-sans);
		pointer-events: auto;
		box-sizing: border-box;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.provenance-text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.provenance-text p {
		margin: 0;
		line-height: 1.35;
	}

	.btn-dismiss {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: var(--color-body-text);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 3px;
		line-height: 1;
		flex-shrink: 0;
		transition: background 0.12s ease, color 0.12s ease;
	}

	.btn-dismiss:hover {
		background: #dad5c7;
		color: var(--color-ink);
	}

	.btn-dismiss:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 1px;
	}
</style>
