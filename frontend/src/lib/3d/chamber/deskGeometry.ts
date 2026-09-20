import { BufferGeometry, LatheGeometry, Shape, ShapeGeometry, Vector2 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CHAMBER } from './layout';

/**
 * Cross-section of a Member desk in the (radius, height) plane, relative to the tier
 * radius: a solid timber front towards the centre, a worktop with a small lip and a
 * recessed base, as the continuous curved desks in the Siambr.
 */
export function deskProfile(radius: number, depth: number = CHAMBER.desk.depth, height: number = CHAMBER.desk.height): Vector2[] {
	const front = radius - depth / 2;
	const back = radius + depth / 2;
	const top = height;
	return [
		new Vector2(front + 0.05, 0),
		new Vector2(front + 0.05, 0.09),
		new Vector2(front, 0.12),
		new Vector2(front, top - 0.05),
		new Vector2(front - 0.03, top - 0.03),
		new Vector2(front - 0.03, top),
		new Vector2(back, top),
		new Vector2(back, top - 0.05),
		new Vector2(back - 0.04, top - 0.05),
		new Vector2(back - 0.04, 0.12),
		new Vector2(back - 0.09, 0.09),
		new Vector2(back - 0.09, 0),
		new Vector2(front + 0.05, 0)
	];
}

/** Lathe phi for a bearing: lathe points sit at (r sin φ, y, r cos φ), bearings at (r sin b, y, −r cos b). */
const phiOf = (bearing: number) => Math.PI - bearing;

/**
 * One continuous curved desk run between bearings `start` and `end` on a tier of
 * `radius`, swept around the chamber centre and capped at both ends. World space,
 * y from the tier floor.
 */
export function deskRunGeometry(
	radius: number,
	start: number,
	end: number,
	depth: number = CHAMBER.desk.depth,
	height: number = CHAMBER.desk.height
): BufferGeometry {
	const profile = deskProfile(radius, depth, height);
	const span = end - start;
	const segments = Math.max(4, Math.ceil((span * radius) / 0.25));
	const sweep = new LatheGeometry(profile, segments, phiOf(end), span);

	const shape = new Shape(profile);
	const caps = [start, end].map((bearing) => {
		const cap = new ShapeGeometry(shape);
		cap.rotateY(phiOf(bearing) - Math.PI / 2);
		return cap;
	});
	const merged = mergeGeometries([sweep, ...caps], false);
	sweep.dispose();
	caps.forEach((c) => c.dispose());
	merged.computeVertexNormals();
	return merged;
}
