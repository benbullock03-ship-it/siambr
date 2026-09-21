/**
 * The sitting timeline: one sitting's contributions and divisions as ordered, non-overlapping
 * beats on the Senedd TV clip clock. Pure TypeScript; no DOM, no three.js.
 *
 * Every timed beat starts at Senedd's own startPos. Everything else here is derived:
 *  - a timed beat ends where the next timed contribution starts (t_end_derived);
 *  - contributions with a missing or negative startPos are untimed and play as fixed 4 s beats
 *    taken from the tail of the Record-preceding timed beat, so nothing is skipped;
 *  - two timed contributions sharing a startPos split the span to the next start equally;
 *  - a division is a 20 s beat after the contribution that calls it (votes.ts), else at the end
 *    of its item, taken from that timed beat; a run of divisions sharing one short gap splits
 *    it rather than overrun the next startPos.
 * Inserted beats never take more than half the gap to the next timed start, so the timed
 * contribution always holds the floor for at least half of its own span. After the last timed
 * contribution there is no next start: its beat is 4 s and any inserts follow at full length.
 */
import { PROVENANCE_DERIVED } from '$lib/data/types';
import type { Contribution, Division, ProvenanceDerived, Sitting } from '$lib/data/types';
import { matchDivisionCalls } from './votes';

export const FIXED_BEAT_SECONDS = 4;
export const DIVISION_BEAT_SECONDS = 20;

interface BeatBase {
	index: number;
	itemId: string;
	/** Start on the clip clock, seconds. Senedd's startPos for a timed contribution. */
	t: number;
	/** Exclusive end. Always derived. */
	tEnd: number;
}

export interface ContributionBeat extends BeatBase {
	kind: 'contribution';
	contribution: Contribution;
	timed: boolean;
}

export interface DivisionBeat extends BeatBase {
	kind: 'division';
	division: Division;
	/** The record gives the item, not the second. */
	placement: ProvenanceDerived;
	/** The contribution that calls this vote, when one names it. Derived. */
	calledBy: string | null;
}

export type Beat = ContributionBeat | DivisionBeat;

export interface ItemBoundary {
	id: string;
	order: number;
	title_en: string;
	title_cy: string;
	/** Start of the item's first beat; for an empty item, the previous item's end. */
	t: number;
	tEnd: number;
	firstTimedT: number | null;
	/** Index range [beatStart, beatEnd) containing every beat of the item. */
	beatStart: number;
	beatEnd: number;
	beatCount: number;
}

export interface Timeline {
	date: string;
	beats: Beat[];
	items: ItemBoundary[];
	firstTimedT: number | null;
	tEnd: number;
	beatIndexByContributionId: Map<string, number>;
	beatIndexByDivisionId: Map<string, number>;
	provenance: { tEnd: ProvenanceDerived; untimedBeats: ProvenanceDerived; divisionPlacement: ProvenanceDerived };
}

type Insert =
	| { kind: 'contribution'; contribution: Contribution; seconds: number }
	| { kind: 'division'; division: Division; seconds: number; calledBy: string | null };

interface Anchor {
	contribution: Contribution;
	recordIndex: number;
	inserts: Insert[];
}

export function isTimed(c: Contribution): boolean {
	return c.t_start !== null && c.t_start >= 0;
}

export function buildTimeline(sitting: Sitting): Timeline {
	const items = [...sitting.items].sort((a, b) => a.order - b.order);
	const orderOf = new Map(items.map((i) => [i.id, i.order]));
	const contributions = [...sitting.contributions].sort(
		(a, b) => (orderOf.get(a.item_id) ?? 0) - (orderOf.get(b.item_id) ?? 0) || a.seq - b.seq
	);
	const divisionsByItem = new Map<string, Division[]>();
	for (const d of [...sitting.divisions].sort((a, b) => a.id.localeCompare(b.id))) {
		divisionsByItem.set(d.item_id, [...(divisionsByItem.get(d.item_id) ?? []), d]);
	}

	const calls = matchDivisionCalls(sitting);
	const lead: Insert[] = [];
	const anchors: Anchor[] = [];
	const anchorByContributionId = new Map<string, Anchor>();
	let recordIndex = 0;
	const push = (insert: Insert) => (anchors.at(-1)?.inserts ?? lead).push(insert);
	for (const item of items) {
		for (const c of contributions) {
			if (c.item_id !== item.id) continue;
			if (isTimed(c)) {
				const anchor = { contribution: c, recordIndex: recordIndex++, inserts: [] };
				anchors.push(anchor);
				anchorByContributionId.set(c.id, anchor);
			} else push({ kind: 'contribution', contribution: c, seconds: FIXED_BEAT_SECONDS });
		}
		for (const division of divisionsByItem.get(item.id) ?? []) {
			const calledBy = calls.get(division.id) ?? null;
			const caller = calledBy ? anchorByContributionId.get(calledBy) : undefined;
			const insert: Insert = { kind: 'division', division, seconds: DIVISION_BEAT_SECONDS, calledBy };
			if (caller) caller.inserts.push(insert);
			else push(insert);
		}
	}
	anchors.sort((a, b) => a.contribution.t_start! - b.contribution.t_start! || a.recordIndex - b.recordIndex);

	const beats: Beat[] = [];
	const add = (beat: Omit<ContributionBeat, 'index'> | Omit<DivisionBeat, 'index'>) =>
		beats.push({ ...beat, index: beats.length } as Beat);
	const addInserts = (inserts: Insert[], from: number, to: number | null) => {
		const wanted = inserts.reduce((s, i) => s + i.seconds, 0);
		const scale = to === null || wanted === 0 ? 1 : Math.max(0, to - from) / wanted;
		let t = from;
		inserts.forEach((insert, k) => {
			const tEnd = to !== null && k === inserts.length - 1 ? to : t + insert.seconds * scale;
			if (insert.kind === 'contribution') {
				add({ kind: 'contribution', itemId: insert.contribution.item_id, t, tEnd, contribution: insert.contribution, timed: false });
			} else {
				add({ kind: 'division', itemId: insert.division.item_id, t, tEnd, division: insert.division, placement: PROVENANCE_DERIVED, calledBy: insert.calledBy });
			}
			t = tEnd;
		});
		return t;
	};

	const firstTimedT = anchors.length ? anchors[0].contribution.t_start! : null;
	if (lead.length) {
		const wanted = lead.reduce((s, i) => s + i.seconds, 0);
		addInserts(lead, 0, firstTimedT === null ? null : Math.min(wanted, firstTimedT));
	}

	for (let i = 0; i < anchors.length; ) {
		const start = anchors[i].contribution.t_start!;
		let j = i;
		while (j < anchors.length && anchors[j].contribution.t_start === start) j++;
		const isLastGroup = j === anchors.length;
		const groupEnd = isLastGroup ? start + FIXED_BEAT_SECONDS : anchors[j].contribution.t_start!;
		const share = (groupEnd - start) / (j - i);
		for (let k = i; k < j; k++) {
			const anchor = anchors[k];
			const a = start + (k - i) * share;
			const b = k === j - 1 ? groupEnd : a + share;
			const wanted = anchor.inserts.reduce((s, x) => s + x.seconds, 0);
			const last = k === anchors.length - 1;
			const reserved = last ? 0 : Math.min(wanted, (b - a) / 2);
			add({ kind: 'contribution', itemId: anchor.contribution.item_id, t: a, tEnd: b - reserved, contribution: anchor.contribution, timed: true });
			if (anchor.inserts.length) addInserts(anchor.inserts, b - reserved, last ? null : b);
		}
		i = j;
	}

	const beatIndexByContributionId = new Map<string, number>();
	const beatIndexByDivisionId = new Map<string, number>();
	for (const beat of beats) {
		if (beat.kind === 'contribution') beatIndexByContributionId.set(beat.contribution.id, beat.index);
		else beatIndexByDivisionId.set(beat.division.id, beat.index);
	}

	const boundaries: ItemBoundary[] = [];
	for (const item of items) {
		const own = beats.filter((b) => b.itemId === item.id);
		const prev = boundaries.at(-1);
		const timed = own.filter((b) => b.kind === 'contribution' && b.timed);
		boundaries.push({
			id: item.id,
			order: item.order,
			title_en: item.title_en,
			title_cy: item.title_cy,
			t: own.length ? Math.min(...own.map((b) => b.t)) : (prev?.tEnd ?? 0),
			tEnd: own.length ? Math.max(...own.map((b) => b.tEnd)) : (prev?.tEnd ?? 0),
			firstTimedT: timed.length ? Math.min(...timed.map((b) => b.t)) : null,
			beatStart: own.length ? own[0].index : (prev?.beatEnd ?? 0),
			beatEnd: own.length ? own[own.length - 1].index + 1 : (prev?.beatEnd ?? 0),
			beatCount: own.length
		});
	}

	return {
		date: sitting.date,
		beats,
		items: boundaries,
		firstTimedT,
		tEnd: beats.length ? beats[beats.length - 1].tEnd : 0,
		beatIndexByContributionId,
		beatIndexByDivisionId,
		provenance: { tEnd: PROVENANCE_DERIVED, untimedBeats: PROVENANCE_DERIVED, divisionPlacement: PROVENANCE_DERIVED }
	};
}

/** Index of the last beat whose start is <= t (or < t when strict), or -1. O(log n). */
export function lastBeatStartingBy(timeline: Timeline, t: number, strict = false): number {
	const { beats } = timeline;
	let lo = 0;
	let hi = beats.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		const before = strict ? beats[mid].t < t : beats[mid].t <= t;
		if (before) lo = mid + 1;
		else hi = mid;
	}
	return lo - 1;
}
