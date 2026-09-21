/** How a division paints the desks and the wall displays. Pure; no DOM, no three.js. */
import type { Division } from '$lib/data/types';
import type { DivisionTint } from '$lib/stage/floor';
import { voteTone } from '$lib/stage/voteTones';

export { voteTone };

/** How far the worktop travels towards the vote tone at full strength: all the way (T-25). */
export const DIVISION_TINT_MIX = 1;

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
