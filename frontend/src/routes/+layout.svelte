<script lang="ts">
	import '../app.css';
	import { onNavigate, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import favicon from '$lib/assets/favicon.svg';
	import ExternalLink from '$lib/hud/ExternalLink.svelte';
	import { kiosk } from '$lib/kiosk.svelte';
	import GlobalHeader from '$lib/nav/GlobalHeader.svelte';
	import OnboardingModal from '$lib/nav/OnboardingModal.svelte';

	let { data, children } = $props();

	let showGuide = $state(false);

	$effect(() => {
		if (browser && !kiosk.active) {
			if (page.url.searchParams.get('guide') === '1') {
				showGuide = true;
			}
		}
	});

	function closeGuide() {
		showGuide = false;
		if (browser && page.url.searchParams.has('guide')) {
			const u = new URL(page.url);
			u.searchParams.delete('guide');
			replaceState(u.toString(), {});
		}
	}

	onNavigate((nav) => {
		if (nav.to?.url) {
			kiosk.sync(nav.to.url);
		}
	});

	$effect(() => {
		kiosk.sync(page.url);
	});

	const checked = $derived(data.site?.checked_at ?? null);
	const published = $derived(data.site?.generated_at ?? null);
	const utc = (iso: string) => iso.replace('T', ' ').replace('Z', '');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if !kiosk.active && !page.url.pathname.startsWith('/sitting')}
	<GlobalHeader site={data.site} onopenguide={() => (showGuide = true)} />
{/if}

{@render children()}

{#if showGuide}
	<OnboardingModal
		latestSitting={data.site?.latest_sitting ?? null}
		onclose={closeGuide}
	/>
{/if}

<footer class="site small">
	<p>
		{#if checked}Record checked <time data-numeric datetime={checked}>{utc(checked)}</time> UTC.{/if}
		{#if published}Latest record published by the Senedd <time data-numeric datetime={published}>{utc(published)}</time>.{/if}
		Speeches quoted verbatim from the <ExternalLink href="https://record.senedd.wales/">Record of Proceedings</ExternalLink>.
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
