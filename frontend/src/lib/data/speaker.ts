/**
 * How a contribution is named on a page.
 *
 * A speech the Record attributed to no Member still has a speaker: the publisher's own label for
 * them ("Elfyn Llwyd", "Aelod o'r Senedd / Member of the Senedd"). Nothing here invents a name; it
 * chooses between the Member register and the publisher's words.
 */
import type { Contribution, MemberLight } from './types';

type Named = Pick<Contribution, 'member_id' | 'speaker_name'>;

/** The Member's canonical name, else the publisher's own label for the speaker. */
export function speakerName(c: Named, speakers: Record<string, MemberLight>): string {
	if (c.member_id) {
		const member = speakers[c.member_id];
		if (member) return member.canonical_name;
	}
	return c.speaker_name ?? c.member_id ?? 'Speaker not named';
}

/** True when the Record named no Member for this speech. Never a Siambr judgement. */
export function isUnattributed(c: Pick<Contribution, 'member_id'>): boolean {
	return c.member_id === null;
}

/** The Member this speech belongs to, or null when the Record attributed it to nobody. */
export function memberOf(speakers: Record<string, MemberLight>, c: Pick<Contribution, 'member_id'>): MemberLight | null {
	return c.member_id ? (speakers[c.member_id] ?? null) : null;
}
