/**
 * Guardrail: wall-screen video is only ever shipped with the offset that places it on the sitting
 * clock. A url without one is the misalignment that used to drop 2026-10-13's broadcast entirely.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Sitting } from '$lib/data/types';

const DATA = resolve(__dirname, '../../../static/data/sittings');
const real = (): Sitting[] =>
	readdirSync(DATA)
		.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
		.map((f) => JSON.parse(readFileSync(resolve(DATA, f), 'utf-8')) as Sitting);

/** The pipeline's MAX_STREAM_OFFSET_S: beyond this the stream is refused, not published. */
const MAX_OFFSET_S = 300;

describe('the exported streams', () => {
	it('pairs every stream url with the offset the player adds', () => {
		for (const s of real()) {
			expect(s.stream_url === null, s.date).toBe(s.stream_offset_s === null);
			expect(s.stream_url_verbatim === null, s.date).toBe(s.stream_offset_verbatim_s === null);
		}
	});

	it('keeps every shipped offset within the bound that means "this meeting, starting early"', () => {
		for (const s of real()) {
			for (const offset of [s.stream_offset_s, s.stream_offset_verbatim_s]) {
				if (offset !== null) expect(Math.abs(offset), s.date).toBeLessThanOrEqual(MAX_OFFSET_S);
			}
		}
	});
});
