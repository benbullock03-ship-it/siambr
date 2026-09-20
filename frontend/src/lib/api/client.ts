import type {
	DossierPlate,
	MemberRecord,
	MemberSummary,
	ParliamentaryTerm,
	PolicyDomain,
	SessionSummary
} from './types';

type Fetch = typeof fetch;

export class ApiError extends Error {
	status: number;

	constructor(status: number, path: string) {
		super(`${status} from ${path}`);
		this.status = status;
	}
}

async function getJson<T>(fetch: Fetch, path: string): Promise<T> {
	const res = await fetch(path);
	if (!res.ok) throw new ApiError(res.status, path);
	return res.json() as Promise<T>;
}

export interface SessionFilters {
	term: number | null;
	domain: string | null;
	speaker: string | null;
}

export function sessions(fetch: Fetch, filters: SessionFilters): Promise<SessionSummary[]> {
	const params = new URLSearchParams();
	if (filters.term !== null) params.set('term', String(filters.term));
	if (filters.domain) params.set('domain', filters.domain);
	if (filters.speaker) params.set('speaker', filters.speaker);
	const qs = params.toString();
	return getJson(fetch, `/api/plenary/sessions${qs ? `?${qs}` : ''}`);
}

export const dossier = (fetch: Fetch, itemId: string) =>
	getJson<DossierPlate>(fetch, `/api/plenary/items/${encodeURIComponent(itemId)}`);

export const policyDomains = (fetch: Fetch) => getJson<PolicyDomain[]>(fetch, '/api/policy-domains');

export const members = (fetch: Fetch, opts: { current?: boolean } = {}) =>
	getJson<MemberSummary[]>(fetch, opts.current ? '/api/members?current=true' : '/api/members');

export const memberRecord = (fetch: Fetch, memberId: string) =>
	getJson<MemberRecord>(fetch, `/api/members/${encodeURIComponent(memberId)}/record`);

export const terms = (fetch: Fetch) => getJson<ParliamentaryTerm[]>(fetch, '/api/terms');
