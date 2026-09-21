<script lang="ts">
	import { goto } from '$app/navigation';
	import type { VantageId } from '$lib/3d/chamber/layout';
	import type { GuidedRig } from '$lib/3d/controls/guided.svelte';
	import type { SiambrState } from '$lib/3d/state.svelte';
	import Mark from '$lib/nav/Mark.svelte';
	import { kiosk } from '$lib/kiosk.svelte';
	import { SPEEDS, type SittingClock } from '../clock.svelte';
	import { ScreenSound } from '../screenVideo.svelte';
	import ScreenAudio from './ScreenAudio.svelte';
	import Transport from './Transport.svelte';

	let {
		clock,
		rig,
		hud,
		date,
		dates,
		onspeaker,
		compact = false,
		sound = new ScreenSound(),
		screenAvailable = false,
		screenMissing = false,
		verbatim = false
	}: {
		clock: SittingClock;
		rig: GuidedRig;
		hud: SiambrState;
		date: string;
		/** Every sitting date, newest first. */
		dates: string[];
		onspeaker: () => void;
		/** Phone: the transport lives in the sheet header instead. */
		compact?: boolean;
		sound?: ScreenSound;
		screenAvailable?: boolean;
		screenMissing?: boolean;
		/** The sitting also has the verbatim feed. */
		verbatim?: boolean;
	} = $props();

	const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	const monthOf = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
	/** Newest first, grouped by month as the index already orders them. */
	const groups = $derived.by(() => {
		const out: { month: string; dates: string[] }[] = [];
		for (const d of dates) {
			const month = monthOf(d);
			const last = out[out.length - 1];
			if (last?.month === month) last.dates.push(d);
			else out.push({ month, dates: [d] });
		}
		return out;
	});

	/** Fixed viewpoints. The hint is what the button does, in one line, shown on hover and focus. */
	const vantages: { id: Exclude<VantageId, 'speaker'>; label: string; hint: string }[] = [
		{ id: 'gallery', label: 'Gallery', hint: 'Wide view from the public gallery' },
		{ id: 'llywydd', label: 'Chair', hint: 'From Y Llywydd’s chair, facing the floor' },
		{ id: 'floor', label: 'Floor', hint: 'Eye level among the desks' }
	];
	const walkAllowed = $derived(!hud.reducedMotion && !hud.kiosk);
	const speedHint: Record<number, string> = { 1: 'Real time', 4: 'Four times real time', 16: 'Sixteen times real time' };

	const liveItem = $derived(clock.floor.live?.itemId ?? null);
	/** The site menu. A kiosk shows Members and the Register, plus Search and Stats only when its config opts in. */
	const menu = $derived.by(() => {
		const all = [
			{ id: 'members', label: 'Members', href: '/members' },
			{ id: 'votes', label: 'Votes', href: '/divisions' },
			{ id: 'search', label: 'Search', href: '/search' },
			{ id: 'register', label: 'Register', href: liveItem ? `/register?item=${encodeURIComponent(liveItem)}` : '/register' },
			{ id: 'stats', label: 'Stats', href: `/sitting/${date}/stats` },
			{ id: 'guide', label: 'Guide', href: `/sitting/${date}?guide=1` }
		];
		if (!hud.kiosk) return all;
		return all.filter((l) => l.id === 'members' || l.id === 'register' || (kiosk.links as string[]).includes(l.id));
	});
	let menuPopover = $state<HTMLElement>();
	let menuButton = $state<HTMLButtonElement>();
	/** The popover sits in the top layer, so it is placed under its button by hand. */
	function placeMenu(e: ToggleEvent) {
		if (e.newState !== 'open' || !menuButton || !menuPopover) return;
		const r = menuButton.getBoundingClientRect();
		menuPopover.style.top = `${r.bottom + 4}px`;
		menuPopover.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
	}

	function pick(id: Exclude<VantageId, 'speaker'>) {
		hud.walk = false;
		rig.setVantage(id);
	}
</script>

{#snippet hint(text: string)}
	<span class="hint" aria-hidden="true">{text}</span>
{/snippet}

<div class="strip" role="toolbar" aria-label="Chamber stage controls">
	<div class="group group-nav">
		<label class="field">
			<span class="kicker">Sitting</span>
			<select value={date} onchange={(e) => goto(`/sitting/${e.currentTarget.value}`)} aria-label="Sitting date">
				{#each groups as g (g.month)}
					<optgroup label={g.month}>
						{#each g.dates as d (d)}
							<option value={d}>{d}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
		</label>
	</div>

	<div class="group group-playback">
		<span class="kicker">Playback</span>
		<div class="row">
			{#if !compact && (!hud.kiosk || !hud.drifting)}
				<Transport {clock} />
			{/if}
			<p class="clock" aria-label="Wall clock">
				<time data-numeric>{clock.wallClock ?? '—:—:—'}</time>
			</p>
			{#if !compact && (!hud.kiosk || !hud.drifting)}
				<div class="segmented" role="group" aria-label="Speed">
					{#each SPEEDS as s (s)}
						<button type="button" class="seg hinted" aria-pressed={clock.speed === s} onclick={() => clock.setSpeed(s)}>{s}x{@render hint(speedHint[s])}</button>
					{/each}
				</div>
			{/if}
			{#if !compact}
				<ScreenAudio {sound} available={screenAvailable} missing={screenMissing} {verbatim} />
			{/if}
		</div>
	</div>

	<div class="group group-camera">
		<span class="kicker">Camera</span>
		<div class="row">
			<div class="segmented" role="group" aria-label="Camera">
				{#each vantages as v (v.id)}
					<button type="button" class="seg hinted" aria-pressed={!hud.walk && rig.vantage === v.id} onclick={() => pick(v.id)}>{v.label}{@render hint(v.hint)}</button>
				{/each}
				<button type="button" class="seg hinted" aria-pressed={!hud.walk && rig.vantage === 'speaker'} onclick={onspeaker}>Speaker{@render hint("Frame whoever holds the floor now")}</button>
			</div>
			<button type="button" class="switch hinted" role="switch" aria-checked={rig.follow} onclick={() => (rig.follow = !rig.follow)}>
				<span class="dot" aria-hidden="true"></span>Follow speaker
			{@render hint("Camera moves to each new speaker as they rise")}</button>
			{#if walkAllowed}
				<button type="button" class="switch hinted" role="switch" aria-checked={hud.walk} onclick={() => (hud.walk = !hud.walk)}>
					<span class="dot" aria-hidden="true"></span>Walk the floor
				{@render hint(hud.touch ? 'Walk with the joystick; tap a desk to open its Member' : 'Walk with W A S D; Esc to leave')}</button>
			{/if}
		</div>
	</div>

	<nav class="group group-links" class:kiosk={hud.kiosk} aria-label="Site">
		{#if compact}
			<button type="button" class="menu-button" popovertarget="stage-menu" bind:this={menuButton}>Menu</button>
			<ul id="stage-menu" class="menu-popover" popover="auto" bind:this={menuPopover} ontoggle={placeMenu}>
				{#each menu as l (l.id)}
					<li><a class="link" href={l.href} onclick={() => menuPopover?.hidePopover()}>{l.label}</a></li>
				{/each}
			</ul>
		{:else}
			<ul class="menu-row">
				{#each menu as l (l.id)}
					<li><a class="link" href={l.href}>{l.label}</a></li>
				{/each}
			</ul>
		{/if}
	</nav>

	<!-- Last in the tab order so the sitting picker and Play come first; drawn first by `order`. -->
	<a href="/" class="brand hinted" aria-label="Siambr home"><Mark size={22} />Siambr{@render hint('The landing page')}</a>
</div>

<style>
	.strip {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.5rem 1rem;
		padding: 0.4rem 0.85rem 0.5rem;
		background: var(--color-ground);
		border-bottom: 1px solid var(--color-border);
		font-family: var(--font-sans);
		box-sizing: border-box;
		width: 100%;
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.group-nav {
		flex-direction: row;
		align-items: flex-end;
		gap: 0.6rem;
		padding-right: 1rem;
		border-right: 1px solid var(--color-border);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.kicker {
		margin: 0;
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-muted);
	}

	.brand {
		order: -1;
		display: inline-flex;
		align-items: flex-end;
		gap: 0.4rem;
		font: 700 1.25rem var(--font-serif);
		color: var(--color-ink);
		letter-spacing: -0.01em;
		line-height: 1;
		text-decoration: none;
		padding-bottom: 0.55rem;
		position: relative;
	}

	.brand:hover {
		color: var(--color-accent-plum);
	}


	.field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.field select {
		min-height: 2.1rem;
		padding: 0 0.5rem;
		border: 1px solid var(--color-border);
		background: var(--color-ground);
		color: var(--color-ink);
		font: 600 var(--text-small) var(--font-mono);
	}

	.field select:focus {
		outline: 2px solid var(--color-focus);
		outline-offset: 1px;
	}

	.clock {
		margin: 0 0.25rem;
	}

	.clock time {
		font: 600 1.15rem var(--font-mono);
		font-variant-numeric: tabular-nums;
		color: var(--color-ink);
	}

	/* One outline round a set of exclusive choices; the pressed one is inked. */
	.segmented {
		display: inline-flex;
		border: 1px solid var(--color-border);
	}

	.seg {
		min-height: 2.1rem;
		padding: 0 0.7rem;
		border: 0;
		border-right: 1px solid var(--color-border);
		background: var(--color-ground);
		color: var(--color-ink);
		font: 600 var(--text-small) var(--font-sans);
		cursor: pointer;
	}

	.seg:last-child {
		border-right: 0;
	}

	.seg:hover {
		background: var(--color-panel);
	}

	.seg[aria-pressed='true'] {
		background: var(--color-ink);
		color: var(--color-ground);
	}

	/* A switch reads as on or off by its dot, not by inverting the whole button. */
	.switch {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-height: 2.1rem;
		padding: 0 0.7rem 0 0.55rem;
		border: 1px solid var(--color-border);
		background: var(--color-ground);
		color: var(--color-body-text);
		font: 600 var(--text-small) var(--font-sans);
		cursor: pointer;
	}

	.switch:hover {
		background: var(--color-panel);
	}

	.dot {
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
		border: 1px solid #8c8979;
		background: transparent;
	}

	.switch[aria-checked='true'] {
		color: var(--color-ink);
		border-color: var(--color-timber-cedar);
	}

	.switch[aria-checked='true'] .dot {
		background: var(--color-timber-cedar);
		border-color: var(--color-timber-cedar);
	}

	.hinted {
		position: relative;
	}

	.hint {
		position: absolute;
		left: 50%;
		top: calc(100% + 0.45rem);
		transform: translateX(-50%);
		padding: 0.25rem 0.55rem;
		background: var(--color-ink);
		color: var(--color-ground);
		font: 500 var(--text-kicker) var(--font-sans);
		letter-spacing: 0;
		text-transform: none;
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.12s ease;
		z-index: 30;
	}

	.hinted:hover .hint,
	.hinted:focus-visible .hint {
		opacity: 1;
	}

	.group-links {
		flex-direction: row;
		align-items: center;
		margin-left: auto;
		padding-bottom: 0.35rem;
	}

	.menu-row {
		display: flex;
		align-items: center;
		gap: 0.25rem 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.link {
		display: inline-flex;
		align-items: center;
		min-height: 1.75rem;
		font: 600 var(--text-small) var(--font-sans);
		color: var(--color-ink);
		text-decoration: none;
		border-bottom: 2px solid var(--color-border);
	}

	.link:hover {
		border-bottom-color: var(--color-ink);
	}

	.kiosk .link {
		min-height: var(--tap-min);
		padding: 0 0.5rem;
	}

	.menu-button {
		min-width: var(--tap-min);
		min-height: var(--tap-min);
		padding: 0 0.75rem;
		border: 1px solid var(--color-border);
		background: var(--color-ground);
		color: var(--color-ink);
		font: 600 var(--text-small) var(--font-sans);
		cursor: pointer;
	}

	.menu-popover {
		position: fixed;
		inset: 3.25rem 0.5rem auto auto;
		margin: 0;
		padding: 0.25rem 0;
		min-width: 12rem;
		list-style: none;
		background: var(--color-ground);
		border: 1px solid var(--color-border);
		box-shadow: 0 8px 24px rgb(17 20 23 / 0.2);
	}

	.menu-popover .link {
		display: flex;
		min-height: var(--tap-min);
		padding: 0 1rem;
		border-bottom: 0;
	}

	.menu-popover .link:hover {
		background: var(--color-panel);
	}

	/* Wide: the record links sit on the kicker line, top right, clear of the controls. */
	@media (min-width: 1200px) {
		.group-links {
			position: absolute;
			top: 0.3rem;
			right: 0.85rem;
			padding-bottom: 0;
		}
	}

	@media (max-width: 900px) {
		.group-links {
			margin-left: 0;
		}
	}

	@media (max-width: 720px) {
		.strip {
			gap: 0.4rem 0.75rem;
			padding: 0.35rem 0.5rem;
		}

		.group,
		.group-nav {
			flex-direction: row;
			align-items: center;
			padding-right: 0;
			border-right: 0;
		}

		.kicker {
			display: none;
		}

		.brand {
			padding-bottom: 0;
		}

		.field select {
			min-height: 1.9rem;
		}

		.clock {
			margin: 0;
		}

		.clock time {
			font-size: 1rem;
		}

		.seg,
		.switch {
			min-height: 1.9rem;
		}

		.group-links {
			padding-bottom: 0;
			margin-left: auto;
		}

		/* Menu stays on the first row beside the clock; the camera wraps below. */
		.group-camera {
			order: 1;
		}

		.hint {
			display: none;
		}

		.seg,
		.switch {
			padding: 0 0.5rem;
		}
	}
</style>
