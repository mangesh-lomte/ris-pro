const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to login...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  console.log('Logging in as Admin...');
  const adminBtn = page.locator('button:has-text("Dr. Arthur Evans"), button:has-text("Admin")').first();
  if (await adminBtn.isVisible()) {
    await adminBtn.click();
  } else {
    await page.fill('input[type="email"]', 'admin@ris.local');
    await page.fill('input[type="password"]', 'Demo@123');
    await page.click('button[type="submit"]');
  }

  await page.waitForTimeout(2000);
  console.log('Navigating to /external-shares...');
  await page.goto('http://localhost:5173/external-shares', { waitUntil: 'domcontentloaded' });

  console.log('Waiting for External Shares content to render...');
  await page.waitForSelector('text=External Scan & Report Sharing', { timeout: 15000 });
  await page.waitForTimeout(3000);

  const localFile = path.resolve('evidence_module_13_sharing.png');
  const brainDir = path.resolve('C:/Users/mange/.gemini/antigravity/brain/797b42dd-d491-4463-b8a8-1f02276b71ae');
  const brainFile = path.join(brainDir, 'evidence_module_13_sharing.png');

  await page.screenshot({ path: localFile, fullPage: false, timeout: 10000 });
  console.log('Saved local screenshot:', localFile);

  if (fs.existsSync(brainDir)) {
    fs.copyFileSync(localFile, brainFile);
    console.log('Copied to brain artifact dir:', brainFile);
  }

  await browser.close();
  console.log('Module 13 screenshot completed successfully.');
}

capture().catch((err) => {
  console.error('Failed to capture screenshot:', err);
  process.exit(1);
});

