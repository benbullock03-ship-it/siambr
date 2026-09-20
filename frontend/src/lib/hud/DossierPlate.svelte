<script lang="ts">
	import type { Dossier } from '$lib/data/dossier';
	import { DERIVED_NOTICE } from '$lib/data/provenance';
	import { broadcastLink } from '$lib/dossier/broadcast';
	import DivisionPlate from './DivisionPlate.svelte';
	import Drawer from './Drawer.svelte';
	import SpeechStack from './SpeechStack.svelte';

	let { dossier, onclose }: { dossier: Dossier; onclose: () => void } = $props();

	const titleId = $derived(`dossier-${dossier.item.id}-title`);
	const itemBroadcast = $derived.by(() => {
		const starts = dossier.contributions.flatMap((c) => c.t_start ?? []);
		return broadcastLink(dossier.item.clip_url, starts.length ? Math.min(...starts) : null);
	});
	const stageHref = $derived.by(() => {
		const starts = dossier.contributions.flatMap((c) => c.t_start ?? []);
		const t = starts.length ? Math.min(...starts) : null;
		return `/sitting/${dossier.sitting.date}${t === null ? `?item=${encodeURIComponent(dossier.item.id)}` : `?t=${t}`}`;
	});
</script>

<Drawer {titleId} {onclose} closeLabel="Close dossier">
	<header class="head">
		<p class="kicker">Dossier Plate · <time datetime={dossier.sitting.date}>{dossier.sitting.date}</time></p>
		<h2 id={titleId}>{dossier.item.title_en}</h2>
		<p class="title-cy" lang="cy">{dossier.item.title_cy}</p>
		<p class="small provenance">{DERIVED_NOTICE.topic}</p>
	</header>

	<section class="seam" aria-label="Where to watch">
		{#if itemBroadcast}
			<a class="button-primary watch" href={itemBroadcast} rel="external">Watch on Senedd TV</a>
		{/if}
		<a class="stage" href={stageHref}>Watch it play in the chamber</a>
	</section>

	<section aria-labelledby="{titleId}-record">
		<h3 id="{titleId}-record" class="kicker">Verbatim Official Record</h3>
		{#if dossier.sitting.record_published_at}
			<p class="small published">
				Record published by the Senedd at
				<time data-numeric datetime={dossier.sitting.record_published_at}>{dossier.sitting.record_published_at.replace('T', ' ')}</time>.
			</p>
		{/if}
		{#if dossier.contributions.length}
			<SpeechStack speeches={dossier.contributions} speakers={dossier.speakers} />
		{:else}
			<p>No contributions on record for this item.</p>
		{/if}
	</section>

	{#each dossier.divisions as division (division.id)}
		<DivisionPlate {division} speakers={dossier.speakers} />
	{/each}

	<footer class="citation small">
		Source: <a href={dossier.sitting.source_xml_url} rel="external">Official Record of Proceedings</a>
	</footer>
</Drawer>

<style>
	.head {
		margin-bottom: 1.25rem;
	}

	.title-cy {
		margin: 0;
		font-family: var(--font-serif);
		color: var(--color-body-text);
	}

	.provenance {
		margin: 0.5rem 0 0;
		color: var(--color-muted);
	}

	.seam {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
		margin: 1.25rem 0;
	}

	.watch {
		display: inline-flex;
		align-items: center;
		text-decoration: none;
	}

	.published {
		color: var(--color-body-text);
	}

	.citation {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-rule-strong);
	}
</style>
