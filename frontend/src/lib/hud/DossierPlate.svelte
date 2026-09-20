<script lang="ts">
	import type { DossierPlate } from '$lib/api/types';
	import { broadcastLink } from '$lib/dossier/broadcast';
	import DivisionPlate from './DivisionPlate.svelte';
	import Drawer from './Drawer.svelte';
	import SpeechStack from './SpeechStack.svelte';

	let { dossier, onclose }: { dossier: DossierPlate; onclose: () => void } = $props();

	const titleId = $derived(`dossier-${dossier.id}-title`);
	const itemBroadcast = $derived.by(() => {
		const starts = dossier.contributions.flatMap((c) => c.video_timestamp_start ?? []);
		return broadcastLink(dossier.senedd_tv_clip_url, starts.length ? Math.min(...starts) : null);
	});
</script>

<Drawer {titleId} {onclose} closeLabel="Close dossier">
	<header class="head">
		<p class="kicker">Dossier Plate · <time datetime={dossier.session_date}>{dossier.session_date}</time></p>
		<h2 id={titleId}>{dossier.title_en}</h2>
		<p class="title-cy" lang="cy">{dossier.title_cy}</p>
	</header>

	{#if itemBroadcast}
		<section class="seam" aria-label="Senedd TV broadcast">
			<a class="button-primary watch" href={itemBroadcast} rel="external">Watch on Senedd TV</a>
		</section>
	{/if}

	{#if dossier.petitions.length}
		<section class="petitions" aria-labelledby="{titleId}-petitions">
			<h3 id="{titleId}-petitions">Linked petitions</h3>
			<ul>
				{#each dossier.petitions as p (p.id)}
					<li>
						<a href={p.source_url} rel="external">{p.title_en}</a>
						<span class="small"><span data-numeric>{p.signature_count.toLocaleString('en-GB')}</span> signatures</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section aria-labelledby="{titleId}-record">
		<h3 id="{titleId}-record" class="kicker">Verbatim Official Record</h3>
		{#if dossier.contributions.length}
			<SpeechStack speeches={dossier.contributions} clipUrl={dossier.senedd_tv_clip_url} />
		{:else}
			<p>No contributions on record for this item.</p>
		{/if}
	</section>

	{#each dossier.divisions as division (division.id)}
		<DivisionPlate {division} />
	{/each}

	<footer class="citation small">
		Source: <a href={dossier.source_xml_url} rel="external">Official Record of Proceedings</a>
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

	.seam {
		margin: 1.25rem 0;
	}

	.watch {
		display: inline-flex;
		align-items: center;
		text-decoration: none;
	}

	.petitions ul {
		padding-left: 1.1rem;
	}

	.petitions li span {
		margin-left: 0.5rem;
		color: var(--color-body-text);
	}

	.citation {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-rule-strong);
	}
</style>
