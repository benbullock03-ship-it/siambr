<script lang="ts">
	let { size = 32 }: { size?: number } = $props();
</script>

<!-- Paths from scripts/brand.mjs. The lit desk is cedar in-page: plum is spent once per view. -->
<svg class="mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
	<g fill="none" stroke-width="7">
		<path
			d="M15.15 49.14A22 22 0 0 1 40.24 14.60M52.40 26.76A22 22 0 0 1 48.85 49.14M22.81 42.71A12 12 0 1 1 41.19 42.71"
			stroke="currentColor"
		/>
		<path d="M42.33 15.58A22 22 0 0 1 51.42 24.67" stroke="var(--color-timber-cedar)" />
	</g>
</svg>

<style>
	.mark {
		flex-shrink: 0;
		display: block;
	}
</style>
