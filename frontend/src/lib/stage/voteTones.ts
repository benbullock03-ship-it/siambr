/**
 * Division tones, one source of truth for the desks, the legend and every ballot chip.
 * Pure constants; no three.js, so the Register can import them.
 *
 * Deliberately not party colours and read as a pair (T-25): For is a teal at L* 47, Against
 * an amber at L* 78, a lightness gap of 30 on top of the hue split, and both sit well above
 * the charcoal worktop (L* 29) so a tinted desk reads from the Gallery. Abstain stays grey.
 * The ticket's first proposal (#1f8a8a / #d9822b) was only 10 L* apart and was not taken.
 * A Member who did not vote, or has no row, is untinted: the record says nothing, so
 * neither does the chamber.
 */
import type { VoteCast } from '$lib/data/types';

export const DIVISION_TONES = {
	for: '#1a7d7d',
	against: '#f5b445',
	abstain: '#a9adb2'
} as const;

export const VOTE_LABEL: Record<VoteCast, string> = {
	for: 'For',
	against: 'Against',
	abstain: 'Abstain',
	did_not_vote: 'Did not vote'
};

/** The tone a recorded position carries; null for did_not_vote and for a Member with no row. */
export function voteTone(vote: VoteCast | undefined): string | null {
	if (vote === 'for' || vote === 'against' || vote === 'abstain') return DIVISION_TONES[vote];
	return null;
}

/** WCAG relative luminance of a hex colour, 0 to 1. */
export function relativeLuminance(hex: string): number {
	const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
	const n = parseInt(hex.slice(1), 16);
	return 0.2126 * lin(((n >> 16) & 255) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255);
}

/** CIE L* lightness, 0 to 100. */
export const lightness = (hex: string) => 116 * Math.cbrt(relativeLuminance(hex)) - 16;
