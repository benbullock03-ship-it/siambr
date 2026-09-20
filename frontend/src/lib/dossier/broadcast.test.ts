import { describe, expect, it } from 'vitest';
import { broadcastLink, formatOffset } from './broadcast';

describe('broadcastLink', () => {
	it('sets startPos in seconds, as the Record XML links do', () => {
		expect(broadcastLink('http://www.senedd.tv/en/16086', 754)).toBe('http://www.senedd.tv/en/16086?startPos=754');
	});

	it('keeps existing query parameters', () => {
		expect(broadcastLink('http://www.senedd.tv/en/16086?l=en', 7)).toBe('http://www.senedd.tv/en/16086?l=en&startPos=7');
	});

	it('returns the clip untouched without a start offset', () => {
		expect(broadcastLink('http://www.senedd.tv/en/16086', null)).toBe('http://www.senedd.tv/en/16086');
	});

	it('returns null when no clip is on record', () => {
		expect(broadcastLink(null, 10)).toBeNull();
	});
});

describe('formatOffset', () => {
	it('renders hh:mm:ss', () => {
		expect(formatOffset(754)).toBe('00:12:34');
		expect(formatOffset(3 * 3600 + 5)).toBe('03:00:05');
	});
});
