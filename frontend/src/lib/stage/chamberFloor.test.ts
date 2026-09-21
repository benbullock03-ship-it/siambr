import { describe, expect, it } from 'vitest';
import { buildDesks } from '$lib/3d/chamber/layout';
import type { MemberLight, Sitting, TermFile } from '$lib/data/types';
import realSitting260916 from '../../../static/data/sittings/2026-09-16.json';
import term7 from '../../../static/data/terms/7.json';
import { ChamberFloor } from './chamberFloor';
import { presidingAt, buildPresidingSpans } from './presiding';
import { buildTimeline, type Beat } from './timeline';

const sitting = realSitting260916 as unknown as Sitting;
const term = term7 as unknown as TermFile;
const timeline = buildTimeline(sitting);
const spans = buildPresidingSpans(sitting, term, timeline);
const chamber = () => new ChamberFloor(timeline, sitting, term, term.members as MemberLight[], buildDesks(term.seat_count));

const speeches = timeline.beats.filter((b): b is Extract<Beat, { kind: 'contribution' }> => b.kind === 'contribution' && b.tEnd - b.t > 4);
const bySpeaker = (seated: boolean) =>
	speeches.find((b) => {
		const id = b.contribution.member_id;
		const chair = presidingAt(spans, b.t + 1);
		return seated ? !!id && id !== chair && term.members.some((m) => m.id === id) : id === chair;
	})!;

describe('ChamberFloor', () => {
	it('returns the same view while only t moves within a speech', () => {
		const floor = chamber();
		const b = bySpeaker(true);
		const first = floor.at(b.t + 1);
		expect(floor.at(b.t + 2)).toBe(first);
		expect(floor.at(b.t + 3)).toBe(first);
	});

	it('lights a seated speaker at their own desk', () => {
		const b = bySpeaker(true);
		const view = chamber().at(b.t + 1);
		expect(view.liveSeat?.member.id).toBe(b.contribution.member_id);
		expect(view.liveDesk?.id).toBe(view.liveSeat?.desk.id);
		expect(view.liveDesk?.row).toBeGreaterThanOrEqual(0);
	});

	it('lights Y Llywydd’s place when the presiding officer speaks', () => {
		const b = bySpeaker(false);
		const view = chamber().at(b.t + 1);
		expect(view.liveDesk?.id).toBe('llywydd');
		expect(view.liveSeat?.member.id).toBe(view.presidingId);
	});

	it('lights nothing outside a contribution', () => {
		const view = chamber().at(timeline.tEnd + 1);
		expect(view.liveDesk).toBeNull();
		expect(view.liveSeat).toBeNull();
	});

	it('reseats only when the chair changes', () => {
		const floor = chamber();
		const before = floor.at(10).seats;
		expect(floor.at(6360).seats).toBe(before);
		const after = floor.at(6380);
		expect(after.presidingId).toBe('ms-huw-irranca-davies');
		expect(after.seats).not.toBe(before);
		expect(after.seats.find((s) => s.desk.id === 'llywydd')?.member.id).toBe('ms-huw-irranca-davies');
		expect(floor.at(10).seats).toBe(before);
	});
});
