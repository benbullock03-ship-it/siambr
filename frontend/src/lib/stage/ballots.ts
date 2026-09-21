/**
 * A Member's ballot history, grouped for reading: sitting day, then the debate each vote
 * decided, then one row per division in Record order. Pure TypeScript; nothing is rewritten,
 * the rows only point at the publisher's own records. Every grouping is PROVENANCE_DERIVED.
 */
import { PROVENANCE_DERIVED } from '$lib/data/types';
import type { MemberBallot, ProvenanceDerived, VoteCast } from '$lib/data/types';
import { itemTitle, readMotion, targetLabel, type VoteTarget } from './votes';

export interface BallotRow {
	ballot: MemberBallot;
	target: VoteTarget;
	targetLabel: string;
	tabledBy: string | null;
}

export interface BallotDebate {
	/** Debate item id when the export matched one, else the Voting Time item the Record files it under. */
	itemId: string;
	/** The debate title when exported, else the topic read from the motion text. */
	title: string;
	/** True when `itemId` is the Voting Time item rather than the debate itself. */
	fallback: boolean;
	rows: BallotRow[];
}

export interface BallotDay {
	date: string;
	count: number;
	debates: BallotDebate[];
}

export interface BallotTally {
	for: number;
	against: number;
	abstain: number;
	did_not_vote: number;
	provenance: ProvenanceDerived;
}

/** Counts of the publisher's rows for this Member; a sum, never an estimate. */
export function tallyBallots(ballots: MemberBallot[]): BallotTally {
	const t: BallotTally = { for: 0, against: 0, abstain: 0, did_not_vote: 0, provenance: PROVENANCE_DERIVED };
	for (const b of ballots) t[b.vote_cast as VoteCast]++;
	return t;
}

/** Ballots by sitting day, newest first, each day's votes by debate in the order the export gives them. */
export function groupBallots(ballots: MemberBallot[]): BallotDay[] {
	const days = new Map<string, BallotDay>();
	for (const b of ballots) {
		let day = days.get(b.date);
		if (!day) days.set(b.date, (day = { date: b.date, count: 0, debates: [] }));
		day.count++;
		const reading = readMotion(b.motion_text);
		const fallback = !b.debate_item_id;
		const itemId = b.debate_item_id ?? b.item_id;
		const title = b.debate_item_title_en ? itemTitle(b.debate_item_title_en) : reading.topic;
		const key = fallback ? `${itemId}:${title}` : itemId;
		let debate = day.debates.find((d) => (d.fallback ? `${d.itemId}:${d.title}` : d.itemId) === key);
		if (!debate) day.debates.push((debate = { itemId, title, fallback, rows: [] }));
		debate.rows.push({ ballot: b, target: reading.target, targetLabel: targetLabel(reading.target), tabledBy: reading.tabledBy });
	}
	return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}
