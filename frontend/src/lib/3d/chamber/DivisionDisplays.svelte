<script lang="ts">
	import { useTask, useThrelte } from '@threlte/core';
	import { CanvasTexture, SRGBColorSpace, VideoTexture, type Mesh, type MeshBasicMaterial, type Texture } from 'three';
	import type { FloorState } from '$lib/stage/floor';
	import { DISPLAY_SURFACES } from '../materials';
	import { clockDigits, wallDisplay } from './divisionLight';
	import { CHAMBER_CLOCKS, CHAMBER_SCREENS } from './layout';

	let { floor, t, video = null }: { floor: FloorState; t: number; video?: Texture | null } = $props();

	const { scene, invalidate } = useThrelte();
	const tint = $derived(floor.divisionTint);
	const running = $derived(floor.division);
	// Keyed on the beat, not the tint: the tint is a new object every frame of its fade.
	const beat = $derived(tint?.beat ?? null);
	const display = $derived(beat ? wallDisplay(beat.division) : null);
	const digits = $derived(running ? clockDigits(running, t) : null);

	function surface(w: number, h: number): [CanvasRenderingContext2D, Texture] {
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('2D canvas unavailable for the division displays');
		const texture = new CanvasTexture(canvas);
		texture.colorSpace = SRGBColorSpace;
		return [ctx, texture];
	}

	const [screenCtx, screenTexture] = surface(...DISPLAY_SURFACES.screen);
	const [clockCtx, clockTexture] = surface(...DISPLAY_SURFACES.clock);
	// The screen is laid out on a 1024x576 grid whatever its surface size.
	screenCtx.scale(DISPLAY_SURFACES.screen[0] / 1024, DISPLAY_SURFACES.screen[1] / 576);

	/** Greedy wrap at the canvas's own metrics; the motion text is never shortened or edited. */
	function lines(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
		const out: string[] = [];
		let line = '';
		for (const word of text.split(/\s+/)) {
			const next = line ? `${line} ${word}` : word;
			if (line && ctx.measureText(next).width > width) {
				out.push(line);
				line = word;
			} else {
				line = next;
			}
		}
		if (line) out.push(line);
		return out.length > max ? [...out.slice(0, max - 1), `${out[max - 1]}…`] : out;
	}

	function drawScreen(d: NonNullable<typeof display>) {
		const ctx = screenCtx;
		ctx.fillStyle = '#0d0f12';
		ctx.fillRect(0, 0, 1024, 576);
		ctx.fillStyle = '#e8ecef';
		ctx.font = '600 34px sans-serif';
		ctx.fillText('DIVISION', 48, 76);
		ctx.font = '40px serif';
		lines(ctx, d.motion, 928, 6).forEach((line, i) => ctx.fillText(line, 48, 156 + i * 52));
		ctx.fillStyle = '#f7f6f2';
		ctx.font = '600 52px monospace';
		ctx.fillText(d.tally, 48, 496);
		ctx.font = '600 44px sans-serif';
		ctx.fillText(d.result, 48, 552);
		screenTexture.needsUpdate = true;
	}

	function drawClock(text: string) {
		const ctx = clockCtx;
		ctx.fillStyle = '#111417';
		ctx.fillRect(0, 0, 480, 128);
		ctx.fillStyle = '#ff2a1a';
		ctx.font = '600 96px monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(text, 240, 68);
		clockTexture.needsUpdate = true;
	}

	// The faces are Envelope's named meshes (`wall-screen-{deg}`, `division-clock-{deg}`); this
	// component only swaps their texture slot and opacity, never their geometry.
	const faces = new Map<string, MeshBasicMaterial>();
	function face(name: string): MeshBasicMaterial | null {
		const hit = faces.get(name);
		if (hit) return hit;
		const mesh = scene.getObjectByName(name) as Mesh | undefined;
		if (!mesh) return null;
		const material = mesh.material as MeshBasicMaterial;
		faces.set(name, material);
		return material;
	}
	/** True when the face changed and needs a frame. */
	function show(name: string, texture: Texture | null, opacity: number): boolean {
		const material = face(name);
		if (!material) return false;
		let changed = false;
		if (material.map !== texture) {
			changed = true;
			material.map = texture;
			material.color.set(texture ? '#ffffff' : '#0a0c0e');
			// Senedd TV frames go out unaltered: no tone mapping or fog on the video.
			material.toneMapped = material.fog = !(texture instanceof VideoTexture);
			material.needsUpdate = true;
		}
		const next = texture ? opacity : 1;
		if (material.opacity !== next) {
			material.opacity = next;
			changed = true;
		}
		return changed;
	}

	// Both surfaces are redrawn only when their content changes, not every frame.
	let drawnMotion: string | null = null;
	let drawnDigits: string | null = null;
	useTask(
		() => {
			let changed = false;
			if (display && display.motion + display.tally !== drawnMotion) {
				drawScreen(display);
				drawnMotion = display.motion + display.tally;
				changed = true;
			}
			if (digits && digits !== drawnDigits) {
				drawClock(digits);
				drawnDigits = digits;
				changed = true;
			}
			// A division tally takes the screens over the video.
			for (const deg of CHAMBER_SCREENS) changed = show(`wall-screen-${deg}`, display ? screenTexture : video, display ? (tint?.strength ?? 1) : 1) || changed;
			for (const deg of CHAMBER_CLOCKS) changed = show(`division-clock-${deg}`, digits ? clockTexture : null, 1) || changed;
			if (changed) invalidate();
		},
		{ autoInvalidate: false }
	);
</script>
