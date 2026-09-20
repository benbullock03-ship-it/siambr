/** Floor-light tones and the per-desk easing behind them. DOMAIN_MODEL.md 3.3; pure, testable. */
import { Color } from 'three';
import type { FloorState } from '$lib/stage/floor';
import { CHAMBER_TONES } from '../materials';

export const FLOOR_LIGHT_MS = 300;

export const FLOOR_LIGHT = {
	worktop: CHAMBER_TONES.worktop,
	worktopLit: '#e6c58c',
	screen: '#1b1e22',
	screenLit: '#e7eef4',
	/** Mixed into the party tab once a Member has spoken. */
	tabWarm: '#fff1d6',
	tabWarmMix: 0.45,
	pool: '#ffd28a'
} as const;

/**
 * The desk to light for the floor state: the live speaker's desk when they are seated and not
 * presiding, else Y Llywydd's place (Presiding Officer, Deputy, clerk or an unseated speaker).
 * Null outside a contribution beat.
 */
export function liveDeskId(floor: FloorState, deskByMember: Map<string, string>, presiding: ReadonlySet<string>): string | null {
	const live = floor.live;
	if (!live || live.kind !== 'contribution') return null;
	const memberId = live.contribution.member_id;
	if (memberId && !presiding.has(memberId)) return deskByMember.get(memberId) ?? 'llywydd';
	return 'llywydd';
}

/** A scalar that eases towards its target over `ms`; a zero duration cuts. */
export class Eased {
	value: number;
	target: number;

	constructor(initial = 0) {
		this.value = initial;
		this.target = initial;
	}

	set(target: number): void {
		this.target = target;
	}

	/** Advance by dt seconds. Returns true when the value changed. */
	step(dtSeconds: number, ms: number): boolean {
		if (this.value === this.target) return false;
		if (ms <= 0) {
			this.value = this.target;
			return true;
		}
		const rate = dtSeconds / (ms / 1000);
		this.value = this.value < this.target ? Math.min(this.target, this.value + rate) : Math.max(this.target, this.value - rate);
		return true;
	}
}

export const smooth = (k: number) => k * k * (3 - 2 * k);

const scratchA = new Color();
const scratchB = new Color();

/** `out` = a mixed towards b by smoothstep(k). */
export function mixInto(out: Color, a: string, b: string, k: number): Color {
	return out.lerpColors(scratchA.set(a), scratchB.set(b), smooth(Math.min(1, Math.max(0, k))));
}
