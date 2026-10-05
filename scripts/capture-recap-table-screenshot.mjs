import puppeteer from 'puppeteer';

async function captureScreenshots() {
  console.log('=== CAPTURING RECAP TABLE SCREENSHOTS & CHECKING CONSOLE ERRORS ===\n');

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1080 });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  console.log('Navigating to http://localhost:3000/ ...');
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0', timeout: 30000 });

  // Navigate to PLTS Tab if not active
  const pltsTabBtn = await page.$('button ::-p-text(PLTS (Solar PV))');
  if (pltsTabBtn) {
    await pltsTabBtn.click();
    await new Promise(r => setTimeout(r, 2000));
  }

  // Scroll to Recap Table
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight / 2);
  });
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: 'scripts/screenshot_matrix_table_final.png', fullPage: false });
  console.log('✓ Screenshot tabel rekap tersimpan di scripts/screenshot_matrix_table_final.png');

  console.log(`\nTotal Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('Console Errors:', consoleErrors);
  } else {
    console.log('✓ ZERO (0) CONSOLE ERRORS CONFIRMED.');
  }

  await browser.close();
}

captureScreenshots().catch(console.error);
