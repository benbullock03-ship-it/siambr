<script lang="ts">
	import { onMount } from 'svelte';

	let {
		onclose,
		latestSitting = null
	}: {
		onclose: () => void;
		latestSitting?: string | null;
	} = $props();

	let closeButton: HTMLButtonElement;

	onMount(() => {
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		closeButton?.focus();
		return () => opener?.focus();
	});

	function handleClose() {
		onclose();
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			handleClose();
		}
	}
</script>

<svelte:window {onkeydown} />

<div class="scrim" aria-hidden="true" onclick={handleClose}></div>

<div
	class="onboarding-dialog"
	role="dialog"
	aria-modal="true"
	aria-labelledby="onboarding-title"
>
	<header class="dialog-head">
		<div>
			<p class="kicker">Welcome to Siambr · Senedd Cymru</p>
			<h2 id="onboarding-title">How to explore the Senedd</h2>
		</div>
		<button
			bind:this={closeButton}
			type="button"
			class="button-close"
			onclick={handleClose}
			aria-label="Close guide"
		>✕</button>
	</header>

	<div class="steps">
		<div class="step-card">
			<div class="step-num" aria-hidden="true">1</div>
			<div class="step-content">
				<h3>1. The Chamber Stage</h3>
				<p>
					Play back a whole Plenary day in the 3D Siambr. A light falls on the desk of the Member
					who has the floor. Their words scroll beside the chamber at the pace they were spoken.
				</p>
			</div>
		</div>

		<div class="step-card">
			<div class="step-num" aria-hidden="true">2</div>
			<div class="step-content">
				<h3>2. Find Your Member</h3>
				<p>
					Enter your Welsh postcode or Member name in <strong>Members</strong> to see everything your
					representative has said and how they voted on every division this term.
				</p>
			</div>
		</div>

		<div class="step-card">
			<div class="step-num" aria-hidden="true">3</div>
			<div class="step-content">
				<h3>3. Quoted Word for Word</h3>
				<p>
					Siambr never paraphrases. Every speech and every division result is quoted as printed in the
					Record of Proceedings. Timed speeches link to that moment on Senedd TV.
				</p>
			</div>
		</div>
	</div>

	<div class="quick-links">
		<p class="quick-title small">Where would you like to start?</p>
		<div class="button-group">
			<a
				href={latestSitting ? `/sitting/${latestSitting}` : '/'}
				class="button-primary"
				onclick={handleClose}
			>
				Enter the Chamber
			</a>
			<a href="/members" class="button-secondary" onclick={handleClose}>
				Find your Member
			</a>
			<a href="/register" class="button-secondary" onclick={handleClose}>
				Browse the Register
			</a>
		</div>
	</div>

	<footer class="dialog-foot">
		<button type="button" class="done-button" onclick={handleClose}>Got it</button>
	</footer>
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		background: rgba(17, 20, 23, 0.65);
		backdrop-filter: blur(4px);
		z-index: 100;
	}

	.onboarding-dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(42rem, calc(100% - 2rem));
		max-height: calc(100vh - 3rem);
		overflow-y: auto;
		background: var(--color-ground);
		color: var(--color-ink);
		padding: 2rem 2.25rem 1.75rem;
		border: 1px solid var(--color-border);
		box-shadow: 0 20px 48px rgba(0, 0, 0, 0.35);
		z-index: 101;
	}

	.dialog-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	.dialog-head h2 {
		margin: 0.25rem 0 0;
		font-family: var(--font-serif);
		font-size: 1.6rem;
		font-weight: 600;
	}

	.button-close {
		width: 36px;
		height: 36px;
		display: grid;
		place-items: center;
		background: none;
		border: 1px solid var(--color-border);
		color: var(--color-ink);
		font-size: 1.1rem;
		cursor: pointer;
		border-radius: 2px;
	}

	.button-close:hover {
		background: var(--color-panel);
	}

	.steps {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		margin-bottom: 1.75rem;
	}

	.step-card {
		display: flex;
		gap: 1.1rem;
		align-items: flex-start;
		padding: 1rem 1.2rem;
		background: var(--color-panel);
		border-left: 3px solid var(--color-timber-cedar);
		border-radius: 2px;
	}

	.step-num {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--color-ink);
		color: var(--color-ground);
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 0.85rem;
		line-height: 1;
		flex-shrink: 0;
		margin-top: 0.15rem;
	}

	.step-content h3 {
		margin: 0 0 0.3rem;
		font-family: var(--font-sans);
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--color-ink);
	}

	.step-content p {
		margin: 0;
		font-size: var(--text-small);
		color: var(--color-body-text);
		line-height: 1.5;
	}

	.quick-links {
		margin-bottom: 1.5rem;
		padding: 1.25rem;
		background: rgba(200, 125, 74, 0.08);
		border: 1px dashed var(--color-border);
		border-radius: 2px;
	}

	.quick-title {
		margin: 0 0 0.75rem;
		font-weight: 700;
		color: var(--color-ink);
	}

	.button-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.button-primary {
		display: inline-flex;
		align-items: center;
		padding: 0.5rem 1rem;
		background: var(--color-accent-plum);
		color: #ffffff;
		font: 600 var(--text-small) var(--font-sans);
		text-decoration: none;
		border-radius: 2px;
	}

	.button-primary:hover {
		background: var(--color-accent-plum-dark, #8f0d57);
	}

	.button-secondary {
		display: inline-flex;
		align-items: center;
		padding: 0.5rem 1rem;
		background: var(--color-panel);
		border: 1px solid var(--color-border);
		color: var(--color-ink);
		font: 600 var(--text-small) var(--font-sans);
		text-decoration: none;
		border-radius: 2px;
	}

	.button-secondary:hover {
		background: var(--color-ground);
		border-color: var(--color-rule-strong);
	}

	.dialog-foot {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: center;
		gap: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}

	.done-button {
		padding: 0.5rem 1.4rem;
		background: var(--color-ink);
		color: var(--color-ground);
		border: none;
		font: 600 var(--text-small) var(--font-sans);
		cursor: pointer;
		border-radius: 2px;
	}

	.done-button:hover {
		background: #2b323a;
	}

	@media (max-width: 600px) {
		.onboarding-dialog {
			padding: 1.5rem 1.25rem;
		}

		.step-card {
			padding: 0.85rem;
			gap: 0.75rem;
		}

		.button-group {
			flex-direction: column;
		}

		.button-primary,
		.button-secondary {
			justify-content: center;
		}
	}
</style>
