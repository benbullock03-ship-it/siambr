export { PROVENANCE_DERIVED } from './types';

/** Badge copy from siambr-spec.md 7.3. Every derived figure renders one of these beside it. */
export const BADGE = {
	verbatim: 'Official verbatim record',
	division: 'Official division result',
	arranged: 'Arranged by Siambr',
	timestamps: 'Derived from timestamps',
	counted: 'Counted by Siambr',
	topic: 'Derived topic cluster'
} as const;

export const DERIVED_NOTICE = {
	seating: 'Desk positions arranged by Siambr engine — not the official seating plan.',
	topic: 'Item types and policy domains grouped by Siambr engine — speeches verbatim.',
	timestamps: 'End times and speaking time are sums of Senedd TV offsets, derived by Siambr — nothing modelled.'
} as const;
