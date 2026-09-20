<script lang="ts">
	import { T } from '@threlte/core';
	import { CircleGeometry, DoubleSide, LatheGeometry, RingGeometry, Vector2, type Mesh } from 'three';
	import { chamberTextures, CHAMBER_TONES } from '../materials';
	import { CHAMBER, DEG, floorHeightAt, SPAWN_BEARING_DEG } from './layout';

	let { ref = $bindable<Mesh | undefined>() }: { ref?: Mesh } = $props();

	const tex = chamberTextures();

	// Lathe profile from the centre out to the wall, following the ramp.
	const profile = [
		new Vector2(0, 0),
		new Vector2(CHAMBER.wellRadius, 0),
		...CHAMBER.rowRadii.map((r) => new Vector2(r, floorHeightAt(r))),
		new Vector2(CHAMBER.wallRadius, floorHeightAt(CHAMBER.wallRadius))
	];
	// Lathe UVs wrap around the circumference; boards want a plan projection instead.
	const geometry = new LatheGeometry(profile, 96);
	const uv = geometry.getAttribute('uv');
	const pos = geometry.getAttribute('position');
	const tile = 2;
	for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / tile, pos.getZ(i) / tile);
	uv.needsUpdate = true;

	const boards = tex.floorBoards;
	const kerb = 0.06;
	// The oak well sits on a low kerb and runs out to the inner desk front, as the scan shows;
	// carpet takes over between the rows.
	const oakRadius = CHAMBER.rowRadii[0] - CHAMBER.desk.depth / 2 - 0.08;
	const apron = new CircleGeometry(oakRadius, 96);
	const apronUv = apron.getAttribute('uv');
	const apronPos = apron.getAttribute('position');
	for (let i = 0; i < apronUv.count; i++) apronUv.setXY(i, apronPos.getX(i) / tile, apronPos.getY(i) / tile);
	apronUv.needsUpdate = true;
	const roundelRadius = 1.6;

	// Oak radial aisles across the carpet, the western entrance aisle widest; UVs in plan.
	const aisles = CHAMBER.aisleBearingsDeg.map((deg) => {
		const width = deg === SPAWN_BEARING_DEG ? CHAMBER.aisleWidth + 0.8 : CHAMBER.aisleWidth;
		const inner = oakRadius - 0.02;
		const outer = CHAMBER.wallRadius - 0.05;
		const half = width / 2 / CHAMBER.rowRadii[1];
		// RingGeometry theta runs anticlockwise from +X in its own plane; after rotation.x = -π/2
		// that plane is XZ with +Y → -Z, so theta = π/2 - bearing.
		const g = new RingGeometry(inner, outer, 1, 24, Math.PI / 2 - deg * DEG - half, half * 2);
		const uv = g.getAttribute('uv');
		const p = g.getAttribute('position');
		for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / tile, -p.getY(i) / tile);
		uv.needsUpdate = true;
		// Lift each vertex onto the ramp.
		for (let i = 0; i < p.count; i++) p.setZ(i, floorHeightAt(Math.hypot(p.getX(i), p.getY(i))) + 0.006);
		p.needsUpdate = true;
		g.computeVertexNormals();
		return g;
	});
</script>

{#each aisles as geometry, i (i)}
	<T.Mesh {geometry} rotation.x={-Math.PI / 2} receiveShadow>
		<T.MeshStandardMaterial map={boards} roughness={0.55} side={DoubleSide} />
	</T.Mesh>
{/each}

<!-- Carpeted tiers, the teleport target. -->
<T.Mesh bind:ref name="floor" {geometry} receiveShadow>
	<T.MeshStandardMaterial color={CHAMBER_TONES.carpet} roughness={1} metalness={0} side={DoubleSide} />
</T.Mesh>

<!-- Oak-boarded well on a low kerb, with the blue mosaic roundel let into its centre. -->
<T.Mesh position={[0, kerb / 2, 0]} receiveShadow>
	<T.CylinderGeometry args={[oakRadius, oakRadius, kerb, 96, 1, true]} />
	<T.MeshStandardMaterial map={boards} roughness={0.55} />
</T.Mesh>
<T.Mesh geometry={apron} position={[0, kerb, 0]} rotation.x={-Math.PI / 2} receiveShadow>
	<T.MeshStandardMaterial map={boards} roughness={0.55} />
</T.Mesh>
<T.Mesh position={[0, kerb + 0.002, 0]} rotation.x={-Math.PI / 2} receiveShadow>
	<T.CircleGeometry args={[roundelRadius, 64]} />
	<T.MeshStandardMaterial map={tex.roundel} roughness={0.35} />
</T.Mesh>
<T.Mesh position={[0, kerb + 0.003, 0]} rotation.x={-Math.PI / 2}>
	<T.RingGeometry args={[roundelRadius, roundelRadius + 0.04, 64]} />
	<T.MeshStandardMaterial color="#8d9297" roughness={0.3} metalness={0.8} />
</T.Mesh>
