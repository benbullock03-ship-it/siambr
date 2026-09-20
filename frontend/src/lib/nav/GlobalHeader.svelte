<script lang="ts">
	import { page } from '$app/state';
	import type { SiteIndex } from '$lib/data/types';

	let {
		site,
		onopenguide
	}: {
		site: SiteIndex | null;
		onopenguide: () => void;
	} = $props();

	const currentPath = $derived(page.url.pathname);
	const latestSitting = $derived(site?.latest_sitting ?? null);
	const currentTerm = $derived(site?.current_term ?? 7);

	const isChamber = $derived(currentPath === '/' || currentPath.startsWith('/sitting'));
	const isRegister = $derived(currentPath.startsWith('/register'));
	const isMembers = $derived(currentPath.startsWith('/members'));
	const isSearch = $derived(currentPath.startsWith('/search'));
	const isStats = $derived(currentPath.startsWith('/terms') || currentPath.includes('/stats'));
</script>

<header class="global-header">
	<div class="header-inner">
		<div class="brand-group">
			<a href="/" class="brand-link">
				<div class="brand-text">
					<span class="brand-title">Siambr</span>
					<span class="brand-sub">Senedd Cymru</span>
				</div>
			</a>
		</div>

		<nav class="primary-nav" aria-label="Main Navigation">
			<a
				href={latestSitting ? `/sitting/${latestSitting}` : '/'}
				class="nav-link"
				class:active={isChamber}
				aria-current={isChamber ? 'page' : undefined}
			>
				Chamber Stage
			</a>
			<a
				href="/register"
				class="nav-link"
				class:active={isRegister}
				aria-current={isRegister ? 'page' : undefined}
			>
				Plenary Register
			</a>
			<a
				href="/members"
				class="nav-link"
				class:active={isMembers}
				aria-current={isMembers ? 'page' : undefined}
			>
				Members
			</a>
			<a
				href="/search"
				class="nav-link"
				class:active={isSearch}
				aria-current={isSearch ? 'page' : undefined}
			>
				Search
			</a>
			<a
				href={`/terms/${currentTerm}/stats`}
				class="nav-link"
				class:active={isStats}
				aria-current={isStats ? 'page' : undefined}
			>
				Stats
			</a>
		</nav>

		<div class="header-actions">
			<button
				type="button"
				class="guide-button"
				onclick={onopenguide}
			>
				<span>Guide</span>
			</button>
		</div>
	</div>
</header>

<style>
	.global-header {
		position: relative;
		z-index: 30;
		background: var(--color-ground);
		border-bottom: 1px solid var(--color-border);
		font-family: var(--font-sans);
	}

	.header-inner {
		max-width: 75rem;
		margin: 0 auto;
		padding: 0 1rem;
		min-height: 52px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.brand-group {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.brand-link {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		text-decoration: none;
		color: var(--color-ink);
	}

	.brand-text {
		display: flex;
		flex-direction: column;
	}

	.brand-title {
		font-family: var(--font-serif);
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		line-height: 1.1;
	}

	.brand-sub {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--color-muted);
		font-weight: 700;
	}

	.primary-nav {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		overflow-x: auto;
		white-space: nowrap;
	}

	.nav-link {
		position: relative;
		display: inline-flex;
		align-items: center;
		padding: 0.5rem 0.85rem;
		font-size: var(--text-small);
		font-weight: 600;
		color: var(--color-body-text);
		text-decoration: none;
		border-radius: 2px;
		transition: color 0.15s ease, background 0.15s ease;
	}

	.nav-link:hover {
		color: var(--color-ink);
		background: var(--color-panel);
	}

	.nav-link.active {
		color: var(--color-accent-plum);
		font-weight: 700;
	}

	.nav-link.active::after {
		content: '';
		position: absolute;
		bottom: -1px;
		left: 0.85rem;
		right: 0.85rem;
		height: 2px;
		background: var(--color-accent-plum);
	}

	.header-actions {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.guide-button {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.75rem;
		background: var(--color-panel);
		border: 1px solid var(--color-border);
		border-radius: 2px;
		color: var(--color-ink);
		font: 600 var(--text-small) var(--font-sans);
		cursor: pointer;
		transition: background 0.15s ease, border-color 0.15s ease;
	}

	.guide-button:hover {
		background: var(--color-ground);
		border-color: var(--color-rule-strong);
	}

	@media (max-width: 768px) {
		.header-inner {
			padding: 0.5rem 0.75rem;
			flex-wrap: wrap;
			gap: 0.5rem;
		}

		.primary-nav {
			order: 3;
			width: 100%;
			justify-content: flex-start;
			border-top: 1px solid var(--color-border);
			padding-top: 0.4rem;
		}

		.nav-link {
			padding: 0.35rem 0.65rem;
			font-size: 0.82rem;
		}
	}
</style>
