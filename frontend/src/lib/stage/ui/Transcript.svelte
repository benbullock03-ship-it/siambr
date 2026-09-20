<script lang="ts">
	import type { MemberLight, Sitting } from '$lib/data/types';
	import { BADGE } from '$lib/data/provenance';
	import { partyColor, partyLabel } from '$lib/dossier/parties';
	import type { SittingClock } from '../clock.svelte';
	import type { Beat } from '../timeline';

	let { clock, sitting }: { clock: SittingClock; sitting: Sitting } = $props();

	const live = $derived<Beat | null>(clock.floor.live);
	const contribution = $derived(live?.kind === 'contribution' ? live.contribution : null);
	const speaker = $derived<MemberLight | null>(contribution ? (sitting.speakers[contribution.member_id] ?? null) : null);
	const item = $derived(live ? (sitting.items.find((i) => i.id === live.itemId) ?? null) : null);
	const untimed = $derived(live?.kind === 'contribution' && !live.timed);
	let portraitFailed = $state(false);
	$effect(() => {
		void speaker?.id;
		portraitFailed = false;
	});

	// Auto-scroll: the text advances with the beat's real pace and yields to the visitor's own
	// scrolling until the next contribution starts.
	let column = $state<HTMLElement>();
	let held = $state(false);
	let lastBeatIndex = -1;
	let programmatic = 0;
	$effect(() => {
		const beat = live;
		const t = clock.t;
		const el = column;
		if (!el || !beat) return;
		if (beat.index !== lastBeatIndex) {
			lastBeatIndex = beat.index;
			held = false;
			programmatic = 1;
			el.scrollTop = 0;
		}
		if (held) return;
		const length = beat.tEnd - beat.t;
		const k = length > 0 ? Math.min(1, Math.max(0, (t - beat.t) / length)) : 0;
		const top = Math.round((el.scrollHeight - el.clientHeight) * k);
		if (Math.abs(el.scrollTop - top) >= 1) {
			programmatic = 1;
			el.scrollTop = top;
		}
	});
	function onscroll() {
		if (programmatic) {
			programmatic = 0;
			return;
		}
		held = true;
	}
	const hold = () => (held = true);
</script>

<section class="transcript" aria-label="Transcript">
	{#if contribution}
		<header class="head">
			{#if speaker?.portrait_url && !portraitFailed}
				<img class="portrait" src={speaker.portrait_url} alt="" width="64" height="64" loading="lazy" onerror={() => (portraitFailed = true)} />
			{/if}
			<div>
				{#if item}<p class="kicker">{item.title_en}</p>{/if}
				{#if speaker}
					<h2 class="name">{speaker.canonical_name}</h2>
					{#if speaker.cymraeg_name && speaker.cymraeg_name !== speaker.canonical_name}
						<p class="name-cy" lang="cy">{speaker.cymraeg_name}</p>
					{/if}
					<p class="meta small">
						<span class="party" style:--party={partyColor(speaker.party_id)}>{partyLabel(speaker.party_id)}</span>
						<span>{speaker.constituency_name_en}</span>
						{#if speaker.role_title_en}<span>· {speaker.role_title_en}</span>{/if}
						<span class="lang">{contribution.lang === 'cy' ? 'Cymraeg' : 'English'}</span>
					</p>
				{:else}
					<h2 class="name">{contribution.member_id}</h2>
					<p class="meta small">Speaker not in the Members register.</p>
				{/if}
			</div>
		</header>

		<div class="body" bind:this={column} {onscroll} onwheel={hold} ontouchmove={hold} role="group" aria-label="Contribution text" tabindex="-1">
			<p class="badge small">{BADGE.verbatim}</p>
			<div class="text" lang={contribution.lang}>
				{#each contribution.text_original.split(/\n+/) as para, i (i)}
					<p>{para}</p>
				{/each}
			</div>
			{#if contribution.lang === 'cy'}
				<p class="rule small" role="separator">Official English translation</p>
				<div class="text translation" lang="en">
					{#each contribution.text_english.split(/\n+/) as para, i (i)}
						<p>{para}</p>
					{/each}
				</div>
			{/if}
			<p class="small tv">
				{#if untimed}
					No broadcast timestamp published for this contribution.
				{:else if contribution.tv_url}
					<a href={contribution.tv_url} rel="external">Watch this moment on Senedd TV</a>
				{/if}
			</p>
		</div>
	{:else if live?.kind === 'division'}
		<header class="head">
			<div>
				{#if item}<p class="kicker">{item.title_en}</p>{/if}
				<h2 class="name">Division</h2>
			</div>
		</header>
		<div class="body" bind:this={column}>
			<p class="badge small">{BADGE.division}</p>
			<div class="text"><p>{live.division.motion_text}</p></div>
			<p class="small">
				For <span data-numeric>{live.division.votes_for}</span>, against <span data-numeric>{live.division.votes_against}</span>, abstain
				<span data-numeric>{live.division.votes_abstain}</span>: {live.division.result === 'agreed' ? 'agreed' : 'negatived'}.
			</p>
		</div>
	{:else}
		<div class="body empty">
			<p class="small">No one holds the floor. Press Play, or choose a contribution from the running order.</p>
		</div>
	{/if}
</section>

<style>
	.transcript {
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: var(--color-ground);
		font-family: var(--font-sans);
	}

	.head {
		display: flex;
		gap: 0.9rem;
		padding: 1rem 1.25rem 0.75rem;
		border-bottom: 1px solid var(--color-border);
	}

	.portrait {
		width: 64px;
		height: 64px;
		object-fit: cover;
		border-radius: var(--rounded-small);
		background: var(--color-panel);
	}

	.kicker {
		margin: 0 0 0.2rem;
	}

	.name {
		margin: 0;
		font: 600 1.25rem var(--font-serif);
	}

	.name-cy {
		margin: 0;
		font-family: var(--font-serif);
		color: var(--color-timber-cedar-dark);
	}

	.meta {
		margin: 0.25rem 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
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

	.lang {
		margin-left: auto;
		padding: 0 0.4rem;
		border: 1px solid var(--color-border);
		font-family: var(--font-mono);
	}

	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0.75rem 1.25rem 1.5rem;
	}

	.badge {
		margin: 0 0 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-muted);
	}

	.text p {
		font-family: var(--font-serif);
		font-size: 1.05rem;
		line-height: 1.65;
		margin: 0 0 0.9em;
	}

	.rule {
		margin: 1rem 0 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--color-rule-strong);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-muted);
	}

	.translation p {
		color: var(--color-body-text);
	}

	.tv {
		margin-top: 1rem;
	}

	.empty {
		display: grid;
		place-items: center;
		text-align: center;
	}
</style>
