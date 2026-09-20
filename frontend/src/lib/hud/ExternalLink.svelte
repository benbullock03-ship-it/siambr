<script lang="ts">
	import type { Snippet } from 'svelte';
	import { renderSVG } from 'uqr';
	import { kiosk } from '$lib/kiosk.svelte';

	let {
		href,
		rel = 'external',
		class: className = '',
		children
	}: {
		href: string;
		rel?: string;
		class?: string;
		children?: Snippet;
	} = $props();

	const isSenedd = $derived(/senedd\.(tv|wales)/i.test(href));
	const isKiosk = $derived(kiosk.active);
	const qrSvg = $derived(isKiosk && isSenedd ? renderSVG(href, { border: 1 }) : '');
</script>

{#if !isKiosk}
	<a {href} {rel} class={className}>
		{@render children?.()}
	</a>
{:else if isSenedd}
	<div class="kiosk-qr {className}">
		{#if children}
			<span class="qr-label">{@render children()}</span>
		{/if}
		<div class="qr-graphic" aria-hidden="true">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html qrSvg}
		</div>
		<span class="qr-url small" data-numeric>{href}</span>
	</div>
{/if}

<style>
	.kiosk-qr {
		display: inline-flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.35rem;
		margin: 0.5rem 0;
		max-width: 100%;
		vertical-align: top;
	}

	.qr-label {
		font-weight: 600;
	}

	.qr-graphic {
		background: #ffffff;
		padding: 4px;
		border-radius: var(--rounded-small, 4px);
		border: 1px solid var(--color-border);
		display: inline-block;
	}

	.qr-graphic :global(svg) {
		width: 80px;
		height: 80px;
		display: block;
	}

	.qr-url {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--color-muted);
		word-break: break-all;
		max-width: 24rem;
	}
</style>
