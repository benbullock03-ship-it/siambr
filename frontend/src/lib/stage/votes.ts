/**
 * Reading a division's place in the sitting. Pure TypeScript; no DOM.
 *
 * The Record files every division under Voting Time and describes it only in motion_text
 * ("Item 5. Reform UK Debate - grooming gangs. Amendment 1, tabled in the name of …").
 * Everything here is derived from that string and from Y Llywydd's verbatim calls
 * ("I call for a vote on amendment 1 …"), so every result carries PROVENANCE_DERIVED.
 * The text itself is never altered; only pointers between records are produced.
 */
import { PROVENANCE_DERIVED } from '$lib/data/types';
import type { Contribution, Division, MemberLight, ProvenanceDerived, Sitting, SittingItem, TabledText } from '$lib/data/types';

export type VoteTarget = { kind: 'motion' } | { kind: 'motion_as_amended' } | { kind: 'amendment'; number: number };

export interface MotionReading {
	/** The agenda number printed in the motion text ("Item 5."), or null. */
	itemNumber: number | null;
	/** The debate's title as the motion text gives it, without the item prefix or the question. */
	topic: string;
	target: VoteTarget;
	/** What the vote was on, as printed: "Amendment 1, tabled in the name of …". */
	question: string | null;
	tabledBy: string | null;
	provenance: ProvenanceDerived;
}

/** The agenda number printed at the head of an item title ("5. Reform UK Debate …"), else order + 1. */
export function itemNumber(item: Pick<SittingItem, 'order' | 'title_en'>): number {
	const m = item.title_en.match(/^\s*(\d+)\./);
	return m ? Number(m[1]) : item.order + 1;
}

/** An item title without its printed agenda number. */
export function itemTitle(title: string): string {
	return title.replace(/^\s*\d+\.\s*/, '');
}

export function targetOf(text: string): VoteTarget {
	const s = text.toLowerCase();
	// The Record is bilingual and occasionally prints the Welsh question in its English field
	// ("Cynnig wedi'i ddiwygio"), so both languages are read rather than one assumed.
	const amendment = s.match(/(?:amendment|gwelliant)\s+(\d+)/);
	if (amendment) return { kind: 'amendment', number: Number(amendment[1]) };
	if (/(?:as\s+amended|wedi['’]?i\s+ddiwygio)/.test(s)) return { kind: 'motion_as_amended' };
	return { kind: 'motion' };
}

export function targetLabel(target: VoteTarget): string {
	switch (target.kind) {
		case 'amendment':
			return `Amendment ${target.number}`;
		case 'motion_as_amended':
			return 'Motion as amended';
		default:
			return 'Motion';
	}
}

const sameTarget = (a: VoteTarget, b: VoteTarget) =>
	a.kind === b.kind && (a.kind !== 'amendment' || b.kind !== 'amendment' || a.number === b.number);

export function readMotion(motionText: string): MotionReading {
	const text = motionText.trim();
	const head = text.match(/^Item\s+(\d+)\.\s*(.*)$/is);
	const itemNo = head ? Number(head[1]) : null;
	const rest = (head ? head[2] : text).trim();
	// The question is the last sentence when the text has more than one: "…grooming gangs. Amendment 1, tabled …"
	const sentences = rest.split(/\.\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean);
	const hasQuestion = sentences.length > 1 && /amendment|motion|gwelliant|cynnig/i.test(sentences[sentences.length - 1]);
	const question = hasQuestion ? sentences[sentences.length - 1].replace(/\.$/, '') : null;
	const topic = (hasQuestion ? sentences.slice(0, -1).join('. ') : rest).replace(/\.$/, '');
	const tabled = question?.match(/(?:tabled\s+in\s+the\s+name\s+of|a\s+gyflwynwyd\s+yn\s+enw)\s+(.+)$/i);
	return {
		itemNumber: itemNo,
		topic,
		target: targetOf(question ?? ''),
		question,
		tabledBy: tabled ? tabled[1].trim().replace(/\.$/, '') : null,
		provenance: PROVENANCE_DERIVED
	};
}

/** The agenda item the division decided, by the number printed in its motion text; null when none matches. */
export function debateItemOf(division: Pick<Division, 'motion_text'>, items: SittingItem[]): SittingItem | null {
	const { itemNumber: n, topic } = readMotion(division.motion_text);
	if (n !== null) {
		const byNumber = items.find((i) => itemNumber(i) === n);
		if (byNumber) return byNumber;
	}
	const key = topic.toLowerCase().replace(/[^a-z0-9]/g, '');
	if (key.length < 8) return null;
	return items.find((i) => i.title_en.toLowerCase().replace(/[^a-z0-9]/g, '').includes(key)) ?? null;
}

const CALL = /\bvote\s+on\s+(?:the\s+)?(amendment\s+\d+|motion\s+as\s+amended|motion)\b/i;

/** The vote a contribution calls ("I call for a vote on amendment 1 …"), read from the English text; null when it calls none. */
export function calledTarget(c: Pick<Contribution, 'text_english'>): VoteTarget | null {
	const m = c.text_english.match(CALL);
	return m ? targetOf(m[1]) : null;
}

/**
 * Pairs each division with the contribution in its item that calls it. Y Llywydd calls the votes
 * of one debate in turn, then the next debate's, so calls are walked in Record order against
 * the divisions grouped by their printed item number, in agenda order. A division no call
 * names is absent from the map.
 */
export function matchDivisionCalls(sitting: Pick<Sitting, 'contributions' | 'divisions'>): Map<string, string> {
	const out = new Map<string, string>();
	const byItem = new Map<string, Division[]>();
	for (const d of sitting.divisions) byItem.set(d.item_id, [...(byItem.get(d.item_id) ?? []), d]);

	for (const [itemId, divisions] of byItem) {
		const groups: { n: number; pending: { division: Division; target: VoteTarget }[] }[] = [];
		for (const division of divisions) {
			const reading = readMotion(division.motion_text);
			const n = reading.itemNumber ?? Number.MAX_SAFE_INTEGER;
			let g = groups.find((x) => x.n === n);
			if (!g) groups.push((g = { n, pending: [] }));
			g.pending.push({ division, target: reading.target });
		}
		groups.sort((a, b) => a.n - b.n);
		const calls = sitting.contributions
			.filter((c) => c.item_id === itemId)
			.sort((a, b) => a.seq - b.seq)
			.map((c) => ({ id: c.id, target: calledTarget(c) }))
			.filter((c): c is { id: string; target: VoteTarget } => c.target !== null);

		let gi = 0;
		for (const call of calls) {
			let found = -1;
			let at = gi;
			for (let k = gi; k < groups.length && found < 0; k++) {
				found = groups[k].pending.findIndex((p) => sameTarget(p.target, call.target));
				if (found >= 0) at = k;
			}
			if (found < 0) continue;
			gi = at;
			const [hit] = groups[at].pending.splice(found, 1);
			out.set(hit.division.id, call.id);
		}
	}
	return out;
}

/** The printed text the vote decided: amendment N of the debate, or its motion. Null when the Record prints none. */
export function tabledTextFor(division: Pick<Division, 'motion_text'>, sitting: Pick<Sitting, 'items' | 'tabled_texts'>): TabledText | null {
	const debate = debateItemOf(division, sitting.items);
	if (!debate) return null;
	const { target } = readMotion(division.motion_text);
	const own = sitting.tabled_texts.filter((t) => t.item_id === debate.id);
	if (target.kind === 'amendment') return own.find((t) => t.kind === 'amendment' && t.amendment_number === target.number) ?? null;
	return own.find((t) => t.kind === 'motion') ?? null;
}

/**
 * The printed amendments the Senedd agreed to the motion a division decided, in number order.
 * The Record prints no merged "as amended" text; the agreed amendments are read from sibling
 * divisions of the same debate (derived), the texts themselves are verbatim as tabled.
 */
export function agreedAmendmentTexts(
	division: Pick<Division, 'motion_text'>,
	divisions: Pick<Division, 'motion_text' | 'result'>[],
	sitting: Pick<Sitting, 'items' | 'tabled_texts'>
): TabledText[] {
	const debate = debateItemOf(division, sitting.items);
	if (!debate) return [];
	const numbers = divisions
		.filter((d) => d.result === 'agreed' && debateItemOf(d, sitting.items)?.id === debate.id)
		.map((d) => readMotion(d.motion_text).target)
		.filter((t): t is { kind: 'amendment'; number: number } => t.kind === 'amendment')
		.map((t) => t.number)
		.sort((a, b) => a - b);
	const own = sitting.tabled_texts.filter((t) => t.item_id === debate.id && t.kind === 'amendment');
	return numbers.map((n) => own.find((t) => t.amendment_number === n)).filter((t): t is TabledText => t !== undefined);
}

/** Every printed motion and amendment of an item, in Record order. */
export function tabledTextsOf(itemId: string, sitting: Pick<Sitting, 'tabled_texts'>): TabledText[] {
	return sitting.tabled_texts.filter((t) => t.item_id === itemId && t.kind !== 'note');
}

/** The Member a printed name refers to, by canonical name among the sitting's speakers. Derived. */
export function memberNamed(name: string | null, speakers: Record<string, MemberLight>): MemberLight | null {
	if (!name) return null;
	const key = name.trim().toLowerCase();
	return Object.values(speakers).find((m) => m.canonical_name.toLowerCase() === key || m.cymraeg_name?.toLowerCase() === key) ?? null;
}
