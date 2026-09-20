<script lang="ts">
	import type { SeneddTerm } from '$lib/types/siambr';

	const currentTerm: SeneddTerm = 6;
</script>

<main>
	<p class="kicker">Siambr - Senedd Cymru</p>
	<h1>Y Cofnod, in three dimensions.</h1>
	<p>Verbatim plenary proceedings, 1999 to the present. Term <span data-numeric>{currentTerm}</span>.</p>
	<p><a href="/register">Open the Register</a></p>
</main>

<style>
	main {
		max-width: 60rem;
		margin: 0 auto;
		padding: 4rem 1rem;
	}
</style>
