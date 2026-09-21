<script lang="ts">
	import { PROVENANCE_DERIVED } from '$lib/data/types';
	import type { PartyStat } from '$lib/data/types';
	import { partyColor, partyLabel } from '$lib/dossier/parties';
	import { count, duration, share } from './format';

	let { rows, caption }: { rows: PartyStat[]; caption: string } = $props();

	const total = $derived(rows.reduce((s, r) => s + r.seconds, 0));
	const widest = $derived(Math.max(1, ...rows.map((r) => r.seconds)));
</script>

<figure class="chart" data-provenance={PROVENANCE_DERIVED}>
	<figcaption class="small">{caption}</figcaption>
	<ul>
		{#each rows as r (r.party_id ?? 'none')}
			<li>
				<p class="label">
					<span class="name">{partyLabel(r.party_id)}</span>
					<span class="value small">
						<span data-numeric>{duration(r.seconds)}</span>
						· <span data-numeric>{share(r.seconds, total)}</span> of the speaking time counted here
						· <span data-numeric>{count(r.contributions)}</span> contributions
					</span>
				</p>
				<span class="track">
					<span class="bar" style:width="{(r.seconds / widest) * 100}%" style:--party={partyColor(r.party_id)}></span>
				</span>
			</li>
		{/each}
	</ul>
</figure>

<style>
	.chart {
		margin: 0 0 1.5rem;
	}

	figcaption {
		color: var(--color-body-text);
		margin-bottom: 0.75rem;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		margin: 0 0 0.9rem;
	}

	.label {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem 0.75rem;
		margin: 0 0 0.25rem;
	}

	.name {
		font-weight: 600;
		color: var(--color-ink);
	}

	.value {
		color: var(--color-body-text);
	}

	.track {
		display: block;
		height: 0.75rem;
		background: var(--color-panel);
	}

	.bar {
		display: block;
		height: 100%;
		min-width: 2px;
		background: var(--party);
		/* A hairline of ground keeps touching bars legible in forced-colours and print. */
		box-shadow: inset 0 0 0 1px var(--color-ground);
	}

	@media (forced-colors: active) {
		.bar {
			background: CanvasText;
		}
	}
</style>
