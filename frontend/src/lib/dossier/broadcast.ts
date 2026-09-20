// senedd.tv reads ?startPos=<seconds from meeting start>, as used in the Record XML's contribution_*_seneddTv links; it has no end parameter.
export function broadcastLink(clipUrl: string | null, start: number | null): string | null {
	if (!clipUrl) return null;
	if (start === null) return clipUrl;
	const url = new URL(clipUrl);
	url.searchParams.set('startPos', String(start));
	return url.toString();
}

export function formatOffset(seconds: number): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
}
