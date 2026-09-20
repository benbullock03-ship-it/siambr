/**
 * Procedural plan of the Siambr debating chamber.
 *
 * Frame: metres, y up, origin at the centre of the chamber floor. Bearings are
 * clockwise from north, north being -Z. Y Llywydd's dais sits at bearing 0; Member desks fill the
 * amphitheatre arc that opens towards south.
 *
 * Source geometry: the 2026 Matterport dollhouse of the refit Siambr. An oak well
 * with Y Llywydd's desk at its edge; four desk rows wrapping almost the full circle,
 * the inner row broken around Y Llywydd; three oak radial aisles (a wide one
 * opposite Y Llywydd's left, two either side of the far end); carpet between rows.
 */

export const CHAMBER = {
	/** Inner radius of the desk-free central well. */
	wellRadius: 3.6,
	/** Radius of each desk tier, innermost first. Tier pitch leaves a 0.6 m walkway. */
	rowRadii: [4.9, 6.9, 8.9, 10.9],
	/** Floor rise per metre of radius beyond the well, replacing the removed steps with a ramp. */
	rampGradient: 0.07,
	/** Bearing span the outer rows occupy, leaving Y Llywydd's side open. */
	arcStartDeg: 20,
	arcEndDeg: 340,
	/** The inner row stops short of Y Llywydd's desk. */
	innerArcStartDeg: 50,
	innerArcEndDeg: 310,
	/** Radial aisles that cut the tiers, as bearings; the western one is the wide entrance aisle. */
	aisleBearingsDeg: [45, 135, 270],
	aisleWidth: 1.6,
	/** Centre-to-centre spacing of desks along a tier. */
	deskPitch: 1.38,
	desk: { width: 1.26, depth: 1.0, height: 0.74 },
	/** Radial extent of desk + chair that blocks walking, relative to the tier radius. */
	deskBlock: { inner: -0.55, outer: 0.85 },
	wallRadius: 12.6,
	wallHeight: 4.4,
	galleryFloorY: 4.6,
	galleryOuterRadius: 16.5,
	ceilingY: 9.6,
	funnelThroatRadius: 2.4,
	funnelThroatY: 6.0,
	dais: { bearingDeg: 0, radius: 4.6, width: 4.4, depth: 1.7, height: 0.15 },
	clerks: { radius: 2.4, width: 3.2, depth: 0.9, height: 0.12 }
} as const;

export const DEG = Math.PI / 180;

export interface Desk {
	id: string;
	row: number;
	/** Position along the tier from Y Llywydd's left (bearing 55°) to right (305°). */
	index: number;
	bearing: number;
	x: number;
	y: number;
	z: number;
	/** Object3D rotation.y that turns the desk's front (-Z) towards the centre. */
	yaw: number;
}

export function bearingToXZ(radius: number, bearing: number): [number, number] {
	return [radius * Math.sin(bearing), -radius * Math.cos(bearing)];
}

export function bearingOf(x: number, z: number): number {
	const b = Math.atan2(x, -z);
	return b < 0 ? b + Math.PI * 2 : b;
}

/** Chamber floor height at a given radius: flat well, then a shallow ramp out to the wall. */
export function floorHeightAt(radius: number): number {
	const beyond = Math.max(0, Math.min(radius, CHAMBER.wallRadius) - CHAMBER.wellRadius);
	return beyond * CHAMBER.rampGradient;
}

export interface ArcSegment {
	start: number;
	end: number;
}

/** Bearing span of a row: the inner row leaves room for Y Llywydd's desk. */
export function rowArc(row: number): ArcSegment {
	return row === 0
		? { start: CHAMBER.innerArcStartDeg * DEG, end: CHAMBER.innerArcEndDeg * DEG }
		: { start: CHAMBER.arcStartDeg * DEG, end: CHAMBER.arcEndDeg * DEG };
}

/** Bearing ranges of one tier between the aisles. */
export function tierSegments(radius: number, row = 1): ArcSegment[] {
	const halfAisle = CHAMBER.aisleWidth / 2 / radius;
	const arc = rowArc(row);
	const cuts = CHAMBER.aisleBearingsDeg.map((d) => d * DEG).filter((c) => c > arc.start && c < arc.end);
	const segments: ArcSegment[] = [];
	let cursor = arc.start;
	for (const cut of cuts) {
		segments.push({ start: cursor, end: cut - halfAisle });
		cursor = cut + halfAisle;
	}
	segments.push({ start: cursor, end: arc.end });
	return segments;
}

const segmentCapacity = (seg: ArcSegment, radius: number) =>
	Math.max(0, Math.floor(((seg.end - seg.start) * radius) / CHAMBER.deskPitch));

export const tierCapacity = (radius: number, row = 1) =>
	tierSegments(radius, row).reduce((n, seg) => n + segmentCapacity(seg, radius), 0);

/** Split `total` across buckets in proportion to their capacity, never exceeding any capacity. */
export function apportion(total: number, capacities: number[]): number[] {
	const capacity = capacities.reduce((a, b) => a + b, 0);
	if (total > capacity) throw new Error(`cannot seat ${total} in capacity ${capacity}`);
	const counts = capacities.map((c) => Math.floor((total * c) / capacity));
	let remaining = total - counts.reduce((a, b) => a + b, 0);
	for (let i = 0; remaining > 0; i = (i + 1) % counts.length) {
		if (counts[i] < capacities[i]) {
			counts[i] += 1;
			remaining -= 1;
		}
	}
	return counts;
}

/** Fewest inner tiers whose combined capacity seats `seatCount` Members. */
export function tiersFor(seatCount: number): number[] {
	const radii: number[] = [];
	let capacity = 0;
	for (const [row, r] of CHAMBER.rowRadii.entries()) {
		radii.push(r);
		capacity += tierCapacity(r, row);
		if (capacity >= seatCount) return radii;
	}
	throw new Error(`chamber holds ${capacity} desks, cannot seat ${seatCount}`);
}

export function buildDesks(seatCount: number): Desk[] {
	const radii = tiersFor(seatCount);
	const perTier = apportion(seatCount, radii.map((r, row) => tierCapacity(r, row)));
	const desks: Desk[] = [];
	radii.forEach((radius, row) => {
		const segments = tierSegments(radius, row);
		const perSegment = apportion(perTier[row], segments.map((s) => segmentCapacity(s, radius)));
		const pitch = CHAMBER.deskPitch / radius;
		let index = 0;
		segments.forEach((seg, s) => {
			const n = perSegment[s];
			const first = (seg.start + seg.end) / 2 - ((n - 1) * pitch) / 2;
			for (let i = 0; i < n; i++) {
				const bearing = first + i * pitch;
				const [x, z] = bearingToXZ(radius, bearing);
				desks.push({
					id: `r${row + 1}-s${index + 1}`,
					row,
					index,
					bearing,
					x,
					y: floorHeightAt(radius),
					z,
					yaw: Math.PI - bearing
				});
				index += 1;
			}
		});
	});
	return desks;
}

export interface DeskRun {
	row: number;
	radius: number;
	start: number;
	end: number;
	desks: Desk[];
}

/** Contiguous desks on one tier, as continuous curved runs from one aisle to the next. */
export function deskRuns(desks: Desk[]): DeskRun[] {
	const runs: DeskRun[] = [];
	for (const row of [...new Set(desks.map((d) => d.row))]) {
		const radius = CHAMBER.rowRadii[row];
		const half = CHAMBER.deskPitch / radius / 2;
		const inRow = desks.filter((d) => d.row === row).sort((a, b) => a.bearing - b.bearing);
		let run: DeskRun | null = null;
		for (const d of inRow) {
			if (run && d.bearing - half <= run.end + 1e-6) {
				run.end = d.bearing + half;
				run.desks.push(d);
			} else {
				run = { row, radius, start: d.bearing - half, end: d.bearing + half, desks: [d] };
				runs.push(run);
			}
		}
	}
	return runs;
}

export type Collider =
	| { kind: 'circle'; x: number; z: number; radius: number }
	| { kind: 'arc'; inner: number; outer: number; start: number; end: number };

/** Oak doorways cut in the chamber wall: bearing and clear width. The western one is the entrance. */
export const CHAMBER_DOORS = [
	{ deg: 45, width: 2.0 },
	{ deg: 135, width: 2.0 },
	{ deg: 270, width: 2.6 }
] as const;

/** Wall screens and the two red division clocks, as bearings clear of the doorways. */
export const CHAMBER_SCREENS = [75, 150, 225, 300] as const;
export const CHAMBER_CLOCKS = [20, 340] as const;

export interface Opening {
	deg: number;
	width: number;
}

/** Split a circle at the given openings, returning the closed bearing ranges (radians) between them. */
export function wallSegments(radius: number, openings: readonly Opening[]): { start: number; end: number }[] {
	const cuts = openings
		.map((o) => ({ centre: o.deg * DEG, half: o.width / 2 / radius }))
		.sort((a, b) => a.centre - b.centre);
	if (!cuts.length) return [{ start: 0, end: Math.PI * 2 }];
	const segments: { start: number; end: number }[] = [];
	for (let i = 0; i < cuts.length; i++) {
		const from = cuts[i].centre + cuts[i].half;
		const next = cuts[(i + 1) % cuts.length];
		const to = i + 1 < cuts.length ? next.centre - next.half : next.centre - next.half + Math.PI * 2;
		// Arc colliders test normalised bearings, so a range crossing north is split at it.
		if (to > Math.PI * 2) {
			segments.push({ start: from, end: Math.PI * 2 }, { start: 0, end: to - Math.PI * 2 });
		} else {
			segments.push({ start: from, end: to });
		}
	}
	return segments;
}

/** Bearing ranges of the chamber wall between its doorways. */
export const chamberWallSegments = () => wallSegments(CHAMBER.wallRadius, CHAMBER_DOORS);

export function isInOpening(deg: number, openings: readonly Opening[], radius: number, margin = 0): boolean {
	return openings.some((o) => {
		const half = (o.width / 2 + margin) / radius;
		const diff = Math.abs((((deg - o.deg) % 360) + 540) % 360 - 180);
		return diff * DEG < half;
	});
}

/** Everything a walker must not pass through, excluding the outer wall (see `walkRadius`). */
export function chamberColliders(desks: Desk[]): Collider[] {
	const colliders: Collider[] = [];
	const rows = [...new Set(desks.map((d) => d.row))];
	for (const row of rows) {
		const radius = CHAMBER.rowRadii[row];
		const half = CHAMBER.deskPitch / radius / 2;
		const inRow = desks.filter((d) => d.row === row).sort((a, b) => a.bearing - b.bearing);
		const band = { inner: radius + CHAMBER.deskBlock.inner, outer: radius + CHAMBER.deskBlock.outer };
		// Merge adjacent desks into one arc so the walker slides along a tier instead of snagging.
		let start = inRow[0].bearing - half;
		let end = inRow[0].bearing + half;
		for (const d of inRow.slice(1)) {
			if (d.bearing - half <= end + 1e-6) {
				end = d.bearing + half;
			} else {
				colliders.push({ kind: 'arc', ...band, start, end });
				start = d.bearing - half;
				end = d.bearing + half;
			}
		}
		colliders.push({ kind: 'arc', ...band, start, end });
	}
	const daisBearing = CHAMBER.dais.bearingDeg * DEG;
	const [dx, dz] = bearingToXZ(CHAMBER.dais.radius, daisBearing);
	colliders.push({ kind: 'circle', x: dx, z: dz, radius: CHAMBER.dais.width / 2 });
	const [cx, cz] = bearingToXZ(CHAMBER.clerks.radius, daisBearing);
	colliders.push({ kind: 'circle', x: cx, z: cz, radius: CHAMBER.clerks.width / 2 });
	return colliders;
}

/** Furthest a walker's centre may be from the origin. */
export const walkRadius = (bodyRadius: number) => CHAMBER.wallRadius - 0.3 - bodyRadius;

/** Where a visitor first stands: the wide western aisle by the wall, facing the well. */
export const SPAWN_BEARING_DEG = 270;
export function spawnPoint(): { x: number; z: number; yaw: number } {
	const bearing = SPAWN_BEARING_DEG * DEG;
	const [x, z] = bearingToXZ(CHAMBER.wallRadius - 1.2, bearing);
	return { x, z, yaw: Math.PI - bearing };
}

/** World point `dz` metres along a desk's local +Z (away from the centre), `dx` along local +X, `y` above the desk floor. */
export function deskPoint(d: Desk, dx: number, dz: number, y: number): [number, number, number] {
	return [d.x + dz * Math.sin(d.yaw) + dx * Math.cos(d.yaw), d.y + y, d.z + dz * Math.cos(d.yaw) - dx * Math.sin(d.yaw)];
}

export type Vec3 = [number, number, number];

export interface CameraPose {
	position: Vec3;
	target: Vec3;
}

export type VantageId = 'gallery' | 'llywydd' | 'floor' | 'speaker';

const vantageAt = (radius: number, deg: number, y: number, target: Vec3): CameraPose => {
	const [x, z] = bearingToXZ(radius, deg * DEG);
	return { position: [x, y, z], target };
};

/**
 * The guided camera's fixed vantage points. Gallery: above the public gallery on the south side,
 * looking at the dais. Y Llywydd: over the Presiding Officer's shoulder across the chamber.
 * Floor: eye height in the wide western aisle. Speaker is computed per desk by `speakerPose`.
 */
export const VANTAGES: Record<Exclude<VantageId, 'speaker'>, CameraPose> = {
	gallery: vantageAt(12.0, 180, CHAMBER.galleryFloorY + 0.5, [0, 0.5, -2.5]),
	llywydd: vantageAt(CHAMBER.dais.radius + 0.9, 0, CHAMBER.dais.height + 2.2, [0, 0.9, 5]),
	floor: vantageAt(9.5, 270, floorHeightAt(9.5) + 1.62, [0, 1.0, -3])
};

/** Three-quarter framing of a desk over the Member's shoulder toward the dais (or, from the dais, across the chamber). */
export function speakerPose(d: Desk): CameraPose {
	// Outer-row desks sit close to the wall, so the over-the-shoulder point is pulled inside it.
	// A wall-side desk has little room behind it: the sideways step and the height scale with what is left.
	const behind = clampInsideEnvelope(deskPoint(d, 0, 2.4, 2.0));
	const reach = Math.hypot(behind[0] - d.x, behind[2] - d.z);
	const position = clampInsideEnvelope(deskPoint(d, -Math.min(1.2, 0.45 * reach), reach, Math.max(1.5, 0.8 + 0.5 * reach)));
	const ahead: Vec3 = d.row < 0 ? [0, 0, 5] : [0, 0, -CHAMBER.dais.radius];
	const target: Vec3 = [d.x + 0.2 * (ahead[0] - d.x), 0.95, d.z + 0.2 * (ahead[2] - d.z)];
	return { position, target };
}

/** Radius of the cedar bell at height y, above its throat; the camera stays outside it. */
export function bellRadiusAt(y: number): number {
	return CHAMBER.funnelThroatRadius + Math.max(0, y - CHAMBER.funnelThroatY) * 1.6;
}

export const CAMERA_LIMITS = { minY: 0.5, maxY: 8.0, clearance: 0.4 } as const;

/** Nearest point to `p` that keeps the camera inside the chamber: under the wall or over the gallery, above the floor, outside the bell. */
export function clampInsideEnvelope([x, y, z]: Vec3): Vec3 {
	const r0 = Math.hypot(x, z);
	let r = r0;
	const bearing = r > 1e-9 ? Math.atan2(x, -z) : 0;
	let cy = Math.min(CAMERA_LIMITS.maxY, Math.max(CAMERA_LIMITS.minY, y));
	cy = Math.max(cy, floorHeightAt(r) + CAMERA_LIMITS.clearance);
	const maxR = cy >= CHAMBER.galleryFloorY + 0.3 ? CHAMBER.galleryOuterRadius - 0.6 : CHAMBER.wallRadius - CAMERA_LIMITS.clearance;
	r = Math.min(r, maxR);
	if (cy > CHAMBER.funnelThroatY - 0.3) r = Math.max(r, bellRadiusAt(cy) + CAMERA_LIMITS.clearance);
	// An inside point comes back untouched so repeated clamps never drift.
	if (r === r0 && cy === y) return [x, y, z];
	const [cx, cz] = bearingToXZ(r, bearing);
	return [cx, cy, cz];
}

export function isInsideEnvelope(p: Vec3, tolerance = 1e-6): boolean {
	const c = clampInsideEnvelope(p);
	return Math.hypot(c[0] - p[0], c[1] - p[1], c[2] - p[2]) <= tolerance;
}

