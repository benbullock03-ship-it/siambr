import { describe, expect, it } from 'vitest';
import type { VoteCast } from '$lib/data/types';
import { division, sitting, speech, item } from '$lib/stage/fixtures';
import { divisionTint } from '$lib/stage/floor';
import { buildTimeline, DIVISION_BEAT_SECONDS } from '$lib/stage/timeline';
import { CHAMBER_TONES } from '../materials';
import { DIVISION_TONES, lightness, relativeLuminance } from '$lib/stage/voteTones';
import { clockDigits, deskTint, voteTone, wallDisplay } from './divisionLight';

const VOTES: VoteCast[] = ['for', 'against', 'abstain', 'did_not_vote'];

describe('voteTone', () => {
	it('is total over vote_cast: a tone for the three recorded positions, none for did_not_vote', () => {
		expect(VOTES.map(voteTone)).toEqual([DIVISION_TONES.for, DIVISION_TONES.against, DIVISION_TONES.abstain, null]);
	});

	it('leaves a Member with no row in the division untinted', () => {
		expect(voteTone(undefined)).toBeNull();
	});
});

/**
 * Viénot, Brettel & Mollon (1999) deuteranope simulation, then CIE Lab distance: the three
 * tones must stay apart for a viewer who cannot separate red from green.
 */
function deuteranope(hex: string): [number, number, number] {
	const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
	const n = parseInt(hex.slice(1), 16);
	const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLinear(v / 255));
	const L = 17.8824 * r + 43.5161 * g + 4.11935 * b;
	const M = 0.494207 * L + 1.24827 * (0.0299566 * r + 0.184309 * g + 1.46709 * b);
	const S = 0.0299566 * r + 0.184309 * g + 1.46709 * b;
	const out: [number, number, number] = [
		0.080944 * L - 0.130504 * M + 0.116721 * S,
		-0.0102485 * L + 0.0540194 * M - 0.113615 * S,
		-0.000365294 * L - 0.00412163 * M + 0.693513 * S
	];
	return out.map((v) => Math.min(1, Math.max(0, v))) as [number, number, number];
}

function lab([r, g, b]: [number, number, number]): [number, number, number] {
	const x = 0.4124 * r + 0.3576 * g + 0.1805 * b;
	const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	const z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
	const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
	const [fx, fy, fz] = [f(x / 0.95047), f(y), f(z / 1.08883)];
	return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const distance = (a: string, b: string) => {
	const [p, q] = [lab(deuteranope(a)), lab(deuteranope(b))];
	return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};

describe('division tones', () => {
	it('keeps the three apart under deuteranopia', () => {
		const tones = Object.values(DIVISION_TONES);
		for (let i = 0; i < tones.length; i++) {
			for (let j = i + 1; j < tones.length; j++) expect(distance(tones[i], tones[j])).toBeGreaterThan(25);
		}
	});

	it('reads as a pair: For and Against at least 30 L* apart, both lighter than the worktop', () => {
		expect(Math.abs(lightness(DIVISION_TONES.for) - lightness(DIVISION_TONES.against))).toBeGreaterThanOrEqual(30);
		expect(Math.abs(relativeLuminance(DIVISION_TONES.for) - relativeLuminance(DIVISION_TONES.against))).toBeGreaterThanOrEqual(0.3);
		const worktop = relativeLuminance(CHAMBER_TONES.worktop);
		expect(relativeLuminance(DIVISION_TONES.for)).toBeGreaterThan(worktop * 2);
		expect(relativeLuminance(DIVISION_TONES.against)).toBeGreaterThan(worktop * 2);
	});

	it('is not a party palette', async () => {
		const { PARTY_HEX } = await import('../materials');
		expect(Object.values(PARTY_HEX)).not.toContain(DIVISION_TONES.for);
		expect(Object.values(PARTY_HEX)).not.toContain(DIVISION_TONES.against);
		expect(Object.values(PARTY_HEX)).not.toContain(DIVISION_TONES.abstain);
	});
});

const timeline = () =>
	buildTimeline(sitting({ items: [item('A', 0, 2)], contributions: [speech('a0', 'A', 0, 10), speech('a1', 'A', 1, 40)], divisions: [division('dA', 'A')] }));

describe('deskTint', () => {
	it('tints a voting Member and leaves a Member with no row untinted', () => {
		const tint = { beat: timeline().beats.find((b) => b.kind === 'division')!, strength: 1 };
		expect(deskTint(tint, 'ms-a0')).toEqual({ tone: DIVISION_TONES.for, mix: expect.any(Number) });
		expect(deskTint(tint, 'ms-a1')).toBeNull();
		expect(deskTint(tint, null)).toBeNull();
		expect(deskTint(null, 'ms-a0')).toBeNull();
	});

	it('carries the fade strength into the mix', () => {
		const built = timeline();
		const beat = built.beats.find((b) => b.kind === 'division')!;
		const full = deskTint({ beat, strength: 1 }, 'ms-a0')!;
		const half = deskTint({ beat, strength: 0.5 }, 'ms-a0')!;
		expect(half.mix).toBeCloseTo(full.mix / 2);
	});

	it('is null once the fade is spent', () => {
		const built = timeline();
		const beat = built.beats.find((b) => b.kind === 'division')!;
		expect(divisionTint(built, beat.tEnd + 6.1)).toBeNull();
	});
});

describe('clockDigits', () => {
	it('counts the beat down and never runs past its ends', () => {
		const beat = { t: 100, tEnd: 100 + DIVISION_BEAT_SECONDS };
		expect(clockDigits(beat, 100)).toBe('00:20');
		expect(clockDigits(beat, 110)).toBe('00:10');
		expect(clockDigits(beat, 90)).toBe('00:20');
		expect(clockDigits(beat, 500)).toBe('00:00');
	});
});

describe('wallDisplay', () => {
	it('reads the publisher’s own figures and wording', () => {
		const d = { ...division('d', 'A'), votes_for: 29, votes_against: 27, votes_abstain: 1, result: 'negatived' as const };
		expect(wallDisplay(d)).toEqual({ motion: 'Fixture motion', tally: 'For 29 · Against 27 · Abstain 1', result: 'Negatived' });
	});
});
