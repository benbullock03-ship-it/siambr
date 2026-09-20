import { floorHeightAt, type Collider } from '../chamber/layout';
import { isClear, resolveCollisions, type Point2 } from './collision';

const KEY_BINDINGS: Record<string, 'forward' | 'back' | 'left' | 'right' | 'run'> = {
	KeyW: 'forward',
	ArrowUp: 'forward',
	KeyS: 'back',
	ArrowDown: 'back',
	KeyA: 'left',
	ArrowLeft: 'left',
	KeyD: 'right',
	ArrowRight: 'right',
	ShiftLeft: 'run',
	ShiftRight: 'run'
};

export const TELEPORT_MS = 420;
const MAX_PITCH = Math.PI / 2 - 0.05;

export interface Pose {
	x: number;
	y: number;
	z: number;
	yaw: number;
	pitch: number;
}

/** First-person walker: keyboard, pointer look, virtual joystick and tap-to-teleport, all collision-resolved. */
export class Player {
	x = $state(0);
	z = $state(0);
	yaw = $state(0);
	pitch = $state(0);
	/** Eye height above the local floor. */
	readonly eyeHeight = 1.62;
	readonly radius = 0.28;
	readonly walkSpeed = 2.3;
	readonly runSpeed = 4.0;
	readonly lookSpeed = 0.0022;

	private held = new Set<string>();
	/** Strafe (x) and forward (y) demand from a virtual joystick, each in -1..1. */
	joystick: Point2 & { y: number } = { x: 0, z: 0, y: 0 };
	private vx = 0;
	private vz = 0;
	private eyeY = this.eyeHeight;
	private glide: { from: Point2; to: Point2; started: number } | null = null;
	constructor(
		private colliders: Collider[],
		private walkRadius: number,
		spawn: { x: number; z: number; yaw: number }
	) {
		this.x = spawn.x;
		this.z = spawn.z;
		this.yaw = spawn.yaw;
		this.eyeY = floorHeightAt(Math.hypot(spawn.x, spawn.z)) + this.eyeHeight;
	}

	/** Stand at a point facing `yaw`, with no glide. */
	placeAt(target: Point2, yaw: number) {
		this.glide = null;
		this.x = target.x;
		this.z = target.z;
		this.yaw = yaw;
		this.vx = 0;
		this.vz = 0;
		this.eyeY = floorHeightAt(Math.hypot(target.x, target.z)) + this.eyeHeight;
	}

	keydown(code: string): boolean {
		if (!(code in KEY_BINDINGS)) return false;
		this.held.add(KEY_BINDINGS[code]);
		return true;
	}

	keyup(code: string) {
		if (code in KEY_BINDINGS) this.held.delete(KEY_BINDINGS[code]);
	}

	releaseKeys() {
		this.held.clear();
	}

	look(dxPixels: number, dyPixels: number) {
		this.yaw -= dxPixels * this.lookSpeed;
		this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch - dyPixels * this.lookSpeed));
	}

	/** Glide to a floor point if a walker can stand there. Returns whether the target was accepted. */
	teleportTo(target: Point2, now = performance.now()): boolean {
		if (!isClear(target, this.radius, this.colliders, this.walkRadius)) return false;
		this.glide = { from: { x: this.x, z: this.z }, to: target, started: now };
		return true;
	}

	get isGliding() {
		return this.glide !== null;
	}

	/** Advance by `dt` seconds and return the camera pose. */
	step(dt: number, now = performance.now()): Pose {
		if (this.glide) {
			const t = Math.min(1, (now - this.glide.started) / TELEPORT_MS);
			const ease = 1 - Math.pow(1 - t, 3);
			this.x = this.glide.from.x + (this.glide.to.x - this.glide.from.x) * ease;
			this.z = this.glide.from.z + (this.glide.to.z - this.glide.from.z) * ease;
			if (t >= 1) this.glide = null;
		} else {
			let forward = (this.held.has('forward') ? 1 : 0) - (this.held.has('back') ? 1 : 0) + this.joystick.y;
			let strafe = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0) + this.joystick.x;
			const mag = Math.hypot(forward, strafe);
			if (mag > 1) {
				forward /= mag;
				strafe /= mag;
			}
			const speed = this.held.has('run') ? this.runSpeed : this.walkSpeed;
			// Camera yaw 0 looks down -Z; right-hand vector is +X rotated with the yaw.
			const fx = -Math.sin(this.yaw);
			const fz = -Math.cos(this.yaw);
			const rx = Math.cos(this.yaw);
			const rz = -Math.sin(this.yaw);
			const targetVx = (fx * forward + rx * strafe) * speed;
			const targetVz = (fz * forward + rz * strafe) * speed;
			const accel = 1 - Math.exp(-dt * 12);
			this.vx += (targetVx - this.vx) * accel;
			this.vz += (targetVz - this.vz) * accel;
			const next = resolveCollisions(
				{ x: this.x + this.vx * dt, z: this.z + this.vz * dt },
				this.radius,
				this.colliders,
				this.walkRadius
			);
			this.x = next.x;
			this.z = next.z;
		}
		const floorY = floorHeightAt(Math.hypot(this.x, this.z)) + this.eyeHeight;
		this.eyeY += (floorY - this.eyeY) * (1 - Math.exp(-dt * 10));
		return { x: this.x, y: this.eyeY, z: this.z, yaw: this.yaw, pitch: this.pitch };
	}
}
