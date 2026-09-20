<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { Raycaster, Vector2, Vector3, type InstancedMesh, type Mesh, type PerspectiveCamera } from 'three';
	import type { Desk } from './chamber/layout';
	import type { SeatAssignment } from './chamber/seating';
	import type { GuidedRig } from './controls/guided.svelte';
	import type { SiambrState } from './state.svelte';

	let {
		rig,
		hud,
		desks,
		seats,
		deskMesh,
		llywyddHit,
		paused = false
	}: {
		rig: GuidedRig;
		hud: SiambrState;
		/** Seated places in `seats` order: instanceId on `deskMesh` indexes this. */
		desks: Desk[];
		seats: SeatAssignment[];
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

	function toNdc(clientX: number, clientY: number) {
		const rect = canvas.getBoundingClientRect();
		ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
	}

	function seatAt(clientX: number, clientY: number): SeatAssignment | null {
		if (!camera || !deskMesh) return null;
		toNdc(clientX, clientY);
		raycaster.setFromCamera(ndc, camera);
		const hit = raycaster.intersectObjects(llywyddHit ? [deskMesh, llywyddHit] : [deskMesh], true)[0];
		if (!hit) return null;
		if (hit.object === llywyddHit) return seatByDesk.get('llywydd') ?? null;
		if (hit.instanceId === undefined) return null;
		return seatByDesk.get(desks[hit.instanceId]?.id) ?? null;
	}

	useTask(() => {
		if (!camera) return;
		rig.update();
		camera.position.set(rig.position[0], rig.position[1], rig.position[2]);
		camera.lookAt(rig.target[0], rig.target[1], rig.target[2]);
		camera.updateMatrixWorld();

		const seat = hud.focus;
		if (seat) {
			probe.set(seat.desk.x, seat.desk.y + 1.15, seat.desk.z).project(camera);
			const visible = probe.z < 1 && Math.abs(probe.x) < 1.2 && Math.abs(probe.y) < 1.2;
			hud.anchor = { x: ((probe.x + 1) / 2) * size.current.width, y: ((1 - probe.y) / 2) * size.current.height, visible };
		} else if (hud.anchor.visible) {
			hud.anchor = { x: 0, y: 0, visible: false };
		}
	});

	$effect(() => {
		let press: { x: number; y: number; t: number; type: string; id: number } | null = null;
		let lastX = 0;
		let lastY = 0;
		const touches = new Map<number, { x: number; y: number }>();
		let pinch = 0;

		const onPointerDown = (e: PointerEvent) => {
			if (paused || (e.pointerType !== 'touch' && e.button !== 0)) return;
			press = { x: e.clientX, y: e.clientY, t: performance.now(), type: e.pointerType, id: e.pointerId };
			lastX = e.clientX;
			lastY = e.clientY;
			if (e.pointerType === 'touch') {
				hud.touch = true;
				touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
				pinch = pinchDistance();
			}
			dom.setPointerCapture?.(e.pointerId);
		};
		const pinchDistance = () => {
			const [a, b] = [...touches.values()];
			return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
		};
		const onPointerMove = (e: PointerEvent) => {
			if (touches.has(e.pointerId)) {
				touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
				if (touches.size >= 2) {
					const d = pinchDistance();
					if (pinch > 0 && d > 0) rig.zoom(pinch / d);
					pinch = d;
					return;
				}
			}
			if (!press || e.pointerId !== press.id) return;
			rig.orbit(e.clientX - lastX, e.clientY - lastY);
			lastX = e.clientX;
			lastY = e.clientY;
		};
		const onPointerUp = (e: PointerEvent) => {
			touches.delete(e.pointerId);
			pinch = pinchDistance();
			if (!press || e.pointerId !== press.id) return;
			const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
			const tap = moved < 8 && performance.now() - press.t < 350;
			const { type } = press;
			press = null;
			dom.releasePointerCapture?.(e.pointerId);
			if (!tap) return;
			const seat = seatAt(e.clientX, e.clientY);
			if (!seat) {
				hud.focus = null;
				return;
			}
			// First click frames the desk and shows the nametag; a second click on it opens the Member.
			// On touch the nametag's own button opens, so a repeat tap only re-frames.
			if (hud.focus?.desk.id === seat.desk.id && type !== 'touch') {
				hud.onopen(seat);
				return;
			}
			hud.focus = seat;
			rig.frameDesk(seat.desk);
		};
		const onWheel = (e: WheelEvent) => {
			if (paused) return;
			e.preventDefault();
			rig.zoom(Math.exp(e.deltaY * 0.0015));
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (paused || e.target instanceof HTMLInputElement) return;
			if (e.code === 'KeyE' && hud.focus) {
				e.preventDefault();
				hud.onopen(hud.focus);
			}
		};

		dom.addEventListener('pointerdown', onPointerDown);
		dom.addEventListener('pointermove', onPointerMove);
		dom.addEventListener('pointerup', onPointerUp);
		dom.addEventListener('pointercancel', onPointerUp);
		dom.addEventListener('wheel', onWheel, { passive: false });
		window.addEventListener('keydown', onKeyDown);
		dom.style.touchAction = 'none';
		return () => {
			dom.removeEventListener('pointerdown', onPointerDown);
			dom.removeEventListener('pointermove', onPointerMove);
			dom.removeEventListener('pointerup', onPointerUp);
			dom.removeEventListener('pointercancel', onPointerUp);
			dom.removeEventListener('wheel', onWheel);
			window.removeEventListener('keydown', onKeyDown);
		};
	});
</script>

<T.PerspectiveCamera bind:ref={camera} makeDefault fov={55} near={0.05} far={140} />
