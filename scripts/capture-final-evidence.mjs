import puppeteer from 'puppeteer';
import path from 'path';

const PORT = process.env.PORT || '3005';
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function captureEvidence() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('1. Capturing Initial Dashboard Load (Summary only)...');
  await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.screenshot({ path: path.join(process.cwd(), 'public', 'screenshot_overview_final.png') });

  console.log('2. Switching to PLTS Tab and Capturing...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const pltsBtn = buttons.find((b) => b.innerText.includes('Kelistrikan PLTS Atap') || b.innerText.includes('PLTS Atap'));
    if (pltsBtn) pltsBtn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(process.cwd(), 'public', 'screenshot_plts_summary_loaded.png') });

  console.log('3. Clicking PR Tab and Capturing...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const prTab = buttons.find((b) => b.innerText.includes('Performance Ratio') || b.innerText.includes('PR'));
    if (prTab) prTab.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(process.cwd(), 'public', 'screenshot_plts_pr_tab_loaded.png') });

  await browser.close();
  console.log('✅ Screenshots captured successfully!');
}

captureEvidence().catch(console.error);
