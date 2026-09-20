<script lang="ts">
	let { onmove }: { onmove: (v: { x: number; y: number }) => void } = $props();

	const RADIUS = 44;
	let knob = $state({ x: 0, y: 0 });
	let pointerId: number | null = null;
	let origin = { x: 0, y: 0 };

	function down(e: PointerEvent) {
		pointerId = e.pointerId;
		origin = { x: e.clientX, y: e.clientY };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function move(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		let dx = e.clientX - origin.x;
		let dy = e.clientY - origin.y;
		const mag = Math.hypot(dx, dy);
		if (mag > RADIUS) {
			dx = (dx / mag) * RADIUS;
			dy = (dy / mag) * RADIUS;
		}
		knob = { x: dx, y: dy };
		onmove({ x: dx / RADIUS, y: -dy / RADIUS });
	}

	function up(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		pointerId = null;
		knob = { x: 0, y: 0 };
		onmove({ x: 0, y: 0 });
	}
</script>

<div
	class="pad"
	role="application"
	aria-label="Walking joystick. Drag to walk."
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
>
	<div class="knob" style:transform="translate({knob.x}px, {knob.y}px)"></div>
</div>

<style>
	.pad {
		position: absolute;
		left: 1.25rem;
		bottom: 1.5rem;
		width: 8.5rem;
		height: 8.5rem;
		border-radius: 50%;
		background: rgb(22 25 29 / 0.35);
		border: 1px solid rgb(247 246 242 / 0.45);
		touch-action: none;
		pointer-events: auto;
		display: grid;
		place-items: center;
	}

	.knob {
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 50%;
		background: var(--color-ground);
		border: 2px solid var(--color-timber-cedar);
	}
</style>
