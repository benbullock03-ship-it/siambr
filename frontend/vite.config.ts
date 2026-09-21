import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

/**
 * PUBLIC_SCREEN_VIDEO (T-33): Senedd TV on the wall screens. Unset, it is on under `vite dev` and off
 * in a build; a preview build sets PUBLIC_SCREEN_VIDEO=1. Production stays off until the Senedd replies.
 */
export function screenVideoFlag(command: 'serve' | 'build'): boolean {
	const value = process.env.PUBLIC_SCREEN_VIDEO?.trim().toLowerCase();
	if (value === '1' || value === 'true') return true;
	if (value === '0' || value === 'false') return false;
	return command === 'serve';
}

export default defineConfig(({ command }) => ({
	plugins: [sveltekit()],
	define: { __SCREEN_VIDEO__: JSON.stringify(screenVideoFlag(command)) }
}));
