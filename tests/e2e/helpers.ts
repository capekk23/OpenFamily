/**
 * Shared helpers for E2E tests.
 * Direct API calls (no browser) to seed test data quickly.
 */

const API_URL = process.env.API_URL ?? 'http://localhost:3002';
const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3001';

export const TEST_ADMIN_EMAIL = 'e2e-admin@openfamily.test';
export const TEST_ADMIN_PASSWORD = 'testpassword123';

/**
 * Create the admin account via the setup endpoint.
 * Returns the access token. Idempotent — ignores 403 (already set up).
 */
export async function setupAdmin(): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD }),
  });

  if (res.status === 403) {
    // Already set up — just log in
    return login(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Setup failed: ${body}`);
  }

  const data = await res.json() as { accessToken: string };
  return data.accessToken;
}

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json() as { accessToken: string };
  return data.accessToken;
}

export async function createPolicy(
  token: string,
  name: string,
  rules: Record<string, unknown>
): Promise<string> {
  const res = await fetch(`${API_URL}/api/policies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, rules }),
  });
  if (!res.ok) throw new Error(`createPolicy failed: ${res.status}`);
  const data = await res.json() as { id: string };
  return data.id;
}

export async function createApiKey(
  token: string,
  name: string,
  policyId: string
): Promise<{ id: string; key: string }> {
  const res = await fetch(`${API_URL}/api/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, policyId }),
  });
  if (!res.ok) throw new Error(`createApiKey failed: ${res.status}`);
  return res.json() as Promise<{ id: string; key: string }>;
}

export async function startSession(
  gatewayKey: string,
  agentId: string,
  policyId?: string
): Promise<string> {
  const res = await fetch(`${GATEWAY_URL}/v1/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-OpenFamily-Key': gatewayKey },
    body: JSON.stringify({ agentId, policyId }),
  });
  if (!res.ok) throw new Error(`startSession failed: ${res.status}`);
  const data = await res.json() as { sessionId: string };
  return data.sessionId;
}

export async function intercept(
  gatewayKey: string,
  sessionId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${GATEWAY_URL}/v1/intercept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-OpenFamily-Key': gatewayKey },
    body: JSON.stringify({ sessionId, toolName, toolInput }),
  });
  const body = await res.json() as Record<string, unknown>;
  return { status: res.status, body };
}
