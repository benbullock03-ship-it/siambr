// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	/** Build flag PUBLIC_SCREEN_VIDEO, set in vite.config.ts. */
	const __SCREEN_VIDEO__: boolean;
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
