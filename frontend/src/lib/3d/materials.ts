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
 * Render tones sampled from the 2026 Matterport scan of the Siambr rather than the UI
 * tokens: pale oak joinery and floor, honey cedar in the bell, charcoal acoustic panels.
 */
export const TIMBER = {
	cedar: '#d1b184',
	cedarLight: '#e6cfa6',
	cedarDark: '#a37c4d',
	groove: '#3b2b1c',
	oak: '#d8c3a0',
	oakFloor: '#dcc8a4',
	leather: '#2a2e33'
} as const;

export const CHAMBER_TONES = {
	acoustic: '#5b5e63',
	carpet: '#6a6f76',
	worktop: '#4a5058',
	monitor: '#b9bdc1',
	ceiling: '#f2f1ee'
} as const;

/**
 * Division tints for the desks: chamber tones, deliberately not party colours, chosen so the
 * three stay apart under deuteranopia as well as normal vision (see divisionLight.test.ts).
 */
export const DIVISION_TONES = {
	for: '#1c5f9c',
	against: '#e0912f',
	abstain: '#a9adb2'
} as const;

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

/** Western red cedar slats with dark shadow grooves, slats running along V. */
export function cedarSlats(repeatX = 1, repeatY = 1, slats = 24, base: string = TIMBER.cedar): Texture {
	const [c, ctx] = canvas(1024);
	const rnd = lcg(7);
	const w = 1024 / slats;
	for (let i = 0; i < slats; i++) {
		ctx.fillStyle = shade(base, 0.9 + rnd() * 0.2);
		ctx.fillRect(i * w, 0, w, 1024);
		// Random-length butt joints along the slat, as the boards in the bell.
		ctx.fillStyle = 'rgba(70, 45, 25, 0.35)';
		for (let y = rnd() * 300; y < 1024; y += 260 + rnd() * 500) ctx.fillRect(i * w, y, w, 1.5);
		ctx.fillStyle = TIMBER.groove;
		ctx.fillRect(i * w + w - Math.max(2, w * 0.14), 0, Math.max(2, w * 0.14), 1024);
		ctx.fillStyle = 'rgba(255, 240, 215, 0.22)';
		ctx.fillRect(i * w, 0, Math.max(1, w * 0.06), 1024);
	}
	grain(ctx, rnd, 1024, 0.07);
	return finish(c, repeatX, repeatY);
}

/** Plain timber boards for joinery: long grain along V, no grooves. */
export function cedarBoard(repeatX = 1, repeatY = 1, base: string = TIMBER.oak): Texture {
	const [c, ctx] = canvas(512);
	const rnd = lcg(19);
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, 512, 512);
	for (let x = 0; x < 512; x += 2) {
		ctx.fillStyle = shade(base, 0.92 + rnd() * 0.16);
		ctx.fillRect(x, 0, 2 + rnd() * 3, 512);
	}
	grain(ctx, rnd, 512, 0.05);
	return finish(c, repeatX, repeatY);
}

/** Oak floorboards with staggered end joints, boards running along V; one tile is ~2 m. */
export function oakBoards(repeatX = 1, repeatY = 1, boards = 14): Texture {
	const [c, ctx] = canvas(1024);
	const rnd = lcg(29);
	const w = 1024 / boards;
	for (let i = 0; i < boards; i++) {
		let y = -rnd() * 400;
		while (y < 1024) {
			const len = 300 + rnd() * 500;
			ctx.fillStyle = shade(TIMBER.oakFloor, 0.9 + rnd() * 0.18);
			ctx.fillRect(i * w + 1, y + 1, w - 2, len - 2);
			y += len;
		}
	}
	grain(ctx, rnd, 1024, 0.05);
	return finish(c, repeatX, repeatY);
}

/** Charcoal acoustic fabric between the oak pilasters of the chamber wall. */
export function acousticPanel(repeatX = 1, repeatY = 1): Texture {
	const [c, ctx] = canvas(256);
	const rnd = lcg(37);
	ctx.fillStyle = CHAMBER_TONES.acoustic;
	ctx.fillRect(0, 0, 256, 256);
	for (let i = 0; i < 6000; i++) {
		ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
		ctx.fillRect(rnd() * 256, rnd() * 256, 1, 1);
	}
	return finish(c, repeatX, repeatY);
}

/** Riven Welsh slate laid in staggered courses, as the Senedd's public floors. */
export function slateSlabs(base: string, repeatX = 1, repeatY = 1, courses = 6): Texture {
	const [c, ctx] = canvas(1024);
	const rnd = lcg(11);
	const h = 1024 / courses;
	ctx.fillStyle = SLATE.joint;
	ctx.fillRect(0, 0, 1024, 1024);
	for (let j = 0; j < courses; j++) {
		// Slabs butt end to end with a hairline joint; each course starts at a random offset.
		let x = -h * (0.5 + rnd() * 1.5);
		while (x < 1024) {
			const len = h * (1.2 + rnd() * 1.2);
			ctx.fillStyle = shade(base, 0.95 + rnd() * 0.1);
			ctx.fillRect(x + 1.5, j * h + 1.5, len - 3, h - 3);
			ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
			for (let k = 0; k < 24; k++) ctx.fillRect(x + 2 + rnd() * (len - 8), j * h + 2 + rnd() * (h - 4), 6 + rnd() * 30, 1);
			x += len;
		}
	}
	return finish(c, repeatX, repeatY);
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
	const [c, ctx] = canvas(256);
	const rnd = lcg(23);
	ctx.fillStyle = SLATE.riven;
	ctx.fillRect(0, 0, 256, 256);
	for (let i = 0; i < 1400; i++) {
		ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.14)';
		ctx.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 1);
	}
	return finish(c, repeatX, repeatY);
}

function shade(hex: string, factor: number): string {
	const n = parseInt(hex.slice(1), 16);
	const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
	const r = ch((n >> 16) & 255);
	const g = ch((n >> 8) & 255);
	const b = ch(n & 255);
	return `rgb(${r}, ${g}, ${b})`;
}
