<script lang="ts">
	import type { MemberRecord } from '$lib/api/types';
	import { partyColor, partyLabel } from '$lib/dossier/parties';
	import Drawer from './Drawer.svelte';

	let { record, onclose }: { record: MemberRecord; onclose: () => void } = $props();

	const m = $derived(record.member);
	const titleId = $derived(`member-${m.id}-title`);
	const currentTenure = $derived(m.tenures.find((t) => t.end_date === null) ?? m.tenures[m.tenures.length - 1] ?? null);
	const currentRoles = $derived(m.roles.filter((r) => r.end_date === null));
	const firstTerm = $derived(m.tenures.length ? Math.min(...m.tenures.map((t) => t.senedd_term)) : null);
	let portraitFailed = $state(false);

	const initials = (name: string) =>
		name
			.split(/\s+/)
			.map((w) => w[0])
			.slice(0, 2)
			.join('');

	const VOTE_LABEL: Record<string, string> = {
		for: 'For',
		against: 'Against',
		abstain: 'Abstain',
		did_not_vote: 'Did not vote'
	};
</script>

<Drawer {titleId} {onclose} closeLabel="Close record">
	<header class="head">
		{#if m.portrait_url && !portraitFailed}
			<img class="portrait" src={m.portrait_url} alt="" width="72" height="72" loading="lazy" onerror={() => (portraitFailed = true)} />
		{:else}
			<span class="portrait initials" aria-hidden="true">{initials(m.canonical_name)}</span>
		{/if}
		<div>
			<p class="kicker">Member of the Senedd · Dossier Plate</p>
			<h2 id={titleId}>{m.honorific ? `${m.honorific} ` : ''}{m.canonical_name}</h2>
			{#if m.cymraeg_name && m.cymraeg_name !== m.canonical_name}
				<p class="name-cy" lang="cy">{m.cymraeg_name}</p>
			{/if}
			<p class="meta">
				{#if currentTenure}
					<span class="party" style:--party={partyColor(currentTenure.party_id)}>{partyLabel(currentTenure.party_id)}</span>
				{/if}
				<span>{m.constituency_name_en}</span>
				{#if currentTenure?.is_regional_member && currentTenure.region_name}
					<span>· Regional Member, {currentTenure.region_name}</span>
				{/if}
			</p>
			{#each currentRoles as role (role.title_en)}
				<p class="role">{role.title_en}</p>
			{/each}
			{#if firstTerm !== null}
				<p class="small">Member since term <span data-numeric>{firstTerm}</span>.</p>
			{/if}
		</div>
	</header>

	<section aria-labelledby="{titleId}-speeches">
		<h3 id="{titleId}-speeches" class="kicker">Verbatim Official Record</h3>
		<p class="small count">
			<span data-numeric>{record.speech_total.toLocaleString('en-GB')}</span> contributions on record.
			{#if record.speech_total > record.speeches.length}
				Showing the latest <span data-numeric>{record.speeches.length}</span>.
			{/if}
		</p>
		{#if record.speeches.length}
			<ol class="speeches">
				{#each record.speeches as s (s.id)}
					<li>
						<article>
							<p class="small where">
								<time datetime={s.session_date}>{s.session_date}</time> ·
								<a href="/register?item={encodeURIComponent(s.agenda_item_id)}">{s.agenda_item_title_en}</a>
								<span class="lang" aria-label={s.spoken_language === 'cy' ? 'Spoken in Welsh' : 'Spoken in English'}>{s.spoken_language}</span>
							</p>
							<blockquote lang={s.spoken_language}><p>{s.verbatim_text_original}</p></blockquote>
							{#if s.spoken_language === 'cy' && s.verbatim_text_english && s.verbatim_text_english !== s.verbatim_text_original}
								<details>
									<summary class="small">Official English translation</summary>
									<p lang="en">{s.verbatim_text_english}</p>
								</details>
							{/if}
						</article>
					</li>
				{/each}
			</ol>
		{:else}
			<p>No contributions on record for this Member.</p>
		{/if}
		{#if record.speech_total > record.speeches.length}
			<p><a href="/register?speaker={encodeURIComponent(m.id)}">Every debate this Member spoke in, in the Register</a></p>
		{/if}
	</section>

	<section aria-labelledby="{titleId}-votes">
		<h3 id="{titleId}-votes" class="kicker">Roll-call divisions</h3>
		{#if record.ballots.length}
			<p class="small count">
				<span data-numeric>{record.ballot_total.toLocaleString('en-GB')}</span> recorded votes.
				{#if record.ballot_total > record.ballots.length}
					Showing the latest <span data-numeric>{record.ballots.length}</span>.
				{/if}
			</p>
			<table class="ballots">
				<thead>
					<tr><th scope="col">Date</th><th scope="col">Motion</th><th scope="col">Vote</th><th scope="col">Result</th></tr>
				</thead>
				<tbody>
					{#each record.ballots as b (b.division_id)}
						<tr>
							<td><time datetime={b.session_date}>{b.session_date}</time></td>
							<td>
								<a href="/register?item={encodeURIComponent(b.agenda_item_id)}">{b.agenda_item_title_en}</a>
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
		Source: <a href={m.official_profile_url} rel="external">Official Senedd profile</a>. Speeches quoted from the Record of Proceedings.
	</footer>
</Drawer>

<style>
	.head {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		margin-bottom: 1.25rem;
	}

	.head h2 {
		margin-bottom: 0.15rem;
	}

	.portrait {
		flex: none;
		width: 72px;
		height: 72px;
		object-fit: cover;
		background: var(--color-panel);
	}

	.initials {
		display: grid;
		place-items: center;
		font: 600 1.4rem var(--font-serif);
		color: var(--color-ink);
	}

	.name-cy {
		margin: 0 0 0.35rem;
		font-family: var(--font-serif);
		color: var(--color-body-text);
	}

	.meta {
		margin: 0 0 0.25rem;
		color: var(--color-body-text);
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

	.party {
		margin-right: 0.5rem;
		font-weight: 600;
		color: var(--color-ink);
	}

	.role {
		margin: 0 0 0.25rem;
		font-weight: 600;
		color: var(--color-ink);
	}

	section {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}

	.count {
		color: var(--color-muted);
		margin-top: 0;
	}

	.speeches {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.speeches li + li {
		margin-top: 1.25rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}

	.where {
		margin: 0 0 0.35rem;
		color: var(--color-muted);
	}

	.lang {
		margin-left: 0.4rem;
		font-family: var(--font-mono);
		text-transform: uppercase;
		border: 1px solid var(--color-border);
		padding: 0 0.3em;
	}

	blockquote {
		margin: 0;
		padding-left: 1rem;
		border-left: 3px solid var(--color-timber-cedar);
	}

	blockquote p {
		margin: 0;
		font-size: 1rem;
		line-height: 1.7;
	}

	details {
		margin-top: 0.5rem;
	}

	.ballots {
		width: 100%;
		border-collapse: collapse;
	}

	.ballots th,
	.ballots td {
		text-align: left;
		vertical-align: top;
		padding: 0.5rem 0.5rem 0.5rem 0;
		border-bottom: 1px solid var(--color-border);
	}

	.ballots th {
		font-size: var(--text-kicker);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-muted);
	}

	.motion {
		display: block;
		color: var(--color-body-text);
	}

	.citation {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-rule-strong);
	}
</style>
