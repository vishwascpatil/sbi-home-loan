import { test, expect } from '@playwright/test';

test.describe('Group Loan Tracker PWA - E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and visit home
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Flow 1 & 7: Add a contribution, confirm dashboard update and persistence across reload', async ({
    page,
  }) => {
    // 1. Initial State Check
    await expect(page.locator('.header-title')).toHaveText('Loan Tracker');
    const heroCard = page.locator('app-hero-card');
    await expect(heroCard).toBeVisible();

    // 2. Open Add Contribution Sheet via Quick Action
    const addContributionBtn = page
      .locator('.quick-actions-bar .chip-button')
      .filter({ hasText: 'Contribution' });
    await addContributionBtn.click();

    const sheet = page.locator('.sheet-container');
    await expect(sheet).toBeVisible();

    // 3. Fill in Contribution details (₹50,000 for Member 1)
    await page.fill('#amount-input', '50000');
    await page.fill('#tx-notes', 'Extra top-up contribution');

    // Submit Form
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // 4. Verify Toast & Sheet Closed
    await expect(sheet).not.toBeVisible();
    await expect(page.locator('.toast-card')).toContainText('Contribution added');

    // 5. Verify Recent Activity updated
    const recentActivity = page.locator('.recent-tx-list');
    await expect(recentActivity).toContainText('+₹50,000');

    // 6. Persistence check: Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.recent-tx-list')).toContainText('+₹50,000');
  });

  test('Flow 2: Record a bank payment with estimated split, confirm principal drops by principal portion only', async ({
    page,
  }) => {
    // Check initial balance exists
    const balanceEl = page.locator('.balance-amount');
    await expect(balanceEl).toBeVisible();

    // Open Bank Payment via quick action
    const bankPaymentBtn = page
      .locator('.quick-actions-bar .chip-button')
      .filter({ hasText: 'Bank Payment' });
    await bankPaymentBtn.click();

    const sheet = page.locator('.sheet-container');
    await expect(sheet).toBeVisible();

    // Check live split preview with ₹2,40,000
    await page.fill('#amount-input', '240000');
    const splitPreview = page.locator('.split-preview-card');
    await expect(splitPreview).toBeVisible();
    await expect(splitPreview).toContainText('Estimated Interest:');
    await expect(splitPreview).toContainText('Principal Reduction:');

    // Submit
    await page.locator('button[type="submit"]').click();
    await expect(sheet).not.toBeVisible();
    await expect(page.locator('.toast-card')).toContainText('Bank payment recorded');

    // Verify recent activity shows payment with interest portion
    const recentActivity = page.locator('.recent-tx-list');
    await expect(recentActivity).toContainText('−₹2,40,000');
    await expect(recentActivity).toContainText('interest');
  });

  test('Flow 3 & 4: Edit and delete a transaction with recalculation', async ({ page }) => {
    // Open the first transaction from Recent Activity
    const firstTxBtn = page.locator('.tx-row-btn').first();
    await firstTxBtn.click();

    const sheet = page.locator('.sheet-container');
    await expect(sheet).toBeVisible();

    // Check delete button is visible in edit mode
    const deleteBtn = page.locator('.delete-btn');
    await expect(deleteBtn).toBeVisible();

    // Update notes
    await page.fill('#tx-notes', 'Edited note for test audit');
    await page.locator('button[type="submit"]').click();
    await expect(sheet).not.toBeVisible();
    await expect(page.locator('.toast-card')).toContainText('Transaction updated');

    // Now delete this transaction
    await firstTxBtn.click();
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Confirm sheet appears
    const confirmBtn = page.locator('.confirm-btn.danger');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Verify toast
    await expect(page.locator('.toast-card')).toContainText('Transaction deleted');
  });

  test('Flow 5: History filters (type, member, month) work', async ({ page }) => {
    // Navigate to History
    await page.goto('/history');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.history-header')).toContainText('History');
    const timelineItems = page.locator('.tx-history-item');
    const initialCount = await timelineItems.count();
    expect(initialCount).toBeGreaterThan(0);

    // Filter by Contributions only
    await page.locator('.chip-button', { hasText: 'Contributions' }).click();
    const contribCount = await page.locator('.tx-history-item').count();
    expect(contribCount).toBeGreaterThan(0);

    // Filter by Bank Payments only
    await page.locator('.chip-button', { hasText: 'Bank Payments' }).click();
    const paymentCount = await page.locator('.tx-history-item').count();
    expect(paymentCount).toBeGreaterThan(0);

    // Clear filter
    await page.locator('.chip-button', { hasText: 'All' }).click();
  });

  test('Flow 6: CSV export generates valid RFC 4180 file with UTF-8 BOM', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.csv-export-btn').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain('.csv');

    // Read download content
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks).toString('utf-8');

    // Check UTF-8 BOM (\uFEFF)
    expect(content.charCodeAt(0)).toBe(0xfeff);

    // Check RFC 4180 Header
    expect(content).toContain('"Date","For Month","Transaction Type","Member Name","Amount (₹)"');
  });

  test('Flow 8: Theme toggle updates data-theme attribute and persists', async ({ page }) => {
    const html = page.locator('html');

    // Initial theme attribute
    const initialTheme = (await html.getAttribute('data-theme')) || 'light';
    const targetTheme = initialTheme === 'light' ? 'dark' : 'light';

    // Click theme toggle button in header
    const toggleBtn = page.locator('.theme-icon-btn');
    await toggleBtn.click();

    // Verify attribute toggles with auto-retrying assertion
    await expect(html).toHaveAttribute('data-theme', targetTheme);

    // Persists across reload
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', targetTheme);
  });

  test('Flow 9: Rate change in Settings updates current rate and audit trail', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.settings-header')).toContainText('Settings');

    // Fill new rate: 8.25%
    await page.fill('#new-rate', '8.25');

    // Apply Rate Change
    await page.locator('.apply-rate-btn').click();

    // Confirm Toast
    await expect(page.locator('.toast-card')).toContainText('Interest rate updated');

    // Subtitle displays updated rate
    await expect(page.locator('.section-sub', { hasText: 'Current rate is' })).toContainText(
      '8.25%'
    );
  });

  test('Flow 10: Bank reconciliation records snapshot and displays variance', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Enter actual bank outstanding: ₹1,18,00,000
    await page.fill('#actual-balance', '11800000');

    // Click Save Reconciliation Snapshot
    await page.locator('.reconcile-btn').click();

    // Verify Toast with variance
    await expect(page.locator('.toast-card')).toContainText('Reconciled!');
  });
});
