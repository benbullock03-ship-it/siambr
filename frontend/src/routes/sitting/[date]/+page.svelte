<script lang="ts">
	import { browser } from '$app/environment';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, untrack } from 'svelte';
	import { decideMode, probeDevice } from '$lib/3d/capability';
	import { buildDesks, chamberColliders, chamberWallSegments, CHAMBER, spawnPoint, walkRadius, type Collider } from '$lib/3d/chamber/layout';
	import { assignChamberSeats, assignSeats, llywyddDesk, llywyddOf, SEATING_PROVENANCE, type SeatAssignment } from '$lib/3d/chamber/seating';
	import { buildPresidingSpans, presidingAt } from '$lib/stage/presiding';
	import { GuidedRig } from '$lib/3d/controls/guided.svelte';
	import { Player } from '$lib/3d/controls/player.svelte';
	import { SiambrState } from '$lib/3d/state.svelte';
	import { loadMember } from '$lib/data/loaders';
	import type { MemberFile } from '$lib/data/types';
	import MemberPlate from '$lib/hud/MemberPlate.svelte';
	import SiambrHud from '$lib/hud/SiambrHud.svelte';
	import { kiosk } from '$lib/kiosk.svelte';
	import { SittingClock } from '$lib/stage/clock.svelte';
	import { KioskIdleController } from '$lib/stage/kiosk.svelte';
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
	const presidingSpans = $derived(buildPresidingSpans(sitting, data.term, clock.timeline));
	const activePresidingMemberId = $derived(presidingAt(presidingSpans, clock.t));
	const activePresiding = $derived(new Set(activePresidingMemberId ? [activePresidingMemberId] : []));
	const activePresidingMember = $derived(
		activePresidingMemberId ? data.members.find((m) => m.id === activePresidingMemberId) ?? null : null
	);
	const seats = $derived<SeatAssignment[]>(
		assignChamberSeats(data.members, desks, data.term, activePresidingMemberId)
	);
	const deskByMember = $derived(new Map(seats.map((s) => [s.member.id, s.desk])));
	const liveContribution = $derived(clock.floor.live?.kind === 'contribution' ? clock.floor.live.contribution : null);
	// The desk the floor light is on: a seated, non-presiding speaker's own desk, else the dais desk.
	const liveDesk = $derived.by(() => {
		if (!liveContribution) return null;
		const id = liveContribution.member_id;
		return (id && !activePresiding.has(id) && deskByMember.get(id)) || deskByMember.get(activePresidingMemberId ?? '') || null;
	});
	const liveSeat = $derived.by(() => {
		if (!liveContribution) return null;
		const id = liveContribution.member_id;
		if (id && !activePresiding.has(id)) {
			const s = seats.find((seat) => seat.member.id === id);
			if (s) return s;
		}
		if (activePresidingMember) {
			return seats.find((seat) => seat.member.id === activePresidingMember.id) ?? null;
		}
		return null;
	});

	$effect(() => {
		hud.liveSpeaker = liveSeat;
	});

	// Follow: each speaker change during playback re-frames the live desk. A deep link frames on arrival.
	$effect(() => {
		const desk = liveDesk;
		if (!rig.follow || hud.walk || !clock.playing || (hud.kiosk && hud.reducedMotion)) return;
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

	/** ?t= seeks and pauses with the camera on the speaker; ?speech= seeks to that contribution; ?item= seeks to the item's first timed contribution. */
	function applyDeepLink() {
		const speech = params.get('speech');
		const t = params.get('t');
		const item = params.get('item');
		if (speech) {
			const c = sitting.contributions.find((contrib) => contrib.id === speech);
			if (c && c.t_start !== null) {
				clock.seek(c.t_start);
				clock.pause();
				const desk = liveDesk;
				if (desk) rig.frameDesk(desk, 0);
				return;
			}
		}
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
		const vantage = params.get('vantage');
		if (vantage === 'gallery' || vantage === 'llywydd' || vantage === 'floor') rig.setVantage(vantage, 0);
		// ?pose=x,y,z,tx,ty,tz places the camera exactly, for the chamber review screenshots.
		const pose = params.get('pose')?.split(',').map(Number);
		if (pose?.length === 6 && pose.every(Number.isFinite)) {
			rig.moveTo({ position: [pose[0], pose[1], pose[2]], target: [pose[3], pose[4], pose[5]] }, 0);
		}
	}

	onMount(() => {
		const decision = decideMode(probeDevice(window));
		if (decision.mode === 'register') {
			fallback = decision.reason;
			return;
		}
		// ?renderer=webgl2 forces the fallback path so the two backends can be compared side by side.
		renderer = params.get('renderer') === 'webgl2' ? 'webgl2' : decision.mode;
		hud.touch = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
		hud.reducedMotion = decision.reducedMotion;
		rig.reducedMotion = decision.reducedMotion;
		kiosk.sync(page.url);
		hud.kiosk = kiosk.active;
		if (hud.reducedMotion || hud.kiosk) hud.walk = false;
		const kioskController = new KioskIdleController(clock, rig, hud);
		const cleanupKiosk = kioskController.start();
		const narrow = window.matchMedia('(max-width: 720px)');
		phone = narrow.matches;
		const onNarrow = (e: MediaQueryListEvent) => (phone = e.matches);
		narrow.addEventListener('change', onNarrow);
		applyDeepLink();
		Promise.all([import('$lib/3d/SiambrCanvas.svelte'), import('$lib/3d/SiambrScene.svelte')]).then(([canvas, scene]) => {
			Canvas = canvas.default;
			Scene = scene.default;
		});
		return () => {
			cleanupKiosk();
			narrow.removeEventListener('change', onNarrow);
		};
	});

	$effect(() => {
		hud.kiosk = kiosk.active;
		if (hud.kiosk) hud.walk = false;
		if (hud.drifting && (record || recordError)) {
			record = null;
			recordError = null;
		}
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
					<SiambrScene {desks} {seats} {clock} {rig} {player} {hud} presiding={activePresiding} {paused} />
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
		>
			{#snippet provenance()}
				<ProvenanceStrip recordPublishedAt={sitting.record_published_at} sourceXmlUrl={sitting.source_xml_url} />
			{/snippet}
		</SiambrHud>

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
		isolation: isolate;
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
		position: relative;
		z-index: 25;
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
