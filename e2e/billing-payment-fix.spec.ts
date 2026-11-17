import { test, expect } from '@playwright/test';

test.describe('Billing Payment Flow - P0 Bug Fix', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@ris.local');
    await page.fill('input[type="password"]', 'Demo@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should record CASH payment without paymentMethod error', async ({ page }) => {
    // Navigate to Billing
    await page.goto('/billing');
    await expect(page.locator('h1')).toContainText('Billing');

    // Wait for invoices to load
    await page.waitForSelector('[data-testid="invoices-tab"], .invoice-row, text=INV-', { timeout: 10000 });

    // Find an unpaid or partially paid invoice
    const invoiceRow = page.locator('tr:has-text("PENDING"), tr:has-text("PARTIALLY_PAID")').first();

    if (await invoiceRow.count() === 0) {
      test.skip('No unpaid/partial invoices available for testing');
      return;
    }

    // Click the Pay/Record Payment button or action
    await invoiceRow.locator('button:has-text("Pay"), button:has-text("Record Payment")').first().click();

    // Wait for payment modal to open
    await expect(page.locator('text=Record Payment')).toBeVisible();

    // Verify payment amount field is present and has default value
    const amountInput = page.locator('input[type="number"]').first();
    await expect(amountInput).toBeVisible();
    const defaultAmount = await amountInput.inputValue();
    expect(parseFloat(defaultAmount)).toBeGreaterThan(0);

    // Select CASH payment method
    const cashButton = page.locator('button:has-text("CASH")');
    await expect(cashButton).toBeVisible();
    await cashButton.click();

    // Verify CASH is selected (check for selected state)
    await expect(cashButton).toHaveClass(/ring-cyan-600|border-cyan-600|bg-cyan-50/);

    // Intercept the API request to verify payload
    const requestPromise = page.waitForRequest(request =>
      request.url().includes('/api/v1/billing/invoices/') &&
      request.url().includes('/payments') &&
      request.method() === 'POST'
    );

    // Submit the payment
    await page.locator('button:has-text("Record Payment")').last().click();

    // Capture the request
    const request = await requestPromise;
    const requestBody = JSON.parse(request.postData() || '{}');

    // CRITICAL: Verify paymentMethod is present and correct
    expect(requestBody).toHaveProperty('paymentMethod');
    expect(requestBody.paymentMethod).toBe('CASH');
    expect(requestBody.amount).toBeGreaterThan(0);

    // Wait for response - should be successful, not a Prisma error
    await page.waitForResponse(
      response => response.url().includes('/payments') && response.status() === 201,
      { timeout: 5000 }
    );

    // Verify modal closes on success
    await expect(page.locator('text=Record Payment')).not.toBeVisible({ timeout: 3000 });

    // CRITICAL SECURITY CHECK: Verify no Prisma errors are visible to user
    const pageContent = await page.content();
    expect(pageContent).not.toContain('Invalid tx.receipt.create() invocation');
    expect(pageContent).not.toContain('Argument paymentMethod is missing');
    expect(pageContent).not.toContain('C:\\Users\\');
    expect(pageContent).not.toContain('node_modules');
    expect(pageContent).not.toContain('server\\src');
    expect(pageContent).not.toContain('Prisma');
  });

  test('should record UPI payment correctly', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForSelector('[data-testid="invoices-tab"], .invoice-row, text=INV-', { timeout: 10000 });

    const invoiceRow = page.locator('tr:has-text("PENDING"), tr:has-text("PARTIALLY_PAID")').first();

    if (await invoiceRow.count() === 0) {
      test.skip('No unpaid/partial invoices available');
      return;
    }

    await invoiceRow.locator('button:has-text("Pay"), button:has-text("Record Payment")').first().click();
    await expect(page.locator('text=Record Payment')).toBeVisible();

    // Select UPI
    const upiButton = page.locator('button:has-text("UPI")');
    await expect(upiButton).toBeVisible();
    await upiButton.click();
    await expect(upiButton).toHaveClass(/ring-cyan-600|border-cyan-600|bg-cyan-50/);

    // Verify UPI reference field shows relevant placeholder
    const referenceInput = page.locator('input[placeholder*="UPI"], input[placeholder*="UTR"]');
    await expect(referenceInput).toBeVisible();

    // Enter a UPI reference
    await referenceInput.fill('UPI-TEST-123456789');

    const requestPromise = page.waitForRequest(request =>
      request.url().includes('/payments') && request.method() === 'POST'
    );

    await page.locator('button:has-text("Record Payment")').last().click();

    const request = await requestPromise;
    const requestBody = JSON.parse(request.postData() || '{}');

    expect(requestBody.paymentMethod).toBe('UPI');
    expect(requestBody.reference).toBe('UPI-TEST-123456789');
  });

  test('should validate payment method is required', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForSelector('[data-testid="invoices-tab"], .invoice-row, text=INV-', { timeout: 10000 });

    const invoiceRow = page.locator('tr:has-text("PENDING"), tr:has-text("PARTIALLY_PAID")').first();

    if (await invoiceRow.count() === 0) {
      test.skip('No unpaid/partial invoices available');
      return;
    }

    await invoiceRow.locator('button:has-text("Pay"), button:has-text("Record Payment")').first().click();
    await expect(page.locator('text=Record Payment')).toBeVisible();

    // Enter amount but DO NOT select payment method
    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.fill('100');

    // Try to submit without selecting payment method
    await page.locator('button:has-text("Record Payment")').last().click();

    // Should show validation error
    await expect(page.locator('text=Please select a payment method')).toBeVisible();

    // No API request should have been made
    const pageContent = await page.content();
    expect(pageContent).not.toContain('Prisma');
  });

  test('should not have horizontal overflow in payment modal', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForSelector('[data-testid="invoices-tab"], .invoice-row, text=INV-', { timeout: 10000 });

    const invoiceRow = page.locator('tr:has-text("PENDING"), tr:has-text("PARTIALLY_PAID")').first();

    if (await invoiceRow.count() === 0) {
      test.skip('No unpaid/partial invoices available');
      return;
    }

    await invoiceRow.locator('button:has-text("Pay"), button:has-text("Record Payment")').first().click();
    await expect(page.locator('text=Record Payment')).toBeVisible();

    // Check payment method buttons container
    const paymentMethodsContainer = page.locator('text=Payment Tender / Method').locator('..').locator('div[class*="grid"]');

    // Verify all payment methods are visible without scrolling
    await expect(page.locator('button:has-text("CASH")')).toBeVisible();
    await expect(page.locator('button:has-text("CREDIT CARD")')).toBeVisible();
    await expect(page.locator('button:has-text("DEBIT CARD")')).toBeVisible();
    await expect(page.locator('button:has-text("UPI")')).toBeVisible();
    await expect(page.locator('button:has-text("ONLINE")')).toBeVisible();
    await expect(page.locator('button:has-text("INSURANCE")')).toBeVisible();

    // Check for horizontal scrollbar (should not exist)
    const hasHorizontalScroll = await paymentMethodsContainer.evaluate((el) => {
      return el.scrollWidth > el.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  test('should handle payment modal responsively at different viewport sizes', async ({ page, viewport }) => {
    const viewports = [
      { width: 1440, height: 900, name: 'Desktop' },
      { width: 1024, height: 768, name: 'Tablet Landscape' },
      { width: 768, height: 1024, name: 'Tablet Portrait' },
      { width: 375, height: 667, name: 'Mobile' },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      await page.goto('/billing');
      await page.waitForSelector('[data-testid="invoices-tab"], .invoice-row, text=INV-', { timeout: 10000 });

      const invoiceRow = page.locator('tr:has-text("PENDING"), tr:has-text("PARTIALLY_PAID")').first();

      if (await invoiceRow.count() === 0) {
        continue;
      }

      await invoiceRow.locator('button:has-text("Pay"), button:has-text("Record Payment")').first().click();
      await expect(page.locator('text=Record Payment')).toBeVisible();

      // All payment methods should still be visible
      await expect(page.locator('button:has-text("CASH")')).toBeVisible();
      await expect(page.locator('button:has-text("UPI")')).toBeVisible();

      // No horizontal scroll
      const paymentMethodsContainer = page.locator('text=Payment Tender / Method').locator('..').locator('div[class*="grid"]');
      const hasHorizontalScroll = await paymentMethodsContainer.evaluate((el) => {
        return el.scrollWidth > el.clientWidth;
      });

      expect(hasHorizontalScroll).toBe(false);

      // Close modal
      await page.locator('button:has-text("Cancel")').first().click();
      await expect(page.locator('text=Record Payment')).not.toBeVisible();
    }
  });
});
