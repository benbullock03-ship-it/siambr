<script lang="ts">
	import type { MemberFile } from '$lib/data/types';
	import { partyColor, partyLabel } from '$lib/dossier/parties';
	import Drawer from './Drawer.svelte';

	let { record, onclose }: { record: MemberFile; onclose: () => void } = $props();

	const LATEST = 25;
	const m = $derived(record);
	const titleId = $derived(`member-${m.id}-title`);
	const currentTenure = $derived(m.tenures.find((t) => t.end_date === null) ?? m.tenures[m.tenures.length - 1] ?? null);
	const currentRoles = $derived(m.roles.filter((r) => r.end_date === null));
	const firstTerm = $derived(m.tenures.length ? Math.min(...m.tenures.map((t) => t.senedd_term)) : null);
	const latest = $derived(
		m.contributions_by_date.flatMap((g) => g.contributions.map((c) => ({ ...c, date: g.date }))).slice(0, LATEST)
	);
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
			<p class="kicker">Member of the Senedd · Member Plate</p>
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
			<p class="small"><a href="/members/{encodeURIComponent(m.id)}">Full register of record for this Member</a></p>
		</div>
	</header>

	<section aria-labelledby="{titleId}-speeches">
		<h3 id="{titleId}-speeches" class="kicker">Verbatim Official Record</h3>
		<p class="small count">
			<span data-numeric>{m.contribution_count.toLocaleString('en-GB')}</span> contributions on record.
			{#if m.contribution_count > latest.length}
				Showing the latest <span data-numeric>{latest.length}</span>.
			{/if}
		</p>
		{#if latest.length}
			<ol class="speeches">
				{#each latest as s (s.id)}
					<li>
						<article>
							<p class="small where">
								<time datetime={s.date}>{s.date}</time> ·
								<a href="/register?item={encodeURIComponent(s.item_id)}">{s.item_title_en}</a>
								<span class="lang" aria-label={s.lang === 'cy' ? 'Spoken in Welsh' : 'Spoken in English'}>{s.lang}</span>
								{#if s.t_start !== null}
									· <a href="/sitting/{s.date}?t={s.t_start}">See it in the chamber</a>
								{/if}
							</p>
							<blockquote lang={s.lang}><p>{s.text_original}</p></blockquote>
							{#if s.lang === 'cy' && s.text_english && s.text_english !== s.text_original}
								<details>
									<summary class="small">Official English translation</summary>
									<p lang="en">{s.text_english}</p>
								</details>
							{/if}
						</article>
					</li>
				{/each}
			</ol>
		{:else}
			<p>No contributions on record for this Member.</p>
		{/if}
		{#if m.contribution_count > latest.length}
			<p><a href="/register?speaker={encodeURIComponent(m.id)}">Every debate this Member spoke in, in the Register</a></p>
		{/if}
	</section>

	<section aria-labelledby="{titleId}-votes">
		<h3 id="{titleId}-votes" class="kicker">Roll-call divisions</h3>
		{#if m.ballots.length}
			<p class="small count"><span data-numeric>{m.ballots.length.toLocaleString('en-GB')}</span> recorded votes.</p>
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
		font: 600 1.4rem var(--font-sans);
		color: var(--color-body-text);
	}

	.name-cy {
		margin: 0;
		font-family: var(--font-serif);
		color: var(--color-body-text);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.5rem;
		margin: 0.25rem 0 0;
		color: var(--color-body-text);
	}

	.party::before {
		content: '';
		display: inline-block;
		width: 0.6em;
		height: 0.6em;
		margin-right: 0.35em;
		background: var(--party);
	}

	.role {
		margin: 0.25rem 0 0;
		font-weight: 600;
		color: var(--color-ink);
	}

	.count {
		color: var(--color-body-text);
	}

	.speeches {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.speeches li {
		padding: 1rem 0;
		border-top: 1px solid var(--color-border);
	}

	.where {
		margin: 0 0 0.4rem;
		color: var(--color-body-text);
	}

	.lang {
		font-family: var(--font-mono);
		text-transform: uppercase;
		padding: 0 0.35rem;
		border: 1px solid var(--color-rule-strong);
		color: var(--color-ink);
	}

	blockquote {
		margin: 0;
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

	.ballots {
		width: 100%;
		border-collapse: collapse;
	}

	.ballots th,
	.ballots td {
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid var(--color-border);
		text-align: left;
		vertical-align: top;
	}

	.ballots thead th {
		font-size: var(--text-small);
		color: var(--color-body-text);
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
