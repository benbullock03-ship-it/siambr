import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

// The suite runs against a fixture export written by the pipeline itself, so the data contract is exercised end to end.
export default function exportFixture() {
	execSync(`python -m tests.export_fixture --out "${resolve('e2e/static/data')}"`, { cwd: '..', stdio: 'inherit' });
}
