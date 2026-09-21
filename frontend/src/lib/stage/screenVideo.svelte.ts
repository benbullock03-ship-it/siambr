/** Wall-screen video (T-32) and its sound (T-33) run only where this build flag is on. */
export const SCREEN_VIDEO: boolean = __SCREEN_VIDEO__;

/** Shared between the chamber screen, which plays the stream, and the HUD's audio toggle. */
export class ScreenSound {
	/** Sound is on by default, as on senedd.tv; the Play press is the gesture that lets it start. */
	muted = $state(false);
	/** Senedd TV's two feeds: English interpretation (its default) or the floor audio as spoken. */
	feed = $state<'interpretation' | 'verbatim'>('interpretation');
	/** The stream could not load or stopped; the screens stay dark for this page. */
	failed = $state(false);
}

