/**
 * Activity log E2E tests:
 * Verify that tool call decisions (APPROVED, BLOCKED) appear in the audit log.
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

test.describe('Activity Log', () => {
  let token: string;
  let apiKeyValue: string;

  test.beforeAll(async () => {
    token = await setupAdmin();

    // Policy: allow web_search, block delete_file
    const policyId = await createPolicy(token, `E2E Activity Policy ${Date.now()}`, {
      blockedTools: ['delete_file'],
      allowedDomains: [],
      useSupervisor: false,
      requireApproval: { always: false, forTools: [], approvalTimeoutSeconds: 60, timeoutBehavior: 'deny' },
    });

    const keyData = await createApiKey(token, 'E2E Activity Key', policyId);
    apiKeyValue = keyData.key;

    // Generate some events
    const sessionId = await startSession(apiKeyValue, 'activity-test-agent');
    await intercept(apiKeyValue, sessionId, 'web_search', { query: 'hello world' }); // APPROVED
    await intercept(apiKeyValue, sessionId, 'delete_file', { path: '/important.txt' }); // BLOCKED
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill(TEST_ADMIN_EMAIL);
    await page.getByPlaceholder(/password/i).fill(TEST_ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/');
  });

  test('activity page shows recent events', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.getByRole('heading', { name: /activity/i })).toBeVisible();

    // Should show both events we generated
    await expect(page.getByText('web_search')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('delete_file')).toBeVisible();
  });

  test('APPROVED and BLOCKED decisions are visible', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.getByText(/approved/i, { exact: false })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/blocked/i, { exact: false })).toBeVisible();
  });

  test('sessions page shows active session', async ({ page }) => {
    await page.goto('/sessions');
    await expect(page.getByRole('heading', { name: /sessions/i })).toBeVisible();
    await expect(page.getByText('activity-test-agent')).toBeVisible({ timeout: 5000 });
  });

  test('overview page shows stats', async ({ page }) => {
    await page.goto('/');
    // Stats cards should render (numbers don't need to be specific)
    await expect(page.getByText(/sessions|policies|events|approvals/i)).toBeVisible();
  });
});
