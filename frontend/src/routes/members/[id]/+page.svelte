<script lang="ts">
	import { BADGE } from '$lib/data/provenance';
	import type { MemberContribution } from '$lib/data/types';
	import { partyColor, partyLabel } from '$lib/dossier/parties';
	import ExternalLink from '$lib/hud/ExternalLink.svelte';

	let { data } = $props();

	const m = $derived(data.record);
	const termLabel = $derived(new Map((data.index?.terms ?? []).map((t) => [t.term, t.label_en])));
	const currentTenure = $derived(m.tenures.find((t) => t.end_date === null) ?? m.tenures[m.tenures.length - 1] ?? null);
	/** Sitting days beyond this many start collapsed; every contribution is still in the page. */
	const OPEN_DAYS = 5;

	const initials = (name: string) =>
		name
			.split(/\s+/)
			.map((w) => w[0])
			.slice(0, 2)
			.join('');
	const VOTE_LABEL: Record<string, string> = { for: 'For', against: 'Against', abstain: 'Abstain', did_not_vote: 'Did not vote' };
	const chamberHref = (date: string, s: MemberContribution) => (s.t_start === null ? null : `/sitting/${date}?t=${s.t_start}&speech=${encodeURIComponent(s.id)}`);
	const span = (start: string, end: string | null) => `${start} to ${end ?? 'present'}`;
</script>

<svelte:head>
	<title>{m.canonical_name} · Members · Siambr</title>
</svelte:head>

<main id="main">
	<p class="kicker">Siambr · Member of the Senedd · Register of record</p>
	<header class="head">
		{#if m.portrait_url}
			<img class="portrait" src={m.portrait_url} alt="" width="96" height="96" />
		{:else}
			<span class="portrait initials" aria-hidden="true">{initials(m.canonical_name)}</span>
		{/if}
		<div>
			<h1>{m.honorific ? `${m.honorific} ` : ''}{m.canonical_name}</h1>
			{#if m.cymraeg_name && m.cymraeg_name !== m.canonical_name}
				<p class="name-cy" lang="cy">{m.cymraeg_name}</p>
			{/if}
			<p class="meta">
				{#if currentTenure}<span class="party" style:--party={partyColor(currentTenure.party_id)}>{partyLabel(currentTenure.party_id)}</span>{/if}
				<span>{currentTenure?.is_regional_member && currentTenure.region_name ? `Regional Member, ${currentTenure.region_name}` : m.constituency_name_en}</span>
				{#if m.current_status !== 'active'}<span>· {m.current_status === 'former' ? 'Former Member' : 'Deceased'}</span>{/if}
			</p>
			<p class="small"><ExternalLink href={m.official_profile_url}>Official Senedd profile</ExternalLink></p>
		</div>
	</header>

	<section class="record" aria-labelledby="tenures">
		<h2 id="tenures">Tenures</h2>
		<ul class="plain">
			{#each m.tenures as t (t.senedd_term + t.start_date)}
				<li>
					<span class="term">{termLabel.get(t.senedd_term) ?? `Term ${t.senedd_term}`}</span>
					<span>{t.is_regional_member && t.region_name ? `${t.region_name} (regional)` : (t.seat_name ?? m.constituency_name_en)}</span>
					<span class="party" style:--party={partyColor(t.party_id)}>{t.party_label ?? partyLabel(t.party_id)}</span>
					<time data-numeric>{span(t.start_date, t.end_date)}</time>
				</li>
			{/each}
		</ul>
	</section>

	<section class="record" aria-labelledby="roles">
		<h2 id="roles">Ministerial roles</h2>
		{#if m.roles.length}
			<ul class="plain">
				{#each m.roles as r (r.title_en + r.start_date)}
					<li>
						<span class="role">{r.title_en}</span>
						{#if r.title_cy && r.title_cy !== r.title_en}<span lang="cy" class="role-cy">{r.title_cy}</span>{/if}
						<time data-numeric>{span(r.start_date, r.end_date)}{r.start_date_precision === 'term_floor' ? ' (from the start of the term at the earliest)' : ''}</time>
					</li>
				{/each}
			</ul>
		{:else}
			<p>No ministerial roles on record.</p>
		{/if}
	</section>

	<section class="record" aria-labelledby="speeches">
		<h2 id="speeches">Contributions, by sitting day</h2>
		<p class="small"><span data-numeric>{m.contribution_count.toLocaleString('en-GB')}</span> contributions on record, newest first. {BADGE.verbatim}.</p>
		{#if !m.contributions_by_date.length}
			<p>No contributions on record for this Member.</p>
		{/if}
		{#each m.contributions_by_date as day, i (day.date)}
			<details class="day" open={i < OPEN_DAYS}>
				<summary><time datetime={day.date}>{day.date}</time> <span class="small" data-numeric>{day.contributions.length}</span></summary>
				<p class="small"><a href="/sitting/{day.date}">Open this sitting on the stage</a></p>
				<ol class="speeches">
					{#each day.contributions as s (s.id)}
						<li id={s.id}>
							<p class="small where">
								<a href="/register?item={encodeURIComponent(s.item_id)}&speech={encodeURIComponent(s.id)}">{s.item_title_en}</a>
								<span class="lang" aria-label={s.lang === 'cy' ? 'Spoken in Welsh' : 'Spoken in English'}>{s.lang}</span>
							</p>
							<blockquote lang={s.lang}><p>{s.text_original}</p></blockquote>
							{#if s.lang === 'cy' && s.text_english && s.text_english !== s.text_original}
								<p class="small rule">Official English translation</p>
								<blockquote lang="en" class="translation"><p>{s.text_english}</p></blockquote>
							{/if}
							<p class="small actions">
								<!-- No script on this page: the checkbox lifts the six-line clamp through CSS. -->
								<label class="reveal"><input type="checkbox" class="reveal-toggle" /> Read in full</label>
								{#if chamberHref(day.date, s)}
									<a href={chamberHref(day.date, s)}>See it in the chamber</a>
								{:else}
									<span>No broadcast timestamp published, so this contribution cannot be placed on the stage.</span>
								{/if}
								{#if s.tv_url}<ExternalLink href={s.tv_url}>Senedd TV</ExternalLink>{/if}
							</p>
						</li>
					{/each}
				</ol>
			</details>
		{/each}
	</section>

	<section class="record" aria-labelledby="votes">
		<h2 id="votes">Roll-call divisions</h2>
		{#if m.ballots.length}
			<p class="small"><span data-numeric>{m.ballots.length.toLocaleString('en-GB')}</span> recorded votes. {BADGE.division}.</p>
			<table class="ballots">
				<thead>
					<tr><th scope="col">Date</th><th scope="col">Motion</th><th scope="col">Vote</th><th scope="col">Result</th></tr>
				</thead>
				<tbody>
					{#each m.ballots as b (b.division_id)}
						<tr>
							<td><time datetime={b.date}>{b.date}</time></td>
							<td>
								<a href="/register?item={encodeURIComponent(b.item_id)}">{b.item_title_en}</a>
								<span class="small motion">{b.motion_text}</span>
							</td>
							<td data-numeric>{VOTE_LABEL[b.vote_cast] ?? b.vote_cast}</td>
							<td>{b.result === 'agreed' ? 'Agreed' : 'Negatived'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p>No roll-call divisions on record for this Member.</p>
		{/if}
	</section>

	<footer class="citation small">
		Source: <ExternalLink href={m.official_profile_url}>Official Senedd profile</ExternalLink>. Speeches quoted verbatim from the
		<ExternalLink href="https://record.senedd.wales/">Record of Proceedings</ExternalLink>; division results from Modern.Gov. Party and roles as recorded for each date.
	</footer>
</main>

<style>
	main {
		max-width: 60rem;
		margin: 0 auto;
		padding: 3rem 1rem 4rem;
	}

	.head {
		display: flex;
		gap: 1.25rem;
		align-items: flex-start;
		margin-bottom: 2rem;
	}

	.head h1 {
		margin: 0 0 0.25rem;
	}

	.portrait {
		flex: 0 0 96px;
		width: 96px;
		height: 96px;
		object-fit: cover;
		background: var(--color-panel);
	}

	.initials {
		display: grid;
		place-items: center;
		font: 600 1.6rem var(--font-serif);
		color: var(--color-body-text);
	}

	.name-cy {
		margin: 0 0 0.35rem;
		font-family: var(--font-serif);
		color: var(--color-timber-cedar-dark);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0 0 0.35rem;
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

	.record {
		margin: 0 0 2.5rem;
	}

	.record h2 {
		font-size: var(--text-h3);
		font-family: var(--font-sans);
		padding-bottom: 0.4rem;
		border-bottom: 1px solid var(--color-rule-strong);
	}

	.plain {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.plain li {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-border);
	}

	.term,
	.role {
		font-weight: 600;
	}

	.role-cy {
		font-family: var(--font-serif);
		color: var(--color-body-text);
	}

	/* Off-screen sitting days skip layout until scrolled to; the text is still in the document. */
	.day {
		content-visibility: auto;
		contain-intrinsic-size: auto 40rem;
	}

	.day summary {
		margin: 1.25rem 0 0.25rem;
		min-height: var(--tap-min);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font: 600 1rem var(--font-sans);
		cursor: pointer;
	}

	.speeches {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.speeches li {
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--color-border);
	}

	.where {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0 0 0.35rem;
	}

	.lang {
		padding: 0 0.35rem;
		border: 1px solid var(--color-border);
		font-family: var(--font-mono);
	}

	blockquote {
		margin: 0;
		padding-left: 1rem;
		border-left: 2px solid var(--color-timber-cedar);
	}

	blockquote p {
		margin: 0;
		font-family: var(--font-serif);
		line-height: 1.6;
		white-space: pre-line;
	}

	/* Visual only: the whole verbatim text is in the page; ticking "Read in full" lifts the clamp. */
	li:not(:has(.reveal-toggle:checked)) blockquote p {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 6;
		line-clamp: 6;
		overflow: hidden;
	}

	.reveal {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-weight: 600;
		color: var(--color-ink);
		cursor: pointer;
	}

	.rule {
		margin: 0.5rem 0 0.25rem 1rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-body-text);
	}

	.translation {
		border-left-color: var(--color-border);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin: 0.5rem 0 0;
		color: var(--color-body-text);
	}

	.ballots {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-small);
	}

	.ballots th,
	.ballots td {
		padding: 0.5rem 0.5rem 0.5rem 0;
		text-align: left;
		vertical-align: top;
		border-bottom: 1px solid var(--color-border);
	}

	.motion {
		display: block;
		color: var(--color-body-text);
	}

	.citation {
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
		color: var(--color-body-text);
	}
</style>
