<script lang="ts">
	import type { MemberLight } from '$lib/data/types';
	import { partyColor, partyLabel } from '$lib/dossier/parties';

	let { data } = $props();

	let query = $state('');
	const term = $derived(data.index.terms.find((t) => t.term === data.index.current_term));

	const byParty = $derived.by(() => {
		const q = query.trim().toLocaleLowerCase('en-GB');
		const groups = new Map<string, MemberLight[]>();
		for (const m of data.members) {
			const hay = `${m.canonical_name} ${m.cymraeg_name ?? ''}`.toLocaleLowerCase('en-GB');
			if (q && !hay.includes(q)) continue;
			const key = m.party_id ?? 'independent';
			groups.set(key, [...(groups.get(key) ?? []), m]);
		}
		return [...groups.entries()]
			.sort(([ka, a], [kb, b]) => b.length - a.length || ka.localeCompare(kb))
			.map(([party, ms]) => [party, ms.sort((a, b) => a.canonical_name.localeCompare(b.canonical_name, 'en-GB'))] as const);
	});

	const seat = (m: MemberLight) =>
		m.is_regional_member && m.region_name ? `${m.region_name} (regional)` : m.constituency_name_en;
</script>

<svelte:head>
	<title>Members · Siambr</title>
</svelte:head>

<main id="main">
	<p class="kicker">Siambr · Members</p>
	<h1>Members of the Senedd</h1>
	<p class="lede">
		{#if term}{term.label_en}: {/if}<span data-numeric>{data.members.length}</span> Members holding a seat today, by party then name.
	</p>

	<form class="search" onsubmit={(e) => e.preventDefault()}>
		<label for="q">Search by name</label>
		<input id="q" type="search" bind:value={query} autocomplete="off" />
	</form>

	{#if byParty.length === 0}
		<p class="empty">No Member matches that name.</p>
	{/if}

	{#each byParty as [party, members] (party)}
		<section aria-labelledby="party-{party}">
			<h2 id="party-{party}"><span class="swatch" style:background={partyColor(party)}></span>{partyLabel(party)} <span class="small count" data-numeric>({members.length})</span></h2>
			<ul class="members">
				{#each members as m (m.id)}
					<li>
						{#if m.portrait_url}
							<img src={m.portrait_url} alt="" width="48" height="48" loading="lazy" />
						{:else}
							<span class="portrait" aria-hidden="true"></span>
						{/if}
						<div>
							<a href="/siambr?member={encodeURIComponent(m.id)}">{m.canonical_name}</a>
							{#if m.cymraeg_name && m.cymraeg_name !== m.canonical_name}<span class="name-cy" lang="cy">{m.cymraeg_name}</span>{/if}
							<span class="small meta">{seat(m)}{#if m.role_title_en} · {m.role_title_en}{/if}</span>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</main>

<style>
	main {
		max-width: 60rem;
		margin: 0 auto;
		padding: 3rem 1rem 4rem;
	}

	.lede {
		max-width: 60ch;
	}

	.search {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-width: 24rem;
		margin: 1.5rem 0 2rem;
	}

	label {
		font-size: var(--text-small);
		font-weight: 600;
	}

	input {
		min-height: var(--tap-min);
		padding: 0 0.6rem;
		font: inherit;
		color: var(--color-ink);
		background: var(--color-ground);
		border: 1px solid var(--color-rule-strong);
		border-radius: var(--rounded-none);
	}

	h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: var(--text-h3);
		font-family: var(--font-sans);
		padding-bottom: 0.4rem;
		border-bottom: 1px solid var(--color-rule-strong);
	}

	.swatch {
		display: inline-block;
		width: 0.7em;
		height: 0.7em;
	}

	.count {
		font-weight: 400;
		color: var(--color-body-text);
	}

	.members {
		margin: 0 0 2rem;
		padding: 0;
		list-style: none;
	}

	.members li {
		display: grid;
		grid-template-columns: 48px 1fr;
		gap: 0.75rem;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-border);
	}

	.members img,
	.portrait {
		width: 48px;
		height: 48px;
		object-fit: cover;
		background: var(--color-panel);
	}

	.members div {
		display: flex;
		flex-direction: column;
	}

	.members a {
		font-weight: 600;
	}

	.name-cy {
		font-family: var(--font-serif);
		color: var(--color-body-text);
	}

	.meta {
		color: var(--color-body-text);
	}

	.empty {
		padding: 1rem 0;
	}
</style>
