<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { data, children } = $props();

	const checked = $derived(data.site?.checked_at ?? null);
	const published = $derived(data.site?.generated_at ?? null);
	const utc = (iso: string) => iso.replace('T', ' ').replace('Z', '');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<footer class="site small">
	<p>
		{#if checked}Record checked <time data-numeric datetime={checked}>{utc(checked)}</time> UTC.{/if}
		{#if published}Latest record published by the Senedd <time data-numeric datetime={published}>{utc(published)}</time>.{/if}
		Speeches quoted verbatim from the <a href="https://record.senedd.wales/" rel="external">Record of Proceedings</a>.
	</p>
</footer>

<style>
	.site {
		max-width: 60rem;
		margin: 0 auto;
		padding: 1.5rem 1rem 2rem;
		color: var(--color-muted);
		border-top: 1px solid var(--color-border);
	}

	.site p {
		margin: 0;
	}
</style>
