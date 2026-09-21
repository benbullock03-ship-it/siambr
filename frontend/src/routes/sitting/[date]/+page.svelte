<script lang="ts">
	import { browser } from '$app/environment';
	import { loadStage } from '$lib/data/loaders';
	import type { Sitting, TermFile } from '$lib/data/types';
	import Stage from './Stage.svelte';

	let { data } = $props();

	const date = $derived(data.summary.date);
	let loaded = $state<{ sitting: Sitting; term: TermFile } | null>(null);
	let failed = $state(false);

	$effect(() => {
		const want = date;
		failed = false;
		let live = true;
		loadStage(fetch, want)
			.then((r) => live && (loaded = r))
			.catch(() => live && (failed = true));
		return () => {
			live = false;
		};
	});

	const stage = $derived(loaded && loaded.sitting.date === date ? loaded : null);
</script>

<svelte:head>
	<title>Plenary {date} · Siambr</title>
	<!-- Prerendered HTML only: on client navigation the store fetches, or already holds, the sitting. -->
	{#if !browser}
		<link rel="preload" as="fetch" crossorigin="anonymous" href="/data/sittings/{date}.json" />
	{/if}
</svelte:head>

{#if stage}
	{#key stage.sitting.date}
		<Stage data={{ sitting: stage.sitting, term: stage.term, members: stage.term.members, dates: data.dates }} />
	{/key}
{:else}
	<main id="main" class="shell">
		<h1>Plenary, {date}</h1>
		<p class="title">{data.summary.title_en}</p>
		{#if failed}
			<div class="plate" role="alert">
				<p>The chamber data could not be loaded. The Register carries the same record.</p>
				<a class="button-primary" href="/register">Open the Register</a>
			</div>
		{:else}
			<p role="status">Loading the sitting…</p>
		{/if}
	</main>
{/if}

<style>
	.shell {
		position: fixed;
		inset: 0;
		display: grid;
		place-content: center;
		gap: 0.5rem;
		padding: 1rem;
		text-align: center;
		background: var(--color-ink-room);
		color: var(--color-ground);
	}

	h1 {
		margin: 0;
		font-size: 1.25rem;
	}

	p {
		margin: 0;
	}

	.plate {
		max-width: 28rem;
		padding: 1.25rem 1.5rem;
		margin-top: 0.5rem;
	}

	.plate .button-primary {
		display: inline-flex;
		align-items: center;
		text-decoration: none;
	}
</style>
