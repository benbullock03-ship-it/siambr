<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SiambrState } from '$lib/3d/state.svelte';
	import { partyColor, partyLabel } from '$lib/dossier/parties';
	import { kiosk } from '$lib/kiosk.svelte';
	import { rememberDismissed, wasDismissed } from './dismissed';
	import TouchJoystick from './TouchJoystick.svelte';
	import VoteLegend from './VoteLegend.svelte';

	/** The overlay on the canvas: nametag, controls hint, crosshair and the walk joystick. */
	let {
		hud,
		renderer,
		onjoystick,
		provenance,
		division = false,
		date,
		phone = false,
		sheetFull = false
	}: {
		hud: SiambrState;
		date: string;
		/** Phone: the transcript is in the sheet below the chamber, not the column on the right. */
		phone?: boolean;
		/** Phone: the sheet covers the chamber, so the plates have nowhere to sit. */
		sheetFull?: boolean;
		renderer: 'webgpu' | 'webgl2' | null;
		onjoystick: (v: { x: number; y: number }) => void;
		provenance?: Snippet;
		/** True while the desks carry a division tint; the legend says what the tones mean. */
		division?: boolean;
	} = $props();

	let dismissedControls = $state(false);
	$effect(() => {
		if (wasDismissed('controls', kiosk.active)) dismissedControls = true;
	});
	function dismissControls() {
		dismissedControls = true;
		rememberDismissed('controls', kiosk.active);
	}

	const focus = $derived(hud.focus);
	const anchor = $derived(hud.anchor);
	const speaker = $derived(hud.liveSpeaker);
	const speakerAnchor = $derived(hud.liveSpeakerAnchor);
	const isSpeaking = $derived(Boolean(focus && speaker && focus.desk.id === speaker.desk.id));
</script>

<div class="hud" class:phone>
	<div class="bottom-stack" hidden={phone && sheetFull}>
		{#if !dismissedControls}
			<div class="plate controls small" aria-label="Controls">
				<div class="controls-content">
					{#if phone && !hud.walk}
						<p class="one-line">Press Play below · drag to orbit · tap a desk</p>
					{:else}
						{#if !hud.walk}
							<p class="lead">
								Plenary, <time data-numeric datetime={date}>{date}</time>. Press Play to start the day;
								{phone ? 'the transcript is in the sheet below.' : 'the transcript follows on the right.'}
							</p>
						{/if}
						{#if hud.walk && hud.touch}
							Drag the joystick to walk. Drag the view to look. Tap the floor to move there. Tap a desk to open its Member.
						{:else if hud.walk}
							<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk · click, then move the mouse to look · <kbd>Esc</kbd> leave walk · <kbd>E</kbd> open a Member
						{:else if hud.touch}
							Drag to orbit. Pinch to zoom. Tap a desk to frame it, then tap Open record.
						{:else}
							Drag to orbit · wheel to zoom · click a desk to frame it, click again to open its record
						{/if}
					{/if}
					{#if renderer && !phone}<span class="engine">{renderer === 'webgpu' ? 'WebGPU' : 'WebGL2'}</span>{/if}
				</div>
				<button
					type="button"
					class="btn-dismiss"
					onclick={dismissControls}
					aria-label="Dismiss controls guide"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>
		{/if}

		{#if division && !phone}
			<VoteLegend compact />
		{/if}

		{#if provenance}
			{@render provenance()}
		{/if}
	</div>

	<div class="status" role="status" aria-live="polite">
		<!-- The beacon floats at the desk's screen position and can land on the controls guide;
		     while the guide is up on a first visit, the guide is the instruction that matters. -->
		{#if speaker && speakerAnchor.visible && dismissedControls && (!focus || focus.desk.id !== speaker.desk.id)}
			<div
				class="live-speaker-beacon floating"
				style:--speaker-x="{speakerAnchor.x}px"
				style:--speaker-y="{speakerAnchor.y}px"
				style:--party={partyColor(speaker.member.party_id)}
			>
				<button
					type="button"
					class="beacon-pill"
					onclick={() => hud.onopen(speaker)}
					aria-label="Speaking now: {speaker.member.canonical_name}. Open record."
				>
					<span class="beacon-pulse-indicator" aria-hidden="true">
						<span class="beacon-core-dot"></span>
					</span>
					{#if speaker.member.portrait_url}
						<img class="beacon-avatar" src={speaker.member.portrait_url} alt="" width="28" height="28" />
					{:else}
						<span class="beacon-avatar-placeholder">{speaker.member.canonical_name[0]}</span>
					{/if}
					<div class="beacon-text">
						<span class="beacon-kicker">Speaking now</span>
						<span class="beacon-name">{speaker.member.canonical_name}</span>
					</div>
					<span class="beacon-party">{partyLabel(speaker.member.party_id)}</span>
				</button>
				<div class="beacon-pointer" aria-hidden="true"></div>
			</div>
		{/if}

		{#if focus}
			<div
				class="nametag plate"
				class:floating={anchor.visible}
				class:is-speaking={isSpeaking}
				style:--anchor-x={anchor.visible ? `${anchor.x}px` : null}
				style:--anchor-y={anchor.visible ? `${anchor.y}px` : null}
				style:--party={partyColor(focus.member.party_id)}
			>
				{#if isSpeaking}
					<div class="speaking-banner">
						<span class="speaking-pulse"></span>
						<span>Speaking on the floor</span>
					</div>
				{/if}
				{#if focus.desk.row < 0}
					<p class="office">{focus.officeTitle ?? 'Y Llywydd · Presiding Officer'}</p>
				{/if}
				<div class="nametag-header">
					{#if focus.member.portrait_url}
						<img class="nametag-avatar" src={focus.member.portrait_url} alt="" width="42" height="42" />
					{/if}
					<div class="nametag-names">
						<p class="name">{focus.member.canonical_name}</p>
						{#if focus.member.cymraeg_name && focus.member.cymraeg_name !== focus.member.canonical_name}
							<p class="name-cy" lang="cy">{focus.member.cymraeg_name}</p>
						{/if}
					</div>
				</div>
				<p class="small meta-row">
					<span class="party-tag" style:background={partyColor(focus.member.party_id)}>{partyLabel(focus.member.party_id)}</span>
					<span class="constituency-tag">{focus.member.constituency_name_en}</span>
				</p>
				<button type="button" class="open button-open" onclick={() => hud.onopen(focus)}>
					<span>Open Member record</span>
					{#if !hud.touch} <kbd>E</kbd>{:else} <span class="arrow" aria-hidden="true">→</span>{/if}
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

	.bottom-stack {
		position: absolute;
		left: 0.75rem;
		bottom: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-width: min(30rem, calc(100% - 1.5rem));
		pointer-events: none;
		z-index: 10;
		box-sizing: border-box;
	}

	/* Phone: the plates ride on top of the transcript sheet, never over its text. */
	.hud.phone .bottom-stack {
		bottom: calc(var(--sheet-height, 50vh) + 0.5rem);
		max-height: calc(100% - var(--sheet-height, 50vh) - 1rem);
		overflow: hidden;
	}

	.bottom-stack[hidden] {
		display: none;
	}

	.one-line {
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.hud.phone .controls {
		align-items: center;
		padding: 0 0 0 0.75rem;
	}

	.hud.phone .controls-content {
		min-width: 0;
	}

	.hud.phone .btn-dismiss {
		min-width: var(--tap-min);
		min-height: var(--tap-min);
	}

	.bottom-stack :global(> *) {
		pointer-events: auto;
	}

	.plate {
		background: rgb(247 246 242 / 0.94);
		backdrop-filter: blur(6px);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.controls {
		position: relative;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		max-width: 100%;
		margin: 0;
		padding: 0.5rem 0.75rem;
		color: var(--color-body-text);
		box-sizing: border-box;
	}

	.controls-content {
		line-height: 1.4;
	}

	.lead {
		margin: 0 0 0.2rem;
		font-weight: 600;
		color: var(--color-ink);
	}

	.btn-dismiss {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: var(--color-body-text);
		cursor: pointer;
		/* WCAG 2.2 target size: never below the tap minimum. */
		min-width: var(--tap-min);
		min-height: var(--tap-min);
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
		/* On the guide's panel, --color-muted falls just short of 4.5:1. */
		color: var(--color-body-text);
	}

	/* --- Live Speaker In-Chamber Beacon --- */
	.live-speaker-beacon {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		pointer-events: auto;
		z-index: 20;
	}

	.live-speaker-beacon.floating {
		left: clamp(160px, var(--speaker-x, 50%), calc(100% - 160px));
		top: clamp(60px, var(--speaker-y, 50%), calc(100% - 40px));
		bottom: auto;
		transform: translate(-50%, -100%) translateY(-12px);
	}

	.beacon-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.3rem 0.75rem 0.3rem 0.4rem;
		background: rgba(17, 20, 23, 0.94);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 232, 168, 0.55);
		border-radius: 9999px;
		color: var(--color-ground);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 12px rgba(255, 210, 138, 0.3);
		cursor: pointer;
		text-align: left;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.beacon-pill:hover {
		transform: scale(1.03);
		box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5), 0 0 16px rgba(255, 210, 138, 0.45);
	}

	.beacon-pulse-indicator {
		position: relative;
		width: 10px;
		height: 10px;
		margin-left: 0.2rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.beacon-core-dot {
		display: block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #ff4757;
		box-shadow: 0 0 8px #ff4757, 0 0 14px rgba(255, 71, 87, 0.6);
	}

	.beacon-avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid var(--party, var(--color-timber-cedar));
		background: var(--color-ink-room);
	}

	.beacon-avatar-placeholder {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--party, var(--color-timber-cedar));
		color: #ffffff;
		font-weight: 700;
		font-size: 0.8rem;
	}

	.beacon-text {
		display: flex;
		flex-direction: column;
	}

	.beacon-kicker {
		font-size: 0.62rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #ffd28a;
		line-height: 1.1;
	}

	.beacon-name {
		font-family: var(--font-serif);
		font-size: 0.95rem;
		font-weight: 600;
		line-height: 1.2;
		color: #ffffff;
		white-space: nowrap;
	}

	.beacon-party {
		font-size: 0.7rem;
		font-weight: 600;
		padding: 0.15rem 0.45rem;
		border-radius: 9999px;
		background: var(--party, #555);
		color: #ffffff;
		white-space: nowrap;
	}

	.beacon-pointer {
		width: 0;
		height: 0;
		border-left: 6px solid transparent;
		border-right: 6px solid transparent;
		border-top: 8px solid rgba(17, 20, 23, 0.94);
		filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.5));
	}

	/* --- Upgraded Nametag / Hover Card --- */
	.nametag {
		position: absolute;
		left: 50%;
		bottom: 5rem;
		transform: translate(-50%, 0);
		min-width: 16rem;
		max-width: 23rem;
		padding: 0.9rem 1.1rem 1rem;
		background: rgba(17, 20, 23, 0.95);
		backdrop-filter: blur(10px);
		color: var(--color-ground);
		border-radius: 4px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-top: 4px solid var(--party, var(--color-timber-cedar-on-ink));
		box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.3);
		transition: transform 0.15s ease-out, opacity 0.15s ease-out;
		z-index: 15;
	}

	.nametag.floating {
		left: clamp(190px, var(--anchor-x, 50%), calc(100% - 190px));
		top: clamp(80px, var(--anchor-y, 50%), calc(100% - 60px));
		bottom: auto;
		transform: translate(-50%, -100%) translateY(-10px);
	}

	.nametag.is-speaking {
		border-top-color: #ffd28a;
		box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45), 0 0 20px rgba(255, 210, 138, 0.25);
	}

	.speaking-banner {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin-bottom: 0.6rem;
		padding: 0.2rem 0.5rem;
		background: rgba(255, 210, 138, 0.15);
		border: 1px solid rgba(255, 210, 138, 0.3);
		border-radius: 2px;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #ffd28a;
	}

	.speaking-pulse {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #ff4757;
		box-shadow: 0 0 6px #ff4757;
	}

	.nametag-header {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.nametag-avatar {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		object-fit: cover;
		background: var(--color-panel);
		border: 2px solid var(--party, var(--color-timber-cedar));
		flex-shrink: 0;
	}

	.nametag-names {
		flex: 1;
		min-width: 0;
	}

	.nametag p {
		margin: 0;
	}

	.name {
		font-family: var(--font-serif);
		font-size: 1.2rem;
		font-weight: 600;
		line-height: 1.2;
		color: #ffffff;
	}

	.office {
		margin: 0 0 0.35rem;
		font-family: var(--font-sans);
		font-size: var(--text-kicker);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-timber-cedar-on-ink);
		font-weight: 700;
	}

	.name-cy {
		font-family: var(--font-serif);
		font-size: 0.95rem;
		color: var(--color-timber-cedar-on-ink);
		margin-top: 0.1rem;
	}

	.meta-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.65rem;
	}

	.party-tag {
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.15rem 0.5rem;
		border-radius: 9999px;
		color: #ffffff;
	}

	.constituency-tag {
		color: #c9cece;
		font-size: 0.85rem;
	}

	.button-open {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		margin-top: 0.85rem;
		min-height: 38px;
		padding: 0.4rem 0.9rem;
		background: var(--color-accent-plum);
		border: none;
		border-radius: 2px;
		color: #ffffff;
		font: 600 0.85rem var(--font-sans);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.button-open:hover {
		background: var(--color-accent-plum-dark, #8f0d57);
	}

	.button-open kbd {
		background: rgba(0, 0, 0, 0.25);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.3);
	}

	.button-open .arrow {
		font-size: 1.1rem;
		line-height: 1;
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
		.nametag {
			bottom: 1rem;
			min-width: 0;
			max-width: calc(100% - 1.5rem);
		}
	}
</style>
