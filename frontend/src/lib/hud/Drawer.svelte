<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	let {
		titleId,
		onclose,
		closeLabel = 'Close',
		anchor = 'viewport',
		children
	}: {
		titleId: string;
		onclose: () => void;
		closeLabel?: string;
		/** 'viewport' covers the screen; 'chamber' sits inside the nearest positioned ancestor, right-aligned. */
		anchor?: 'viewport' | 'chamber';
		children: Snippet;
	} = $props();

	let drawer: HTMLElement;
	let closeButton: HTMLButtonElement;

	onMount(() => {
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		closeButton.focus();
		return () => opener?.focus();
	});

	function focusables(): HTMLElement[] {
		return [...drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')];
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onclose();
			return;
		}
		if (event.key !== 'Tab') return;
		const items = focusables();
		if (!items.length) return;
		const first = items[0];
		const last = items[items.length - 1];
		const active = document.activeElement;
		const outside = !drawer.contains(active);
		if (event.shiftKey && (active === first || active === drawer || outside)) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && (active === last || outside)) {
			event.preventDefault();
			first.focus();
		}
	}
</script>

<svelte:window {onkeydown} />

<div class="scrim" class:chamber={anchor === 'chamber'} aria-hidden="true" onclick={onclose}></div>

<div bind:this={drawer} class="drawer" class:chamber={anchor === 'chamber'} role="dialog" aria-modal="true" aria-labelledby={titleId}>
	<button bind:this={closeButton} type="button" class="close" onclick={onclose}>{closeLabel}</button>
	{@render children()}
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		background: rgb(17 20 23 / 0.45);
		z-index: 10;
	}

	.drawer {
		position: fixed;
		inset: 0 0 0 auto;
		width: min(48rem, 100%);
		overflow-y: auto;
		padding: 1.5rem clamp(1rem, 4vw, 2.5rem) 2.5rem;
		background: var(--color-ground);
		border-left: 1px solid var(--color-border);
		z-index: 11;
		animation: slide-in 220ms ease-out;
	}

	/* Anchored to the chamber viewport: the drawer covers the 3D view only, never the transcript column. */
	.scrim.chamber,
	.drawer.chamber {
		position: absolute;
	}

	.drawer.chamber {
		z-index: 30;
	}

	@media (prefers-reduced-motion: reduce) {
		.drawer {
			animation: none;
		}
	}

	@keyframes slide-in {
		from {
			transform: translateX(2.5rem);
			opacity: 0;
		}
	}

	.close {
		float: right;
		margin-left: 1rem;
		min-height: var(--tap-min);
		padding: 0 1rem;
		background: none;
		border: 1px solid var(--color-rule-strong);
		font: 600 var(--text-small) var(--font-sans);
		color: var(--color-ink);
		cursor: pointer;
	}

	.close:hover {
		background: var(--color-panel);
	}
</style>
