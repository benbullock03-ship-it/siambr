/** Shared domain types. Mirrors the Gold-tier SQLite schema in CLAUDE.md section 3. */

export type SeneddTerm = 1 | 2 | 3 | 4 | 5 | 6;
export type LanguageCode = 'en' | 'cy';
export type VoteCast = 'For' | 'Against' | 'Abstain';
export type DivisionResult = 'Agreed' | 'NotAgreed' | 'Tied';
export type AgendaItemType = 'Debate' | 'Questions' | 'Statement' | 'BillStage';

export type PartyId = 'labour' | 'conservatives' | 'plaid' | 'libdems' | 'independent';

export type PolicyDomainId = 'health' | 'transport' | 'economy' | 'education' | 'communities' | 'devolution';

/** Every synthetic or clustered entity must carry this flag (CLAUDE.md section 5.2). */
export const PROVENANCE_DERIVED = 'PROVENANCE_DERIVED' as const;
export type Provenance =
	| 'verbatim-official-record'
	| 'official-briefing'
	| typeof PROVENANCE_DERIVED;

export interface Member {
	id: number;
	gssCode: string | null;
	canonicalName: string;
	cymraegName: string | null;
	partyId: PartyId;
	constituencyOrRegion: string;
	portraitUrl: string | null;
	officialProfileUrl: string;
}

export interface MemberRole {
	id: number;
	memberId: number;
	roleTitle: string;
	portfolio: string | null;
	dateStart: string;
	dateEnd: string | null;
}

export interface PlenarySession {
	id: number;
	sessionDate: string;
	seneddTerm: SeneddTerm;
	titleEn: string;
	titleCy: string | null;
	sourceXmlUrl: string;
}

export interface AgendaItem {
	id: number;
	sessionId: number;
	itemOrder: number;
	titleEn: string;
	titleCy: string | null;
	itemType: AgendaItemType;
	policyDomainId: PolicyDomainId | null;
	seneddTvClipUrl: string | null;
}

export interface DebateContribution {
	id: number;
	agendaItemId: number;
	memberId: number;
	sequenceNumber: number;
	languageCode: LanguageCode;
	/** Verbatim from Y Cofnod. Never edited, never synthesised. */
	speechVerbatim: string;
	videoTimestampSeconds: number | null;
	provenance: 'verbatim-official-record';
}

export interface Division {
	id: number;
	agendaItemId: number;
	motionText: string;
	votesFor: number;
	votesAgainst: number;
	votesAbstain: number;
	result: DivisionResult;
}

export interface DivisionVote {
	divisionId: number;
	memberId: number;
	voteCast: VoteCast;
}
