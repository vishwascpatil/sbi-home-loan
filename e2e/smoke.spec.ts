import { test, expect } from '@playwright/test';

test.describe('Smoke Test', () => {
  test('should load the application shell', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Loan EMI Tracker/i);
  });
});
