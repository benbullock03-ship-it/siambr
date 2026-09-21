<script lang="ts">
	import { Canvas } from '@threlte/core/webgpu';
	import { untrack, type Snippet } from 'svelte';
	import { ACESFilmicToneMapping, PCFShadowMap } from 'three';
	import { WebGPURenderer } from 'three/webgpu';

	let {
		forceWebGL = false,
		onfailure,
		onready,
		children
	}: {
		forceWebGL?: boolean;
		onfailure: (error: unknown) => void;
		onready?: (backend: 'webgpu' | 'webgl2') => void;
		children: Snippet;
	} = $props();

	// Threlte awaits init() without a catch, so wrap it to route a failed context to the fallback
	// and to report which backend three actually brought up (WebGPU silently falls back to WebGL2).
	// Threlte calls this inside an effect: props are read untracked so a later change cannot
	// tear down the live context.
	function createRenderer(canvas: HTMLCanvasElement) {
		const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL: untrack(() => forceWebGL) });
		if (import.meta.env.DEV) {
			// Frames drawn, for the e2e idle gate: a paused, settled chamber draws none.
			const counter = ((window as unknown as { __siambr?: { frames: number } }).__siambr = { frames: 0 });
			const render = renderer.render.bind(renderer);
			renderer.render = (...args) => {
				counter.frames++;
				return render(...args);
			};
		}
		const init = renderer.init.bind(renderer);
		renderer.init = () =>
			init()
				.then(() => {
					const backend = renderer.backend as { isWebGPUBackend?: boolean };
					onready?.(backend.isWebGPUBackend ? 'webgpu' : 'webgl2');
					return renderer;
				})
				.catch((error: unknown) => {
					onfailure(error);
					return new Promise<never>(() => {});
				}) as ReturnType<typeof init>;
		return renderer;
	}
</script>

<Canvas {createRenderer} toneMapping={ACESFilmicToneMapping} shadows={PCFShadowMap} dpr={[1, 1.75]}>
	{@render children()}
</Canvas>
