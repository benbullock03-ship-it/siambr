<script lang="ts">
	import { useTask, useThrelte } from '@threlte/core';
	import { Color, Fog, type InstancedMesh, type Mesh } from 'three';
	import { PMREMGenerator } from 'three/webgpu';
	import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
	import type { Texture } from 'three';
	import type { FloorState } from '$lib/stage/floor';
	import type { SittingClock } from '$lib/stage/clock.svelte';
	import { ScreenSound } from '$lib/stage/screenVideo.svelte';
	import ChamberScreen from './chamber/ChamberScreen.svelte';
	import Dais from './chamber/Dais.svelte';
	import Desks from './chamber/Desks.svelte';
	import DivisionDisplays from './chamber/DivisionDisplays.svelte';
	import Envelope from './chamber/Envelope.svelte';
	import Floor from './chamber/Floor.svelte';
	import Funnel from './chamber/Funnel.svelte';
	import type { Desk } from './chamber/layout';
	import { llywyddDesk, type SeatAssignment } from './chamber/seating';
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
		paused = false,
		stream = null,
		sound = new ScreenSound()
	}: {
		desks: Desk[];
		seats: SeatAssignment[];
		clock?: SittingClock | null;
		rig: GuidedRig;
		player: Player;
		hud: SiambrState;
		presiding?: ReadonlySet<string>;
		paused?: boolean;
		/** Senedd TV stream for the wall screens; null where the video does not run. */
		stream?: string | null;
		sound?: ScreenSound;
	} = $props();

	const { scene, renderer } = useThrelte();
	scene.background = new Color(ESTATE.sky);
	scene.fog = new Fog(ESTATE.sky, 30, 90);

	// A neutral room environment gives the glass, monitors and mace something to reflect; built
	// once the renderer is up, on the first frame.
	let environmentReady = false;
	function buildEnvironment() {
		environmentReady = true;
		try {
			const pmrem = new PMREMGenerator(renderer as unknown as ConstructorParameters<typeof PMREMGenerator>[0]);
			scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
			scene.environmentIntensity = 0.14;
			pmrem.dispose();
		} catch (error) {
			console.warn('Siambr: environment reflections unavailable', error);
		}
	}

	let floorMesh = $state<Mesh>();
	let deskMesh = $state<InstancedMesh>();
	let pickMesh = $state<InstancedMesh>();
	let llywyddHit = $state<Mesh>();
	const places = $derived([...desks, llywyddDesk()]);

	const EMPTY_FLOOR: FloorState = { live: null, spokenMemberIds: new Set(), division: null, divisionTint: null };
	const floor = $derived<FloorState>(clock?.floor ?? EMPTY_FLOOR);
	let screenVideo = $state<Texture | null>(null);

	useTask((dt) => {
		if (!environmentReady) buildEnvironment();
		if (!paused) clock?.tick(Math.min(dt, 0.25));
	});
</script>

<Lighting />
<Floor bind:ref={floorMesh} />
<Funnel />
<Envelope />
<Dais />
<Desks {desks} {seats} focus={hud.focus} {floor} {presiding} reducedMotion={hud.reducedMotion} bind:hitMesh={deskMesh} bind:pickMesh bind:llywyddHit />
{#if stream}
	<ChamberScreen {clock} {stream} {sound} held={paused} bind:texture={screenVideo} />
{/if}
<DivisionDisplays {floor} t={clock?.t ?? 0} video={stream ? screenVideo : null} />
{#if hud.walk}
	<Walker {player} {hud} desks={places} {seats} floors={[floorMesh]} deskMesh={pickMesh} {llywyddHit} {paused} />
{:else}
	<GuidedCamera {rig} {hud} desks={places} {seats} deskMesh={pickMesh} {llywyddHit} {paused} />
{/if}
