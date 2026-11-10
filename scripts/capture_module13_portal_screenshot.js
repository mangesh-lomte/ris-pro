const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const token = 'a1100c5699a4e041038a5cf2d55f3403ec8cb70b8673ced56b7508c667f221e0';
  console.log(`Navigating to public share portal: /share/${token}...`);
  await page.goto(`http://localhost:5173/share/${token}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const localFile = path.resolve('evidence_module_13_recipient_portal.png');
  const brainDir = path.resolve('C:/Users/mange/.gemini/antigravity/brain/797b42dd-d491-4463-b8a8-1f02276b71ae');
  const brainFile = path.join(brainDir, 'evidence_module_13_recipient_portal.png');

  await page.screenshot({ path: localFile, fullPage: false, timeout: 10000 });
  console.log('Saved local screenshot:', localFile);

  if (fs.existsSync(brainDir)) {
    fs.copyFileSync(localFile, brainFile);
    console.log('Copied to brain artifact dir:', brainFile);
  }

  await browser.close();
  console.log('Recipient portal screenshot completed successfully.');
}

capture().catch((err) => {
  console.error('Failed to capture screenshot:', err);
  process.exit(1);
});

