import { describe, expect, it } from 'vitest';
import { buildDesks, CHAMBER, chamberColliders, spawnPoint, walkRadius } from '../chamber/layout';
import { Player, TELEPORT_MS } from './player.svelte';

const colliders = chamberColliders(buildDesks(96));
const make = () => new Player(colliders, walkRadius(0.28), spawnPoint());

describe('Player', () => {
	it('walks forward along the look direction', () => {
		// Spawn faces the well from the western aisle, so forward is +X.
		const p = make();
		const x0 = p.x;
		p.keydown('KeyW');
		for (let i = 0; i < 60; i++) p.step(1 / 60);
		expect(p.x).toBeGreaterThan(x0 + 0.5);
		expect(Math.abs(p.z)).toBeLessThan(1e-6);
	});

	it('ignores keys that are not bound', () => {
		const p = make();
		expect(p.keydown('KeyQ')).toBe(false);
		expect(p.keydown('ArrowUp')).toBe(true);
	});

	it('cannot leave the chamber through the wall', () => {
		const p = make();
		p.keydown('KeyS');
		p.keydown('ShiftLeft');
		for (let i = 0; i < 600; i++) p.step(1 / 60);
		expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(walkRadius(0.28) + 1e-6);
	});

	it('cannot walk through the dais', () => {
		const p = new Player(colliders, walkRadius(0.28), { x: 0, z: 6, yaw: 0 });
		p.keydown('KeyW');
		p.keydown('ShiftLeft');
		for (let i = 0; i < 900; i++) p.step(1 / 60);
		expect(p.z).toBeGreaterThan(-(CHAMBER.dais.radius - CHAMBER.dais.width / 2) + 0.2);
	});

	it('clamps pitch and wraps nothing on yaw', () => {
		const p = make();
		p.look(0, -100000);
		expect(p.pitch).toBeLessThan(Math.PI / 2);
		const yaw0 = p.yaw;
		p.look(500, 0);
		expect(p.yaw).toBeCloseTo(yaw0 - 500 * p.lookSpeed);
	});

	it('teleports only to clear floor and glides there', () => {
		const p = make();
		const desk = buildDesks(96)[10];
		expect(p.teleportTo({ x: desk.x, z: desk.z }, 0)).toBe(false);
		expect(p.teleportTo({ x: 0, z: 1 }, 0)).toBe(true);
		p.step(1 / 60, TELEPORT_MS / 2);
		expect(p.isGliding).toBe(true);
		p.step(1 / 60, TELEPORT_MS + 1);
		expect(p.isGliding).toBe(false);
		expect(p.x).toBeCloseTo(0);
		expect(p.z).toBeCloseTo(1);
	});

	it('eye height follows the ramp', () => {
		const p = make();
		const outer = p.step(1 / 60).y;
		p.teleportTo({ x: 0, z: 0.5 }, 0);
		let pose = p.step(1, TELEPORT_MS + 1);
		for (let i = 0; i < 120; i++) pose = p.step(1 / 60, TELEPORT_MS + 1);
		expect(pose.y).toBeCloseTo(p.eyeHeight, 2);
		expect(outer).toBeGreaterThan(p.eyeHeight);
	});
});
