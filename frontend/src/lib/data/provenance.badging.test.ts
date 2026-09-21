import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

/**
 * T-24 provenance gate. Every route and component that renders a derived figure (seating, speaking
 * time, shares, t_end_derived, policy domain, division placement) must carry the PROVENANCE_DERIVED
 * constant or the ProvenanceStrip badge, found by walking the compiled Svelte AST rather than the text.
 */

const SRC = join(__dirname, '..', '..');

/** Source patterns that mean a file touches a derived figure. */
const TRIGGERS: Record<string, RegExp> = {
	seating: /chamber\/seating|\bSeat\b|\bseatFor\b|\bSEATING_/,
	'speaking time or share': /\.seconds\b|\bshare\(|speaking time|by_party|by_member/i,
	t_end_derived: /\bt_end_derived\b|\.tEnd\b/,
	'policy domain': /policy_domain|domain_id|\.domains\b|policyDomain/,
	'division placement': /kind === 'division'|DivisionBeat|divisionTint|\.placement\b|debateItemOf/
};

/** Identifiers and components that count as the badge. */
const BADGE_IDENTIFIERS = new Set(['PROVENANCE_DERIVED', 'SEATING_PROVENANCE', 'BADGE', 'DERIVED_NOTICE', 'SEATING_NOTICE']);
const BADGE_COMPONENTS = new Set(['ProvenanceStrip']);

/**
 * Files that touch a derived figure but carry no badge of their own. Each needs a reason.
 * The 3D chamber draws seats and tints from props typed with SEATING_PROVENANCE and the
 * division beat's placement; the badge a reader sees is ProvenanceStrip and the division legend
 * on the only route that mounts them, /sitting/[date], which this test also asserts.
 */
const EXEMPT: Record<string, string> = {
	'lib/3d/chamber/Desks.svelte': 'geometry: desk positions come from seating.ts (typed SEATING_PROVENANCE); the sitting route shows ProvenanceStrip',
	'lib/3d/chamber/DivisionDisplays.svelte': 'geometry: wall clocks read the division beat; the sitting route shows the badge and VoteLegend',
	'lib/3d/SiambrScene.svelte': 'scene graph: passes seats and floor state to the chamber; no figure rendered as text',
	'lib/3d/GuidedCamera.svelte': 'camera: frames a seat; renders nothing',
	'lib/3d/Walker.svelte': 'camera: walks the floor; renders nothing'
};

function svelteFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return svelteFiles(path);
		return entry.name.endsWith('.svelte') ? [path] : [];
	});
}

function walk(node: unknown, visit: (n: { type: string; name?: string }) => void): void {
	if (!node || typeof node !== 'object') return;
	if (Array.isArray(node)) {
		for (const child of node) walk(child, visit);
		return;
	}
	const n = node as { type?: string; name?: string } & Record<string, unknown>;
	if (typeof n.type === 'string') visit(n as { type: string; name?: string });
	for (const [key, value] of Object.entries(n)) {
		if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
		walk(value, visit);
	}
}

function carriesBadge(source: string): boolean {
	const ast = parse(source, { modern: true });
	let found = false;
	walk(ast, (n) => {
		if (n.type === 'Identifier' && n.name && BADGE_IDENTIFIERS.has(n.name)) found = true;
		if (n.type === 'Component' && n.name && BADGE_COMPONENTS.has(n.name)) found = true;
	});
	return found;
}

const files = svelteFiles(SRC).map((path) => ({
	rel: relative(SRC, path).replace(/\\/g, '/'),
	source: readFileSync(path, 'utf-8')
}));

describe('provenance badging on derived figures', () => {
	const derived = files.filter((f) => Object.values(TRIGGERS).some((re) => re.test(f.source)));

	it('finds the files that render derived figures', () => {
		expect(derived.map((f) => f.rel)).toEqual(expect.arrayContaining([
			'routes/sitting/[date]/+page.svelte',
			'routes/sitting/[date]/stats/+page.svelte',
			'routes/terms/[n]/stats/+page.svelte',
			'routes/register/+page.svelte',
			'lib/stage/ui/Transcript.svelte',
			'lib/stage/ui/ScrubBar.svelte',
			'lib/stats/PartyBars.svelte'
		]));
	});

	it.each(derived.map((f) => [f.rel, f] as const))('%s carries the badge or is exempt with a reason', (rel, file) => {
		const triggered = Object.entries(TRIGGERS).filter(([, re]) => re.test(file.source)).map(([name]) => name);
		if (rel in EXEMPT) {
			expect(EXEMPT[rel].length).toBeGreaterThan(10);
			return;
		}
		expect(carriesBadge(file.source), `${rel} renders ${triggered.join(', ')} without PROVENANCE_DERIVED or ProvenanceStrip`).toBe(true);
	});

	it('keeps the exempt list to files that still exist and still need it', () => {
		for (const rel of Object.keys(EXEMPT)) {
			const file = files.find((f) => f.rel === rel);
			expect(file, `${rel} is exempt but no longer exists`).toBeDefined();
			expect(Object.values(TRIGGERS).some((re) => re.test(file!.source)), `${rel} is exempt but renders nothing derived`).toBe(true);
		}
	});

	it('the sitting route shows the seating notice for the chamber it mounts', () => {
		const sitting = files.find((f) => f.rel === 'routes/sitting/[date]/+page.svelte')!;
		let strip = false;
		walk(parse(sitting.source, { modern: true }), (n) => {
			if (n.type === 'Component' && n.name === 'ProvenanceStrip') strip = true;
		});
		expect(strip).toBe(true);
	});
});
