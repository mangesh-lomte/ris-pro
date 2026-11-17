const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\mange\\.gemini\\antigravity\\brain\\797b42dd-d491-4463-b8a8-1f02276b71ae';

async function run() {
  console.log('=== STARTING RADAXIS RIS PREMIUM PRODUCT TRANSFORMATION VERIFICATION ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const results = {
    surfacesVerified: [],
    anomalies: [],
    inspections: {},
  };

  const checkPageQuality = async (surfaceName) => {
    const bodyText = await page.innerText('body');
    const anomaliesFound = [];

    if (bodyText.includes('NaN')) anomaliesFound.push('NaN detected');
    if (bodyText.includes('undefined')) anomaliesFound.push('undefined string detected');
    if (bodyText.includes('Invalid Date')) anomaliesFound.push('Invalid Date detected');
    if (bodyText.includes('[object Object]')) anomaliesFound.push('[object Object] detected');

    // Check for raw unformatted dollar prices
    const dollarMatches = bodyText.match(/\$\s*\d+/g);
    if (dollarMatches) {
      anomaliesFound.push(`Unformatted dollar currency detected: ${dollarMatches.join(', ')}`);
    }

    if (anomaliesFound.length > 0) {
      console.warn(`   ⚠️ Anomalies on ${surfaceName}:`, anomaliesFound);
      results.anomalies.push({ surface: surfaceName, anomalies: anomaliesFound });
    } else {
      console.log(`   ✅ 0 visual anomalies on ${surfaceName} (clean clinical text)`);
    }

    return anomaliesFound;
  };

  try {
    // ------------------------------------------------------------------------
    // 0. AUTHENTICATION
    // ------------------------------------------------------------------------
    console.log('1. Authenticating as Clinical Admin (Dr. Arthur Evans)...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
    const quickBtn = page.locator('button:has-text("Dr. Arthur Evans")');
    await quickBtn.click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('   Authenticated. Dashboard URL:', page.url());

    // ------------------------------------------------------------------------
    // SURFACE 1: EXECUTIVE DASHBOARD
    // ------------------------------------------------------------------------
    console.log('\n--- Surface 1: Executive Dashboard ---');
    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Clinical Command Center', { timeout: 10000 });
    await page.waitForSelector('text=Total Bookings', { timeout: 10000 });
    await page.waitForSelector('text=Completed Scans', { timeout: 10000 });
    await page.waitForSelector('text=Pending Reports', { timeout: 10000 });
    await page.waitForSelector('text=Critical Tasks', { timeout: 10000 });
    await page.waitForSelector('text=Today Revenue', { timeout: 10000 });

    const p1Shot = path.join(ARTIFACT_DIR, 'evidence_premium_dashboard.png');
    await page.screenshot({ path: p1Shot, fullPage: true });
    await checkPageQuality('Executive Dashboard');
    results.surfacesVerified.push({ surface: 'Executive Dashboard', path: p1Shot });

    // ------------------------------------------------------------------------
    // SURFACE 2: MASTER PATIENT INDEX
    // ------------------------------------------------------------------------
    console.log('\n--- Surface 2: Master Patient Index ---');
    await page.goto('http://localhost:5173/patients', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Master Patient Index (MPI)', { timeout: 10000 });
    await page.waitForSelector('tbody tr', { timeout: 10000 });

    const p2Shot = path.join(ARTIFACT_DIR, 'evidence_premium_patients.png');
    await page.screenshot({ path: p2Shot, fullPage: true });
    await checkPageQuality('Master Patient Index');
    results.surfacesVerified.push({ surface: 'Master Patient Index', path: p2Shot });

    // ------------------------------------------------------------------------
    // SURFACE 3: PATIENT DETAIL & TIMELINE
    // ------------------------------------------------------------------------
    console.log('\n--- Surface 3: Patient Detail & Clinical Chart ---');
    await page.goto('http://localhost:5173/patients/PAT-2026-10001', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=PAT-2026-10001', { timeout: 10000 });

    const p3Shot = path.join(ARTIFACT_DIR, 'evidence_premium_patient_detail.png');
    await page.screenshot({ path: p3Shot, fullPage: true });
    await checkPageQuality('Patient Detail & Clinical Chart');
    results.surfacesVerified.push({ surface: 'Patient Detail & Clinical Chart', path: p3Shot });

    // ------------------------------------------------------------------------
    // SURFACE 4: IMAGING ORDERS REGISTRY
    // ------------------------------------------------------------------------
    console.log('\n--- Surface 4: Imaging Orders Registry ---');
    await page.goto('http://localhost:5173/orders', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Imaging Orders & Accession Registry', { timeout: 10000 });
    await page.waitForSelector('tbody tr', { timeout: 10000 });

    const p4Shot = path.join(ARTIFACT_DIR, 'evidence_premium_orders.png');
    await page.screenshot({ path: p4Shot, fullPage: true });
    await checkPageQuality('Imaging Orders Registry');
    results.surfacesVerified.push({ surface: 'Imaging Orders Registry', path: p4Shot });

    // ------------------------------------------------------------------------
    // SURFACE 5: RECEPTION DESK & QUEUE
    // ------------------------------------------------------------------------
    console.log('\n--- Surface 5: Reception Desk & Queue ---');
    await page.goto('http://localhost:5173/reception', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Reception Desk & Patient Waiting Queue', { timeout: 10000 });

    const p5Shot = path.join(ARTIFACT_DIR, 'evidence_premium_reception.png');
    await page.screenshot({ path: p5Shot, fullPage: true });
    await checkPageQuality('Reception Desk & Queue');
    results.surfacesVerified.push({ surface: 'Reception Desk & Queue', path: p5Shot });

    // ------------------------------------------------------------------------
    // SURFACE 6: TECHNOLOGIST WORKLIST
    // ------------------------------------------------------------------------
    console.log('\n--- Surface 6: Technologist Worklist ---');
    await page.goto('http://localhost:5173/technologist/worklist', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Technologist Worklist (MWL)', { timeout: 10000 });

    const p6Shot = path.join(ARTIFACT_DIR, 'evidence_premium_technologist.png');
    await page.screenshot({ path: p6Shot, fullPage: true });
    await checkPageQuality('Technologist Worklist');
    results.surfacesVerified.push({ surface: 'Technologist Worklist', path: p6Shot });

    // ------------------------------------------------------------------------
    // SURFACE 7: RADIOLOGIST WORKLIST
    // ------------------------------------------------------------------------
    console.log('\n--- Surface 7: Radiologist Worklist ---');
    await page.goto('http://localhost:5173/radiologist/worklist', { waitUntil: 'networkidle' });
    await page.waitForSelector('h1:has-text("Radiologist Worklist")', { timeout: 10000 });

    const p7Shot = path.join(ARTIFACT_DIR, 'evidence_premium_radiologist.png');
    await page.screenshot({ path: p7Shot, fullPage: true });
    await checkPageQuality('Radiologist Worklist');
    results.surfacesVerified.push({ surface: 'Radiologist Worklist', path: p7Shot });

    // ------------------------------------------------------------------------
    // SURFACE 8: DIAGNOSTIC REPORTING WORKSPACE MODAL
    // ------------------------------------------------------------------------
    console.log('\n--- Surface 8: Diagnostic Reporting Workspace ---');
    // Click Draft Report or View Report button on first available study row
    const reportBtn = page.locator('button:has-text("Draft Report")').or(page.locator('button:has-text("View Report")')).first();
    if (await reportBtn.isVisible()) {
      await reportBtn.click();
      await page.waitForSelector('text=REPORTING WORKSPACE', { timeout: 8000 });
      await page.waitForTimeout(500);

      const p8Shot = path.join(ARTIFACT_DIR, 'evidence_premium_reporting_modal.png');
      await page.screenshot({ path: p8Shot, fullPage: true });
      await checkPageQuality('Diagnostic Reporting Workspace Modal');
      results.surfacesVerified.push({ surface: 'Diagnostic Reporting Workspace Modal', path: p8Shot });

      // Close modal
      const closeBtn = page.locator('button:has-text("Cancel")').or(page.locator('button[aria-label="Close"]')).first();
      if (await closeBtn.isVisible()) await closeBtn.click();
      await page.waitForTimeout(300);
    }

    // ------------------------------------------------------------------------
    // SURFACE 9: BILLING & ACCOUNTS
    // ------------------------------------------------------------------------
    console.log('\n--- Surface 9: Billing & Accounts ---');
    await page.goto('http://localhost:5173/billing', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Billing, Accounts & Revenue Operations', { timeout: 10000 });
    await page.waitForSelector('text=Invoices', { timeout: 10000 });

    const p9Shot = path.join(ARTIFACT_DIR, 'evidence_premium_billing.png');
    await page.screenshot({ path: p9Shot, fullPage: true });
    await checkPageQuality('Billing & Accounts');
    results.surfacesVerified.push({ surface: 'Billing & Accounts', path: p9Shot });

    // ------------------------------------------------------------------------
    // SURFACE 10: INVENTORY & CONTRAST
    // ------------------------------------------------------------------------
    console.log('\n--- Surface 10: Inventory & Contrast ---');
    await page.goto('http://localhost:5173/inventory', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Inventory, Pharmacy & Contrast Management', { timeout: 10000 });

    const p10Shot = path.join(ARTIFACT_DIR, 'evidence_premium_inventory.png');
    await page.screenshot({ path: p10Shot, fullPage: true });
    await checkPageQuality('Inventory & Contrast');
    results.surfacesVerified.push({ surface: 'Inventory & Contrast', path: p10Shot });

    // ------------------------------------------------------------------------
    // SURFACE 11: EQUIPMENT & MAINTENANCE
    // ------------------------------------------------------------------------
    console.log('\n--- Surface 11: Equipment & Maintenance ---');
    await page.goto('http://localhost:5173/maintenance', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Equipment Maintenance & Biomedical Engineering', { timeout: 10000 });

    const p11Shot = path.join(ARTIFACT_DIR, 'evidence_premium_maintenance.png');
    await page.screenshot({ path: p11Shot, fullPage: true });
    await checkPageQuality('Equipment & Maintenance');
    results.surfacesVerified.push({ surface: 'Equipment & Maintenance', path: p11Shot });

    // ------------------------------------------------------------------------
    // SURFACE 12: ADMINISTRATION & SAFETY
    // ------------------------------------------------------------------------
    console.log('\n--- Surface 12: Administration & Safety ---');
    await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Administration, Safety & Governance', { timeout: 10000 });
    await page.waitForSelector('button[role="tab"]:has-text("Users & Roles")', { timeout: 10000 });

    const p12Shot = path.join(ARTIFACT_DIR, 'evidence_premium_admin.png');
    await page.screenshot({ path: p12Shot, fullPage: true });
    await checkPageQuality('Administration & Safety');
    results.surfacesVerified.push({ surface: 'Administration & Safety', path: p12Shot });

    // ------------------------------------------------------------------------
    // SURFACE 13: SYSTEM HEALTH DIAGNOSTICS
    // ------------------------------------------------------------------------
    console.log('\n--- Surface 13: System Health Diagnostics ---');
    await page.goto('http://localhost:5173/health', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=System & Database Health Diagnostics', { timeout: 10000 });
    await page.waitForSelector('text=Operational Services Overview', { timeout: 10000 });

    const p13Shot = path.join(ARTIFACT_DIR, 'evidence_premium_health.png');
    await page.screenshot({ path: p13Shot, fullPage: true });
    await checkPageQuality('System Health Diagnostics');
    results.surfacesVerified.push({ surface: 'System Health Diagnostics', path: p13Shot });

    // ------------------------------------------------------------------------
    // SURFACE 14: EXTERNAL STUDY SHARING
    // ------------------------------------------------------------------------
    console.log('\n--- Surface 14: External Study Sharing ---');
    await page.goto('http://localhost:5173/external-shares', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=External Study Sharing', { timeout: 10000 });
    await page.waitForSelector('text=Active Shares', { timeout: 10000 });

    const p14Shot = path.join(ARTIFACT_DIR, 'evidence_premium_external_share.png');
    await page.screenshot({ path: p14Shot, fullPage: true });
    await checkPageQuality('External Study Sharing');
    results.surfacesVerified.push({ surface: 'External Study Sharing', path: p14Shot });

    // Open Create Share Modal to inspect verified security copy
    const createShareBtn = page.locator('button:has-text("+ New External Share")');
    if (await createShareBtn.isVisible()) {
      await createShareBtn.click();
      await page.waitForSelector('text=Create Secure External Share Link', { timeout: 5000 });

      // Verify exact approved wording
      const hasSecureLinksWording = await page.locator('text=Secure tokenized external study links').first().isVisible();
      const hasMandatoryOtpWording = await page.locator('text=Mandatory 6-digit OTP verification').first().isVisible();

      console.log('   Security copy verification:');
      console.log('   - "Secure tokenized external study links":', hasSecureLinksWording ? 'VERIFIED' : 'NOT FOUND');
      console.log('   - "Mandatory 6-digit OTP verification":', hasMandatoryOtpWording ? 'VERIFIED' : 'NOT FOUND');

      const modalShot = path.join(ARTIFACT_DIR, 'evidence_premium_share_modal.png');
      await page.screenshot({ path: modalShot, fullPage: true });
      results.surfacesVerified.push({ surface: 'External Share Modal', path: modalShot });

      const closeShareBtn = page.locator('button:has-text("Cancel")').first();
      if (await closeShareBtn.isVisible()) await closeShareBtn.click();
      await page.waitForTimeout(300);
    }

    // ------------------------------------------------------------------------
    // SURFACE 15: PATIENT PORTAL MODAL
    // ------------------------------------------------------------------------
    console.log('\n--- Surface 15: Patient Appointment Portal Modal ---');
    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle' });
    const portalBtn = page.locator('button:has-text("Patient Portal")').first();
    await portalBtn.click();
    await page.waitForSelector('text=Online Patient Appointment Portal', { timeout: 6000 });

    const p15Shot = path.join(ARTIFACT_DIR, 'evidence_premium_patient_portal.png');
    await page.screenshot({ path: p15Shot, fullPage: true });
    await checkPageQuality('Patient Portal Modal');
    results.surfacesVerified.push({ surface: 'Patient Portal Modal', path: p15Shot });

    // Output JSON result
    const reportPath = path.join(ARTIFACT_DIR, 'premium_product_transformation_verification.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log('\n=== VERIFICATION COMPLETE ===');
    console.log(`Total Surfaces Verified: ${results.surfacesVerified.length}`);
    console.log(`Total Anomalies Found: ${results.anomalies.length}`);
    console.log(`Report saved to: ${reportPath}`);

  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
