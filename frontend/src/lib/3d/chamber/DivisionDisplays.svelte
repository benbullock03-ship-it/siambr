<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { CanvasTexture, SRGBColorSpace, type Texture } from 'three';
	import type { FloorState } from '$lib/stage/floor';
	import { clockDigits, wallDisplay } from './divisionLight';
	import { bearingToXZ, CHAMBER, CHAMBER_CLOCKS, CHAMBER_SCREENS, DEG } from './layout';

	let { floor, t }: { floor: FloorState; t: number } = $props();

	const wall = CHAMBER.wallRadius;
	const wallH = CHAMBER.wallHeight;
	const tint = $derived(floor.divisionTint);
	const running = $derived(floor.division);
	const display = $derived(tint ? wallDisplay(tint.beat.division) : null);
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

	const [screenCtx, screenTexture] = surface(1024, 576);
	const [clockCtx, clockTexture] = surface(480, 128);

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

	// Both surfaces are redrawn only when their content changes, not every frame.
	let drawnMotion: string | null = null;
	let drawnDigits: string | null = null;
	useTask(() => {
		if (display && display.motion + display.tally !== drawnMotion) {
			drawScreen(display);
			drawnMotion = display.motion + display.tally;
		}
		if (digits && digits !== drawnDigits) {
			drawClock(digits);
			drawnDigits = digits;
		}
	});

	const at = (radius: number, deg: number, y: number): [number, number, number] => {
		const [x, z] = bearingToXZ(radius, deg * DEG);
		return [x, y, z];
	};
	// A plane's +Z must point back into the chamber, the opposite way round from Envelope's
	// housing boxes, or the face is culled and the text reads mirrored.
	const facing = (deg: number) => -deg * DEG;
</script>

<!-- The motion and the publisher's own tally on the four wall screens, fading with the desk tints. -->
{#if display}
	{#each CHAMBER_SCREENS as deg (deg)}
		<T.Mesh position={at(wall - 0.175, deg, 2.75)} rotation.y={facing(deg)} renderOrder={1}>
			<T.PlaneGeometry args={[1.66, 0.91]} />
			<T.MeshBasicMaterial map={screenTexture} transparent opacity={tint?.strength ?? 1} />
		</T.Mesh>
	{/each}
{/if}

<!-- The two red clocks run only while the division is on the floor. -->
{#if digits}
	{#each CHAMBER_CLOCKS as deg (deg)}
		<T.Mesh position={at(wall - 0.17, deg, wallH - 0.75)} rotation.y={facing(deg)} renderOrder={1}>
			<T.PlaneGeometry args={[0.56, 0.15]} />
			<T.MeshBasicMaterial map={clockTexture} />
		</T.Mesh>
	{/each}
{/if}
