<script lang="ts">
	import { browser } from '$app/environment';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, untrack } from 'svelte';
	import { decideMode, probeDevice } from '$lib/3d/capability';
	import { buildDesks, chamberColliders, chamberWallSegments, CHAMBER, spawnPoint, walkRadius, type Collider } from '$lib/3d/chamber/layout';
	import { assignSeats, llywyddDesk, llywyddOf, SEATING_PROVENANCE, type SeatAssignment } from '$lib/3d/chamber/seating';
	import { GuidedRig } from '$lib/3d/controls/guided.svelte';
	import { Player } from '$lib/3d/controls/player.svelte';
	import { SiambrState } from '$lib/3d/state.svelte';
	import { loadMember } from '$lib/data/loaders';
	import type { MemberFile } from '$lib/data/types';
	import MemberPlate from '$lib/hud/MemberPlate.svelte';
	import SiambrHud from '$lib/hud/SiambrHud.svelte';
	import { SittingClock } from '$lib/stage/clock.svelte';
	import { applyAction, keyboardAction } from '$lib/stage/keys';
	import { buildTimeline } from '$lib/stage/timeline';
	import ProvenanceStrip from '$lib/stage/ui/ProvenanceStrip.svelte';
	import RunningOrder from '$lib/stage/ui/RunningOrder.svelte';
	import ScrubBar from '$lib/stage/ui/ScrubBar.svelte';
	import StageSheet from '$lib/stage/ui/StageSheet.svelte';
	import TopStrip from '$lib/stage/ui/TopStrip.svelte';
	import Transcript from '$lib/stage/ui/Transcript.svelte';

	let { data } = $props();

	const sitting = $derived(data.sitting);
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
	const player = new Player([...chamberColliders(untrack(() => desks)), ...wallColliders], walkRadius(0), spawnPoint());
	const rig = new GuidedRig();
	const clock = untrack(() => new SittingClock(buildTimeline(data.sitting), data.sitting.meeting_start_time));
	const presiding = $derived(new Set(data.term.presiding_officers.map((o) => o.member_id)));
	const deskByMember = $derived(new Map(seats.map((s) => [s.member.id, s.desk])));
	const liveContribution = $derived(clock.floor.live?.kind === 'contribution' ? clock.floor.live.contribution : null);
	// The desk the floor light is on: a seated, non-presiding speaker's own desk, else Y Llywydd's place.
	const liveDesk = $derived.by(() => {
		if (!liveContribution) return null;
		const id = liveContribution.member_id;
		return (id && !presiding.has(id) && deskByMember.get(id)) || deskByMember.get(llywydd?.id ?? '') || null;
	});

	// Follow: each speaker change during playback re-frames the live desk. A deep link frames on arrival.
	$effect(() => {
		const desk = liveDesk;
		if (!rig.follow || hud.walk || !clock.playing) return;
		untrack(() => {
			if (desk && desk.id !== rig.framedDeskId) rig.frameDesk(desk);
		});
	});

	// Entering walk mode stands the walker at the spawn; leaving it drops pointer lock and the rig resumes where it was.
	$effect(() => {
		if (hud.walk) {
			player.placeAt(spawnPoint(), spawnPoint().yaw);
		} else if (browser && document.pointerLockElement) {
			document.exitPointerLock();
		}
	});

	type CanvasModule = typeof import('$lib/3d/SiambrCanvas.svelte');
	type SceneModule = typeof import('$lib/3d/SiambrScene.svelte');
	let Canvas = $state<CanvasModule['default']>();
	let Scene = $state<SceneModule['default']>();
	let renderer = $state<'webgpu' | 'webgl2' | null>(null);
	let fallback = $state<string | null>(null);
	let phone = $state(false);

	const params = $derived(browser ? page.url.searchParams : new URLSearchParams());
	const memberId = $derived(params.get('member'));
	let record = $state<MemberFile | null>(null);
	let recordError = $state<string | null>(null);
	const paused = $derived(record !== null || recordError !== null);

	/** ?t= seeks and pauses with the camera on the speaker; ?item= seeks to the item's first timed contribution. */
	function applyDeepLink() {
		const t = params.get('t');
		const item = params.get('item');
		if (t !== null && Number.isFinite(Number(t))) {
			clock.seek(Number(t));
			clock.pause();
		} else if (item) {
			const boundary = clock.timeline.items.find((i) => i.id === item);
			if (boundary) {
				clock.seek(boundary.firstTimedT ?? boundary.t);
				clock.pause();
			}
		}
		const desk = liveDesk;
		if (desk && (t !== null || item)) rig.frameDesk(desk, 0);
	}

	onMount(() => {
		const decision = decideMode(probeDevice(window));
		if (decision.mode === 'register') {
			fallback = decision.reason;
			return;
		}
		renderer = decision.mode;
		hud.touch = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
		hud.reducedMotion = decision.reducedMotion;
		rig.reducedMotion = decision.reducedMotion;
		hud.kiosk = new URL(window.location.href).searchParams.get('kiosk') === '1';
		if (hud.reducedMotion || hud.kiosk) hud.walk = false;
		const narrow = window.matchMedia('(max-width: 720px)');
		phone = narrow.matches;
		const onNarrow = (e: MediaQueryListEvent) => (phone = e.matches);
		narrow.addEventListener('change', onNarrow);
		applyDeepLink();
		Promise.all([import('$lib/3d/SiambrCanvas.svelte'), import('$lib/3d/SiambrScene.svelte')]).then(([canvas, scene]) => {
			Canvas = canvas.default;
			Scene = scene.default;
		});
		return () => narrow.removeEventListener('change', onNarrow);
	});

	// The URL is a moment: ?t= follows playback, throttled to once a second, without a navigation.
	let lastWritten = -1;
	$effect(() => {
		const t = Math.floor(clock.t);
		if (!browser || !clock.playing || t === lastWritten) return;
		lastWritten = t;
		const url = new URL(page.url);
		url.searchParams.set('t', String(t));
		url.searchParams.delete('item');
		replaceState(url, page.state);
	});

	hud.onopen = (seat: SeatAssignment) => {
		const url = new URL(page.url);
		url.searchParams.set('member', seat.member.id);
		goto(url, { noScroll: true, keepFocus: true });
	};

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

	// Keyboard map from the clock module. Esc leaves walk mode; an open drawer takes Esc itself, never both.
	function onkeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement | null;
		if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
		if (paused) return;
		if (e.key === 'Escape') {
			if (hud.walk) {
				e.preventDefault();
				hud.walk = false;
			}
			return;
		}
		if (hud.walk && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
		const action = keyboardAction(e);
		if (!action) return;
		e.preventDefault();
		applyAction(clock, action);
	}

	function speaker() {
		hud.walk = false;
		rig.speaker(liveDesk);
	}
</script>

<svelte:head>
	<title>Plenary {sitting.date} · Siambr</title>
</svelte:head>

<svelte:window {onkeydown} />

<main id="main" class="stage" class:phone>
	<TopStrip {clock} {rig} {hud} date={sitting.date} sittings={data.sittings} onspeaker={speaker} compact={phone} />
	<ScrubBar {clock} meetingStartTime={sitting.meeting_start_time} />

	<div class="chamber">
		{#if fallback}
			<div class="plate fallback" role="status">
				<p>{fallback === 'no-webgl' ? 'This device cannot draw the chamber.' : 'This device has too little memory for the chamber.'} The Register carries the same record.</p>
				<a class="button-primary" href="/register">Open the Register</a>
			</div>
		{:else if Canvas && Scene}
			{@const SiambrCanvas = Canvas}
			{@const SiambrScene = Scene}
			<div class="canvas" aria-hidden="true">
				<SiambrCanvas forceWebGL={renderer === 'webgl2'} onfailure={() => (fallback = 'no-webgl')} onready={(backend) => (renderer = backend)}>
					<SiambrScene {desks} {seats} {clock} {rig} {player} {hud} {presiding} {paused} />
				</SiambrCanvas>
			</div>
		{:else}
			<p class="loading small" role="status">Preparing the chamber…</p>
		{/if}

		<SiambrHud
			{hud}
			{renderer}
			onjoystick={(v) => {
				player.joystick.x = v.x;
				player.joystick.y = v.y;
			}}
		/>
		<ProvenanceStrip recordPublishedAt={sitting.record_published_at} sourceXmlUrl={sitting.source_xml_url} />

		{#if phone}
			<StageSheet {clock}>
				{#snippet transcript()}<Transcript {clock} {sitting} />{/snippet}
				{#snippet order()}<RunningOrder {clock} {sitting} />{/snippet}
			</StageSheet>
		{/if}
	</div>

	{#if !phone}
		<div class="column">
			<Transcript {clock} {sitting} />
			<RunningOrder {clock} {sitting} />
		</div>
	{/if}

	{#if record}
		<MemberPlate {record} onclose={closeRecord} />
	{:else if recordError}
		<div class="plate error" role="alert">
			<p>{recordError}</p>
			<button type="button" class="button-primary" onclick={closeRecord}>Back to the chamber</button>
		</div>
	{/if}
</main>

<style>
	.stage {
		position: fixed;
		inset: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(22rem, 36%);
		grid-template-rows: auto auto minmax(0, 1fr);
		background: var(--color-ink-room);
		overflow: hidden;
	}

	.stage > :global(.strip),
	.stage > :global(.scrub) {
		grid-column: 1 / -1;
	}

	.chamber {
		position: relative;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	.canvas {
		position: absolute;
		inset: 0;
	}

	.column {
		display: grid;
		grid-template-rows: minmax(0, 3fr) minmax(0, 2fr);
		min-height: 0;
		border-left: 1px solid var(--color-border);
		background: var(--color-ground);
	}

	.column > :global(.order) {
		overflow-y: auto;
	}

	.loading {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		margin: 0;
		color: var(--color-ground);
	}

	.fallback,
	.error {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		max-width: min(28rem, calc(100% - 2rem));
		padding: 1.25rem 1.5rem;
		z-index: 12;
	}

	.fallback .button-primary {
		display: inline-flex;
		align-items: center;
		text-decoration: none;
	}

	.stage.phone {
		grid-template-columns: minmax(0, 1fr);
	}
</style>
