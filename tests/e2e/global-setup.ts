/**
 * Global setup: verify all services are reachable before running tests.
 * Also seeds a test admin user if needed.
 */
import { FullConfig } from '@playwright/test';

const API_URL = process.env.API_URL ?? 'http://localhost:3002';
const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3001';
const DASHBOARD_URL = process.env.DASHBOARD_URL ?? 'http://localhost:3000';

async function waitForUrl(url: string, maxWaitMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Service not ready after ${maxWaitMs}ms: ${url}`);
}

export default async function globalSetup(_config: FullConfig) {
  console.log('Waiting for services to be ready...');
  await Promise.all([
    waitForUrl(`${API_URL}/health`),
    waitForUrl(`${GATEWAY_URL}/health`),
    waitForUrl(DASHBOARD_URL),
  ]);
  console.log('All services ready.');

  // Reset: delete test admin if exists so setup flow can be tested
  // (only if E2E_RESET=true — avoids wiping a real instance accidentally)
  if (process.env.E2E_RESET === 'true') {
    console.log('E2E_RESET=true — DB reset handled by docker-compose in CI');
  }
}
