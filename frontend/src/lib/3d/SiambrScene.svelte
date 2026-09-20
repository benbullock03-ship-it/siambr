<script lang="ts">
	import { useTask, useThrelte } from '@threlte/core';
	import { Color, Fog, type InstancedMesh, type Mesh } from 'three';
	import type { FloorState } from '$lib/stage/floor';
	import type { SittingClock } from '$lib/stage/clock.svelte';
	import Dais from './chamber/Dais.svelte';
	import Desks from './chamber/Desks.svelte';
	import DivisionDisplays from './chamber/DivisionDisplays.svelte';
	import Envelope from './chamber/Envelope.svelte';
	import Floor from './chamber/Floor.svelte';
	import Funnel from './chamber/Funnel.svelte';
	import type { Desk } from './chamber/layout';
	import type { SeatAssignment } from './chamber/seating';
	import type { GuidedRig } from './controls/guided.svelte';
	import type { Player } from './controls/player.svelte';
	import GuidedCamera from './GuidedCamera.svelte';
	import Lighting from './Lighting.svelte';
	import { ESTATE } from './materials';
	import type { SiambrState } from './state.svelte';
	import Walker from './Walker.svelte';

	let {
		desks,
		seats,
		clock = null,
		rig,
		player,
		hud,
		presiding = new Set<string>(),
		paused = false
	}: {
		desks: Desk[];
		seats: SeatAssignment[];
		clock?: SittingClock | null;
		rig: GuidedRig;
		player: Player;
		hud: SiambrState;
		presiding?: ReadonlySet<string>;
		paused?: boolean;
	} = $props();

	const { scene } = useThrelte();
	scene.background = new Color(ESTATE.sky);
	scene.fog = new Fog(ESTATE.sky, 30, 90);

	let floorMesh = $state<Mesh>();
	let deskMesh = $state<InstancedMesh>();
	let llywyddHit = $state<Mesh>();
	const places = $derived(seats.map((s) => s.desk));

	const EMPTY_FLOOR: FloorState = { live: null, spokenMemberIds: new Set(), division: null, divisionTint: null };
	const floor = $derived<FloorState>(clock?.floor ?? EMPTY_FLOOR);

	useTask((dt) => {
		if (!paused) clock?.tick(Math.min(dt, 0.25));
	});
</script>

<Lighting />
<Floor bind:ref={floorMesh} />
<Funnel />
<Envelope />
<Dais />
<Desks {desks} {seats} focus={hud.focus} {floor} {presiding} reducedMotion={hud.reducedMotion} bind:hitMesh={deskMesh} bind:llywyddHit />
<DivisionDisplays {floor} t={clock?.t ?? 0} />
{#if hud.walk}
	<Walker {player} {hud} desks={places} {seats} floors={[floorMesh]} {deskMesh} {llywyddHit} {paused} />
{:else}
	<GuidedCamera {rig} {hud} desks={places} {seats} {deskMesh} {llywyddHit} {paused} />
{/if}
