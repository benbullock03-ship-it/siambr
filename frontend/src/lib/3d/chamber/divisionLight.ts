/** How a division paints the desks and the wall displays. Pure; no DOM, no three.js. */
import type { Division, VoteCast } from '$lib/data/types';
import type { DivisionTint } from '$lib/stage/floor';
import { DIVISION_TONES } from '../materials';

/** How far the worktop travels towards the vote tone at full strength. */
export const DIVISION_TINT_MIX = 0.85;

/**
 * The tone a desk carries for a vote. `did_not_vote`, and a Member with no row in the
 * division, stay untinted: the record says nothing about them, so neither does the chamber.
 */
export function voteTone(vote: VoteCast | undefined): string | null {
	if (vote === 'for' || vote === 'against' || vote === 'abstain') return DIVISION_TONES[vote];
	return null;
}

/** The tint a seated Member's desk shows, 0 when they have no recorded vote. */
export function deskTint(tint: DivisionTint | null, memberId: string | null): { tone: string; mix: number } | null {
	if (!tint || !memberId) return null;
	const tone = voteTone(tint.beat.division.votes[memberId]);
	return tone ? { tone, mix: DIVISION_TINT_MIX * tint.strength } : null;
}

/** The division clocks run down the beat; 'MM:SS' on the wall, floored, never below zero. */
export function clockDigits(beat: { t: number; tEnd: number }, t: number): string {
	const left = Math.max(0, Math.ceil(beat.tEnd - Math.min(Math.max(t, beat.t), beat.tEnd)));
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(Math.floor(left / 60))}:${pad(left % 60)}`;
}

export interface WallDisplay {
	motion: string;
	tally: string;
	result: string;
}

/** What the four wall screens read during a division: the publisher's own words and figures. */
export function wallDisplay(division: Division): WallDisplay {
	return {
		motion: division.motion_text,
		tally: `For ${division.votes_for} · Against ${division.votes_against} · Abstain ${division.votes_abstain}`,
		result: division.result === 'agreed' ? 'Agreed' : 'Negatived'
	};
}
