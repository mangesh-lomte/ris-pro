const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const ARTIFACT_DIR = 'C:\\Users\\mange\\.gemini\\antigravity\\brain\\797b42dd-d491-4463-b8a8-1f02276b71ae';

async function run() {
  console.log('=== STARTING MODULE 14 PLAYWRIGHT ACCEPTANCE TEST ===');
  const browser = await chromium.launch({ headless: true });

  try {
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminPage = await adminContext.newPage();

    // ------------------------------------------------------------------------
    // FLOW A: Admin Login & Users / Role Management (Req 1)
    // ------------------------------------------------------------------------
    console.log('\n--- FLOW A: Admin Login & Users / Role Management ---');
    await adminPage.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });

    console.log('1. Authenticating as Clinical Admin (Dr. Arthur Evans)...');
    const adminQuickBtn = adminPage.locator('button:has-text("Dr. Arthur Evans")');
    await adminQuickBtn.click();
    await adminPage.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('   Authenticated successfully. Current URL:', adminPage.url());

    console.log('2. Navigating to Administration, Safety & Reports (/admin)...');
    await adminPage.goto('http://localhost:5173/admin', { waitUntil: 'networkidle' });
    await adminPage.waitForSelector('text=Administration, Safety & Reports', { timeout: 10000 });

    console.log('3. Verifying Users & Roles tab is active...');
    await adminPage.waitForSelector('text=Add Staff User', { timeout: 5000 });
    await adminPage.waitForSelector('tbody tr', { timeout: 5000 });
    const staffCount = await adminPage.locator('tbody tr').count();
    console.log('   Staff users displayed in table:', staffCount);

    const userScreenshotPath = path.join(ARTIFACT_DIR, 'evidence_module_14_users.png');
    await adminPage.screenshot({ path: userScreenshotPath, fullPage: true });
    console.log('   Captured screenshot:', userScreenshotPath);

    // ------------------------------------------------------------------------
    // FLOW B: Audit Trail Inspection & Filtering (Req 2)
    // ------------------------------------------------------------------------
    console.log('\n--- FLOW B: Audit Trail Inspection & Filtering ---');
    const auditTabBtn = adminPage.locator('button:has-text("2. Audit Trail")');
    await auditTabBtn.click();
    await adminPage.waitForSelector('text=Showing Audit Logs', { timeout: 5000 });
    await adminPage.waitForSelector('tbody tr', { timeout: 5000 });
    const auditRowCount = await adminPage.locator('tbody tr').count();
    console.log('   Audit trail rows displayed:', auditRowCount);

    const auditScreenshotPath = path.join(ARTIFACT_DIR, 'evidence_module_14_audit.png');
    await adminPage.screenshot({ path: auditScreenshotPath, fullPage: true });
    console.log('   Captured screenshot:', auditScreenshotPath);

    // ------------------------------------------------------------------------
    // FLOW C: Patient Merge / Correction Control (Req 3)
    // ------------------------------------------------------------------------
    console.log('\n--- FLOW C: Patient Merge / Correction Control ---');
    const mergeTabBtn = adminPage.locator('button:has-text("3. Patient Merge")');
    await mergeTabBtn.click();
    await adminPage.waitForSelector('text=Execute Patient Merge', { timeout: 5000 });
    await adminPage.waitForSelector('text=Patient Merge Audit Ledger', { timeout: 5000 });

    const mergeScreenshotPath = path.join(ARTIFACT_DIR, 'evidence_module_14_patient_merge.png');
    await adminPage.screenshot({ path: mergeScreenshotPath, fullPage: true });
    console.log('   Captured screenshot:', mergeScreenshotPath);

    // ------------------------------------------------------------------------
    // FLOW D: Service Masters & Reporting Templates (Req 6)
    // ------------------------------------------------------------------------
    console.log('\n--- FLOW D: Service & Report Masters ---');
    const mastersTabBtn = adminPage.locator('button:has-text("6. Service Masters")');
    await mastersTabBtn.click();
    await adminPage.waitForSelector('text=Examination Service Catalog', { timeout: 5000 });
    await adminPage.waitForSelector('text=Radiology Reporting Templates', { timeout: 5000 });

    const mastersScreenshotPath = path.join(ARTIFACT_DIR, 'evidence_module_14_masters.png');
    await adminPage.screenshot({ path: mastersScreenshotPath, fullPage: true });
    console.log('   Captured screenshot:', mastersScreenshotPath);

    // ------------------------------------------------------------------------
    // FLOW E: Operational KPIs & Quality Reports (Req 7, 8)
    // ------------------------------------------------------------------------
    console.log('\n--- FLOW E: Operational KPIs & Quality Incident Reports ---');
    const kpiTabBtn = adminPage.locator('button:has-text("7. Operational KPIs")');
    await kpiTabBtn.click();
    await adminPage.waitForSelector('text=Diagnostic TAT', { timeout: 5000 });
    await adminPage.waitForSelector('text=Modality Volume Breakdown', { timeout: 5000 });

    const kpiScreenshotPath = path.join(ARTIFACT_DIR, 'evidence_module_14_kpi_quality.png');
    await adminPage.screenshot({ path: kpiScreenshotPath, fullPage: true });
    console.log('   Captured screenshot:', kpiScreenshotPath);

    // ------------------------------------------------------------------------
    // FLOW F: Integration Health Dashboard (Req 9)
    // ------------------------------------------------------------------------
    console.log('\n--- FLOW F: Integration Health Dashboard ---');
    const healthTabBtn = adminPage.locator('button:has-text("9. Integration Health")');
    await healthTabBtn.click();
    await adminPage.waitForSelector('text=System Integration Posture', { timeout: 5000 });
    await adminPage.waitForSelector('text=PostgreSQL Relational Storage', { timeout: 5000 });

    const healthScreenshotPath = path.join(ARTIFACT_DIR, 'evidence_module_14_integration_health.png');
    await adminPage.screenshot({ path: healthScreenshotPath, fullPage: true });
    console.log('   Captured screenshot:', healthScreenshotPath);

    // ------------------------------------------------------------------------
    // FLOW G: Backup & Disaster Recovery Checks (Req 10)
    // ------------------------------------------------------------------------
    console.log('\n--- FLOW G: Backup & Disaster Recovery Checks ---');
    const backupTabBtn = adminPage.locator('button:has-text("10. Backup & DR")');
    await backupTabBtn.click();
    await adminPage.waitForSelector('text=Database Backup & Recovery Catalog', { timeout: 5000 });
    await adminPage.waitForSelector('text=Trigger Database Backup', { timeout: 5000 });

    const backupScreenshotPath = path.join(ARTIFACT_DIR, 'evidence_module_14_backup_dr.png');
    await adminPage.screenshot({ path: backupScreenshotPath, fullPage: true });
    console.log('   Captured screenshot:', backupScreenshotPath);

    await adminContext.close();

    // ------------------------------------------------------------------------
    // FLOW H: Non-Admin RBAC Protection Gate (Req 1, 4)
    // ------------------------------------------------------------------------
    console.log('\n--- FLOW H: Non-Admin RBAC Protection Gate ---');
    const techContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const techPage = await techContext.newPage();

    console.log('1. Logging in as Technologist (Elena Rostova)...');
    await techPage.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
    const techQuickBtn = techPage.locator('button:has-text("Elena Rostova")');
    await techQuickBtn.click();
    await techPage.waitForURL('**/dashboard', { timeout: 10000 });

    console.log('2. Attempting to directly navigate to /admin...');
    await techPage.goto('http://localhost:5173/admin', { waitUntil: 'networkidle' });
    await techPage.waitForTimeout(1000);

    console.log('3. Verifying RBAC Access Denied gate...');
    await techPage.waitForSelector('text=Access Denied', { timeout: 5000 });
    const accessDeniedText = await techPage.locator('text=You do not have permission to access this page').isVisible();
    const requiredRoleText = await techPage.locator('text=ADMIN').first().isVisible();
    const adminHeadingVisible = await techPage.locator('text=Administration, Safety & Reports').isVisible();

    if (!accessDeniedText || !requiredRoleText) {
      throw new Error('FAILED: Access Denied card was not rendered for non-admin user!');
    }
    if (adminHeadingVisible) {
      throw new Error('FAILED: AdminPage content leaked to unauthorized user!');
    }
    console.log('   Verified: ProtectedRoute blocked unauthorized access and rendered Access Denied banner.');

    const rbacScreenshotPath = path.join(ARTIFACT_DIR, 'evidence_module_14_rbac_denial.png');
    await techPage.screenshot({ path: rbacScreenshotPath, fullPage: true });
    console.log('   Captured screenshot:', rbacScreenshotPath);

    await techContext.close();

    console.log('\n=== ALL MODULE 14 PLAYWRIGHT ACCEPTANCE FLOWS PASSED SUCCESSFULLY ===');
  } catch (err) {
    console.error('\n❌ PLAYWRIGHT TEST ERROR:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
