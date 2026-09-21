<script lang="ts">
	import type { SittingClock } from '../clock.svelte';

	let { clock }: { clock: SittingClock } = $props();
</script>

<!-- Play leads so it is the first stop after the sitting picker (T-26 keyboard entry). -->
<div id="transport" class="transport" role="group" aria-label="Transport">
	<button type="button" class="button-primary play" onclick={() => clock.toggle()} disabled={clock.atEnd} aria-label={clock.playing ? 'Pause' : 'Play'} title="Play or pause (Space or K)">
		{clock.playing ? 'Pause' : 'Play'}
	</button>
	<button type="button" class="step" onclick={() => clock.stepItem(-1)} aria-label="Previous item" title="Previous item (Shift+Left)">⇤</button>
	<button type="button" class="step" onclick={() => clock.stepContribution(-1)} aria-label="Previous contribution" title="Previous contribution (Left)">←</button>
	<button type="button" class="step" onclick={() => clock.stepContribution(1)} aria-label="Next contribution" title="Next contribution (Right)">→</button>
	<button type="button" class="step" onclick={() => clock.stepItem(1)} aria-label="Next item" title="Next item (Shift+Right)">⇥</button>
</div>

<style>
	.transport {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.step {
		min-width: var(--tap-min);
		min-height: var(--tap-min);
		border: 1px solid var(--color-border);
		background: var(--color-ground);
		color: var(--color-ink);
		font: 600 1rem var(--font-sans);
		cursor: pointer;
	}

	.play {
		min-width: 4.25rem;
	}
</style>
