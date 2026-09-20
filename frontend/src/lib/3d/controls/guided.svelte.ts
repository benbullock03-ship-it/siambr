/**
 * Guided camera rig: four vantage points, desk framing, orbit and zoom within the chamber
 * envelope, eased moves (600 ms cubic; cuts under reduced motion). Pure TypeScript.
 */
import { clampInsideEnvelope, speakerPose, VANTAGES, type CameraPose, type Desk, type VantageId, type Vec3 } from '../chamber/layout';

export const MOVE_MS = 600;
export const ORBIT = {
	minPitch: -0.35,
	maxPitch: 1.25,
	minDistance: 1.5,
	maxDistance: 20,
	yawPerPixel: 0.004,
	pitchPerPixel: 0.003
} as const;

const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
const lerp3 = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const clampPose = (pose: CameraPose): CameraPose => ({ position: clampInsideEnvelope(pose.position), target: pose.target });

/** Spherical offset of the camera about its target: yaw around +Y, pitch above the horizon. */
export function sphericalOf(pose: CameraPose): { yaw: number; pitch: number; distance: number } {
	const dx = pose.position[0] - pose.target[0];
	const dy = pose.position[1] - pose.target[1];
	const dz = pose.position[2] - pose.target[2];
	const flat = Math.hypot(dx, dz);
	return { yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, flat), distance: Math.hypot(dx, dy, dz) };
}

export function poseFromSpherical(target: Vec3, yaw: number, pitch: number, distance: number): CameraPose {
	const flat = Math.cos(pitch) * distance;
	return {
		target,
		position: [target[0] + Math.sin(yaw) * flat, target[1] + Math.sin(pitch) * distance, target[2] + Math.cos(yaw) * flat]
	};
}

export class GuidedRig {
	vantage = $state<VantageId | 'desk'>('gallery');
	follow = $state(true);
	/** Desk the camera is framing, if any. */
	framedDeskId = $state<string | null>(null);
	reducedMotion = false;

	position: Vec3 = [...VANTAGES.gallery.position];
	target: Vec3 = [...VANTAGES.gallery.target];
	private from: CameraPose | null = null;
	private to: CameraPose = clampPose(VANTAGES.gallery);
	private started = 0;
	private duration = 0;

	get pose(): CameraPose {
		return { position: [...this.position], target: [...this.target] };
	}

	get moving(): boolean {
		return this.from !== null;
	}

	/** Ease to a pose over `ms` (a cut when zero or under reduced motion). */
	moveTo(pose: CameraPose, ms = MOVE_MS, now = performance.now()): void {
		this.to = clampPose(pose);
		if (ms <= 0 || this.reducedMotion) {
			this.from = null;
			this.position = [...this.to.position];
			this.target = [...this.to.target];
			return;
		}
		this.from = this.pose;
		this.started = now;
		this.duration = ms;
	}

	setVantage(id: Exclude<VantageId, 'speaker'>, ms = MOVE_MS, now = performance.now()): void {
		this.vantage = id;
		this.framedDeskId = null;
		this.moveTo(VANTAGES[id], ms, now);
	}

	/** Speaker view of a desk: three-quarter over the shoulder toward the dais. */
	frameDesk(desk: Desk, ms = MOVE_MS, now = performance.now()): void {
		this.vantage = 'desk';
		this.framedDeskId = desk.id;
		this.moveTo(speakerPose(desk), ms, now);
	}

	/** The Speaker vantage: frames `desk` when there is one, else falls back to the gallery. */
	speaker(desk: Desk | null, ms = MOVE_MS, now = performance.now()): void {
		if (desk) {
			this.frameDesk(desk, ms, now);
			this.vantage = 'speaker';
		} else {
			this.setVantage('gallery', ms, now);
		}
	}

	/** Drag: rotate the camera about its target, keeping it in the envelope. Cancels any move. */
	orbit(dxPixels: number, dyPixels: number): void {
		const s = sphericalOf({ position: this.position, target: this.target });
		const yaw = s.yaw - dxPixels * ORBIT.yawPerPixel;
		const pitch = Math.min(ORBIT.maxPitch, Math.max(ORBIT.minPitch, s.pitch + dyPixels * ORBIT.pitchPerPixel));
		this.settle(poseFromSpherical(this.target, yaw, pitch, s.distance));
	}

	/** Wheel or pinch: scale the distance to the target within limits. */
	zoom(factor: number): void {
		const s = sphericalOf({ position: this.position, target: this.target });
		const distance = Math.min(ORBIT.maxDistance, Math.max(ORBIT.minDistance, s.distance * factor));
		this.settle(poseFromSpherical(this.target, s.yaw, s.pitch, distance));
	}

	private settle(pose: CameraPose): void {
		this.from = null;
		this.to = clampPose(pose);
		this.position = [...this.to.position];
		this.target = [...this.to.target];
	}

	/** Advance an eased move. Returns true while the camera is still travelling. */
	update(now = performance.now()): boolean {
		if (!this.from) return false;
		const k = Math.min(1, (now - this.started) / this.duration);
		const e = easeOutCubic(k);
		this.position = clampInsideEnvelope(lerp3(this.from.position, this.to.position, e));
		this.target = lerp3(this.from.target, this.to.target, e);
		if (k >= 1) this.from = null;
		return this.from !== null;
	}
}
