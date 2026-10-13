import puppeteer from 'puppeteer';
import fs from 'fs';

// Screenshots stay out of public/, which ships to production.
fs.mkdirSync('docs/evidence/screenshots', { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200 });

  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle2', timeout: 30000 });

  // Click PLTS Atap sub-item
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.textContent.includes('Kelistrikan PLTS Atap') || el.textContent.includes('PLTS Atap'));
    if (b) b.click();
  });

  // Wait until dashboardData is loaded (KPI shows 5.876,12 or 4.804.339 or loading text is gone)
  await page.waitForFunction(() => {
    return document.body.textContent.includes('5.876,12') || document.body.textContent.includes('4.804.339');
  }, { timeout: 15000 }).catch(() => console.log('Timeout waiting for specific text, proceeding...'));

  await new Promise(r => setTimeout(r, 2000));

  // 1. Screenshot of Top 4 KPI Cards
  await page.screenshot({ path: 'docs/evidence/screenshots/clean_kpi_cards.png' });
  console.log('Saved docs/evidence/screenshots/clean_kpi_cards.png');

  // Find the Analisis Kinerja PLTS container
  const getAnalysisEl = async () => page.$('[data-plts-performance-analysis="true"]');

  // Click Tab 1: Produksi vs Target
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.textContent.includes('Produksi vs Target'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  let el = await getAnalysisEl();
  if (el) await el.screenshot({ path: 'docs/evidence/screenshots/tab1_produksi_element.png' });
  console.log('Saved docs/evidence/screenshots/tab1_produksi_element.png');

  // Click Tab 2: Performa Sistem (PR)
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.textContent.includes('Performa Sistem (PR)'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  el = await getAnalysisEl();
  if (el) await el.screenshot({ path: 'docs/evidence/screenshots/tab2_pr_element.png' });
  console.log('Saved docs/evidence/screenshots/tab2_pr_element.png');

  // Click Tab 3: Parameter Pendukung
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.textContent.includes('Parameter Pendukung'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  el = await getAnalysisEl();
  if (el) await el.screenshot({ path: 'docs/evidence/screenshots/tab3_support_element.png' });
  console.log('Saved docs/evidence/screenshots/tab3_support_element.png');

  // Click Tab 4: Beban vs PLTS
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.textContent.includes('Beban vs PLTS'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  el = await getAnalysisEl();
  if (el) await el.screenshot({ path: 'docs/evidence/screenshots/tab4_load_element.png' });
  console.log('Saved docs/evidence/screenshots/tab4_load_element.png');

  // Click Tab 4 by-branch view
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.textContent.includes('Perbandingan per Cabang DC'));
    if (b) b.click();
  });
  // Listen for console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Capture Monthly Matrix Table
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight / 2);
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'docs/evidence/screenshots/monthly_matrix_table.png' });
  console.log('Saved docs/evidence/screenshots/monthly_matrix_table.png');

  await browser.close();
  console.log('Console errors count:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.error('Console errors:', consoleErrors);
  }
  console.log('DONE!');
})();
