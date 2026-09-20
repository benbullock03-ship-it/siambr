<script lang="ts">
	import { T } from '@threlte/core';
	import { DoubleSide, Vector2 } from 'three';
	import { chamberTextures, TIMBER } from '../materials';
	import { CHAMBER } from './layout';

	const throat = CHAMBER.funnelThroatRadius;
	const throatY = CHAMBER.funnelThroatY;
	const top = CHAMBER.ceilingY;
	const skylightY = throatY + 7;

	// The inverted cedar bell: a throat over the centre flaring out into the ceiling.
	const bell = [
		new Vector2(throat, throatY),
		new Vector2(throat + 0.05, throatY + 0.6),
		new Vector2(throat + 0.5, throatY + 1.3),
		new Vector2(4.0, throatY + 1.95),
		new Vector2(5.8, throatY + 2.6),
		new Vector2(8.0, throatY + 3.15),
		new Vector2(10.5, top - 0.25),
		new Vector2(CHAMBER.wallRadius, top),
		new Vector2(CHAMBER.galleryOuterRadius + 0.2, top + 0.1)
	];

	const tex = chamberTextures();
	const ribs = tex.bellRibs;
	const tube = tex.bellThroat;
</script>

<!-- Pale honey cedar, lit from the skylight above so the slats read brighter towards the throat. -->
<T.Mesh name="funnel">
	<T.LatheGeometry args={[bell, 128]} />
	<T.MeshStandardMaterial map={ribs} roughness={0.65} side={DoubleSide} emissive={TIMBER.cedarLight} emissiveIntensity={0.05} />
</T.Mesh>

<!-- Throat rising through the roof towards the wind cowl. -->
<T.Mesh position={[0, (throatY + skylightY) / 2, 0]}>
	<T.CylinderGeometry args={[throat, throat, skylightY - throatY, 64, 1, true]} />
	<T.MeshStandardMaterial map={tube} roughness={0.65} side={DoubleSide} emissive={TIMBER.cedarLight} emissiveIntensity={0.12} />
</T.Mesh>

<!-- The lit lower rim of the bell, as the scan shows it from the gallery. -->
<T.Mesh position={[0, throatY + 0.02, 0]} rotation.x={Math.PI / 2}>
	<T.RingGeometry args={[throat - 0.02, throat + 0.16, 64]} />
	<T.MeshBasicMaterial color="#fff7e6" side={DoubleSide} />
</T.Mesh>

<!-- Daylight from the cowl above. -->
<T.Mesh position={[0, skylightY, 0]} rotation.x={Math.PI / 2}>
	<T.CircleGeometry args={[throat, 48]} />
	<T.MeshBasicMaterial color="#ffffff" />
</T.Mesh>
<T.PointLight position={[0, skylightY - 1, 0]} intensity={160} distance={40} decay={2} color="#fff6ea" />

<!-- Small downlights punched through the ceiling. -->
{#each [0, 60, 120, 180, 240, 300] as deg (deg)}
	{@const b = (deg * Math.PI) / 180}
	<T.Mesh position={[7.2 * Math.sin(b), top - 0.62, -7.2 * Math.cos(b)]} rotation.x={Math.PI / 2}>
		<T.CircleGeometry args={[0.14, 16]} />
		<T.MeshBasicMaterial color="#111417" />
	</T.Mesh>
{/each}
