// Keys match member_tenures.party_id (migration 002).
const PARTIES: Record<string, { label: string; token: string }> = {
	labour: { label: 'Welsh Labour', token: '--color-party-labour' },
	plaid_cymru: { label: 'Plaid Cymru', token: '--color-party-plaid' },
	conservatives: { label: 'Welsh Conservatives', token: '--color-party-conservatives' },
	libdems: { label: 'Welsh Liberal Democrats', token: '--color-party-libdems' },
	reform_uk: { label: 'Reform UK', token: '--color-party-reform' },
	greens: { label: 'Wales Green Party', token: '--color-party-independent' },
	ukip: { label: 'UKIP', token: '--color-party-independent' },
	independent: { label: 'Independent', token: '--color-party-independent' },
	other: { label: 'Other', token: '--color-party-independent' }
};

export function partyLabel(partyId: string | null): string {
	return partyId === null ? 'Party not recorded' : (PARTIES[partyId]?.label ?? partyId);
}

export function partyColor(partyId: string | null): string {
	return `var(${(partyId && PARTIES[partyId]?.token) || '--color-party-independent'})`;
}
