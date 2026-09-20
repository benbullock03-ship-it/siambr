<script lang="ts">
	import type { SiambrState } from '$lib/3d/state.svelte';
	import { partyColor, partyLabel } from '$lib/dossier/parties';
	import TouchJoystick from './TouchJoystick.svelte';

	/** The overlay on the canvas: nametag, controls hint, crosshair and the walk joystick. */
	let {
		hud,
		renderer,
		onjoystick
	}: {
		hud: SiambrState;
		renderer: 'webgpu' | 'webgl2' | null;
		onjoystick: (v: { x: number; y: number }) => void;
	} = $props();

	const focus = $derived(hud.focus);
	const anchor = $derived(hud.anchor);
</script>

<div class="hud">
	<p class="plate controls small" aria-label="Controls">
		{#if hud.walk}
			{#if hud.touch}
				Drag the joystick to walk. Drag the view to look. Tap the floor to move there. Tap a desk to open its Member.
			{:else}
				<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk · click, then move the mouse to look · <kbd>Esc</kbd> leave walk · <kbd>E</kbd> open a Member
			{/if}
		{:else if hud.touch}
			Drag to orbit. Pinch to zoom. Tap a desk to frame it, then tap Open record.
		{:else}
			Drag to orbit · wheel to zoom · click a desk to frame it, click again to open its record
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

	{#if hud.touch && hud.walk}
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

	.hud button {
		pointer-events: auto;
	}

	.plate {
		background: rgb(247 246 242 / 0.92);
		backdrop-filter: blur(6px);
	}

	.controls {
		position: absolute;
		right: 1rem;
		bottom: 1rem;
		max-width: min(30rem, calc(100% - 2rem));
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
		bottom: 5rem;
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

	@media (max-width: 720px) {
		.controls {
			display: none;
		}

		.nametag {
			bottom: 1rem;
			min-width: 0;
			max-width: calc(100% - 1.5rem);
		}
	}
</style>
