const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const ARTIFACT_DIR = 'C:\\Users\\mange\\.gemini\\antigravity\\brain\\797b42dd-d491-4463-b8a8-1f02276b71ae';

async function run() {
  console.log('=== STARTING MODULE 13 DYNAMIC PLAYWRIGHT ACCEPTANCE TEST ===');
  const browser = await chromium.launch({ headless: true });

  try {
    // ------------------------------------------------------------------------
    // FLOW A: Staff Login & External Share Creation
    // ------------------------------------------------------------------------
    console.log('\n--- FLOW A: Staff Login & External Share Creation ---');
    const staffContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const staffPage = await staffContext.newPage();

    console.log('1. Navigating to login page...');
    await staffPage.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });

    console.log('2. Authenticating as Clinical Admin (Dr. Arthur Evans)...');
    const adminQuickBtn = staffPage.locator('button:has-text("Dr. Arthur Evans")');
    await adminQuickBtn.click();
    await staffPage.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('   Authenticated successfully. Current URL:', staffPage.url());

    console.log('3. Navigating to External Shares management portal...');
    await staffPage.goto('http://localhost:5173/external-shares', { waitUntil: 'networkidle' });
    await staffPage.waitForSelector('text=External Scan & Report Sharing', { timeout: 10000 });

    console.log('4. Opening Create New Share Modal...');
    const newShareBtn = staffPage.locator('button:has-text("New External Share Link")');
    await newShareBtn.click();
    await staffPage.waitForSelector('text=Create Secure External Share Link', { timeout: 5000 });

    console.log('5. Verifying mandatory access control badge presence in UI...');
    const mandatoryBadge = await staffPage.locator('text=Mandatory Recipient Access Control (PDF Req 6)').isVisible();
    if (!mandatoryBadge) {
      throw new Error('FAILED: Mandatory Recipient Access Control badge is missing from CreateShareModal');
    }
    console.log('   Verified: Mandatory Recipient Access Control (PDF Req 6) badge is present.');

    console.log('6. Selecting demo examination ACC-2026-DEMO01...');
    const orderSelect = staffPage.locator('form select').first();
    const options = await orderSelect.locator('option').allInnerTexts();
    console.log('   Available options count:', options.length);
    console.log('   First 5 options:', options.slice(0, 5));
    const demoOption = options.find(o => o.includes('ACC-2026-DEMO01'));
    if (!demoOption) {
      throw new Error(`FAILED: Could not find ACC-2026-DEMO01 in examination dropdown. Available: ${options.slice(0, 10).join(', ')}`);
    }
    await orderSelect.selectOption({ label: demoOption });

    console.log('7. Filling recipient details...');
    await staffPage.fill('input[placeholder="e.g., Dr. Marcus Vance"]', 'Dr. Sarah Connor, Chief Radiologist');
    await staffPage.fill('input[placeholder="e.g., Attending Neurosurgeon"]', 'Consulting Specialist');
    await staffPage.fill('input[placeholder="e.g., Metro Neuroscience"]', 'Cyberdyne Medical Center');

    console.log('8. Submitting share creation form...');
    const submitBtn = staffPage.locator('button[type="submit"]:has-text("Generate External Share Link")');
    await submitBtn.click();

    // Check if error appeared
    await staffPage.waitForTimeout(2000);
    const modalError = await staffPage.locator('.bg-rose-50').allInnerTexts();
    if (modalError.length > 0) {
      console.error('   Modal error observed:', modalError);
    }

    // Wait for modal to close
    try {
      await staffPage.waitForSelector('text=Create Secure External Share Link', { state: 'detached', timeout: 5000 });
      console.log('   Share creation submitted successfully (modal detached).');
    } catch {
      console.log('   Modal did not detach. Checking error or status...');
      const errors = await staffPage.locator('form').innerText();
      console.log('   Form content:', errors);
    }

    // Wait for table to reload with the new share
    await staffPage.waitForTimeout(1000);
    const tableRow = staffPage.locator('tr:has-text("Dr. Sarah Connor")').first();
    await tableRow.waitFor({ state: 'visible', timeout: 10000 });
    const rowText = await tableRow.innerText();
    console.log('   New share located in staff table:');
    console.log('   Row preview:', rowText.split('\n').slice(0, 5).join(' | '));

    // Extract OTP code from the row text (format: "Code: 123456")
    const codeMatch = rowText.match(/Code:\s*(\d{6})/);
    if (!codeMatch) {
      throw new Error('FAILED: Could not find 6-digit OTP code in staff table row');
    }
    const otpCode = codeMatch[1];
    console.log(`   Captured generated OTP code: [${otpCode}]`);

    // Fetch the latest share token from the API directly using staff session
    const staffStorage = await staffContext.storageState();
    let staffToken = null;
    for (const origin of staffStorage.origins) {
      for (const item of origin.localStorage) {
        if (item.name.includes('token') || item.name.includes('auth')) {
          try {
            const parsed = JSON.parse(item.value);
            if (parsed.token) staffToken = parsed.token;
          } catch {
            if (item.value.startsWith('ey')) staffToken = item.value;
          }
        }
      }
    }

    const sharesApiRes = await fetch('http://localhost:5000/api/v1/external-shares?limit=5', {
      headers: staffToken ? { Authorization: `Bearer ${staffToken}` } : {},
    });
    const sharesApiData = await sharesApiRes.json();
    const sharesList = Array.isArray(sharesApiData.data) ? sharesApiData.data : (sharesApiData.data?.items || []);
    const createdShare = sharesList.find(s => s.recipientName.includes('Dr. Sarah Connor'));
    if (!createdShare) {
      throw new Error('FAILED: Could not find created share in API list');
    }
    const shareToken = createdShare.shareToken;
    const shareId = createdShare.id;
    console.log(`   Resolved shareToken: ${shareToken}`);
    console.log(`   Resolved shareId: ${shareId}`);

    // ------------------------------------------------------------------------
    // FLOW B: Pre-OTP Recipient Access Gating
    // ------------------------------------------------------------------------
    console.log('\n--- FLOW B: Pre-OTP Recipient Access Gating ---');
    // Open a completely separate incognito recipient session
    const recipientContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const recipientPage = await recipientContext.newPage();

    const shareUrl = `http://localhost:5173/share/${shareToken}`;
    console.log(`1. Recipient navigating to public link: ${shareUrl}`);
    await recipientPage.goto(shareUrl, { waitUntil: 'networkidle' });

    console.log('2. Verifying Pre-OTP Access Gate UI...');
    await recipientPage.waitForSelector('text=Clinical Access Verification', { timeout: 10000 });
    await recipientPage.waitForSelector('text=Enter 6-Digit Security Code (OTP)', { timeout: 5000 });

    const pageContentPreOtp = await recipientPage.content();

    // Verify clinical information is strictly absent
    const leaks = [];
    if (pageContentPreOtp.includes('Eleanor Vance')) leaks.push('Patient Name (Eleanor Vance)');
    if (pageContentPreOtp.includes('1985-04-12')) leaks.push('Date of Birth');
    if (pageContentPreOtp.includes('findings') && pageContentPreOtp.includes('consolidation')) leaks.push('Diagnostic Findings');
    if (pageContentPreOtp.includes('Launch Web Viewer')) leaks.push('Web Viewer Launch Button');
    if (pageContentPreOtp.includes('Download Report PDF')) leaks.push('Download Report PDF Button');
    if (pageContentPreOtp.includes('Download ZIP')) leaks.push('Download DICOM ZIP Button');

    if (leaks.length > 0) {
      throw new Error(`CRITICAL SECURITY FAILURE: Pre-OTP access gate leaked clinical data: ${leaks.join(', ')}`);
    }
    console.log('   Strict Access Control Confirmed: 0 clinical leaks detected prior to OTP entry.');

    const preOtpScreenshotPath = path.join(ARTIFACT_DIR, 'evidence_module_13_pre_otp_gate.png');
    await recipientPage.screenshot({ path: preOtpScreenshotPath, fullPage: true });
    console.log(`   Captured Pre-OTP Gate screenshot: ${preOtpScreenshotPath}`);

    // ------------------------------------------------------------------------
    // FLOW C & D: Recipient OTP Verification & Unlocked Portal
    // ------------------------------------------------------------------------
    console.log('\n--- FLOW C & D: OTP Verification & Unlocked Clinical Portal ---');
    console.log(`1. Entering OTP [${otpCode}] into recipient portal...`);
    const otpInput = recipientPage.locator('input[placeholder="e.g. 849201"]');
    await otpInput.fill(otpCode);

    console.log('2. Clicking "Unlock Diagnostic Study"...');
    const unlockBtn = recipientPage.locator('button:has-text("Unlock Diagnostic Study")');
    await unlockBtn.click();

    console.log('3. Waiting for unlocked clinical portal transition...');
    await recipientPage.waitForSelector('text=Patient Demographics', { timeout: 10000 });
    await recipientPage.waitForSelector('text=Eleanor Vance (Demo)', { timeout: 5000 });
    await recipientPage.waitForSelector('text=ACC-2026-DEMO01', { timeout: 5000 });
    await recipientPage.waitForSelector('text=FINAL & LOCKED', { timeout: 5000 });
    await recipientPage.waitForSelector('text=Official Diagnostic Radiology Report', { timeout: 5000 });

    console.log('4. Verifying clinical artifact access capabilities...');
    const webViewerBtn = recipientPage.locator('a:has-text("Launch Web Viewer")');
    const reportPdfBtn = recipientPage.locator('a:has-text("Download Report PDF")');
    const dicomZipBtn = recipientPage.locator('a:has-text("Download ZIP")');

    await webViewerBtn.waitFor({ state: 'visible', timeout: 5000 });
    await reportPdfBtn.waitFor({ state: 'visible', timeout: 5000 });
    await dicomZipBtn.waitFor({ state: 'visible', timeout: 5000 });

    const webViewerHref = await webViewerBtn.getAttribute('href');
    console.log(`   Verified Web Viewer link: ${webViewerHref}`);
    if (!webViewerHref.includes('shareToken=')) {
      throw new Error('FAILED: webViewerUrl does not include shareToken parameter');
    }

    const verifiedScreenshotPath = path.join(ARTIFACT_DIR, 'evidence_module_13_verified_portal.png');
    await recipientPage.screenshot({ path: verifiedScreenshotPath, fullPage: true });
    console.log(`   Captured Verified Portal screenshot: ${verifiedScreenshotPath}`);

    // ------------------------------------------------------------------------
    // FLOW E: Verified Report PDF Download
    // ------------------------------------------------------------------------
    console.log('\n--- FLOW E: Verified Report PDF Download ---');
    const pdfRes = await fetch(`http://localhost:5000/api/v1/external-shares/${shareToken}/report-pdf`);
    console.log(`1. Report PDF response status: ${pdfRes.status}`);
    if (pdfRes.status !== 200) {
      throw new Error(`FAILED: Report PDF returned HTTP ${pdfRes.status}`);
    }
    const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
    const pdfMagic = pdfBuf.slice(0, 4).toString('utf8');
    console.log(`2. Report PDF signature: "${pdfMagic}", size: ${pdfBuf.length} bytes`);
    if (pdfMagic !== '%PDF') {
      throw new Error(`FAILED: Report PDF does not start with %PDF header, got "${pdfMagic}"`);
    }
    console.log('   Report PDF download verified successfully.');

    // ------------------------------------------------------------------------
    // FLOW F: Authentic Orthanc DICOM Package Download
    // ------------------------------------------------------------------------
    console.log('\n--- FLOW F: Authentic Orthanc DICOM Package Download ---');
    console.log('1. Requesting DICOM package from /api/v1/external-shares/:token/dicom-package...');
    const dicomRes = await fetch(`http://localhost:5000/api/v1/external-shares/${shareToken}/dicom-package`);
    console.log(`2. DICOM package response status: ${dicomRes.status}`);
    if (dicomRes.status !== 200) {
      const errText = await dicomRes.text();
      throw new Error(`FAILED: DICOM package returned HTTP ${dicomRes.status}: ${errText}`);
    }
    const dicomBuf = Buffer.from(await dicomRes.arrayBuffer());
    const dicomZipMagic = dicomBuf.slice(0, 4).toString('hex');
    console.log(`3. DICOM package signature: 0x${dicomZipMagic}, total bytes: ${dicomBuf.length}`);
    if (dicomZipMagic !== '504b0304') {
      throw new Error(`FAILED: Package is not a valid PKZIP archive, got signature 0x${dicomZipMagic}`);
    }
    if (dicomBuf.length < 1000000) {
      throw new Error(`FAILED: DICOM package size (${dicomBuf.length} bytes) is too small to be the authentic Orthanc study archive`);
    }

    // Inspect files inside ZIP archive
    let idx = 0;
    const fileEntries = [];
    while ((idx = dicomBuf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), idx)) !== -1 && fileEntries.length < 10) {
      const fnLen = dicomBuf.readUInt16LE(idx + 26);
      const fn = dicomBuf.slice(idx + 30, idx + 30 + fnLen).toString('utf8');
      fileEntries.push(fn);
      idx += 30 + fnLen;
    }
    console.log('4. Sample authentic DICOM files from package:');
    fileEntries.slice(0, 3).forEach(f => console.log('   -', f));
    const hasDcm = fileEntries.some(f => f.endsWith('.dcm'));
    if (!hasDcm) {
      throw new Error('FAILED: Authentic study package does not contain .dcm files');
    }
    console.log('   Authentic Orthanc DICOM package verified successfully.');

    // ------------------------------------------------------------------------
    // FLOW G: Staff Revocation & Recipient 403 Denial
    // ------------------------------------------------------------------------
    console.log('\n--- FLOW G: Staff Revocation & Recipient 403 Denial ---');
    console.log('1. Setting dialog handler in staff page and clicking Revoke...');
    staffPage.on('dialog', async (dialog) => {
      console.log(`   Staff prompt dialog observed: "${dialog.message()}". Accepting with reason...`);
      await dialog.accept('Access terminated per clinical compliance protocol');
    });

    const revokeBtn = tableRow.locator('button:has-text("Revoke")');
    await revokeBtn.click();

    console.log('2. Waiting for share status to become Revoked in staff table...');
    await staffPage.waitForSelector('span:has-text("Revoked")', { timeout: 10000 });
    console.log('   Staff table confirms status = Revoked.');

    console.log('3. Recipient reloading the share page...');
    await recipientPage.reload({ waitUntil: 'networkidle' });

    console.log('4. Verifying immediate HTTP 403 / Access Restricted rejection...');
    await recipientPage.waitForSelector('text=Access Restricted', { timeout: 10000 });
    await recipientPage.waitForSelector('text=This share link has been revoked', { timeout: 5000 });

    const revokedScreenshotPath = path.join(ARTIFACT_DIR, 'evidence_module_13_revoked_state.png');
    await recipientPage.screenshot({ path: revokedScreenshotPath, fullPage: true });
    console.log(`   Captured Revoked State screenshot: ${revokedScreenshotPath}`);

    // Verify negative access on API endpoints post-revocation
    const postRevokePdfRes = await fetch(`http://localhost:5000/api/v1/external-shares/${shareToken}/report-pdf`);
    const postRevokeDicomRes = await fetch(`http://localhost:5000/api/v1/external-shares/${shareToken}/dicom-package`);
    console.log(`5. Post-revocation Report PDF status: ${postRevokePdfRes.status} (Expected 403)`);
    console.log(`6. Post-revocation DICOM package status: ${postRevokeDicomRes.status} (Expected 403)`);

    if (postRevokePdfRes.status !== 403 || postRevokeDicomRes.status !== 403) {
      throw new Error(`FAILED: Revocation did not block binary endpoints with HTTP 403`);
    }

    console.log('\n=== ALL 7 PLAYWRIGHT DYNAMIC FLOWS PASSED SUCCESSFULLY! ===');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('\nPLAYWRIGHT ACCEPTANCE TEST RUNNER ERROR:', err);
  process.exit(1);
});
