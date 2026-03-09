import { test, expect } from '@playwright/test';
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, setupAdmin } from '../helpers';

test.describe('Authentication', () => {
  test.beforeAll(async () => {
    await setupAdmin();
  });

  test('redirects unauthenticated users to /login or /setup', async ({ page }) => {
    await page.goto('/policies');
    // Should end up at /login or /setup (not /policies)
    await expect(page).toHaveURL(/\/(login|setup)/);
  });

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
  });

  test('rejects invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill('wrong@example.com');
    await page.getByPlaceholder(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill(TEST_ADMIN_EMAIL);
    await page.getByPlaceholder(/password/i).fill(TEST_ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    // Should end up on the overview page
    await expect(page).toHaveURL('/');
    await expect(page.getByText(/openfamily/i).first()).toBeVisible();
  });

  test('sign out clears session and redirects to login', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill(TEST_ADMIN_EMAIL);
    await page.getByPlaceholder(/password/i).fill(TEST_ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/');

    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
