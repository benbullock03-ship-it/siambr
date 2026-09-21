<script lang="ts">
	import Stage from './Stage.svelte';

	let { data } = $props();
</script>

{#key data.sitting.date}
	<Stage {data} />
{/key}
