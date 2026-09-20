<script lang="ts">
	import { T } from '@threlte/core';
	import { BackSide, DoubleSide } from 'three';
	import { acousticPanel, cedarBoard, cedarSlats, CHAMBER_TONES, SLATE, slateSlabs, TIMBER } from '../materials';
	import { bearingToXZ, CHAMBER, CHAMBER_CLOCKS, CHAMBER_DOORS, CHAMBER_SCREENS, chamberWallSegments, DEG, isInOpening } from './layout';

	const wall = CHAMBER.wallRadius;
	const wallH = CHAMBER.wallHeight;
	const galleryY = CHAMBER.galleryFloorY;
	const outer = CHAMBER.galleryOuterRadius;
	const top = CHAMBER.ceilingY;
	const fasciaTop = galleryY + 1.15;

	const fabric = acousticPanel(60, 6);
	const oak = cedarBoard(1, 1);
	const galleryFloor = slateSlabs(SLATE.riven, 8, 8);
	const galleryFascia = cedarSlats(1, 1, 200, TIMBER.cedarDark);

	// Doorways cut the wall; pilasters near them give way to the door jambs.
	const pilasters = Array.from({ length: 40 }, (_, i) => (i * 360) / 40).filter(
		(deg) => !isInOpening(deg, CHAMBER_DOORS, wall, 0.3)
	);
	// CylinderGeometry measures theta from +Z towards +X, so a bearing b sits at theta = π − b.
	const wallArcs = chamberWallSegments().map((s) => ({ start: Math.PI - s.end, length: s.end - s.start }));
	const wallScreens = CHAMBER_SCREENS;
	const doors = CHAMBER_DOORS;
	const clocks = CHAMBER_CLOCKS;
	const posts = Array.from({ length: 48 }, (_, i) => (i * 360) / 48);
	const downlights = Array.from({ length: 72 }, (_, i) => (i * 360) / 72);
	const mullions = Array.from({ length: 36 }, (_, i) => (i * 360) / 36);

	const at = (radius: number, deg: number, y: number): [number, number, number] => {
		const [x, z] = bearingToXZ(radius, deg * DEG);
		return [x, y, z];
	};
	const facing = (deg: number) => Math.PI - deg * DEG;
</script>

<!-- Chamber wall: charcoal acoustic fabric between oak pilasters, an oak skirting and an oak cornice,
     cut by three oak doorways. -->
{#each wallArcs as arc, i (i)}
	<T.Mesh position={[0, wallH / 2, 0]} receiveShadow>
		<T.CylinderGeometry args={[wall, wall, wallH, 96, 1, true, arc.start, arc.length]} />
		<T.MeshStandardMaterial map={fabric} roughness={1} side={DoubleSide} />
	</T.Mesh>
	<T.Mesh position={[0, 0.3, 0]}>
		<T.CylinderGeometry args={[wall - 0.04, wall - 0.04, 0.6, 96, 1, true, arc.start, arc.length]} />
		<T.MeshStandardMaterial map={oak} roughness={0.6} side={BackSide} />
	</T.Mesh>
{/each}
{#each pilasters as deg (deg)}
	<T.Mesh position={at(wall - 0.06, deg, wallH / 2)} rotation.y={facing(deg)} receiveShadow>
		<T.BoxGeometry args={[0.32, wallH, 0.12]} />
		<T.MeshStandardMaterial map={oak} roughness={0.6} />
	</T.Mesh>
{/each}
<T.Mesh position={[0, wallH - 0.2, 0]}>
	<T.CylinderGeometry args={[wall - 0.1, wall - 0.04, 0.4, 96, 1, true]} />
	<T.MeshStandardMaterial map={oak} roughness={0.6} side={BackSide} />
</T.Mesh>

<!-- Linear uplighters along the cornice. -->
<T.Mesh position={[0, wallH - 0.42, 0]}>
	<T.CylinderGeometry args={[wall - 0.16, wall - 0.16, 0.05, 96, 1, true]} />
	<T.MeshBasicMaterial color="#fff4dc" side={DoubleSide} />
</T.Mesh>

<!-- Wall screens, open oak doorways and the two division clocks; all dark until a division
     lights them (DivisionDisplays). -->
{#each wallScreens as deg (deg)}
	<T.Mesh position={at(wall - 0.14, deg, 2.75)} rotation.y={facing(deg)}>
		<T.BoxGeometry args={[1.7, 0.95, 0.06]} />
		<T.MeshStandardMaterial color="#0d0f12" roughness={0.25} />
	</T.Mesh>
{/each}
{#each doors as { deg, width } (deg)}
	{@const [dx, dz] = bearingToXZ(wall, deg * DEG)}
	<T.Group position={[dx, 0, dz]} rotation.y={facing(deg)}>
		{#each [-1, 1] as side (side)}
			<T.Mesh position={[(side * (width + 0.3)) / 2, 1.3, 0]}>
				<T.BoxGeometry args={[0.3, 2.6, 0.5]} />
				<T.MeshStandardMaterial map={oak} roughness={0.55} />
			</T.Mesh>
		{/each}
		<T.Mesh position={[0, 2.75, 0]}>
			<T.BoxGeometry args={[width + 0.6, 0.3, 0.5]} />
			<T.MeshStandardMaterial map={oak} roughness={0.55} />
		</T.Mesh>
		<T.Mesh position={[0, (2.9 + wallH) / 2, 0]}>
			<T.BoxGeometry args={[width + 0.6, wallH - 2.9, 0.12]} />
			<T.MeshStandardMaterial map={fabric} roughness={1} />
		</T.Mesh>
	</T.Group>
{/each}
{#each clocks as deg (deg)}
	<T.Mesh position={at(wall - 0.14, deg, wallH - 0.75)} rotation.y={facing(deg)}>
		<T.BoxGeometry args={[0.6, 0.18, 0.05]} />
		<T.MeshStandardMaterial color="#111417" roughness={0.4} />
	</T.Mesh>
{/each}

<!-- Public gallery: dark cedar-slat fascia, then full-height glass, slate floor and tiered seats behind. -->
<T.Mesh position={[0, (wallH + galleryY) / 2, 0]}>
	<T.CylinderGeometry args={[wall + 0.05, wall + 0.05, galleryY - wallH + 0.02, 96, 1, true]} />
	<T.MeshStandardMaterial map={galleryFascia} roughness={0.8} side={DoubleSide} />
</T.Mesh>
<T.Mesh position={[0, (galleryY + fasciaTop) / 2, 0]}>
	<T.CylinderGeometry args={[wall + 0.05, wall + 0.05, fasciaTop - galleryY, 96, 1, true]} />
	<T.MeshStandardMaterial map={galleryFascia} roughness={0.8} side={DoubleSide} />
</T.Mesh>
<T.Mesh position={[0, (fasciaTop + top) / 2, 0]}>
	<T.CylinderGeometry args={[wall + 0.05, wall + 0.05, top - fasciaTop, 96, 1, true]} />
	<T.MeshStandardMaterial color="#cfd8de" transparent opacity={0.22} roughness={0.05} metalness={0.1} side={DoubleSide} />
</T.Mesh>
{#each posts as deg (deg)}
	<T.Mesh position={at(wall + 0.05, deg, (fasciaTop + top) / 2)}>
		<T.BoxGeometry args={[0.05, top - fasciaTop, 0.05]} />
		<T.MeshStandardMaterial color="#c9ccd0" roughness={0.3} metalness={0.8} />
	</T.Mesh>
{/each}
<T.Mesh position={[0, galleryY, 0]} rotation.x={-Math.PI / 2}>
	<T.RingGeometry args={[wall, outer, 96]} />
	<T.MeshStandardMaterial map={galleryFloor} roughness={0.9} side={DoubleSide} />
</T.Mesh>
{#each [0.9, 1.9, 2.9] as step, i (step)}
	<T.Mesh position={[0, galleryY + 0.28 + i * 0.3, 0]}>
		<T.CylinderGeometry args={[wall + step, wall + step, 0.4, 96, 1, true]} />
		<T.MeshStandardMaterial color="#4d5158" roughness={0.9} side={DoubleSide} />
	</T.Mesh>
{/each}

<!-- White ceiling ring with its band of downlights. -->
<T.Mesh position={[0, top, 0]} rotation.x={Math.PI / 2}>
	<T.RingGeometry args={[CHAMBER.wallRadius - 2.4, outer + 0.2, 96]} />
	<T.MeshStandardMaterial color={CHAMBER_TONES.ceiling} roughness={0.9} side={DoubleSide} />
</T.Mesh>
{#each downlights as deg (deg)}
	<T.Mesh position={at(wall - 1.2, deg, top - 0.01)} rotation.x={Math.PI / 2}>
		<T.CircleGeometry args={[0.09, 12]} />
		<T.MeshBasicMaterial color="#fffaf0" />
	</T.Mesh>
{/each}

<!-- Outer curtain wall of the Senedd, glass with steel mullions. -->
<T.Mesh position={[0, (galleryY + top) / 2, 0]}>
	<T.CylinderGeometry args={[outer, outer, top - galleryY, 96, 1, true]} />
	<T.MeshStandardMaterial color="#e3e9ee" transparent opacity={0.22} roughness={0.05} side={DoubleSide} />
</T.Mesh>
{#each mullions as deg (deg)}
	<T.Mesh position={at(outer, deg, (galleryY + top) / 2)}>
		<T.BoxGeometry args={[0.08, top - galleryY, 0.08]} />
		<T.MeshStandardMaterial color="#f2f2f0" roughness={0.4} metalness={0.5} />
	</T.Mesh>
{/each}
