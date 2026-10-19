/**
 * Recomputes a sitting's derived stats from its exported sitting file, by the same method as
 * `pipeline/export.py`. Nothing here ships to a page: it exists so a test can reconcile every
 * figure in `stats/sittings/{date}.json` against the record the site already serves.
 */
import type { Contribution, ItemStat, MemberStat, PartyStat, Sitting, StatTotals, UnattributedStat } from '$lib/data/types';

/** Half up to three decimals, matching `round3` in the exporter. */
export const round3 = (x: number) => Math.floor(x * 1000 + 0.5) / 1000;

export const isTimed = (c: Contribution) => c.t_start !== null && c.t_start >= 0;

export function secondsByContribution(contributions: Contribution[]): Map<string, number> {
	const timed = contributions.filter(isTimed);
	const starts = [...new Set(timed.map((c) => c.t_start as number))].sort((a, b) => a - b);
	const following = new Map(starts.slice(0, -1).map((t, i) => [t, starts[i + 1]]));
	const sharers = new Map<number, number>();
	for (const c of timed) sharers.set(c.t_start as number, (sharers.get(c.t_start as number) ?? 0) + 1);
	const out = new Map<string, number>();
	for (const c of timed) {
		const t = c.t_start as number;
		const end = following.get(t);
		out.set(c.id, end === undefined ? 0 : (end - t) / (sharers.get(t) as number));
	}
	return out;
}

interface Row {
	member_id: string | null;
	party_id: string | null;
	item_id: string;
	lang: string;
	seconds: number | null;
}

function rowsOf(sitting: Sitting): Row[] {
	const seconds = secondsByContribution(sitting.contributions);
	return sitting.contributions.map((c) => ({
		member_id: c.member_id,
		// Unattributed speech has no party; it is reported by unattributedOf(), never folded in.
		party_id: c.member_id ? (sitting.speakers[c.member_id]?.party_id ?? null) : null,
		item_id: c.item_id,
		lang: c.lang,
		seconds: seconds.has(c.id) ? (seconds.get(c.id) as number) : null
	}));
}

interface Bucket {
	seconds: number;
	contributions: number;
	untimed_contributions: number;
	members: Set<string>;
}

function tally<K>(rows: Row[], key: (r: Row) => K): Map<K, Bucket> {
	const out = new Map<K, Bucket>();
	for (const r of rows) {
		const k = key(r);
		const b = out.get(k) ?? { seconds: 0, contributions: 0, untimed_contributions: 0, members: new Set<string>() };
		b.contributions += 1;
		if (r.member_id) b.members.add(r.member_id);
		if (r.seconds === null) b.untimed_contributions += 1;
		else b.seconds += r.seconds;
		out.set(k, b);
	}
	return out;
}

/** The exporter's ordering: most seconds, then most contributions, then id. */
const byWeight = (a: { seconds: number; contributions: number }, b: typeof a, aid: string, bid: string) =>
	b.seconds - a.seconds || b.contributions - a.contributions || aid.localeCompare(bid);

export function totalsOf(sitting: Sitting): StatTotals {
	const rows = rowsOf(sitting);
	const welsh = rows.filter((r) => r.lang === 'cy').length;
	const untimed = rows.filter((r) => r.seconds === null).length;
	return {
		contributions: rows.length,
		timed_contributions: rows.length - untimed,
		untimed_contributions: untimed,
		speaking_seconds: round3(rows.reduce((s, r) => s + (r.seconds ?? 0), 0)),
		divisions: sitting.divisions.length,
		welsh_contributions: welsh,
		welsh_share: rows.length ? round3(welsh / rows.length) : 0,
		// Part of the totals above, and never part of a Member's or party's share.
		unattributed_contributions: unattributedOf(sitting).contributions,
		unattributed_seconds: unattributedOf(sitting).seconds
	};
}

/** Speech the Record attributed to no Member: reported, never folded into a party or a Member. */
export function unattributedOf(sitting: Sitting): UnattributedStat {
	const rows = rowsOf(sitting).filter((r) => r.member_id === null);
	return {
		contributions: rows.length,
		seconds: round3(rows.reduce((s, r) => s + (r.seconds ?? 0), 0)),
		untimed_contributions: rows.filter((r) => r.seconds === null).length
	};
}

export function membersOf(sitting: Sitting): MemberStat[] {
	const rows = rowsOf(sitting);
	const out: MemberStat[] = [];
	for (const [member_id, b] of tally(rows, (r) => r.member_id)) {
		if (member_id === null) continue; // reported by unattributedOf(), not as a Member
		out.push({
			member_id,
			canonical_name: sitting.speakers[member_id]?.canonical_name ?? member_id,
			party_id: rows.find((r) => r.member_id === member_id)?.party_id ?? null,
			seconds: round3(b.seconds),
			contributions: b.contributions,
			untimed_contributions: b.untimed_contributions
		});
	}
	return out.sort((a, b) => byWeight(a, b, a.member_id, b.member_id));
}

export function partiesOf(sitting: Sitting): PartyStat[] {
	const out: PartyStat[] = [];
	const attributed = rowsOf(sitting).filter((r) => r.member_id !== null);
	for (const [party_id, b] of tally(attributed, (r) => r.party_id)) {
		out.push({
			party_id,
			seconds: round3(b.seconds),
			contributions: b.contributions,
			untimed_contributions: b.untimed_contributions,
			members: b.members.size
		});
	}
	return out.sort((a, b) => byWeight(a, b, a.party_id ?? '', b.party_id ?? ''));
}

export function itemsOf(sitting: Sitting): ItemStat[] {
	const buckets = tally(rowsOf(sitting), (r) => r.item_id);
	return [...sitting.items]
		.sort((a, b) => a.order - b.order)
		.map((i) => {
			const b = buckets.get(i.id);
			return {
				item_id: i.id,
				order: i.order,
				title_en: i.title_en,
				title_cy: i.title_cy,
				type: i.type,
				policy_domain_id: i.policy_domain_id,
				seconds: round3(b?.seconds ?? 0),
				contributions: b?.contributions ?? 0,
				untimed_contributions: b?.untimed_contributions ?? 0
			};
		});
}
