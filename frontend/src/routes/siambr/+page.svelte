<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, untrack } from 'svelte';
	import { decideMode, probeDevice } from '$lib/3d/capability';
	import { buildDesks, chamberColliders, chamberWallSegments, CHAMBER, spawnPoint, walkRadius, type Collider } from '$lib/3d/chamber/layout';
	import { assignSeats, llywyddDesk, llywyddOf, SEATING_PROVENANCE, type SeatAssignment } from '$lib/3d/chamber/seating';
	import { Player } from '$lib/3d/controls/player.svelte';
	import { SiambrState } from '$lib/3d/state.svelte';
	import { dossierFor, type Dossier } from '$lib/data/dossier';
	import { loadMember, loadSittingForItem } from '$lib/data/loaders';
	import type { MemberFile } from '$lib/data/types';
	import DossierPlate from '$lib/hud/DossierPlate.svelte';
	import MemberPlate from '$lib/hud/MemberPlate.svelte';
	import SiambrHud from '$lib/hud/SiambrHud.svelte';

	let { data } = $props();

	const desks = $derived(buildDesks(data.term.seat_count));
	const llywydd = $derived(llywyddOf(data.term, data.members));
	// The Llywydd presides from the dais, so their Member desk stays empty.
	const seats = $derived<SeatAssignment[]>([
		...assignSeats(data.members.filter((m) => m.id !== llywydd?.id), desks),
		...(llywydd ? [{ desk: llywyddDesk(), member: llywydd, provenance: SEATING_PROVENANCE }] : [])
	]);
	const hud = new SiambrState();
	// The chamber plan is fixed for the life of the page, so the walker's colliders are built once.
	const wallColliders: Collider[] = chamberWallSegments().map((seg) => ({
		kind: 'arc',
		inner: CHAMBER.wallRadius - 0.15,
		outer: CHAMBER.wallRadius + 0.25,
		...seg
	}));
	const player = new Player(
		[...chamberColliders(untrack(() => desks)), ...wallColliders],
		walkRadius(0),
		spawnPoint()
	);

	type CanvasModule = typeof import('$lib/3d/SiambrCanvas.svelte');
	type SceneModule = typeof import('$lib/3d/SiambrScene.svelte');
	let Canvas = $state<CanvasModule['default']>();
	let Scene = $state<SceneModule['default']>();
	let renderer = $state<'webgpu' | 'webgl2' | null>(null);

	const params = $derived(browser ? page.url.searchParams : new URLSearchParams());
	const memberId = $derived(params.get('member'));
	let record = $state<MemberFile | null>(null);
	let recordError = $state<string | null>(null);
	const itemId = $derived(params.get('item'));
	let dossier = $state<Dossier | null>(null);
	let dossierError = $state<string | null>(null);
	const paused = $derived(record !== null || recordError !== null || dossier !== null || dossierError !== null);

	function toRegister(reason: string) {
		return goto(`/register?from=siambr&reason=${reason}`, { replaceState: true });
	}

	onMount(async () => {
		const decision = decideMode(probeDevice(window));
		if (decision.mode === 'register') {
			await toRegister(decision.reason);
			return;
		}
		renderer = decision.mode;
		hud.touch = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
		const [canvas, scene] = await Promise.all([
			import('$lib/3d/SiambrCanvas.svelte'),
			import('$lib/3d/SiambrScene.svelte')
		]);
		Canvas = canvas.default;
		Scene = scene.default;
	});

	hud.onopen = (seat: SeatAssignment) => {
		const url = new URL(page.url);
		url.searchParams.set('member', seat.member.id);
		goto(url, { noScroll: true, keepFocus: true });
	};

	$effect(() => {
		const id = itemId;
		dossier = null;
		dossierError = null;
		if (!id) return;
		let live = true;
		loadSittingForItem(fetch, data.sittings, id)
			.then((sitting) => {
				if (!live) return;
				const d = sitting && dossierFor(sitting, id);
				if (d) dossier = d;
				else dossierError = 'This debate is not on record.';
			})
			.catch(() => live && (dossierError = 'This debate could not be loaded.'));
		return () => {
			live = false;
		};
	});

	async function closeDossier() {
		const url = new URL(page.url);
		url.searchParams.delete('item');
		await goto(url, { noScroll: true, keepFocus: true });
	}

	$effect(() => {
		const id = memberId;
		record = null;
		recordError = null;
		if (!id) return;
		let live = true;
		loadMember(fetch, id)
			.then((r) => live && (record = r))
			.catch(() => live && (recordError = 'This Member’s record could not be loaded.'));
		return () => {
			live = false;
		};
	});

	async function closeRecord() {
		const url = new URL(page.url);
		url.searchParams.delete('member');
		await goto(url, { noScroll: true, keepFocus: true });
	}
</script>

<svelte:head>
	<title>Y Siambr · Siambr</title>
</svelte:head>

<main id="main" class="stage">
	{#if Canvas && Scene}
		{@const SiambrCanvas = Canvas}
		{@const SiambrScene = Scene}
		<div class="canvas" aria-hidden="true">
			<SiambrCanvas
				forceWebGL={renderer === 'webgl2'}
				onfailure={() => toRegister('no-webgl')}
				onready={(backend) => (renderer = backend)}
			>
				<SiambrScene {desks} {seats} {player} {hud} {paused} />
			</SiambrCanvas>
		</div>
	{:else}
		<p class="loading small" role="status">Preparing the chamber…</p>
	{/if}

	<SiambrHud
		{hud}
		term={data.term}
		{llywydd}
		deskCount={desks.length}
		seatedCount={seats.length}
		{renderer}
		onjoystick={(v) => {
			player.joystick.x = v.x;
			player.joystick.y = v.y;
		}}
	/>

	{#if record}
		<MemberPlate {record} onclose={closeRecord} />
	{:else if recordError}
		<div class="plate error" role="alert">
			<p>{recordError}</p>
			<button type="button" class="button-primary" onclick={closeRecord}>Back to the chamber</button>
		</div>
	{:else if dossier}
		<DossierPlate {dossier} onclose={closeDossier} />
	{:else if dossierError}
		<div class="plate error" role="alert">
			<p>{dossierError}</p>
			<button type="button" class="button-primary" onclick={closeDossier}>Back to the chamber</button>
		</div>
	{/if}
</main>

<style>
	.stage {
		position: fixed;
		inset: 0;
		background: var(--color-ink-room);
		overflow: hidden;
	}

	.canvas {
		position: absolute;
		inset: 0;
	}

	.loading {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		margin: 0;
		color: var(--color-ground);
	}

	.error {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		padding: 1.25rem 1.5rem;
		z-index: 12;
	}
</style>
