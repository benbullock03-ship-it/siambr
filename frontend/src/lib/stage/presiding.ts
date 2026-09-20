import type { Contribution, Sitting, TermFile } from '$lib/data/types';
import type { Timeline } from './timeline';

export interface PresidingSpan {
	t: number;
	memberId: string;
}

const ADDRESSING_CHAIR_RE =
	/^\s*(?:diolch\s*,\s*)?(?:ddirprwy\s+lywydd|dirprwy\s+lywydd|lywydd|llywydd|presiding\s+officer|deputy\s+presiding\s+officer)\b/i;

/**
 * Returns true if a contribution by a Presiding Officer is made from the chair
 * rather than speaking as an ordinary backbench member to the chair.
 */
export function isChairingContribution(c: Contribution, presidingMemberIds: ReadonlySet<string>): boolean {
	if (!c.member_id || !presidingMemberIds.has(c.member_id)) return false;
	// When Huw Irranca-Davies addresses the Deputy Presiding Officer from the floor (e.g. 90-second statements),
	// he is speaking to the chair, not chairing the debate.
	if (c.member_id === 'ms-huw-irranca-davies') {
		const text = c.text_english || c.text_original || '';
		const orig = c.text_original || '';
		if (ADDRESSING_CHAIR_RE.test(text) || ADDRESSING_CHAIR_RE.test(orig)) {
			return false;
		}
	}
	return true;
}

/**
 * Builds chronological time spans of which Presiding Officer holds the chair.
 */
export function buildPresidingSpans(sitting: Sitting, term: TermFile, timeline?: Timeline): PresidingSpan[] {
	const poIds = new Set(term.presiding_officers.map((o) => o.member_id));
	if (poIds.size === 0) {
		const defaultPo = sitting.presiding_officer_id ?? 'ms-huw-irranca-davies';
		return [{ t: 0, memberId: defaultPo }];
	}

	// Determine who opens the session in the chair
	const firstPo =
		sitting.contributions.find((c) => isChairingContribution(c, poIds))?.member_id ??
		sitting.presiding_officer_id ??
		term.presiding_officers.find((o) => o.office === 'llywydd')?.member_id ??
		[...poIds][0];

	const spans: PresidingSpan[] = [{ t: 0, memberId: firstPo }];
	let currentPo = firstPo;

	if (timeline) {
		for (const beat of timeline.beats) {
			if (beat.kind === 'contribution' && isChairingContribution(beat.contribution, poIds)) {
				if (beat.contribution.member_id !== currentPo) {
					spans.push({ t: beat.t, memberId: beat.contribution.member_id });
					currentPo = beat.contribution.member_id;
				}
			}
		}
	} else {
		for (const c of sitting.contributions) {
			if (isChairingContribution(c, poIds) && c.member_id !== currentPo) {
				const t = c.t_start ?? (spans.length > 0 ? spans[spans.length - 1].t : 0);
				spans.push({ t, memberId: c.member_id });
				currentPo = c.member_id;
			}
		}
	}

	return spans;
}

/**
 * Binary searches presiding spans for the active Presiding Officer at time t.
 */
export function presidingAt(spans: PresidingSpan[], t: number): string | null {
	if (spans.length === 0) return null;
	let lo = 0;
	let hi = spans.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (spans[mid].t <= t) lo = mid + 1;
		else hi = mid;
	}
	const span = spans[lo - 1];
	return span ? span.memberId : spans[0].memberId;
}
