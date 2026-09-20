<script lang="ts">
	import { goto } from '$app/navigation';
	import type { VantageId } from '$lib/3d/chamber/layout';
	import type { GuidedRig } from '$lib/3d/controls/guided.svelte';
	import type { SiambrState } from '$lib/3d/state.svelte';
	import type { SittingSummary } from '$lib/data/types';
	import { SPEEDS, type SittingClock } from '../clock.svelte';
	import Transport from './Transport.svelte';

	let {
		clock,
		rig,
		hud,
		date,
		sittings,
		onspeaker,
		compact = false
	}: {
		clock: SittingClock;
		rig: GuidedRig;
		hud: SiambrState;
		date: string;
		sittings: SittingSummary[];
		onspeaker: () => void;
		/** Phone: the transport lives in the sheet header instead. */
		compact?: boolean;
	} = $props();

	const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	const monthOf = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
	/** Newest first, grouped by month as the index already orders them. */
	const groups = $derived.by(() => {
		const out: { month: string; dates: string[] }[] = [];
		for (const s of sittings) {
			const month = monthOf(s.date);
			const last = out[out.length - 1];
			if (last?.month === month) last.dates.push(s.date);
			else out.push({ month, dates: [s.date] });
		}
		return out;
	});

	const vantages: { id: Exclude<VantageId, 'speaker'>; label: string }[] = [
		{ id: 'gallery', label: 'Gallery' },
		{ id: 'llywydd', label: 'Y Llywydd' },
		{ id: 'floor', label: 'Floor' }
	];
	const walkAllowed = $derived(!hud.reducedMotion && !hud.kiosk);

	function pick(id: Exclude<VantageId, 'speaker'>) {
		hud.walk = false;
		rig.setVantage(id);
	}
</script>

<div class="strip" role="toolbar" aria-label="Chamber stage controls">
	<!-- Group 1: Navigation & Sitting Selection -->
	<div class="group group-nav">
		<a href="/?home=1" class="brand-link" title="Siambr landing page">
			<span class="brand-title">Siambr</span>
		</a>
		<a href="/?home=1" class="nav-home-btn" aria-label="Return to landing page">
			<span class="nav-arrow" aria-hidden="true">←</span>
			<span>Home</span>
		</a>
		<div class="divider" aria-hidden="true"></div>
		<label class="picker">
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

	<!-- Group 2: Clock & Playback Transport -->
	<div class="group group-playback">
		<p class="clock" aria-label="Wall clock">
			<span class="kicker">Clock</span>
			<time data-numeric>{clock.wallClock ?? '—:—:—'}</time>
		</p>
		{#if !compact && (!hud.kiosk || !hud.drifting)}
			<Transport {clock} />
			<div class="speed" role="group" aria-label="Speed">
				{#each SPEEDS as s (s)}
					<button type="button" class="chip" aria-pressed={clock.speed === s} onclick={() => clock.setSpeed(s)}>{s}x</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Group 3: Camera Vantages & Floor Navigation -->
	<div class="group group-camera">
		<div class="camera" role="group" aria-label="Camera">
			{#each vantages as v (v.id)}
				<button type="button" class="chip" aria-pressed={!hud.walk && rig.vantage === v.id} onclick={() => pick(v.id)}>{v.label}</button>
			{/each}
			<button type="button" class="chip" aria-pressed={!hud.walk && rig.vantage === 'speaker'} onclick={onspeaker}>Speaker</button>
			<button type="button" class="chip" role="switch" aria-checked={rig.follow} onclick={() => (rig.follow = !rig.follow)}>Follow</button>
			{#if walkAllowed}
				<button type="button" class="chip" role="switch" aria-checked={hud.walk} onclick={() => (hud.walk = !hud.walk)}>Walk the floor</button>
			{/if}
		</div>
	</div>

	<!-- Group 4: Civic Records & Statistics -->
	<div class="group group-links">
		<a class="chip chip-stats" href="/sitting/{date}/stats">Session stats</a>
		<a class="nav-register-link" href="/register">Register</a>
	</div>
</div>

<style>
	.strip {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 1rem;
		padding: 0.45rem 0.85rem;
		background: var(--color-ground);
		border-bottom: 1px solid var(--color-border);
		font-family: var(--font-sans);
		box-sizing: border-box;
		width: 100%;
	}

	.group {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
	}

	.group-nav {
		flex-shrink: 0;
	}

	.brand-link {
		display: inline-flex;
		align-items: center;
		text-decoration: none;
		padding: 0.15rem 0.35rem;
		border-radius: 4px;
	}

	.brand-link:hover .brand-title {
		color: var(--color-accent-plum);
	}

	.brand-title {
		font-family: var(--font-serif);
		font-weight: 700;
		font-size: 1.25rem;
		color: var(--color-ink);
		letter-spacing: -0.01em;
		line-height: 1;
	}

	.nav-home-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		min-height: var(--tap-min);
		padding: 0 0.65rem;
		font-size: var(--text-small);
		font-weight: 600;
		color: var(--color-body-text);
		background: var(--color-panel);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		text-decoration: none;
		transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
	}

	.nav-home-btn:hover {
		background: #dad5c7;
		color: var(--color-ink);
		border-color: #8c8979;
	}

	.nav-arrow {
		font-size: 1rem;
		line-height: 1;
	}

	.divider {
		width: 1px;
		height: 1.8rem;
		background: var(--color-border);
		margin: 0 0.2rem;
	}

	.kicker {
		display: block;
		margin: 0;
		font-size: var(--text-kicker);
		color: var(--color-body-text);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.picker select {
		min-height: var(--tap-min);
		padding: 0 0.5rem;
		border: 1px solid var(--color-border);
		background: var(--color-ground);
		color: var(--color-ink);
		font: 600 var(--text-small) var(--font-mono);
		border-radius: 4px;
	}

	.picker select:focus {
		outline: 2px solid var(--color-focus);
		outline-offset: 1px;
	}

	.clock {
		margin: 0;
	}

	.clock time {
		font: 600 1.1rem var(--font-mono);
		color: var(--color-ink);
	}

	.speed,
	.camera {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
	}

	.chip {
		min-height: var(--tap-min);
		padding: 0 0.7rem;
		border: 1px solid var(--color-border);
		background: var(--color-ground);
		color: var(--color-ink);
		font: 600 var(--text-small) var(--font-sans);
		cursor: pointer;
		border-radius: 4px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		transition: background 0.12s ease, border-color 0.12s ease;
	}

	.chip:hover {
		border-color: #8c8979;
		background: #eceae3;
	}

	.chip[aria-pressed='true'],
	.chip[aria-checked='true'] {
		background: var(--color-ink);
		color: var(--color-ground);
		border-color: var(--color-ink);
	}

	.chip-stats {
		font-weight: 600;
		color: var(--color-ink);
		background: var(--color-panel);
	}

	.group-links {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.nav-register-link {
		min-height: var(--tap-min);
		display: inline-flex;
		align-items: center;
		font: 600 var(--text-small) var(--font-sans);
		color: var(--color-accent-plum);
		text-decoration: none;
		padding: 0 0.35rem;
	}

	.nav-register-link:hover {
		color: var(--color-accent-plum-dark);
		text-decoration: underline;
	}

	@media (max-width: 900px) {
		.group-links {
			margin-left: 0;
		}
	}

	@media (max-width: 720px) {
		.strip {
			gap: 0.4rem 0.5rem;
			padding: 0.35rem 0.5rem;
		}

		.divider {
			display: none;
		}

		.group-nav {
			width: 100%;
			justify-content: space-between;
		}

		.camera {
			width: 100%;
			gap: 0.25rem;
		}

		.chip {
			padding: 0 0.5rem;
		}
	}
</style>
