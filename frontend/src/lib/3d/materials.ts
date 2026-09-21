import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

/** Senedd Estate tokens (DESIGN.md) as plain hex for the renderer. */
export const ESTATE = {
	ground: '#f7f6f2',
	panel: '#eceae3',
	ink: '#16191d',
	inkRoom: '#111417',
	border: '#d1cebe',
	cedar: '#c87d4a',
	cedarDark: '#915025',
	cedarLight: '#e6a87c',
	slate: '#3f474f',
	muted: '#65717c',
	plum: '#c9187e',
	sky: '#dfe5ea'
} as const;

/**
 * Render tones read off the 2026 Matterport scan of the Siambr rather than the UI tokens:
 * pale straw oak joinery and floor, honey cedar in the bell, charcoal acoustic panels.
 */
export const TIMBER = {
	cedar: '#d3b27c',
	cedarLight: '#efd9b0',
	cedarDark: '#b58b55',
	groove: '#5a3f26',
	oak: '#cfb27f',
	oakFloor: '#e0cfab',
	leather: '#33373c'
} as const;

export const CHAMBER_TONES = {
	acoustic: '#43474c',
	carpet: '#5c636c',
	galleryCarpet: '#3a3d42',
	worktop: '#3e444b',
	monitor: '#c9ccd0',
	bezel: '#26292d',
	ceiling: '#f0efeb',
	doorPanel: '#3b3f45',
	roundel: '#3a6a96',
	roundelLight: '#8fbbd6'
} as const;

/** Division tints live in $lib/stage/voteTones so the Register shares them without three.js. */
export { DIVISION_TONES } from '$lib/stage/voteTones';

export const SLATE = {
	riven: '#4c5359',
	honed: '#c4c6c3',
	joint: '#8d9297'
} as const;

export const PARTY_HEX: Record<string, string> = {
	labour: '#d93b3b',
	conservatives: '#3b7bd9',
	plaid_cymru: '#329966',
	libdems: '#e59e2b',
	reform_uk: '#12b6cf'
};

export const partyHex = (partyId: string | null) => (partyId && PARTY_HEX[partyId]) || '#7a828a';

/** Pixel size of every procedural texture; nothing exceeds 1024 on a side (T-23). */
export const TEXTURE_SIZES = {
	cedarSlats: 512,
	cedarBoard: 512,
	oakBoards: 512,
	acousticPanel: 256,
	cornicePool: 128,
	slateSlabs: 512,
	slateFace: 256,
	galleryCarpet: 256,
	meshWeave: 128,
	mosaicRoundel: 512
} as const;

export const TEXTURE_BUDGET_BYTES = 12 * 1024 * 1024;

/** Surfaces on the wall screens and clocks, counted in the budget: two DivisionDisplays canvases and the 360p Senedd TV frame. */
export const DISPLAY_SURFACES = { screen: [768, 432], clock: [480, 128], video: [640, 360] } as const;
export const displaySurfaceBytes = () =>
	Object.values(DISPLAY_SURFACES).reduce((n, [w, h]) => n + w * h * 4, 0);

/** Every texture the chamber creates, by cache key, with its uncompressed RGBA size. */
const registry = new Map<string, { texture: Texture; bytes: number }>();

export const textureBudgetBytes = () => [...registry.values()].reduce((n, r) => n + r.bytes, 0);
export const textureKeys = () => [...registry.keys()];

/** Build a texture once per distinct argument list; every consumer shares the instance. */
function memo(key: string, size: number, build: () => Texture): Texture {
	const hit = registry.get(key);
	if (hit) return hit.texture;
	const texture = build();
	registry.set(key, { texture, bytes: size * size * 4 });
	return texture;
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
	const c = document.createElement('canvas');
	c.width = size;
	c.height = size;
	const ctx = c.getContext('2d');
	if (!ctx) throw new Error('2D canvas unavailable for procedural textures');
	return [c, ctx];
}

function finish(c: HTMLCanvasElement, repeatX: number, repeatY: number): Texture {
	const tex = new CanvasTexture(c);
	tex.colorSpace = SRGBColorSpace;
	tex.wrapS = tex.wrapT = RepeatWrapping;
	tex.repeat.set(repeatX, repeatY);
	tex.anisotropy = 4;
	return tex;
}

/** Deterministic noise so textures are identical between reloads. */
function lcg(seed: number) {
	let s = seed >>> 0;
	return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
}

/** Western red cedar slats with shadow gaps between them, slats running along V. */
export function cedarSlats(repeatX = 1, repeatY = 1, slats = 24, base: string = TIMBER.cedar): Texture {
	const size = TEXTURE_SIZES.cedarSlats;
	return memo(`cedarSlats:${repeatX}:${repeatY}:${slats}:${base}`, size, () => {
		const [c, ctx] = canvas(size);
		const rnd = lcg(7);
		const w = size / slats;
		const gap = Math.max(2, w * 0.16);
		ctx.fillStyle = TIMBER.groove;
		ctx.fillRect(0, 0, size, size);
		for (let i = 0; i < slats; i++) {
			const x = i * w;
			ctx.fillStyle = shade(base, 0.9 + rnd() * 0.2);
			ctx.fillRect(x, 0, w - gap, size);
			// Finger-jointed lengths along the slat, as the boards in the bell.
			ctx.fillStyle = 'rgba(80, 55, 30, 0.3)';
			for (let y = rnd() * 200; y < size; y += 140 + rnd() * 260) ctx.fillRect(x, y, w - gap, 1);
			// A lit edge on one side and a shadowed edge into the gap on the other.
			ctx.fillStyle = 'rgba(255, 244, 222, 0.28)';
			ctx.fillRect(x, 0, Math.max(1, w * 0.08), size);
			ctx.fillStyle = 'rgba(40, 25, 10, 0.25)';
			ctx.fillRect(x + w - gap - Math.max(1, w * 0.08), 0, Math.max(1, w * 0.08), size);
		}
		grain(ctx, rnd, size, 0.06);
		return finish(c, repeatX, repeatY);
	});
}

/** Plain timber boards for joinery: long grain along V, board joints across U. */
export function cedarBoard(repeatX = 1, repeatY = 1, base: string = TIMBER.oak, seed = 19): Texture {
	const size = TEXTURE_SIZES.cedarBoard;
	return memo(`cedarBoard:${repeatX}:${repeatY}:${base}:${seed}`, size, () => {
		const [c, ctx] = canvas(size);
		const rnd = lcg(seed);
		ctx.fillStyle = base;
		ctx.fillRect(0, 0, size, size);
		// Boards ~110 mm wide on a 1 m tile, each with its own tone and a soft joint line.
		const boards = 9;
		const w = size / boards;
		for (let b = 0; b < boards; b++) {
			const tone = 0.9 + rnd() * 0.18;
			for (let x = 0; x < w; x += 2) {
				ctx.fillStyle = shade(base, tone * (0.96 + rnd() * 0.08));
				ctx.fillRect(b * w + x, 0, 3, size);
			}
			// Occasional darker streak, the medullary figure of quarter-sawn oak.
			if (rnd() > 0.5) {
				ctx.fillStyle = 'rgba(120, 85, 45, 0.18)';
				ctx.fillRect(b * w + rnd() * w, 0, 1 + rnd() * 2, size);
			}
			ctx.fillStyle = 'rgba(70, 50, 30, 0.35)';
			ctx.fillRect(b * w, 0, 1, size);
		}
		grain(ctx, rnd, size, 0.05);
		return finish(c, repeatX, repeatY);
	});
}

/** Oak floorboards with staggered end joints, boards running along V; one tile is ~2 m. */
export function oakBoards(repeatX = 1, repeatY = 1, boards = 14): Texture {
	const size = TEXTURE_SIZES.oakBoards;
	return memo(`oakBoards:${repeatX}:${repeatY}:${boards}`, size, () => {
		const [c, ctx] = canvas(size);
		const rnd = lcg(29);
		const w = size / boards;
		ctx.fillStyle = shade(TIMBER.oakFloor, 0.7);
		ctx.fillRect(0, 0, size, size);
		for (let i = 0; i < boards; i++) {
			let y = -rnd() * 400;
			while (y < size) {
				const len = 300 + rnd() * 500;
				ctx.fillStyle = shade(TIMBER.oakFloor, 0.9 + rnd() * 0.18);
				ctx.fillRect(i * w + 1, y + 1, w - 2, len - 2);
				// Fine longitudinal grain and the odd knot-dark streak.
				ctx.fillStyle = 'rgba(110, 80, 45, 0.12)';
				for (let k = 0; k < 6; k++) ctx.fillRect(i * w + 3 + rnd() * (w - 6), y + 4, 1, len - 8);
				y += len;
			}
		}
		grain(ctx, rnd, size, 0.04);
		return finish(c, repeatX, repeatY);
	});
}

/** Charcoal acoustic fabric between the oak pilasters of the chamber wall: a fine twill weave. */
export function acousticPanel(repeatX = 1, repeatY = 1): Texture {
	const size = TEXTURE_SIZES.acousticPanel;
	return memo(`acousticPanel:${repeatX}:${repeatY}`, size, () => {
		const [c, ctx] = canvas(size);
		const rnd = lcg(37);
		ctx.fillStyle = CHAMBER_TONES.acoustic;
		ctx.fillRect(0, 0, size, size);
		for (let y = 0; y < size; y += 2) {
			for (let x = 0; x < size; x += 2) {
				const diag = ((x + y) >> 1) % 4 === 0;
				ctx.fillStyle = diag ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
				ctx.fillRect(x, y, 1, 1);
			}
		}
		for (let i = 0; i < 3000; i++) {
			ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)';
			ctx.fillRect(rnd() * size, rnd() * size, 1, 1);
		}
		return finish(c, repeatX, repeatY);
	});
}

/** Warm pool that each cornice pendant throws down the wall; one tile per pendant, V is wall height. */
export function cornicePool(repeatX = 1): Texture {
	const size = TEXTURE_SIZES.cornicePool;
	return memo(`cornicePool:${repeatX}`, size, () => {
		const [c, ctx] = canvas(size);
		ctx.clearRect(0, 0, size, size);
		// A tight scallop under each pendant: gone by a third of the wall height.
		const g = ctx.createRadialGradient(size / 2, 0, 0, size / 2, 0, size * 0.42);
		g.addColorStop(0, 'rgba(255, 228, 190, 0.9)');
		g.addColorStop(0.3, 'rgba(255, 220, 175, 0.3)');
		g.addColorStop(1, 'rgba(255, 210, 160, 0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, size, size);
		const tex = finish(c, repeatX, 1);
		tex.wrapT = RepeatWrapping;
		return tex;
	});
}

/** Riven Welsh slate laid in staggered courses, as the Senedd's public floors. */
export function slateSlabs(base: string, repeatX = 1, repeatY = 1, courses = 6): Texture {
	const size = TEXTURE_SIZES.slateSlabs;
	return memo(`slateSlabs:${base}:${repeatX}:${repeatY}:${courses}`, size, () => {
		const [c, ctx] = canvas(size);
		const rnd = lcg(11);
		const h = size / courses;
		ctx.fillStyle = SLATE.joint;
		ctx.fillRect(0, 0, size, size);
		for (let j = 0; j < courses; j++) {
			let x = -h * (0.5 + rnd() * 1.5);
			while (x < size) {
				const len = h * (1.2 + rnd() * 1.2);
				ctx.fillStyle = shade(base, 0.95 + rnd() * 0.1);
				ctx.fillRect(x + 1.5, j * h + 1.5, len - 3, h - 3);
				ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
				for (let k = 0; k < 24; k++) ctx.fillRect(x + 2 + rnd() * (len - 8), j * h + 2 + rnd() * (h - 4), 6 + rnd() * 30, 1);
				x += len;
			}
		}
		return finish(c, repeatX, repeatY);
	});
}

/** Dark cut-pile carpet of the public gallery. */
export function galleryCarpet(repeatX = 1, repeatY = 1): Texture {
	const size = TEXTURE_SIZES.galleryCarpet;
	return memo(`galleryCarpet:${repeatX}:${repeatY}`, size, () => {
		const [c, ctx] = canvas(size);
		const rnd = lcg(41);
		ctx.fillStyle = CHAMBER_TONES.galleryCarpet;
		ctx.fillRect(0, 0, size, size);
		for (let i = 0; i < 9000; i++) {
			ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.1)';
			ctx.fillRect(rnd() * size, rnd() * size, 1, 1 + rnd());
		}
		return finish(c, repeatX, repeatY);
	});
}

/** Open mesh of the task-chair backs: a dark knit over a lighter frame. */
export function meshWeave(repeatX = 1, repeatY = 1): Texture {
	const size = TEXTURE_SIZES.meshWeave;
	return memo(`meshWeave:${repeatX}:${repeatY}`, size, () => {
		const [c, ctx] = canvas(size);
		ctx.fillStyle = TIMBER.leather;
		ctx.fillRect(0, 0, size, size);
		ctx.fillStyle = 'rgba(0,0,0,0.45)';
		for (let y = 0; y < size; y += 4) for (let x = 0; x < size; x += 4) ctx.fillRect(x + 1, y + 1, 2, 2);
		ctx.fillStyle = 'rgba(255,255,255,0.08)';
		for (let y = 0; y < size; y += 4) ctx.fillRect(0, y, size, 1);
		return finish(c, repeatX, repeatY);
	});
}

/** The roundel at the centre of the well: blue slate tesserae in rings, lighter towards the rim. */
export function mosaicRoundel(): Texture {
	const size = TEXTURE_SIZES.mosaicRoundel;
	return memo('mosaicRoundel', size, () => {
		const [c, ctx] = canvas(size);
		const rnd = lcg(53);
		const r = size / 2;
		ctx.fillStyle = CHAMBER_TONES.roundel;
		ctx.fillRect(0, 0, size, size);
		const rings = 18;
		for (let ring = 1; ring <= rings; ring++) {
			const radius = (ring / rings) * (r - 6);
			const n = Math.max(6, Math.round(ring * 7));
			const k = ring / rings;
			for (let i = 0; i < n; i++) {
				const a = (i / n) * Math.PI * 2 + ring * 0.13;
				const x = r + Math.cos(a) * radius;
				const y = r + Math.sin(a) * radius;
				ctx.fillStyle = mix(CHAMBER_TONES.roundelLight, CHAMBER_TONES.roundel, 0.25 + 0.55 * k + (rnd() - 0.5) * 0.2);
				ctx.beginPath();
				ctx.arc(x, y, 5.2 - k * 1.5, 0, Math.PI * 2);
				ctx.fill();
			}
		}
		return finish(c, 1, 1);
	});
}

function grain(ctx: CanvasRenderingContext2D, rnd: () => number, size: number, alpha: number) {
	ctx.globalAlpha = alpha;
	for (let y = 0; y < size; y += 3) {
		ctx.fillStyle = rnd() > 0.5 ? '#000' : '#fff';
		ctx.fillRect(0, y, size, 1);
	}
	ctx.globalAlpha = 1;
}

/** Welsh slate: near-black with cool flecks, used for desk fronts and the dais face. */
export function slateFace(repeatX = 1, repeatY = 1): Texture {
	const size = TEXTURE_SIZES.slateFace;
	return memo(`slateFace:${repeatX}:${repeatY}`, size, () => {
		const [c, ctx] = canvas(size);
		const rnd = lcg(23);
		ctx.fillStyle = SLATE.riven;
		ctx.fillRect(0, 0, size, size);
		for (let i = 0; i < 1400; i++) {
			ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.14)';
			ctx.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 3, 1);
		}
		return finish(c, repeatX, repeatY);
	});
}

function rgb(hex: string): [number, number, number] {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex: string, factor: number): string {
	const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
	const [r, g, b] = rgb(hex);
	return `rgb(${ch(r)}, ${ch(g)}, ${ch(b)})`;
}

function mix(a: string, b: string, k: number): string {
	const t = Math.max(0, Math.min(1, k));
	const [ar, ag, ab] = rgb(a);
	const [br, bg, bb] = rgb(b);
	return `rgb(${Math.round(ar + (br - ar) * t)}, ${Math.round(ag + (bg - ag) * t)}, ${Math.round(ab + (bb - ab) * t)})`;
}

/**
 * The full set the chamber draws with, built once and shared. Adding a texture here is what
 * puts it under the budget test.
 */
export function chamberTextures() {
	return {
		bellRibs: cedarSlats(5, 1, 32, TIMBER.cedar),
		bellThroat: cedarSlats(3, 3, 32, TIMBER.cedar),
		galleryFascia: cedarSlats(24, 1, 32, TIMBER.cedarDark),
		joineryA: cedarBoard(1, 1, TIMBER.oak, 19),
		joineryB: cedarBoard(1, 1, TIMBER.oak, 23),
		floorBoards: oakBoards(),
		wallFabric: acousticPanel(60, 6),
		cornicePools: cornicePool(40),
		galleryCarpet: galleryCarpet(10, 10),
		chairMesh: meshWeave(2, 3),
		roundel: mosaicRoundel()
	};
}
