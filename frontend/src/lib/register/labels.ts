import type { SessionFilters } from '$lib/api/client';

const ITEM_TYPES: Record<string, string> = {
	debate: 'Debate',
	oral_questions: 'Questions',
	statement: 'Statement',
	bill_stage: 'Bill stage',
	emergency_debate: 'Emergency debate'
};

export const itemTypeLabel = (type: string) => ITEM_TYPES[type] ?? type;

export const SENEDD_TERMS = [1, 2, 3, 4, 5, 6, 7] as const;

export function parseFilters(params: URLSearchParams): SessionFilters {
	const term = Number(params.get('term'));
	return {
		term: Number.isInteger(term) && term >= 1 && term <= 7 ? term : null,
		domain: params.get('domain') || null,
		speaker: params.get('speaker') || null
	};
}
