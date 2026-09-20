<script lang="ts">
	import { T } from '@threlte/core';
	import { Instance, InstancedMesh } from '@threlte/extras';
	import { AdditiveBlending, BackSide, DoubleSide } from 'three';
	import { chamberTextures, CHAMBER_TONES, TIMBER } from '../materials';
	import { bearingToXZ, CHAMBER, CHAMBER_CLOCKS, CHAMBER_DOORS, CHAMBER_SCREENS, chamberWallSegments, DEG, isInOpening } from './layout';

	const wall = CHAMBER.wallRadius;
	const wallH = CHAMBER.wallHeight;
	const galleryY = CHAMBER.galleryFloorY;
	const outer = CHAMBER.galleryOuterRadius;
	const top = CHAMBER.ceilingY;
	const fasciaTop = galleryY + 1.15;
	const railTop = fasciaTop + 1.1;

	const tex = chamberTextures();

	// Forty bays of paired oak pilasters; the bays that fall in a doorway give way to the jambs.
	const BAYS = 40;
	const bays = Array.from({ length: BAYS }, (_, i) => (i * 360) / BAYS);
	const pilasters = bays.filter((deg) => !isInOpening(deg, CHAMBER_DOORS, wall, 0.4));
	const pendants = bays.map((deg) => deg + 180 / BAYS).filter((deg) => !isInOpening(deg, CHAMBER_DOORS, wall, 0.2));
	// CylinderGeometry measures theta from +Z towards +X, so a bearing b sits at theta = π − b.
	const wallArcs = chamberWallSegments().map((s) => ({ start: Math.PI - s.end, length: s.end - s.start }));
	const wallScreens = CHAMBER_SCREENS;
	const doors = CHAMBER_DOORS;
	const clocks = CHAMBER_CLOCKS;
	const posts = Array.from({ length: 48 }, (_, i) => (i * 360) / 48);
	const downlights = Array.from({ length: 72 }, (_, i) => (i * 360) / 72);
	const mullions = Array.from({ length: 36 }, (_, i) => (i * 360) / 36);
	const dividers = Array.from({ length: 28 }, (_, i) => (i * 360) / 28 + 5);

	const at = (radius: number, deg: number, y: number): [number, number, number] => {
		const [x, z] = bearingToXZ(radius, deg * DEG);
		return [x, y, z];
	};
	/** A box's +Z turned to face the centre. */
	const facing = (deg: number) => Math.PI - deg * DEG;
	/** A plane's +Z turned to face the centre (the opposite sense from a box seen from its back). */
	const planeFacing = (deg: number) => -deg * DEG;
</script>

<!-- Chamber wall: charcoal acoustic fabric between paired oak pilasters, an oak skirting and an
     oak cornice, cut by three oak doorways. -->
{#each wallArcs as arc, i (i)}
	<T.Mesh position={[0, wallH / 2, 0]} receiveShadow>
		<T.CylinderGeometry args={[wall, wall, wallH, 96, 1, true, arc.start, arc.length]} />
		<T.MeshStandardMaterial map={tex.wallFabric} roughness={1} side={DoubleSide} />
	</T.Mesh>
	<T.Mesh position={[0, 0.3, 0]}>
		<T.CylinderGeometry args={[wall - 0.04, wall - 0.04, 0.6, 96, 1, true, arc.start, arc.length]} />
		<T.MeshStandardMaterial map={tex.joineryA} roughness={0.6} side={BackSide} />
	</T.Mesh>
{/each}
<InstancedMesh limit={pilasters.length * 2} range={pilasters.length * 2} receiveShadow>
	<T.BoxGeometry args={[0.18, wallH, 0.14]} />
	<T.MeshStandardMaterial map={tex.joineryB} roughness={0.6} />
	{#each pilasters as deg (deg)}
		{#each [-0.17, 0.17] as dx (dx)}
			<Instance position={at(wall - 0.07, deg + dx / wall / DEG, wallH / 2)} rotation.y={facing(deg)} />
		{/each}
	{/each}
</InstancedMesh>
<T.Mesh position={[0, wallH - 0.2, 0]}>
	<T.CylinderGeometry args={[wall - 0.14, wall - 0.04, 0.4, 96, 1, true]} />
	<T.MeshStandardMaterial map={tex.joineryA} roughness={0.6} side={BackSide} />
</T.Mesh>

<!-- Pendant downlights along the cornice and the warm pools they throw down the fabric. -->
<InstancedMesh limit={pendants.length} range={pendants.length}>
	<T.CylinderGeometry args={[0.012, 0.012, 0.2, 6]} />
	<T.MeshStandardMaterial color="#8d9297" roughness={0.4} metalness={0.7} />
	{#each pendants as deg (deg)}
		<Instance position={at(wall - 0.32, deg, wallH - 0.5)} />
	{/each}
</InstancedMesh>
<InstancedMesh limit={pendants.length} range={pendants.length}>
	<T.CylinderGeometry args={[0.14, 0.11, 0.06, 16]} />
	<T.MeshBasicMaterial color="#fff6e4" />
	{#each pendants as deg (deg)}
		<Instance position={at(wall - 0.32, deg, wallH - 0.62)} />
	{/each}
</InstancedMesh>
<T.Mesh position={[0, wallH / 2 - 0.25, 0]} renderOrder={1}>
	<T.CylinderGeometry args={[wall - 0.02, wall - 0.02, wallH - 0.5, 96, 1, true]} />
	<T.MeshBasicMaterial map={tex.cornicePools} transparent opacity={0.4} blending={AdditiveBlending} depthWrite={false} side={BackSide} />
</T.Mesh>

<!-- Wall screens and the two red clocks: an oak-framed housing with a named face whose texture
     DivisionDisplays writes; the faces stay dark until a division lights them. -->
{#each wallScreens as deg (deg)}
	<T.Mesh position={at(wall - 0.14, deg, 2.75)} rotation.y={facing(deg)}>
		<T.BoxGeometry args={[1.86, 1.1, 0.06]} />
		<T.MeshStandardMaterial map={tex.joineryB} roughness={0.55} />
	</T.Mesh>
	<T.Mesh position={at(wall - 0.18, deg, 2.75)} rotation.y={facing(deg)}>
		<T.BoxGeometry args={[1.7, 0.95, 0.03]} />
		<T.MeshStandardMaterial color="#0d0f12" roughness={0.3} metalness={0.2} />
	</T.Mesh>
	<T.Mesh name={`wall-screen-${deg}`} position={at(wall - 0.2, deg, 2.75)} rotation.y={planeFacing(deg)} renderOrder={1}>
		<T.PlaneGeometry args={[1.62, 0.9]} />
		<T.MeshBasicMaterial color="#0a0c0e" transparent />
	</T.Mesh>
{/each}
{#each clocks as deg (deg)}
	<T.Mesh position={at(wall - 0.14, deg, wallH - 0.75)} rotation.y={facing(deg)}>
		<T.BoxGeometry args={[0.64, 0.2, 0.05]} />
		<T.MeshStandardMaterial color="#111417" roughness={0.4} />
	</T.Mesh>
	<T.Mesh name={`division-clock-${deg}`} position={at(wall - 0.17, deg, wallH - 0.75)} rotation.y={planeFacing(deg)} renderOrder={1}>
		<T.PlaneGeometry args={[0.56, 0.15]} />
		<T.MeshBasicMaterial color="#0a0c0e" transparent />
	</T.Mesh>
{/each}

<!-- Oak doorways with closed flush doors: a leaf with two charcoal inset panels. -->
{#each doors as { deg, width } (deg)}
	{@const [dx, dz] = bearingToXZ(wall, deg * DEG)}
	<T.Group position={[dx, 0, dz]} rotation.y={facing(deg)}>
		{#each [-1, 1] as side (side)}
			<T.Mesh position={[(side * (width + 0.3)) / 2, 1.3, 0]}>
				<T.BoxGeometry args={[0.3, 2.6, 0.5]} />
				<T.MeshStandardMaterial map={tex.joineryB} roughness={0.55} />
			</T.Mesh>
		{/each}
		<T.Mesh position={[0, 2.75, 0]}>
			<T.BoxGeometry args={[width + 0.6, 0.3, 0.5]} />
			<T.MeshStandardMaterial map={tex.joineryB} roughness={0.55} />
		</T.Mesh>
		<T.Mesh position={[0, 1.3, 0.05]} receiveShadow>
			<T.BoxGeometry args={[width, 2.6, 0.08]} />
			<T.MeshStandardMaterial map={tex.joineryA} roughness={0.5} />
		</T.Mesh>
		{#each [-1, 1] as side (side)}
			<T.Mesh position={[(side * width) / 4, 1.45, 0.095]}>
				<T.BoxGeometry args={[width / 2 - 0.18, 2.0, 0.02]} />
				<T.MeshStandardMaterial color={CHAMBER_TONES.doorPanel} roughness={0.9} />
			</T.Mesh>
		{/each}
		<T.Mesh position={[0, (2.9 + wallH) / 2, 0]}>
			<T.BoxGeometry args={[width + 0.6, wallH - 2.9, 0.12]} />
			<T.MeshStandardMaterial map={tex.wallFabric} roughness={1} />
		</T.Mesh>
	</T.Group>
{/each}

<!-- Public gallery: honey cedar-slat fascia, glass balustrade on steel posts under a cedar
     handrail, then dark carpet, oak-clad seating bays and tiered seats behind. -->
<T.Mesh position={[0, (wallH + galleryY) / 2, 0]}>
	<T.CylinderGeometry args={[wall + 0.05, wall + 0.05, galleryY - wallH + 0.02, 96, 1, true]} />
	<T.MeshStandardMaterial map={tex.galleryFascia} roughness={0.75} side={DoubleSide} />
</T.Mesh>
<T.Mesh position={[0, (galleryY + fasciaTop) / 2, 0]}>
	<T.CylinderGeometry args={[wall + 0.05, wall + 0.05, fasciaTop - galleryY, 96, 1, true]} />
	<T.MeshStandardMaterial map={tex.galleryFascia} roughness={0.75} side={DoubleSide} />
</T.Mesh>
<T.Mesh position={[0, fasciaTop - 0.06, 0]}>
	<T.CylinderGeometry args={[wall + 0.12, wall + 0.12, 0.12, 96, 1, true]} />
	<T.MeshStandardMaterial color={TIMBER.groove} roughness={0.7} side={DoubleSide} />
</T.Mesh>
<T.Mesh position={[0, (fasciaTop + railTop) / 2, 0]}>
	<T.CylinderGeometry args={[wall + 0.05, wall + 0.05, railTop - fasciaTop, 96, 1, true]} />
	<T.MeshPhysicalMaterial color="#dfe8ee" transparent opacity={0.28} roughness={0.04} metalness={0} reflectivity={0.9} side={DoubleSide} />
</T.Mesh>
<InstancedMesh limit={posts.length} range={posts.length}>
	<T.BoxGeometry args={[0.05, railTop - fasciaTop, 0.05]} />
	<T.MeshStandardMaterial color="#3b3f45" roughness={0.35} metalness={0.8} />
	{#each posts as deg (deg)}
		<Instance position={at(wall + 0.05, deg, (fasciaTop + railTop) / 2)} />
	{/each}
</InstancedMesh>
<T.Mesh position={[0, railTop, 0]} rotation.x={Math.PI / 2}>
	<T.TorusGeometry args={[wall + 0.05, 0.04, 8, 96]} />
	<T.MeshStandardMaterial map={tex.joineryA} roughness={0.5} />
</T.Mesh>
<T.Mesh position={[0, galleryY, 0]} rotation.x={-Math.PI / 2}>
	<T.RingGeometry args={[wall, outer, 96]} />
	<T.MeshStandardMaterial map={tex.galleryCarpet} roughness={1} side={DoubleSide} />
</T.Mesh>
{#each [0.9, 1.9, 2.9] as step, i (step)}
	<T.Mesh position={[0, galleryY + (0.4 + i * 0.3) / 2, 0]}>
		<T.CylinderGeometry args={[wall + step, wall + step, 0.4 + i * 0.3, 96, 1, true]} />
		<T.MeshStandardMaterial map={tex.galleryCarpet} roughness={1} side={DoubleSide} />
	</T.Mesh>
	<T.Mesh position={[0, galleryY + 0.55 + i * 0.3, 0]}>
		<T.CylinderGeometry args={[wall + step + 0.45, wall + step + 0.4, 0.42, 96, 1, true]} />
		<T.MeshStandardMaterial color="#2c2f34" roughness={0.9} side={DoubleSide} />
	</T.Mesh>
{/each}
<InstancedMesh limit={dividers.length} range={dividers.length} castShadow>
	<T.BoxGeometry args={[0.06, 1.1, 2.9]} />
	<T.MeshStandardMaterial map={tex.joineryB} roughness={0.55} />
	{#each dividers as deg (deg)}
		<Instance position={at(wall + 1.9, deg, galleryY + 0.55)} rotation.y={facing(deg)} />
	{/each}
</InstancedMesh>

<!-- White ceiling ring with its band of downlights. -->
<T.Mesh position={[0, top, 0]} rotation.x={Math.PI / 2}>
	<T.RingGeometry args={[CHAMBER.wallRadius - 2.4, outer + 0.2, 96]} />
	<T.MeshStandardMaterial color={CHAMBER_TONES.ceiling} roughness={0.9} side={DoubleSide} />
</T.Mesh>
<InstancedMesh limit={downlights.length} range={downlights.length}>
	<T.CircleGeometry args={[0.09, 12]} />
	<T.MeshBasicMaterial color="#fffaf0" />
	{#each downlights as deg (deg)}
		<Instance position={at(wall - 1.2, deg, top - 0.01)} rotation.x={Math.PI / 2} />
	{/each}
</InstancedMesh>

<!-- Outer curtain wall of the Senedd, glass with steel mullions. -->
<T.Mesh position={[0, (galleryY + top) / 2, 0]}>
	<T.CylinderGeometry args={[outer, outer, top - galleryY, 96, 1, true]} />
	<T.MeshStandardMaterial color="#e3e9ee" transparent opacity={0.22} roughness={0.05} side={DoubleSide} />
</T.Mesh>
<InstancedMesh limit={mullions.length} range={mullions.length}>
	<T.BoxGeometry args={[0.08, top - galleryY, 0.08]} />
	<T.MeshStandardMaterial color="#f2f2f0" roughness={0.4} metalness={0.5} />
	{#each mullions as deg (deg)}
		<Instance position={at(outer, deg, (galleryY + top) / 2)} />
	{/each}
</InstancedMesh>
