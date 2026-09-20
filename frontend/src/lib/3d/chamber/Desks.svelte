<script lang="ts">
	import { T } from '@threlte/core';
	import { Instance, InstancedMesh } from '@threlte/extras';
	import { DoubleSide, type InstancedMesh as ThreeInstancedMesh, type Mesh } from 'three';
	import { cedarBoard, CHAMBER_TONES, ESTATE, partyHex, TIMBER } from '../materials';
	import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
	import { deskRunGeometry } from './deskGeometry';
	import { CHAMBER, type Desk } from './layout';
	import type { SeatAssignment } from './seating';

	let {
		desks,
		seats,
		focus,
		hitMesh = $bindable<ThreeInstancedMesh | undefined>(),
		llywyddHit = $bindable<Mesh | undefined>()
	}: {
		desks: Desk[];
		seats: SeatAssignment[];
		focus: SeatAssignment | null;
		hitMesh?: ThreeInstancedMesh;
		llywyddHit?: Mesh;
	} = $props();

	const { width, depth, height } = CHAMBER.desk;
	const board = cedarBoard(6, 1);
	const seatByDesk = $derived(new Map(seats.map((s) => [s.desk.id, s])));
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

	/** World position of a point `dz` metres along a desk's local +Z (away from the centre). */
	const behind = (d: Desk, dz: number, y: number): [number, number, number] => [
		d.x + dz * Math.sin(d.yaw),
		d.y + y,
		d.z + dz * Math.cos(d.yaw)
	];
	/** As `behind`, offset `dx` metres along the desk's local +X too. */
	const beside = (d: Desk, dx: number, dz: number, y: number): [number, number, number] => [
		d.x + dz * Math.sin(d.yaw) + dx * Math.cos(d.yaw),
		d.y + y,
		d.z + dz * Math.cos(d.yaw) - dx * Math.sin(d.yaw)
	];
	const monitorTilt = -0.2;
</script>

<!-- Curved oak desk units, one wedge per Member, merged per row. -->
{#each rows as { row, y, geometry } (row)}
	<T.Mesh {geometry} position.y={y} castShadow receiveShadow>
		<T.MeshStandardMaterial map={board} roughness={0.55} side={DoubleSide} />
	</T.Mesh>
{/each}

<!-- Charcoal worktop inset, one instance per seated place in `seats` order: it doubles as
     the raycast target, so instanceId → the Walker's desks[i]. -->
<InstancedMesh bind:ref={hitMesh} limit={places.length} range={places.length} name="desks">
	<T.BoxGeometry args={[width - 0.16, 0.014, depth - 0.16]} />
	<T.MeshStandardMaterial color={CHAMBER_TONES.worktop} roughness={0.5} />
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
<InstancedMesh limit={desks.length} range={desks.length}>
	<T.BoxGeometry args={[0.4, 0.22, 0.004]} />
	<T.MeshStandardMaterial color="#1b1e22" roughness={0.2} />
	{#each desks as d (d.id)}
		<Instance position={behind(d, -0.268, height + 0.145)} rotation.order="YXZ" rotation.y={d.yaw} rotation.x={monitorTilt} />
	{/each}
</InstancedMesh>
<InstancedMesh limit={desks.length} range={desks.length}>
	<T.BoxGeometry args={[0.26, 0.018, 0.05]} />
	<T.MeshStandardMaterial roughness={0.35} />
	{#each desks as d (d.id)}
		{@const seat = seatByDesk.get(d.id)}
		<Instance
			position={behind(d, -depth / 2 + 0.05, height + 0.009)}
			rotation.y={d.yaw}
			color={seat ? partyHex(seat.member.party_id) : ESTATE.border}
		/>
	{/each}
</InstancedMesh>

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
