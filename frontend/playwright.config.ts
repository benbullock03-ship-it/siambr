import { defineConfig } from '@playwright/test';

const API_PORT = 8765;
const WEB_PORT = 5174;

export default defineConfig({
	testDir: 'e2e',
	use: { baseURL: `http://127.0.0.1:${WEB_PORT}` },
	webServer: [
		{
			command: `python -m backend.tests.e2e_server --port ${API_PORT}`,
			cwd: '..',
			url: `http://127.0.0.1:${API_PORT}/health`,
			reuseExistingServer: false
		},
		{
			command: `npx vite dev --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
			env: { API_ORIGIN: `http://127.0.0.1:${API_PORT}` },
			url: `http://127.0.0.1:${WEB_PORT}`,
			reuseExistingServer: false,
			timeout: 120_000
		}
	]
});
