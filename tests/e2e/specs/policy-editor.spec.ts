import { test, expect } from '@playwright/test';
import { setupAdmin, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, createPolicy, login } from '../helpers';

const POLICY_NAME = `E2E Policy ${Date.now()}`;

test.describe('Policy Editor', () => {
  test.beforeAll(async () => {
    await setupAdmin();
  });

  // Log in before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill(TEST_ADMIN_EMAIL);
    await page.getByPlaceholder(/password/i).fill(TEST_ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/');
  });

  test('policies list page loads', async ({ page }) => {
    await page.goto('/policies');
    await expect(page.getByRole('heading', { name: /policies/i })).toBeVisible();
    await expect(page.getByText(/new policy/i)).toBeVisible();
  });

  test('create a new policy via the editor', async ({ page }) => {
    await page.goto('/policies/new');
    await expect(page.getByRole('heading', { name: /new policy/i })).toBeVisible();

    // Fill in name
    await page.getByPlaceholder(/e.g. Strict Research Agent/i).fill(POLICY_NAME);

    // The textarea should already have default JSON
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();

    // Click Format JSON to ensure valid JSON
    await page.getByRole('button', { name: /format json/i }).click();

    // Submit
    await page.getByRole('button', { name: /create policy/i }).click();

    // Should redirect to policies list
    await expect(page).toHaveURL('/policies');

    // New policy should appear
    await expect(page.getByText(POLICY_NAME)).toBeVisible();
  });

  test('invalid JSON shows error and disables submit', async ({ page }) => {
    await page.goto('/policies/new');

    const textarea = page.locator('textarea');
    await textarea.fill('{ invalid json }');

    // Submit button should be disabled
    const submitBtn = page.getByRole('button', { name: /create policy/i });
    await expect(submitBtn).toBeDisabled();

    // JSON error message shown
    await expect(page.getByText(/json/i)).toBeVisible();
  });

  test('edit existing policy updates name and version', async ({ page }) => {
    // Create a policy via API first
    const token = await login(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    const policyId = await createPolicy(token, `E2E Edit ${Date.now()}`, {
      blockedTools: [],
      allowedDomains: [],
      useSupervisor: false,
      requireApproval: { always: false, forTools: [], approvalTimeoutSeconds: 300, timeoutBehavior: 'deny' },
    });

    await page.goto(`/policies/${policyId}`);
    await expect(page.getByRole('heading', { name: /edit policy/i })).toBeVisible();

    // Change the name
    const nameInput = page.getByPlaceholder(/e.g. Strict Research Agent/i);
    await nameInput.clear();
    await nameInput.fill('Updated Policy Name');

    await page.getByRole('button', { name: /save changes/i }).click();

    // Should show ✓ Saved!
    await expect(page.getByRole('button', { name: /saved/i })).toBeVisible({ timeout: 5000 });
  });

  test('deactivate policy from list', async ({ page }) => {
    const token = await login(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await createPolicy(token, `E2E Deactivate ${Date.now()}`, {
      blockedTools: [],
      useSupervisor: false,
      requireApproval: { always: false, forTools: [], approvalTimeoutSeconds: 300, timeoutBehavior: 'deny' },
    });

    await page.goto('/policies');
    // Click the first Deactivate button
    const deactivateBtn = page.getByRole('button', { name: /deactivate/i }).first();
    await deactivateBtn.click();

    // Page reloads — INACTIVE badge should appear
    await expect(page.getByText('INACTIVE')).toBeVisible({ timeout: 5000 });
  });
});
