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

	const seat = (m: MemberLight) => (m.is_regional_member && m.region_name ? `${m.region_name} (regional)` : m.constituency_name_en);

	// Postcode lookup: postcodes.io names the Senedd constituency but publishes no GSS code for it,
	// so the match is on the constituency name; a GSS match is kept for any Member whose code it does return.
	let postcode = $state('');
	let lookup = $state<{ state: 'idle' } | { state: 'busy' } | { state: 'error'; message: string } | { state: 'found'; constituency: string; members: MemberLight[]; regional: MemberLight[] }>({ state: 'idle' });
	const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('en-GB').replace(/[^a-z0-9]+/g, ' ').trim();

	async function findMember(e: SubmitEvent) {
		e.preventDefault();
		const pc = postcode.replace(/\s+/g, '').toUpperCase();
		if (!pc) return;
		lookup = { state: 'busy' };
		try {
			const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
			if (res.status === 404) {
				lookup = { state: 'error', message: 'That postcode is not on record. Check it and try again.' };
				return;
			}
			if (!res.ok) throw new Error(String(res.status));
			const body = (await res.json()) as { result: { country: string; senedd_constituency: string | null; region: string | null; codes: Record<string, string | null> } };
			const r = body.result;
			if (r.country !== 'Wales' || !r.senedd_constituency) {
				lookup = { state: 'error', message: 'That postcode is outside Wales, so it has no Member of the Senedd.' };
				return;
			}
			const gss = r.codes.senedd_constituency ?? null;
			const want = fold(r.senedd_constituency);
			const members = data.members.filter((m) => !m.is_regional_member && ((gss && m.gss_constituency_code === gss) || fold(m.constituency_name_en) === want || fold(m.constituency_name_cy) === want));
			const regional = data.members.filter((m) => m.is_regional_member && m.region_name && r.region && fold(m.region_name) === fold(r.region));
			if (!members.length && !regional.length) {
				lookup = { state: 'error', message: `No Member on record for ${r.senedd_constituency}.` };
				return;
			}
			lookup = { state: 'found', constituency: r.senedd_constituency, members, regional };
		} catch {
			lookup = { state: 'error', message: 'The postcode service could not be reached. Try again later, or search by name.' };
		}
	}
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

	<div class="finders">
		<form class="search" onsubmit={(e) => e.preventDefault()}>
			<label for="q">Search by name</label>
			<input id="q" type="search" bind:value={query} autocomplete="off" />
		</form>

		<form class="search" onsubmit={findMember}>
			<label for="postcode">Find your Member by postcode</label>
			<div class="row">
				<input id="postcode" type="text" bind:value={postcode} autocomplete="postal-code" inputmode="text" spellcheck="false" />
				<button type="submit" class="button-primary" disabled={lookup.state === 'busy'}>Find</button>
			</div>
			<p class="small hint">Looked up with postcodes.io in your browser. Nothing is stored.</p>
		</form>
	</div>

	<div aria-live="polite">
		{#if lookup.state === 'busy'}
			<p class="small">Looking up the constituency…</p>
		{:else if lookup.state === 'error'}
			<p class="error" role="alert">{lookup.message}</p>
		{:else if lookup.state === 'found'}
			<section class="found" aria-labelledby="found-title">
				<h2 id="found-title">{lookup.constituency}</h2>
				<p class="small"><span data-numeric>{lookup.members.length}</span> Members for this constituency.</p>
				<ul class="members">
					{#each lookup.members as m (m.id)}
						<li>
							{#if m.portrait_url}<img src={m.portrait_url} alt="" width="48" height="48" loading="lazy" />{:else}<span class="portrait" aria-hidden="true"></span>{/if}
							<div>
								<a href="/members/{encodeURIComponent(m.id)}">{m.canonical_name}</a>
								<span class="small meta"><span class="swatch" style:background={partyColor(m.party_id)}></span>{partyLabel(m.party_id)}{#if m.role_title_en} · {m.role_title_en}{/if}</span>
							</div>
						</li>
					{/each}
				</ul>
				{#if lookup.regional.length}
					<h3 class="small">Regional Members</h3>
					<ul class="members">
						{#each lookup.regional as m (m.id)}
							<li>
								{#if m.portrait_url}<img src={m.portrait_url} alt="" width="48" height="48" loading="lazy" />{:else}<span class="portrait" aria-hidden="true"></span>{/if}
								<div>
									<a href="/members/{encodeURIComponent(m.id)}">{m.canonical_name}</a>
									<span class="small meta">{seat(m)}</span>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}
	</div>

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
							<a href="/members/{encodeURIComponent(m.id)}">{m.canonical_name}</a>
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

	.finders {
		display: flex;
		flex-wrap: wrap;
		gap: 2rem;
		margin: 1.5rem 0 2rem;
	}

	.search {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1 1 18rem;
		max-width: 24rem;
	}

	.row {
		display: flex;
		gap: 0.5rem;
	}

	.row input {
		flex: 1;
		min-width: 0;
	}

	.hint {
		margin: 0.2rem 0 0;
		color: var(--color-body-text);
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

	.found {
		margin: 0 0 2rem;
		padding: 1rem 1.25rem;
		background: var(--color-panel);
		border-left: 3px solid var(--color-timber-cedar);
	}

	.found h2 {
		margin-top: 0;
		border: 0;
	}

	.found h3 {
		margin: 1rem 0 0.25rem;
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
		margin-right: 0.3em;
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

	.error {
		color: var(--color-error);
	}
</style>
