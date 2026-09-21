<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { Instance, InstancedMesh } from '@threlte/extras';
	import { AdditiveBlending, BoxGeometry, CatmullRomCurve3, Color, DoubleSide, InstancedMesh as ThreeInstancedMesh, MeshBasicMaterial, Object3D, TubeGeometry, Vector3, type Mesh } from 'three';
	import type { FloorState } from '$lib/stage/floor';
	import { chamberTextures, CHAMBER_TONES, ESTATE, partyHex } from '../materials';
	import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
	import { deskRunGeometry } from './deskGeometry';
	import { deskTint } from './divisionLight';
	import { Eased, FLOOR_LIGHT, FLOOR_LIGHT_MS, liveDeskId, mixInto } from './floorLight';
	import { CHAMBER, deskPoint, type Desk } from './layout';
	import { llywyddDesk, type SeatAssignment } from './seating';

	let {
		desks,
		seats,
		focus,
		floor,
		presiding = new Set<string>(),
		reducedMotion = false,
		hitMesh = $bindable<ThreeInstancedMesh | undefined>(),
		pickMesh = $bindable<ThreeInstancedMesh | undefined>(),
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
		/** Hidden pick volume, one fat box per desk in `desks` order, so a hover never drops into a gap between worktops. */
		pickMesh?: ThreeInstancedMesh;
		llywyddHit?: Mesh;
	} = $props();

	const pickVolume = $derived.by(() => {
		const mesh = new ThreeInstancedMesh(new BoxGeometry(width, 0.6, depth + 0.2), new MeshBasicMaterial(), desks.length);
		const o = new Object3D();
		desks.forEach((d, i) => {
			const [x, y, z] = deskPoint(d, 0, 0, height + 0.25);
			o.position.set(x, y, z);
			o.rotation.set(0, d.yaw, 0);
			o.updateMatrix();
			mesh.setMatrixAt(i, o.matrix);
		});
		mesh.instanceMatrix.needsUpdate = true;
		mesh.visible = false;
		mesh.name = 'pick';
		return mesh;
	});
	$effect(() => {
		pickMesh = pickVolume;
	});

	const { width, depth, height } = CHAMBER.desk;
	const tex = chamberTextures();
	// Gooseneck: rises from the worktop, then bends back towards the Member.
	const gooseneck = new TubeGeometry(
		new CatmullRomCurve3([new Vector3(0, 0, 0), new Vector3(0, 0.2, 0), new Vector3(0, 0.29, 0.05), new Vector3(0, 0.33, 0.13)]),
		12,
		0.007,
		6,
		false
	);
	const seatByDesk = $derived(new Map(seats.map((s) => [s.desk.id, s])));
	const deskByMember = $derived(new Map(seats.map((s) => [s.member.id, s.desk.id])));
	// Each desk is its own wedge with a board joint to its neighbour, as in the scan; merged per row.
	const DESK_GAP = 0.03;
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
	// All chamber places, including Y Llywydd's place at the dais.
	const places = $derived([...desks, llywyddDesk()]);
	const llywydd = $derived(places.find((d) => d.row < 0) ?? null);

	const behind = (d: Desk, dz: number, y: number) => deskPoint(d, 0, dz, y);
	const beside = (d: Desk, dx: number, dz: number, y: number) => deskPoint(d, dx, dz, y);
	const monitorTilt = -0.2;

	// Floor light: the live desk's worktop warms, its screen lights, a pool glows on the carpet
	// behind its chair. The party tab is party colour, always (T-25). Per-instance colour, eased.
	let screenMesh = $state<ThreeInstancedMesh>();
	let pool = $state<Mesh>();
	let halo = $state<Mesh>();
	let beam = $state<Mesh>();
	const lit = new Map<string, Eased>();
	const eased = (map: Map<string, Eased>, id: string) => {
		let e = map.get(id);
		if (!e) map.set(id, (e = new Eased()));
		return e;
	};
	const colour = new Color();
	const voteColour = new Color();
	const liveId = $derived(liveDeskId(floor, deskByMember, presiding));
	const liveDesk = $derived(liveId ? (places.find((d) => d.id === liveId) ?? null) : null);
	const poolLit = new Eased();
	let poolDeskId: string | null = null;

	useTask((dt) => {
		const ms = reducedMotion ? 0 : FLOOR_LIGHT_MS;
		for (const d of places) eased(lit, d.id).set(d.id === liveId ? 1 : 0);
		if (hitMesh) {
			const tint = floor.divisionTint;
			places.forEach((d, i) => {
				const e = eased(lit, d.id);
				e.step(dt, ms);
				const c = mixInto(colour, FLOOR_LIGHT.worktop, FLOOR_LIGHT.worktopLit, e.value);
				// A division overrides the floor light: the worktop carries the Member's own vote.
				const vote = deskTint(tint, seatByDesk.get(d.id)?.member.id ?? null);
				if (vote) c.lerp(voteColour.set(vote.tone), vote.mix);
				hitMesh!.setColorAt(i, c);
			});
			if (hitMesh.instanceColor) hitMesh.instanceColor.needsUpdate = true;
		}
		if (screenMesh) {
			desks.forEach((d, i) => {
				screenMesh!.setColorAt(i, mixInto(colour, FLOOR_LIGHT.screen, FLOOR_LIGHT.screenLit, eased(lit, d.id).value));
			});
			if (screenMesh.instanceColor) screenMesh.instanceColor.needsUpdate = true;
		}
		if (pool) {
			if (liveDesk && liveDesk.id !== poolDeskId) {
				poolDeskId = liveDesk.id;
				const [x, y, z] = behind(liveDesk, liveDesk.row < 0 ? -0.9 : 0.9, 0.015);
				pool.position.set(x, y, z);
				if (halo) halo.position.set(x, y + 0.002, z);
				if (beam) beam.position.set(x, y + 3.2, z);
			}
			poolLit.set(liveDesk ? 1 : 0);
			poolLit.step(dt, ms);
			const active = poolLit.value > 0;
			pool.visible = active;
			(pool.material as { opacity: number }).opacity = 0.65 * poolLit.value;

			if (halo) {
				halo.visible = active;
				const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.004);
				(halo.material as { opacity: number }).opacity = (0.2 + 0.25 * pulse) * poolLit.value;
			}
			if (beam) {
				beam.visible = active;
				(beam.material as { opacity: number }).opacity = 0.22 * poolLit.value;
			}
		}
	});
</script>

<!-- Curved oak desk units, one wedge per Member, merged per row; rows alternate the board
     set so the grain reads per wedge rather than as one wrapped texture. -->
{#each rows as { row, y, geometry } (row)}
	<T.Mesh {geometry} position.y={y} castShadow receiveShadow>
		<T.MeshStandardMaterial map={row % 2 ? tex.joineryB : tex.joineryA} roughness={0.5} side={DoubleSide} />
	</T.Mesh>
{/each}

<!-- Pick volume: the whole desk unit from lip to monitor top, never drawn. instanceId → desks[i]. -->
<T is={pickVolume} />

<!-- Charcoal worktop inset, one instance per seated place in `seats` order. -->
<InstancedMesh bind:ref={hitMesh} limit={places.length} range={places.length} name="desks" update={false}>
	<T.BoxGeometry args={[width - 0.22, 0.014, depth - 0.3]} />
	<T.MeshStandardMaterial color="#ffffff" roughness={0.6} />
	{#each places as d (d.id)}
		<Instance position={behind(d, d.row < 0 ? 0 : 0.04, (d.row < 0 ? 1.0 : height) + 0.007)} rotation.y={d.yaw} />
	{/each}
</InstancedMesh>

<!-- Pop-up monitor: dark bezel to the Member, brushed silver back to the chamber. -->
<InstancedMesh limit={desks.length} range={desks.length} castShadow>
	<T.BoxGeometry args={[0.44, 0.27, 0.02]} />
	<T.MeshStandardMaterial color={CHAMBER_TONES.bezel} roughness={0.45} metalness={0.2} />
	{#each desks as d (d.id)}
		<Instance position={behind(d, -0.28, height + 0.145)} rotation.order="YXZ" rotation.y={d.yaw} rotation.x={monitorTilt} />
	{/each}
</InstancedMesh>
<InstancedMesh limit={desks.length} range={desks.length}>
	<T.BoxGeometry args={[0.44, 0.27, 0.004]} />
	<T.MeshStandardMaterial color={CHAMBER_TONES.monitor} roughness={0.3} metalness={0.5} />
	{#each desks as d (d.id)}
		<Instance position={behind(d, -0.292, height + 0.145)} rotation.order="YXZ" rotation.y={d.yaw} rotation.x={monitorTilt} />
	{/each}
</InstancedMesh>
<InstancedMesh bind:ref={screenMesh} limit={desks.length} range={desks.length} name="screens" update={false}>
	<T.BoxGeometry args={[0.4, 0.225, 0.004]} />
	<T.MeshStandardMaterial color="#ffffff" roughness={0.15} metalness={0.1} />
	{#each desks as d (d.id)}
		<Instance position={behind(d, -0.268, height + 0.15)} rotation.order="YXZ" rotation.y={d.yaw} rotation.x={monitorTilt} />
	{/each}
</InstancedMesh>
<!-- Party tab on the front lip, read from behind the Member's shoulder; party colour, never warmed. -->
<InstancedMesh limit={desks.length} range={desks.length} name="tabs" update={false}>
	<T.BoxGeometry args={[0.34, 0.02, 0.07]} />
	<T.MeshStandardMaterial roughness={0.3} />
	{#each desks as d (d.id)}
		{@const seat = seatByDesk.get(d.id)}
		<Instance position={behind(d, -depth / 2 + 0.06, height + 0.01)} rotation.y={d.yaw} color={seat ? partyHex(seat.member.party_id) : ESTATE.border} />
	{/each}
</InstancedMesh>

<!-- One soft pool of light on the carpet behind the live Member's chair; moved, never duplicated. -->
<T.Mesh bind:ref={pool} rotation.x={-Math.PI / 2} visible={false} renderOrder={1}>
	<T.CircleGeometry args={[1.1, 40]} />
	<T.MeshBasicMaterial color={FLOOR_LIGHT.pool} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} />
</T.Mesh>
<!-- Outer radiant halo on the carpet -->
<T.Mesh bind:ref={halo} rotation.x={-Math.PI / 2} visible={false} renderOrder={1}>
	<T.RingGeometry args={[1.15, 1.8, 48]} />
	<T.MeshBasicMaterial color="#ffc466" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} />
</T.Mesh>
<!-- Vertical architectural downlight column from the ceiling down to the speaker -->
<T.Mesh bind:ref={beam} visible={false} renderOrder={1}>
	<T.CylinderGeometry args={[0.35, 1.4, 6.4, 32, 1, true]} />
	<T.MeshBasicMaterial color="#ffe699" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} />
</T.Mesh>

<!-- Microphone on a bent gooseneck, its head turned towards the Member. -->
<InstancedMesh limit={desks.length} range={desks.length} geometry={gooseneck}>
	<T.MeshStandardMaterial color="#2b2f33" roughness={0.35} metalness={0.7} />
	{#each desks as d (d.id)}
		<Instance position={beside(d, 0.3, 0.0, height + 0.01)} rotation.y={d.yaw} />
	{/each}
</InstancedMesh>
<InstancedMesh limit={desks.length} range={desks.length}>
	<T.CylinderGeometry args={[0.014, 0.02, 0.05, 10]} />
	<T.MeshStandardMaterial color="#111417" roughness={0.6} />
	{#each desks as d (d.id)}
		<Instance position={beside(d, 0.3, 0.16, height + 0.35)} rotation.order="YXZ" rotation.y={d.yaw} rotation.x={1.1} />
	{/each}
</InstancedMesh>
<InstancedMesh limit={desks.length} range={desks.length}>
	<T.CylinderGeometry args={[0.03, 0.035, 0.012, 12]} />
	<T.MeshStandardMaterial color="#1c1f23" roughness={0.5} metalness={0.4} />
	{#each desks as d (d.id)}
		<Instance position={beside(d, 0.3, 0.0, height + 0.006)} />
	{/each}
</InstancedMesh>

<!-- Task chairs in charcoal mesh, tucked in behind the desk: star base, gas stem, seat, mesh back, arms. -->
<InstancedMesh limit={desks.length} range={desks.length}>
	<T.CylinderGeometry args={[0.3, 0.32, 0.02, 20]} />
	<T.MeshStandardMaterial color="#3a3d41" roughness={0.4} metalness={0.5} />
	{#each desks as d (d.id)}
		<Instance position={behind(d, 0.78, 0.01)} />
	{/each}
</InstancedMesh>
<InstancedMesh limit={desks.length} range={desks.length}>
	<T.CylinderGeometry args={[0.03, 0.035, 0.4, 10]} />
	<T.MeshStandardMaterial color="#5c6166" roughness={0.35} metalness={0.7} />
	{#each desks as d (d.id)}
		<Instance position={behind(d, 0.78, 0.22)} />
	{/each}
</InstancedMesh>
<InstancedMesh limit={desks.length} range={desks.length} castShadow>
	<T.BoxGeometry args={[0.5, 0.07, 0.48]} />
	<T.MeshStandardMaterial map={tex.chairMesh} roughness={0.85} />
	{#each desks as d (d.id)}
		<Instance position={behind(d, 0.78, 0.46)} rotation.y={d.yaw} />
	{/each}
</InstancedMesh>
<InstancedMesh limit={desks.length} range={desks.length} castShadow>
	<T.BoxGeometry args={[0.48, 0.56, 0.05]} />
	<T.MeshStandardMaterial map={tex.chairMesh} roughness={0.85} />
	{#each desks as d (d.id)}
		<Instance position={behind(d, 0.99, 0.78)} rotation.order="YXZ" rotation.y={d.yaw} rotation.x={-0.12} />
	{/each}
</InstancedMesh>
{#each [-0.26, 0.26] as side (side)}
	<InstancedMesh limit={desks.length} range={desks.length}>
		<T.BoxGeometry args={[0.04, 0.02, 0.3]} />
		<T.MeshStandardMaterial color="#3a3d41" roughness={0.5} />
		{#each desks as d (d.id)}
			<Instance position={beside(d, side, 0.78, 0.68)} rotation.y={d.yaw} />
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
