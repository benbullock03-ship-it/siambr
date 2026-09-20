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

<div class="strip">
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

	<p class="clock" aria-label="Wall clock">
		<span class="kicker">Clock</span>
		<time data-numeric>{clock.wallClock ?? '—:—:—'}</time>
	</p>

	{#if !compact}
		<Transport {clock} />
		<div class="speed" role="group" aria-label="Speed">
			{#each SPEEDS as s (s)}
				<button type="button" class="chip" aria-pressed={clock.speed === s} onclick={() => clock.setSpeed(s)}>{s}x</button>
			{/each}
		</div>
	{/if}

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

	<p class="links">
		<a href="/sitting/{date}/stats">Stats</a>
		<a href="/register">Register</a>
	</p>
</div>

<style>
	.strip {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
		padding: 0.5rem 1rem;
		background: var(--color-ground);
		border-bottom: 1px solid var(--color-border);
		font-family: var(--font-sans);
	}

	.kicker {
		display: block;
		margin: 0;
	}

	.picker select {
		min-height: var(--tap-min);
		padding: 0 0.5rem;
		border: 1px solid var(--color-border);
		background: var(--color-ground);
		color: var(--color-ink);
		font: 600 var(--text-small) var(--font-mono);
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
	}

	.chip[aria-pressed='true'],
	.chip[aria-checked='true'] {
		background: var(--color-ink);
		color: var(--color-ground);
		border-color: var(--color-ink);
	}

	.links {
		margin: 0 0 0 auto;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: var(--tap-min);
		font: 600 var(--text-small) var(--font-sans);
	}

	@media (max-width: 720px) {
		.strip {
			gap: 0.4rem 0.6rem;
			padding: 0.4rem 0.75rem;
		}

		.camera {
			width: 100%;
		}
	}
</style>
