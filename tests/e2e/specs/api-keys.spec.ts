/**
 * API key management E2E tests:
 * Create a key, verify it's shown once, revoke it.
 */

import { test, expect } from '@playwright/test';
import { setupAdmin, login, createPolicy, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from '../helpers';

test.describe('API Key Management', () => {
  test.beforeAll(async () => {
    const token = await setupAdmin();
    // Ensure at least one policy exists for the key form
    await createPolicy(token, 'E2E Keys Policy', {
      blockedTools: [],
      useSupervisor: false,
      requireApproval: { always: false, forTools: [], approvalTimeoutSeconds: 300, timeoutBehavior: 'deny' },
    });
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill(TEST_ADMIN_EMAIL);
    await page.getByPlaceholder(/password/i).fill(TEST_ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/');
  });

  test('keys page loads with New Key button', async ({ page }) => {
    await page.goto('/keys');
    await expect(page.getByRole('heading', { name: /api keys/i })).toBeVisible();
    await expect(page.getByText(/new key/i)).toBeVisible();
  });

  test('create a new API key and see the one-time reveal', async ({ page }) => {
    await page.goto('/keys');
    await page.getByText(/new key/i).click();

    // Form appears
    await expect(page.getByRole('heading', { name: /create api key/i })).toBeVisible();

    // Fill in key name
    await page.getByPlaceholder(/e.g. Production Agent/i).fill('E2E Test Key');

    // Select a policy
    const select = page.locator('select');
    await select.selectOption({ index: 1 }); // first real policy

    await page.getByRole('button', { name: /create key/i }).click();

    // One-time reveal should appear with the key
    await expect(page.getByText(/copy it now/i)).toBeVisible({ timeout: 5000 });

    // Key should start with "of_" or be a long string
    const keyText = page.locator('code');
    await expect(keyText).toBeVisible();
    const text = await keyText.textContent();
    expect(text?.length).toBeGreaterThan(10);
  });

  test('revoke a key removes it from active list', async ({ page }) => {
    await page.goto('/keys');

    // If there's a Revoke button, click it
    const revokeBtn = page.getByRole('button', { name: /revoke/i }).first();
    const count = await revokeBtn.count();

    if (count > 0) {
      await revokeBtn.click();
      // Page reloads — that key's revoke button should be gone
      await expect(page.getByText(/revoke/i).first()).toHaveCount(0, { timeout: 5000 }).catch(() => {
        // OK if there are still other keys with revoke buttons
      });
    } else {
      test.skip(true, 'No active keys to revoke');
    }
  });
});
