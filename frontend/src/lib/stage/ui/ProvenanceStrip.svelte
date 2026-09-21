<script lang="ts">
	import { SEATING_NOTICE } from '$lib/3d/chamber/seating';
	import ExternalLink from '$lib/hud/ExternalLink.svelte';
	import { rememberDismissed, wasDismissed } from '$lib/hud/dismissed';
	import { kiosk } from '$lib/kiosk.svelte';

	let {
		recordPublishedAt,
		sourceXmlUrl,
		compact = false
	}: {
		recordPublishedAt: string | null;
		sourceXmlUrl: string;
		/** Phone: one "i" button that opens the notice, so the text never sits over the chamber. */
		compact?: boolean;
	} = $props();
	const stamp = $derived(recordPublishedAt ? recordPublishedAt.replace('T', ' ') : 'date not stated');
	let dismissed = $state(false);
	$effect(() => {
		if (wasDismissed('seating', kiosk.active)) dismissed = true;
	});
	function dismiss() {
		dismissed = true;
		rememberDismissed('seating', kiosk.active);
	}

	let infoButton = $state<HTMLButtonElement>();
	let infoPopover = $state<HTMLElement>();
	/** The popover sits in the top layer, so it is placed above its button by hand. */
	function placeInfo(e: ToggleEvent) {
		if (e.newState !== 'open' || !infoButton || !infoPopover) return;
		const r = infoButton.getBoundingClientRect();
		infoPopover.style.left = `${r.left}px`;
		infoPopover.style.bottom = `${window.innerHeight - r.top + 4}px`;
	}
</script>

{#if compact}
	<aside class="info" aria-label="Provenance">
		<button type="button" class="info-button" popovertarget="provenance-notice" bind:this={infoButton} aria-label="Seating and record notice">i</button>
		<div id="provenance-notice" class="info-popover small" popover="auto" bind:this={infoPopover} ontoggle={placeInfo}>
			<p>{SEATING_NOTICE}</p>
			<p>Record as published <ExternalLink href={sourceXmlUrl}><time data-numeric datetime={recordPublishedAt ?? undefined}>{stamp}</time></ExternalLink>.</p>
		</div>
	</aside>
{:else if !dismissed}
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
	.info {
		align-self: flex-start;
	}

	.info-button {
		width: var(--tap-min);
		height: var(--tap-min);
		border: 1px solid var(--color-border);
		border-radius: 50%;
		background: rgb(247 246 242 / 0.94);
		color: var(--color-ink);
		font: italic 700 1.1rem var(--font-serif);
		cursor: pointer;
	}

	.info-popover {
		position: fixed;
		inset: auto auto 0 0;
		margin: 0;
		max-width: min(22rem, calc(100vw - 1.5rem));
		padding: 0.6rem 0.8rem;
		background: var(--color-ground);
		color: var(--color-body-text);
		border: 1px solid var(--color-border);
		box-shadow: 0 8px 24px rgb(17 20 23 / 0.2);
	}

	.info-popover p {
		margin: 0 0 0.25rem;
		line-height: 1.35;
	}

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
