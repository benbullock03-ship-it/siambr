<script lang="ts">
	import type { MemberLight as MemberSummary, TermFile as ParliamentaryTerm } from '$lib/data/types';
	import { SEATING_NOTICE } from '$lib/3d/chamber/seating';
	import type { SiambrState } from '$lib/3d/state.svelte';
	import { partyColor, partyLabel } from '$lib/dossier/parties';
	import TouchJoystick from './TouchJoystick.svelte';

	let {
		hud,
		term,
		llywydd,
		deskCount,
		seatedCount,
		renderer,
		onjoystick
	}: {
		hud: SiambrState;
		term: ParliamentaryTerm;
		llywydd: MemberSummary | null;
		deskCount: number;
		seatedCount: number;
		renderer: 'webgpu' | 'webgl2' | null;
		onjoystick: (v: { x: number; y: number }) => void;
	} = $props();

	const focus = $derived(hud.focus);
	const anchor = $derived(hud.anchor);
</script>

<div class="hud">
	<header class="plate title">
		<p class="kicker">Siambr · Spatial Walkthrough</p>
		<h1>Y Siambr</h1>
		<p class="small">
			{term.label_en} · <span data-numeric>{seatedCount}</span> Members,
			<span data-numeric>{deskCount}</span> desks.
			{#if llywydd}<span class="llywydd">Y Llywydd: {llywydd.canonical_name}.</span>{/if}
		</p>
		<p class="small provenance">{SEATING_NOTICE}</p>
		<a class="button-primary switch" href="/register">Open the Register</a>
	</header>

	<p class="plate controls small" aria-label="Controls">
		{#if hud.touch}
			Drag the joystick to walk. Drag the view to look. Tap the floor to move there. Tap a desk to open its Member.
		{:else}
			<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk · click, then move the mouse to look · <kbd>Esc</kbd> release · <kbd>E</kbd> open a Member
		{/if}
		{#if renderer}<span class="engine">{renderer === 'webgpu' ? 'WebGPU' : 'WebGL2'}</span>{/if}
	</p>

	<div class="status" role="status" aria-live="polite">
		{#if focus}
			<div
				class="nametag plate"
				class:floating={anchor.visible}
				style:left={anchor.visible ? `${anchor.x}px` : null}
				style:top={anchor.visible ? `${anchor.y}px` : null}
			>
				{#if focus.desk.row < 0}
					<p class="office">Y Llywydd · Presiding Officer</p>
				{/if}
				<p class="name">{focus.member.canonical_name}</p>
				{#if focus.member.cymraeg_name && focus.member.cymraeg_name !== focus.member.canonical_name}
					<p class="name-cy" lang="cy">{focus.member.cymraeg_name}</p>
				{/if}
				<p class="small">
					<span class="party" style:--party={partyColor(focus.member.party_id)}>{partyLabel(focus.member.party_id)}</span>
					{focus.member.constituency_name_en}
				</p>
				<button type="button" class="open" onclick={() => hud.onopen(focus)}>
					Open record{#if !hud.touch} <kbd>E</kbd>{/if}
				</button>
			</div>
		{/if}
	</div>

	{#if hud.pointerLocked}
		<div class="crosshair" aria-hidden="true"></div>
	{/if}

	{#if hud.touch}
		<TouchJoystick onmove={onjoystick} />
	{/if}
</div>

<style>
	.hud {
		position: absolute;
		inset: 0;
		pointer-events: none;
		font-family: var(--font-sans);
	}

	.hud :is(a, button) {
		pointer-events: auto;
	}

	.plate {
		background: rgb(247 246 242 / 0.92);
		backdrop-filter: blur(6px);
	}

	.title {
		position: absolute;
		top: 1rem;
		left: 1rem;
		max-width: min(22rem, calc(100vw - 2rem));
		padding: 1rem 1.25rem;
	}

	.title h1 {
		font-size: clamp(1.5rem, 3vw, 2rem);
		margin-bottom: 0.25rem;
	}

	.title p {
		margin: 0 0 0.35rem;
	}

	.provenance {
		color: var(--color-muted);
	}

	.switch {
		display: inline-flex;
		align-items: center;
		margin-top: 0.5rem;
		text-decoration: none;
	}

	.controls {
		position: absolute;
		right: 1rem;
		bottom: 1rem;
		max-width: min(30rem, calc(100vw - 2rem));
		margin: 0;
		padding: 0.6rem 0.9rem;
		color: var(--color-body-text);
	}

	kbd {
		font: 600 0.8em var(--font-mono);
		padding: 0.05em 0.35em;
		margin: 0 0.1em;
		border: 1px solid var(--color-border);
		background: var(--color-panel);
		color: var(--color-ink);
	}

	.engine {
		margin-left: 0.6rem;
		font-family: var(--font-mono);
		color: var(--color-muted);
	}

	.nametag {
		position: absolute;
		left: 50%;
		bottom: 6rem;
		transform: translate(-50%, 0);
		min-width: 14rem;
		max-width: 20rem;
		padding: 0.75rem 1rem;
		background: var(--color-ink-room);
		color: var(--color-ground);
		border-left: 3px solid var(--color-timber-cedar-on-ink);
	}

	.nametag.floating {
		bottom: auto;
		transform: translate(-50%, -100%);
	}

	.nametag p {
		margin: 0;
	}

	.name {
		font-family: var(--font-serif);
		font-size: 1.15rem;
		font-weight: 600;
	}

	.office {
		margin: 0 0 0.15rem;
		font-family: var(--font-sans);
		font-size: var(--text-kicker);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-timber-cedar-on-ink);
	}

	.name-cy {
		font-family: var(--font-serif);
		color: var(--color-timber-cedar-on-ink);
	}

	.nametag .small {
		color: #d8dbd6;
		margin-top: 0.25rem;
	}

	.party::before {
		content: '';
		display: inline-block;
		width: 0.6em;
		height: 0.6em;
		margin-right: 0.35em;
		background: var(--party);
		border-radius: 50%;
	}

	.party {
		margin-right: 0.5rem;
		font-weight: 600;
	}

	.open {
		margin-top: 0.5rem;
		min-height: var(--tap-min);
		padding: 0 0.9rem;
		background: none;
		border: 1px solid var(--color-timber-cedar-on-ink);
		color: var(--color-ground);
		font: 600 var(--text-small) var(--font-sans);
		cursor: pointer;
	}

	.open kbd {
		background: transparent;
		color: var(--color-ground);
		border-color: var(--color-timber-cedar-on-ink);
	}

	.crosshair {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 6px;
		height: 6px;
		margin: -3px 0 0 -3px;
		border-radius: 50%;
		background: var(--color-ground);
		box-shadow: 0 0 0 1px var(--color-ink-room);
	}

	@media (max-width: 640px) {
		.title {
			top: 0.75rem;
			left: 0.75rem;
			max-width: calc(100vw - 1.5rem);
			padding: 0.6rem 0.85rem;
		}

		.title h1 {
			font-size: 1.25rem;
		}

		.title .small,
		.controls {
			font-size: 0.78rem;
			line-height: 1.35;
		}

		.title p {
			margin-bottom: 0.2rem;
		}

		.switch {
			margin-top: 0.3rem;
			min-height: var(--tap-min);
		}

		/* Joystick owns the bottom-left 9.5rem; controls sit beside it, the nametag above both. */
		.controls {
			right: 0.75rem;
			bottom: 0.75rem;
			max-width: calc(100vw - 11rem);
			padding: 0.5rem 0.7rem;
		}

		.nametag {
			bottom: 11rem;
			min-width: 0;
			max-width: calc(100vw - 1.5rem);
		}

		.nametag.floating {
			bottom: auto;
		}
	}
</style>
