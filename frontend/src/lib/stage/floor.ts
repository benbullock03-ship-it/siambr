/** What the chamber shows at sitting time t. DOMAIN_MODEL.md 3.3. Pure; no DOM, no three.js. */
import type { Beat, DivisionBeat, Timeline } from './timeline';
import { lastBeatStartingBy } from './timeline';

/** Desk tints hold through the division beat, then fade out over this many sitting seconds. */
export const DIVISION_FADE_SECONDS = 6;

export interface DivisionTint {
	beat: DivisionBeat;
	/** 1 through the beat, easing to 0 across the fade that follows it. */
	strength: number;
}

export interface FloorState {
	live: Beat | null;
	/** Members with a contribution beat starting before t. */
	spokenMemberIds: Set<string>;
	division: DivisionBeat | null;
	/** The division the desks are showing: the live one, or the last one still fading. */
	divisionTint: DivisionTint | null;
}

interface SpokenIndex {
	/** Beat index at which each Member first speaks, ascending. */
	firstSpeak: { memberId: string; beatIndex: number }[];
	cachedCount: number;
	cached: Set<string>;
}

const spokenIndexes = new WeakMap<Timeline, SpokenIndex>();
const divisionIndexes = new WeakMap<Timeline, DivisionBeat[]>();

function divisionBeats(timeline: Timeline): DivisionBeat[] {
	let beats = divisionIndexes.get(timeline);
	if (!beats) divisionIndexes.set(timeline, (beats = timeline.beats.filter((b): b is DivisionBeat => b.kind === 'division')));
	return beats;
}

function spokenIndex(timeline: Timeline): SpokenIndex {
	let index = spokenIndexes.get(timeline);
	if (index) return index;
	const seen = new Set<string>();
	const firstSpeak: SpokenIndex['firstSpeak'] = [];
	for (const beat of timeline.beats) {
		if (beat.kind !== 'contribution') continue;
		const memberId = beat.contribution.member_id;
		if (!memberId || seen.has(memberId)) continue;
		seen.add(memberId);
		firstSpeak.push({ memberId, beatIndex: beat.index });
	}
	index = { firstSpeak, cachedCount: 0, cached: new Set() };
	spokenIndexes.set(timeline, index);
	return index;
}

/** The beat holding the floor at t, or null outside every beat. O(log n). */
export function liveBeat(timeline: Timeline, t: number): Beat | null {
	const { beats } = timeline;
	let i = lastBeatStartingBy(timeline, t);
	// A zero-length beat shares its start with the beat after it; step back over it only
	// when nothing later covers t.
	while (i >= 0 && beats[i].tEnd <= t && beats[i].t === t) i--;
	if (i < 0) return null;
	return t < beats[i].tEnd ? beats[i] : null;
}

/** Members whose first contribution beat starts strictly before t. O(log n) amortised. */
export function spokenMemberIds(timeline: Timeline, t: number): Set<string> {
	const index = spokenIndex(timeline);
	const lastStarted = lastBeatStartingBy(timeline, t, true);
	let lo = 0;
	let hi = index.firstSpeak.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (index.firstSpeak[mid].beatIndex <= lastStarted) lo = mid + 1;
		else hi = mid;
	}
	if (lo !== index.cachedCount) {
		index.cached = new Set(index.firstSpeak.slice(0, lo).map((f) => f.memberId));
		index.cachedCount = lo;
	}
	return index.cached;
}

/**
 * The division whose tint the desks carry at t: the beat itself at full strength, then the
 * fade after it. Null before the first division and more than the fade past the last one.
 * O(log n).
 */
export function divisionTint(timeline: Timeline, t: number): DivisionTint | null {
	const beats = divisionBeats(timeline);
	let lo = 0;
	let hi = beats.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (beats[mid].t <= t) lo = mid + 1;
		else hi = mid;
	}
	const beat = beats[lo - 1];
	if (!beat) return null;
	if (t < beat.tEnd) return { beat, strength: 1 };
	const over = t - beat.tEnd;
	return over < DIVISION_FADE_SECONDS ? { beat, strength: 1 - over / DIVISION_FADE_SECONDS } : null;
}

export function floorState(timeline: Timeline, t: number): FloorState {
	const live = liveBeat(timeline, t);
	return {
		live,
		spokenMemberIds: spokenMemberIds(timeline, t),
		division: live?.kind === 'division' ? live : null,
		divisionTint: divisionTint(timeline, t)
	};
}
