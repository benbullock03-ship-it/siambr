<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { Raycaster, Vector2, Vector3, type InstancedMesh, type Mesh, type PerspectiveCamera } from 'three';
	import type { Desk } from './chamber/layout';
	import type { SeatAssignment } from './chamber/seating';
	import type { Player } from './controls/player.svelte';
	import { FOCUS_RANGE_M, LOOK_RANGE_M, type SiambrState } from './state.svelte';

	let {
		player,
		hud,
		desks,
		seats,
		floors,
		deskMesh,
		llywyddHit,
		paused = false
	}: {
		player: Player;
		hud: SiambrState;
		desks: Desk[];
		seats: SeatAssignment[];
		/** Teleport targets: the chamber tiers. */
		floors: (Mesh | undefined)[];
		deskMesh: InstancedMesh | undefined;
		llywyddHit?: Mesh;
		paused?: boolean;
	} = $props();

	const { dom, canvas, size } = useThrelte();
	let camera = $state<PerspectiveCamera>();

	const raycaster = new Raycaster();
	const ndc = new Vector2();
	const probe = new Vector3();
	const seatByDesk = $derived(new Map(seats.map((s) => [s.desk.id, s])));
	let pointer: { x: number; y: number } | null = null;

	function nearestSeat(): SeatAssignment | null {
		let best: SeatAssignment | null = null;
		let bestD = FOCUS_RANGE_M;
		for (const s of seats) {
			const d = Math.hypot(s.desk.x - player.x, s.desk.z - player.z);
			if (d < bestD) {
				bestD = d;
				best = s;
			}
		}
		return best;
	}

	/** Desk instance under `ndc`, or null. Instances mount in `desks` order, so instanceId is the desk index. */
	function pickSeat(far = Infinity): SeatAssignment | null {
		if (!camera || !deskMesh) return null;
		raycaster.setFromCamera(ndc, camera);
		raycaster.far = far;
		// Threlte's InstancedMesh disables raycast on the mesh; each <Instance> child raycasts itself.
		const hit = raycaster.intersectObjects(llywyddHit ? [deskMesh, llywyddHit] : [deskMesh], true)[0];
		raycaster.far = Infinity;
		if (!hit) return null;
		if (hit.object === llywyddHit) return seatByDesk.get('llywydd') ?? null;
		if (hit.instanceId === undefined) return null;
		return seatByDesk.get(desks[hit.instanceId]?.id) ?? null;
	}

	/** Seat under the crosshair (pointer locked) or under the pointer, within looking range. */
	function lookedAtSeat(): SeatAssignment | null {
		if (hud.pointerLocked) ndc.set(0, 0);
		else if (pointer) toNdc(pointer.x, pointer.y);
		else return null;
		return pickSeat(LOOK_RANGE_M);
	}

	useTask((dt) => {
		if (!camera) return;
		const pose = player.step(Math.min(dt, 0.05));
		camera.position.set(pose.x, pose.y, pose.z);
		camera.rotation.set(pose.pitch, pose.yaw, 0, 'YXZ');
		camera.updateMatrixWorld();

		const seat = paused ? null : (lookedAtSeat() ?? nearestSeat());
		if (seat?.desk.id !== hud.focus?.desk.id) hud.focus = seat;
		if (seat) {
			probe.set(seat.desk.x, seat.desk.y + 1.15, seat.desk.z).project(camera);
			const visible = probe.z < 1 && Math.abs(probe.x) < 1.2 && Math.abs(probe.y) < 1.2;
			hud.anchor = {
				x: ((probe.x + 1) / 2) * size.current.width,
				y: ((1 - probe.y) / 2) * size.current.height,
				visible
			};
		} else if (hud.anchor.visible) {
			hud.anchor = { x: 0, y: 0, visible: false };
		}

		const speakerSeat = hud.liveSpeaker;
		if (speakerSeat) {
			probe.set(speakerSeat.desk.x, speakerSeat.desk.y + 1.35, speakerSeat.desk.z).project(camera);
			const visible = probe.z < 1 && Math.abs(probe.x) < 1.05 && Math.abs(probe.y) < 1.05;
			hud.liveSpeakerAnchor = {
				x: ((probe.x + 1) / 2) * size.current.width,
				y: ((1 - probe.y) / 2) * size.current.height,
				visible
			};
		} else if (hud.liveSpeakerAnchor.visible) {
			hud.liveSpeakerAnchor = { x: 0, y: 0, visible: false };
		}
	});

	function toNdc(clientX: number, clientY: number) {
		const rect = canvas.getBoundingClientRect();
		ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
	}

	/** Seat under a screen point, or under the crosshair when the pointer is locked. */
	function seatAt(clientX: number, clientY: number): SeatAssignment | null {
		if (hud.pointerLocked) ndc.set(0, 0);
		else toNdc(clientX, clientY);
		return pickSeat();
	}

	function floorAt(clientX: number, clientY: number): { x: number; z: number } | null {
		const targets = floors.filter((m): m is Mesh => !!m);
		if (!camera || !targets.length) return null;
		toNdc(clientX, clientY);
		raycaster.setFromCamera(ndc, camera);
		const hit = raycaster.intersectObjects(targets, false)[0];
		return hit ? { x: hit.point.x, z: hit.point.z } : null;
	}

	$effect(() => {
		if (!camera) return;
		const cam = camera;
		let press: { x: number; y: number; t: number; type: string; id: number } | null = null;
		let lastX = 0;
		let lastY = 0;

		const onKeyDown = (e: KeyboardEvent) => {
			if (paused || e.target instanceof HTMLInputElement) return;
			if (e.code === 'KeyE' && hud.focus) {
				e.preventDefault();
				hud.onopen(hud.focus);
				return;
			}
			if (player.keydown(e.code)) e.preventDefault();
		};
		const onKeyUp = (e: KeyboardEvent) => player.keyup(e.code);
		const onBlur = () => player.releaseKeys();

		const onPointerDown = (e: PointerEvent) => {
			if (paused || e.button !== 0) return;
			press = { x: e.clientX, y: e.clientY, t: performance.now(), type: e.pointerType, id: e.pointerId };
			lastX = e.clientX;
			lastY = e.clientY;
			if (e.pointerType === 'touch') hud.touch = true;
			dom.setPointerCapture?.(e.pointerId);
		};
		const onPointerMove = (e: PointerEvent) => {
			pointer = { x: e.clientX, y: e.clientY };
			if (hud.pointerLocked) {
				player.look(e.movementX, e.movementY);
				return;
			}
			if (!press || e.pointerId !== press.id) return;
			player.look(e.clientX - lastX, e.clientY - lastY);
			lastX = e.clientX;
			lastY = e.clientY;
		};
		const onPointerLeave = () => {
			pointer = null;
		};
		const onPointerUp = (e: PointerEvent) => {
			if (!press || e.pointerId !== press.id) return;
			const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
			const tap = moved < 8 && performance.now() - press.t < 350;
			const { type } = press;
			press = null;
			dom.releasePointerCapture?.(e.pointerId);
			if (!tap) return;
			const seat = seatAt(e.clientX, e.clientY);
			if (seat) {
				hud.onopen(seat);
				return;
			}
			if (type === 'touch') {
				const target = floorAt(e.clientX, e.clientY);
				if (target) player.teleportTo(target);
				return;
			}
			if (!hud.pointerLocked) {
				const req = canvas.requestPointerLock?.({ unadjustedMovement: true } as never);
				(req as Promise<void> | undefined)?.catch?.(() => {});
			}
		};
		const onLockChange = () => {
			hud.pointerLocked = document.pointerLockElement === canvas;
			if (!hud.pointerLocked) player.releaseKeys();
		};

		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('blur', onBlur);
		dom.addEventListener('pointerdown', onPointerDown);
		dom.addEventListener('pointermove', onPointerMove);
		dom.addEventListener('pointerup', onPointerUp);
		dom.addEventListener('pointercancel', onPointerUp);
		dom.addEventListener('pointerleave', onPointerLeave);
		document.addEventListener('pointerlockchange', onLockChange);
		dom.style.touchAction = 'none';
		void cam;
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('blur', onBlur);
			dom.removeEventListener('pointerdown', onPointerDown);
			dom.removeEventListener('pointermove', onPointerMove);
			dom.removeEventListener('pointerup', onPointerUp);
			dom.removeEventListener('pointercancel', onPointerUp);
			dom.removeEventListener('pointerleave', onPointerLeave);
			document.removeEventListener('pointerlockchange', onLockChange);
		};
	});

	$effect(() => {
		if (paused) {
			player.releaseKeys();
			if (document.pointerLockElement) document.exitPointerLock();
		}
	});
</script>

<T.PerspectiveCamera bind:ref={camera} makeDefault fov={72} near={0.05} far={140} />
