<script lang="ts">
	let { data } = $props();

	const term = $derived(data.index?.terms.find((t) => t.term === data.index?.current_term) ?? null);
</script>

<svelte:head>
	<title>Siambr · Senedd Cymru</title>
</svelte:head>

<main id="main">
	<p class="kicker">Siambr · Senedd Cymru</p>
	<h1>One sitting day, on a stage.</h1>
	<p class="lede">
		Verbatim plenary proceedings of Senedd Cymru, played back in real time from the official Record of Proceedings.
		{#if term}{term.label_en}.{/if}
	</p>
	{#if data.index?.latest_sitting}
		<p>
			Latest sitting: <a href="/register"><time datetime={data.index.latest_sitting} data-numeric>{data.index.latest_sitting}</time></a>
			· <span data-numeric>{data.index.sitting_count}</span> sittings on record.
		</p>
	{/if}
	<nav class="doors" aria-label="Enter">
		<a class="button-primary" href="/siambr">Enter the chamber</a>
		<a href="/register">Open the Register</a>
		<a href="/members">Find your Member</a>
	</nav>
</main>

<style>
	main {
		max-width: 60rem;
		margin: 0 auto;
		padding: 4rem 1rem;
	}

	.lede {
		max-width: 60ch;
	}

	.doors {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1.5rem;
		margin-top: 2rem;
	}

	.button-primary {
		display: inline-flex;
		align-items: center;
		text-decoration: none;
	}
</style>
