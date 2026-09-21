<script lang="ts">
	import { T } from '@threlte/core';
	import { DoubleSide } from 'three';
	import { chamberTextures, CHAMBER_TONES, TIMBER } from '../materials';
	import { deskRunGeometry } from './deskGeometry';
	import { bearingToXZ, CHAMBER, DEG } from './layout';

	const b = CHAMBER.dais.bearingDeg * DEG;
	const yaw = Math.PI - b;
	const [dx, dz] = bearingToXZ(CHAMBER.dais.radius, b);
	const [cx, cz] = bearingToXZ(CHAMBER.clerks.radius, b);
	const { width, height } = CHAMBER.dais;
	const board = chamberTextures().joineryB;

	// Y Llywydd's desk is a taller curved oak run on the same radius as the platform,
	// with the mace in an open slot at its centre; the clerks sit at a lower run in front.
	const halfSpan = width / 2 / CHAMBER.dais.radius;
	const llywydd = deskRunGeometry(CHAMBER.dais.radius, b - halfSpan, b + halfSpan, 0.95, 1.0);
	const clerkHalf = CHAMBER.clerks.width / 2 / CHAMBER.clerks.radius;
	const clerks = deskRunGeometry(CHAMBER.clerks.radius, b - clerkHalf, b + clerkHalf, 0.8, 0.74);

	/** A point `along` metres towards the centre from a spot at bearing b. */
	const towardCentre = (x: number, z: number, along: number): [number, number] => [
		x - along * Math.sin(b),
		z + along * Math.cos(b)
	];
	const [chx, chz] = towardCentre(dx, dz, -0.9);
</script>

<!-- Low oak platform. -->
<T.Mesh position={[dx, height / 2, dz]} rotation.y={yaw} castShadow receiveShadow>
	<T.BoxGeometry args={[width + 0.6, height, 2.2]} />
	<T.MeshStandardMaterial map={board} roughness={0.6} />
</T.Mesh>

<T.Mesh geometry={llywydd} position.y={height} castShadow receiveShadow>
	<T.MeshStandardMaterial map={board} roughness={0.55} side={DoubleSide} />
</T.Mesh>
<!-- Y Llywydd's centre bay stands a little proud of the run, as the scan shows. -->
<T.Mesh position={[dx - 0.02 * Math.sin(b), height + 0.5, dz + 0.02 * Math.cos(b)]} rotation.y={yaw} castShadow receiveShadow>
	<T.BoxGeometry args={[1.5, 1.14, 1.08]} />
	<T.MeshStandardMaterial map={board} roughness={0.55} />
</T.Mesh>
<!-- Mace slot: a dark recess in the desk front with the mace lying inside. Its face sits 2 cm
     proud of the bay front (0.56 m out) so the two planes never coincide. -->
<T.Mesh position={[dx - 0.555 * Math.sin(b), height + 0.7, dz + 0.555 * Math.cos(b)]} rotation.y={yaw}>
	<T.BoxGeometry args={[1.1, 0.26, 0.05]} />
	<T.MeshStandardMaterial color="#141618" roughness={0.6} />
</T.Mesh>
<T.Mesh position={[dx - 0.585 * Math.sin(b), height + 0.66, dz + 0.585 * Math.cos(b)]} rotation.y={yaw} rotation.z={Math.PI / 2}>
	<T.CylinderGeometry args={[0.02, 0.03, 0.95, 10]} />
	<T.MeshStandardMaterial color="#d8b25a" roughness={0.3} metalness={0.9} />
</T.Mesh>

<!-- Y Llywydd's chair: star base and stem, then seat and back. -->
<T.Mesh position={[chx, height + 0.01, chz]}>
	<T.CylinderGeometry args={[0.32, 0.34, 0.02, 20]} />
	<T.MeshStandardMaterial color="#3a3d41" roughness={0.4} metalness={0.5} />
</T.Mesh>
<T.Mesh position={[chx, height + 0.22, chz]}>
	<T.CylinderGeometry args={[0.035, 0.04, 0.4, 10]} />
	<T.MeshStandardMaterial color="#5c6166" roughness={0.35} metalness={0.7} />
</T.Mesh>
<T.Mesh position={[chx, height + 0.46, chz]} rotation.y={yaw} castShadow>
	<T.BoxGeometry args={[0.6, 0.08, 0.55]} />
	<T.MeshStandardMaterial color={TIMBER.leather} roughness={0.7} />
</T.Mesh>
<T.Mesh position={[chx + 0.25 * Math.sin(b), height + 0.9, chz - 0.25 * Math.cos(b)]} rotation.y={yaw} castShadow>
	<T.BoxGeometry args={[0.6, 0.85, 0.08]} />
	<T.MeshStandardMaterial color="#3d4147" roughness={0.75} />
</T.Mesh>

<!-- Clerks' desk on the chamber floor, with its monitors. -->
<T.Mesh geometry={clerks} position.y={CHAMBER.clerks.height} castShadow receiveShadow>
	<T.MeshStandardMaterial map={board} roughness={0.55} side={DoubleSide} />
</T.Mesh>
{#each [-1, 0, 1] as slot (slot)}
	<T.Mesh
		position={[cx + slot * 1.0 * Math.cos(b) - 0.1 * Math.sin(b), CHAMBER.clerks.height + 0.88, cz + slot * 1.0 * Math.sin(b) + 0.1 * Math.cos(b)]}
		rotation.order="YXZ"
		rotation.y={yaw}
		rotation.x={-0.2}
	>
		<T.BoxGeometry args={[0.44, 0.26, 0.018]} />
		<T.MeshStandardMaterial color={CHAMBER_TONES.monitor} roughness={0.3} metalness={0.4} />
	</T.Mesh>
{/each}
