import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const WEB_PORT = 5174;
const STATIC_DIR = resolve('e2e/static');

export default defineConfig({
	testDir: 'e2e',
	testIgnore: ['e2e/static/**'],
	globalSetup: './e2e/global-setup.ts',
	// Several stage tests on SwiftShader at once starve each other of the chamber's 20 s load budget.
	workers: 2,
	use: { baseURL: `http://127.0.0.1:${WEB_PORT}` },
	webServer: {
		command: `npx vite dev --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
		env: { SIAMBR_STATIC_DIR: STATIC_DIR },
		url: `http://127.0.0.1:${WEB_PORT}`,
		reuseExistingServer: false,
		timeout: 120_000
	}
});
