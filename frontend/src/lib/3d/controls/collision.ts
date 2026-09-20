import { bearingOf, DEG, type Collider } from '../chamber/layout';

export interface Point2 {
	x: number;
	z: number;
}

const TAU = Math.PI * 2;

function inArc(bearing: number, start: number, end: number): boolean {
	const b = ((bearing % TAU) + TAU) % TAU;
	return b >= start && b <= end;
}

/** Push a disc of `radius` at `p` out of one collider. Returns the corrected point. */
export function pushOut(p: Point2, radius: number, c: Collider): Point2 {
	if (c.kind === 'circle') {
		const dx = p.x - c.x;
		const dz = p.z - c.z;
		const dist = Math.hypot(dx, dz);
		const min = c.radius + radius;
		if (dist >= min) return p;
		if (dist < 1e-6) return { x: c.x + min, z: c.z };
		const k = min / dist;
		return { x: c.x + dx * k, z: c.z + dz * k };
	}
	const r = Math.hypot(p.x, p.z);
	const bearing = bearingOf(p.x, p.z);
	// Arc ends are extended by the disc radius so a walker cannot clip a desk's corner.
	const pad = r > 1e-6 ? radius / r : 0;
	if (!inArc(bearing, c.start - pad, c.end + pad)) return p;
	const inner = c.inner - radius;
	const outer = c.outer + radius;
	if (r <= inner || r >= outer) return p;
	// Leave through the nearer radial face; the angular faces are covered by the pad above.
	const target = r - inner < outer - r ? inner : outer;
	const k = r > 1e-6 ? target / r : 1;
	return { x: p.x * k, z: p.z * k };
}

/** Keep a disc inside the chamber and out of all furniture. Two passes settle corner overlaps. */
export function resolveCollisions(
	p: Point2,
	radius: number,
	colliders: Collider[],
	walkRadius: number
): Point2 {
	let out = { x: p.x, z: p.z };
	for (let pass = 0; pass < 2; pass++) {
		for (const c of colliders) out = pushOut(out, radius, c);
		const r = Math.hypot(out.x, out.z);
		if (r > walkRadius) {
			const k = walkRadius / r;
			out = { x: out.x * k, z: out.z * k };
		}
	}
	return out;
}

/** True when a disc at `p` overlaps nothing, used to validate teleport targets. */
export function isClear(p: Point2, radius: number, colliders: Collider[], walkRadius: number): boolean {
	const settled = resolveCollisions(p, radius, colliders, walkRadius);
	return Math.hypot(settled.x - p.x, settled.z - p.z) < 1e-4;
}
