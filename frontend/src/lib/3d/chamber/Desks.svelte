<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { Instance, InstancedMesh } from '@threlte/extras';
	import { AdditiveBlending, Color, DoubleSide, type InstancedMesh as ThreeInstancedMesh, type Mesh } from 'three';
	import type { FloorState } from '$lib/stage/floor';
	import { cedarBoard, CHAMBER_TONES, ESTATE, partyHex, TIMBER } from '../materials';
	import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
	import { deskRunGeometry } from './deskGeometry';
	import { Eased, FLOOR_LIGHT, FLOOR_LIGHT_MS, liveDeskId, mixInto } from './floorLight';
	import { CHAMBER, deskPoint, type Desk } from './layout';
	import type { SeatAssignment } from './seating';

	let {
		desks,
		seats,
		focus,
		floor,
		presiding = new Set<string>(),
		reducedMotion = false,
		hitMesh = $bindable<ThreeInstancedMesh | undefined>(),
		llywyddHit = $bindable<Mesh | undefined>()
	}: {
		desks: Desk[];
		seats: SeatAssignment[];
		focus: SeatAssignment | null;
		floor: FloorState;
		/** Members who preside (Llywydd, Deputy): their speech lights the dais, not their desk. */
		presiding?: ReadonlySet<string>;
		reducedMotion?: boolean;
		hitMesh?: ThreeInstancedMesh;
		llywyddHit?: Mesh;
	} = $props();

	const { width, depth, height } = CHAMBER.desk;
	const board = cedarBoard(6, 1);
	const seatByDesk = $derived(new Map(seats.map((s) => [s.desk.id, s])));
	const deskByMember = $derived(new Map(seats.map((s) => [s.member.id, s.desk.id])));
	// Each desk is its own wedge with a small gap to its neighbour, as in the scan; merged per row.
	const DESK_GAP = 0.12;
	const rows = $derived(
		[...new Set(desks.map((d) => d.row))].map((row) => {
			const radius = CHAMBER.rowRadii[row];
			const half = (CHAMBER.deskPitch - DESK_GAP) / 2 / radius;
			const parts = desks.filter((d) => d.row === row).map((d) => deskRunGeometry(radius, d.bearing - half, d.bearing + half));
			const geometry = mergeGeometries(parts, false);
			parts.forEach((g) => g.dispose());
			return { row, y: desks.find((d) => d.row === row)?.y ?? 0, geometry };
		})
	);
	// Everything with a Member behind it, including Y Llywydd's place at the dais, in `seats` order.
	const places = $derived(seats.map((s) => s.desk));
	const llywydd = $derived(places.find((d) => d.row < 0) ?? null);

	const behind = (d: Desk, dz: number, y: number) => deskPoint(d, 0, dz, y);
	const beside = (d: Desk, dx: number, dz: number, y: number) => deskPoint(d, dx, dz, y);
	const monitorTilt = -0.2;

	// Floor light: the live desk's worktop warms, its screen lights, a pool glows on the carpet
	// behind its chair; spoken Members keep a warmed party tab. All per-instance colour, eased.
	let screenMesh = $state<ThreeInstancedMesh>();
	let tabMesh = $state<ThreeInstancedMesh>();
	let pool = $state<Mesh>();
	const lit = new Map<string, Eased>();
	const spoken = new Map<string, Eased>();
	const eased = (map: Map<string, Eased>, id: string) => {
		let e = map.get(id);
		if (!e) map.set(id, (e = new Eased()));
		return e;
	};
	const colour = new Color();
	const liveId = $derived(liveDeskId(floor, deskByMember, presiding));
	const liveDesk = $derived(liveId ? (places.find((d) => d.id === liveId) ?? null) : null);
	const poolLit = new Eased();
	let poolDeskId: string | null = null;

	useTask((dt) => {
		const ms = reducedMotion ? 0 : FLOOR_LIGHT_MS;
		for (const d of places) eased(lit, d.id).set(d.id === liveId ? 1 : 0);
		for (const d of desks) {
			const seat = seatByDesk.get(d.id);
			eased(spoken, d.id).set(seat && floor.spokenMemberIds.has(seat.member.id) ? 1 : 0);
		}
		if (hitMesh) {
			places.forEach((d, i) => {
				const e = eased(lit, d.id);
				e.step(dt, ms);
				hitMesh!.setColorAt(i, mixInto(colour, FLOOR_LIGHT.worktop, FLOOR_LIGHT.worktopLit, e.value));
			});
			if (hitMesh.instanceColor) hitMesh.instanceColor.needsUpdate = true;
		}
		if (screenMesh && tabMesh) {
			desks.forEach((d, i) => {
				const l = eased(lit, d.id);
				const s = eased(spoken, d.id);
				s.step(dt, ms);
				screenMesh!.setColorAt(i, mixInto(colour, FLOOR_LIGHT.screen, FLOOR_LIGHT.screenLit, l.value));
				const seat = seatByDesk.get(d.id);
				const base = seat ? partyHex(seat.member.party_id) : ESTATE.border;
				tabMesh!.setColorAt(i, mixInto(colour, base, FLOOR_LIGHT.tabWarm, s.value * FLOOR_LIGHT.tabWarmMix));
			});
			if (screenMesh.instanceColor) screenMesh.instanceColor.needsUpdate = true;
			if (tabMesh.instanceColor) tabMesh.instanceColor.needsUpdate = true;
		}
		if (pool) {
			if (liveDesk && liveDesk.id !== poolDeskId) {
				poolDeskId = liveDesk.id;
				const [x, y, z] = behind(liveDesk, liveDesk.row < 0 ? -0.9 : 0.9, 0.015);
				pool.position.set(x, y, z);
			}
			poolLit.set(liveDesk ? 1 : 0);
			poolLit.step(dt, ms);
			pool.visible = poolLit.value > 0;
			(pool.material as { opacity: number }).opacity = 0.55 * poolLit.value;
		}
	});
</script>

<!-- Curved oak desk units, one wedge per Member, merged per row. -->
{#each rows as { row, y, geometry } (row)}
	<T.Mesh {geometry} position.y={y} castShadow receiveShadow>
		<T.MeshStandardMaterial map={board} roughness={0.55} side={DoubleSide} />
	</T.Mesh>
{/each}

<!-- Charcoal worktop inset, one instance per seated place in `seats` order: it doubles as
     the raycast target, so instanceId → the Walker's desks[i]. -->
<InstancedMesh bind:ref={hitMesh} limit={places.length} range={places.length} name="desks" update={false}>
	<T.BoxGeometry args={[width - 0.16, 0.014, depth - 0.16]} />
	<T.MeshStandardMaterial color="#ffffff" roughness={0.5} />
	{#each places as d (d.id)}
		<Instance position={behind(d, d.row < 0 ? 0 : 0.02, (d.row < 0 ? 1.0 : height) + 0.007)} rotation.y={d.yaw} />
	{/each}
</InstancedMesh>
<InstancedMesh limit={desks.length} range={desks.length} castShadow>
	<T.BoxGeometry args={[0.44, 0.26, 0.018]} />
	<T.MeshStandardMaterial color={CHAMBER_TONES.monitor} roughness={0.35} metalness={0.3} />
	{#each desks as d (d.id)}
		<Instance position={behind(d, -0.28, height + 0.14)} rotation.order="YXZ" rotation.y={d.yaw} rotation.x={monitorTilt} />
	{/each}
</InstancedMesh>
<InstancedMesh bind:ref={screenMesh} limit={desks.length} range={desks.length} name="screens" update={false}>
	<T.BoxGeometry args={[0.4, 0.22, 0.004]} />
	<T.MeshStandardMaterial color="#ffffff" roughness={0.2} />
	{#each desks as d (d.id)}
		<Instance position={behind(d, -0.268, height + 0.145)} rotation.order="YXZ" rotation.y={d.yaw} rotation.x={monitorTilt} />
	{/each}
</InstancedMesh>
<InstancedMesh bind:ref={tabMesh} limit={desks.length} range={desks.length} name="tabs" update={false}>
	<T.BoxGeometry args={[0.26, 0.018, 0.05]} />
	<T.MeshStandardMaterial roughness={0.35} />
	{#each desks as d (d.id)}
		{@const seat = seatByDesk.get(d.id)}
		<Instance position={behind(d, -depth / 2 + 0.05, height + 0.009)} rotation.y={d.yaw} color={seat ? partyHex(seat.member.party_id) : ESTATE.border} />
	{/each}
</InstancedMesh>

<!-- One soft pool of light on the carpet behind the live Member's chair; moved, never duplicated. -->
<T.Mesh bind:ref={pool} rotation.x={-Math.PI / 2} visible={false} renderOrder={1}>
	<T.CircleGeometry args={[1.1, 40]} />
	<T.MeshBasicMaterial color={FLOOR_LIGHT.pool} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} />
</T.Mesh>

<!-- Microphone on a gooseneck, leaning towards the Member. -->
<InstancedMesh limit={desks.length} range={desks.length}>
	<T.CylinderGeometry args={[0.006, 0.008, 0.34, 8]} />
	<T.MeshStandardMaterial color="#2b2f33" roughness={0.4} metalness={0.6} />
	{#each desks as d (d.id)}
		<Instance position={beside(d, 0.3, 0.0, height + 0.16)} rotation.order="YXZ" rotation.y={d.yaw} rotation.x={0.35} />
	{/each}
</InstancedMesh>
<InstancedMesh limit={desks.length} range={desks.length}>
	<T.SphereGeometry args={[0.018, 10, 8]} />
	<T.MeshStandardMaterial color="#111417" roughness={0.6} />
	{#each desks as d (d.id)}
		<Instance position={beside(d, 0.3, 0.06, height + 0.33)} />
	{/each}
</InstancedMesh>

<!-- High-back task chairs in charcoal mesh: star base, gas stem, seat, back, arms. -->
<InstancedMesh limit={desks.length} range={desks.length}>
	<T.CylinderGeometry args={[0.3, 0.32, 0.02, 20]} />
	<T.MeshStandardMaterial color="#3a3d41" roughness={0.4} metalness={0.5} />
	{#each desks as d (d.id)}
		<Instance position={behind(d, 0.9, 0.01)} />
	{/each}
</InstancedMesh>
<InstancedMesh limit={desks.length} range={desks.length}>
	<T.CylinderGeometry args={[0.03, 0.035, 0.4, 10]} />
	<T.MeshStandardMaterial color="#5c6166" roughness={0.35} metalness={0.7} />
	{#each desks as d (d.id)}
		<Instance position={behind(d, 0.9, 0.22)} />
	{/each}
</InstancedMesh>
<InstancedMesh limit={desks.length} range={desks.length} castShadow>
	<T.BoxGeometry args={[0.5, 0.07, 0.48]} />
	<T.MeshStandardMaterial color={TIMBER.leather} roughness={0.7} />
	{#each desks as d (d.id)}
		<Instance position={behind(d, 0.9, 0.46)} rotation.y={d.yaw} />
	{/each}
</InstancedMesh>
<InstancedMesh limit={desks.length} range={desks.length} castShadow>
	<T.BoxGeometry args={[0.48, 0.6, 0.08]} />
	<T.MeshStandardMaterial color="#3d4147" roughness={0.75} />
	{#each desks as d (d.id)}
		<Instance position={behind(d, 1.12, 0.82)} rotation.order="YXZ" rotation.y={d.yaw} rotation.x={-0.12} />
	{/each}
</InstancedMesh>
<InstancedMesh limit={desks.length} range={desks.length}>
	<T.BoxGeometry args={[0.3, 0.16, 0.07]} />
	<T.MeshStandardMaterial color="#3d4147" roughness={0.75} />
	{#each desks as d (d.id)}
		<Instance position={behind(d, 1.17, 1.2)} rotation.order="YXZ" rotation.y={d.yaw} rotation.x={-0.12} />
	{/each}
</InstancedMesh>
{#each [-0.26, 0.26] as side (side)}
	<InstancedMesh limit={desks.length} range={desks.length}>
		<T.BoxGeometry args={[0.04, 0.02, 0.3]} />
		<T.MeshStandardMaterial color="#3a3d41" roughness={0.5} />
		{#each desks as d (d.id)}
			<Instance position={beside(d, side, 0.9, 0.68)} rotation.y={d.yaw} />
		{/each}
	</InstancedMesh>
{/each}

<!-- Y Llywydd's whole desk is the pick target at the dais; a plain Mesh raycasts even when hidden. -->
{#if llywydd}
	<T.Mesh bind:ref={llywyddHit} position={behind(llywydd, 0, 0.6)} rotation.y={llywydd.yaw} visible={false}>
		<T.BoxGeometry args={[CHAMBER.dais.width, 1.2, 1.0]} />
		<T.MeshBasicMaterial />
	</T.Mesh>
{/if}

{#if focus}
	{@const d = focus.desk}
	<T.Mesh position={[d.x, d.y + 0.012, d.z]} rotation.x={-Math.PI / 2}>
		<T.RingGeometry args={[0.95, 1.08, 48]} />
		<T.MeshBasicMaterial color={ESTATE.plum} />
	</T.Mesh>
	<T.Mesh position={behind(d, 0.02, (d.row < 0 ? 1.0 : height) + 0.02)} rotation.y={d.yaw}>
		<T.BoxGeometry args={[width - 0.2, 0.006, depth - 0.2]} />
		<T.MeshBasicMaterial color={ESTATE.plum} transparent opacity={0.55} />
	</T.Mesh>
{/if}
