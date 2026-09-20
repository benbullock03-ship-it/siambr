<script lang="ts">
	import { useThrelte } from '@threlte/core';
	import { Color, Fog, type InstancedMesh, type Mesh } from 'three';
	import Dais from './chamber/Dais.svelte';
	import Desks from './chamber/Desks.svelte';
	import Envelope from './chamber/Envelope.svelte';
	import Floor from './chamber/Floor.svelte';
	import Funnel from './chamber/Funnel.svelte';
	import type { Desk } from './chamber/layout';
	import type { SeatAssignment } from './chamber/seating';
	import type { Player } from './controls/player.svelte';
	import Lighting from './Lighting.svelte';
	import { ESTATE } from './materials';
	import type { SiambrState } from './state.svelte';
	import Walker from './Walker.svelte';

	let {
		desks,
		seats,
		player,
		hud,
		paused = false
	}: {
		desks: Desk[];
		seats: SeatAssignment[];
		player: Player;
		hud: SiambrState;
		paused?: boolean;
	} = $props();

	const { scene } = useThrelte();
	scene.background = new Color(ESTATE.sky);
	scene.fog = new Fog(ESTATE.sky, 30, 90);

	let floor = $state<Mesh>();
	let deskMesh = $state<InstancedMesh>();
	let llywyddHit = $state<Mesh>();
</script>

<Lighting />
<Floor bind:ref={floor} />
<Funnel />
<Envelope />
<Dais />
<Desks {desks} {seats} focus={hud.focus} bind:hitMesh={deskMesh} bind:llywyddHit />
<Walker {player} {hud} desks={seats.map((s) => s.desk)} {seats} floors={[floor]} {deskMesh} {llywyddHit} {paused} />
