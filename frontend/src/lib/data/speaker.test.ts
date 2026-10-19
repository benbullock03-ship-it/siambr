/**
 * Guardrail: every speech is either attributed to a Member on the register or carries the
 * publisher's own label. Nothing is silently dropped and nothing is invented (migration 011).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MemberLight, Sitting } from '$lib/data/types';
import { isUnattributed, speakerName } from './speaker';

const DATA = resolve(__dirname, '../../../static/data/sittings');
const real = (): Sitting[] =>
	readdirSync(DATA)
		.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
		.map((f) => JSON.parse(readFileSync(resolve(DATA, f), 'utf-8')) as Sitting);

const member = (id: string, name: string, party = 'labour'): MemberLight =>
	({ id, canonical_name: name, party_id: party }) as MemberLight;

describe('speakerName', () => {
	it('prefers the Member on the register', () => {
		expect(speakerName({ member_id: 'ms-a', speaker_name: 'ignored' }, { 'ms-a': member('ms-a', 'A B') })).toBe('A B');
	});

	it('falls back to the publisher label when the Record named no Member', () => {
		expect(speakerName({ member_id: null, speaker_name: 'Elfyn Llwyd' }, {})).toBe('Elfyn Llwyd');
	});

	it('marks a speech the Record attributed to nobody, and only that', () => {
		expect(isUnattributed({ member_id: null })).toBe(true);
		expect(isUnattributed({ member_id: 'ms-a' })).toBe(false);
	});
});

describe('the exported record', () => {
	it('names a speaker for every contribution, never a gap', () => {
		const sittings = real();
		expect(sittings.length).toBeGreaterThan(0);
		for (const s of sittings) {
			for (const c of s.contributions) {
				if (c.member_id) {
					expect(c.unattributed, `${s.date} ${c.id}`).toBe(false);
					expect(s.speakers[c.member_id], `${s.date} ${c.id}`).toBeDefined();
					expect(c.speaker_name, `${s.date} ${c.id}`).toBeNull();
				} else {
					expect(c.unattributed, `${s.date} ${c.id}`).toBe(true);
					expect(c.speaker_name, `${s.date} ${c.id}`).toBeTruthy();
				}
			}
		}
	});

	it('summarises exactly the unattributed contributions of each sitting', () => {
		for (const s of real()) {
			const rows = s.contributions.filter((c) => c.unattributed);
			expect(s.unattributed.contributions, s.date).toBe(rows.length);
			const names = new Set(rows.map((c) => c.speaker_name));
			expect(s.unattributed.speakers.map((k) => k.name).sort(), s.date).toEqual([...names].sort());
			expect(
				s.unattributed.speakers.reduce((n, k) => n + k.contributions, 0),
				s.date
			).toBe(rows.length);
		}
	});

});
