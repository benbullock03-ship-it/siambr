<script lang="ts">
	import { browser } from '$app/environment';
	import { speakerOf } from '$lib/data/dossier';
	import type { Contribution, MemberLight } from '$lib/data/types';
	import { speechAnchor } from '$lib/dossier/anchors';
	import { formatOffset } from '$lib/dossier/broadcast';
	import { partyColor, partyLabel } from '$lib/dossier/parties';
	import ExternalLink from './ExternalLink.svelte';

	let {
		speeches,
		speakers,
		targetSpeechId,
		targetSpeakerId,
		recordUrl = null
	}: {
		speeches: Contribution[];
		speakers: Record<string, MemberLight>;
		recordUrl?: string | null;
		targetSpeechId?: string;
		targetSpeakerId?: string;
	} = $props();

	const initials = (name: string) =>
		name
			.split(/\s+/)
			.map((w) => w[0])
			.slice(0, 2)
			.join('');

	$effect(() => {
		if (targetSpeechId && browser) {
			const anchor = speechAnchor(targetSpeechId);
			setTimeout(() => {
				const el = document.getElementById(anchor);
				if (el) {
					el.scrollIntoView({ behavior: 'smooth', block: 'center' });
					el.focus();
				}
			}, 100);
		}
	});
</script>

<ol class="stack">
	{#each speeches as s (s.id)}
		{@const who = speakerOf(speakers, s.member_id)}
		{@const isTarget = targetSpeechId === s.id}
		{@const isSpeakerMatch = Boolean(targetSpeakerId && targetSpeakerId === s.member_id)}
		<li
			id={speechAnchor(s.id)}
			tabindex="-1"
			class:target-speech={isTarget}
			class:speaker-match={isSpeakerMatch && !isTarget}
		>
			<article aria-labelledby="{speechAnchor(s.id)}-speaker">
				{#if isTarget}
					<div class="target-badge" role="status">
						<span class="target-dot"></span>
						<span>Selected Contribution · {who.canonical_name}</span>
					</div>
				{/if}
				<header>
					{#if who.portrait_url}
						<img class="portrait" src={who.portrait_url} alt="" width="48" height="48" loading="lazy" />
					{:else}
						<span class="portrait initials" aria-hidden="true">{initials(who.canonical_name)}</span>
					{/if}
					<div>
						<h3 id="{speechAnchor(s.id)}-speaker">{who.canonical_name}</h3>
						<p class="meta small">
							{#if who.role_title_en}<span class="role">{who.role_title_en}</span>{/if}
							<span class="party" style:--party={partyColor(who.party_id)}>{partyLabel(who.party_id)}</span>
							<span class="lang" aria-label={s.lang === 'cy' ? 'Spoken in Welsh' : 'Spoken in English'}>{s.lang}</span>
						</p>
					</div>
				</header>
				<blockquote lang={s.lang}>
					<p>{s.text_original}</p>
				</blockquote>
				{#if s.lang === 'cy' && s.text_english && s.text_english !== s.text_original}
					<details>
						<summary class="small">Official English translation</summary>
						<p lang="en">{s.text_english}</p>
					</details>
				{/if}
				{#if s.t_start !== null}
					<p class="offset small">
						{#if s.tv_url}
							<ExternalLink href={s.tv_url}>Watch from <time data-numeric>{formatOffset(s.t_start)}</time></ExternalLink>
						{:else}
							Broadcast offset <time data-numeric>{formatOffset(s.t_start)}</time>
						{/if}
					</p>
				{/if}
				{#if recordUrl}
					<p class="small record"><ExternalLink href={recordUrl}>Read this in the Record</ExternalLink></p>
				{/if}
			</article>
		</li>
	{/each}
</ol>

<style>
	.stack {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		padding: 1.25rem 0;
		border-top: 1px solid var(--color-border);
		scroll-margin-top: 1.5rem;
		transition: background 0.2s ease, border-color 0.2s ease;
	}

	li.target-speech {
		background: rgba(201, 24, 126, 0.07);
		border-left: 4px solid var(--color-accent-plum);
		padding: 1.25rem 1.1rem;
		margin: 0.75rem 0;
		border-radius: 4px;
		box-shadow: 0 0 0 1px rgba(201, 24, 126, 0.2), 0 4px 16px rgba(201, 24, 126, 0.08);
	}

	li.speaker-match {
		background: rgba(200, 125, 74, 0.06);
		border-left: 3px solid var(--color-timber-cedar);
		padding-left: 0.85rem;
	}

	.target-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		margin-bottom: 0.85rem;
		padding: 0.25rem 0.65rem;
		background: var(--color-accent-plum);
		color: #ffffff;
		font: 700 0.72rem var(--font-sans);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		border-radius: 2px;
	}

	.target-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #ffffff;
		box-shadow: 0 0 4px #ffffff;
	}

	li:focus-visible {
		outline-offset: 4px;
	}

	header {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	h3 {
		margin: 0;
	}

	.portrait {
		flex: none;
		width: 48px;
		height: 48px;
		object-fit: cover;
		background: var(--color-panel);
	}

	.initials {
		display: grid;
		place-items: center;
		font-weight: 600;
		color: var(--color-body-text);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.75rem;
		margin: 0.1rem 0 0;
		color: var(--color-body-text);
	}

	.role {
		font-weight: 600;
		color: var(--color-ink);
	}

	.party::before {
		content: '';
		display: inline-block;
		width: 0.6em;
		height: 0.6em;
		margin-right: 0.35em;
		background: var(--party);
	}

	.lang {
		font-family: var(--font-mono);
		text-transform: uppercase;
		padding: 0 0.35rem;
		border: 1px solid var(--color-rule-strong);
		color: var(--color-ink);
	}

	blockquote {
		margin: 0.75rem 0 0;
		padding: 0;
		color: var(--color-ink);
		white-space: pre-line;
	}

	blockquote p {
		margin: 0;
		max-width: 68ch;
	}

	details {
		margin-top: 0.5rem;
	}

	summary {
		cursor: pointer;
		color: var(--color-body-text);
	}

	.offset {
		margin: 0.5rem 0 0;
	}
</style>
