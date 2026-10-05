import puppeteer from 'puppeteer';

(async () => {
  console.log('Launching Puppeteer browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200 });

  const jsErrors = [];
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('Failed to load resource') && !text.includes('favicon')) {
      jsErrors.push(text);
      console.log('BROWSER CONSOLE ERROR:', text);
    }
  });
  page.on('pageerror', err => {
    jsErrors.push(err.message);
    console.log('BROWSER PAGE EXCEPTION:', err.message);
  });

  console.log('Navigating to http://127.0.0.1:3000...');
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  // Find and click 'Kelistrikan PLTS Atap' in sidebar
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const pltsBtn = btns.find(b => b.textContent.includes('Kelistrikan PLTS Atap') || b.textContent.includes('PLTS Atap'));
    if (pltsBtn) {
      pltsBtn.click();
      return true;
    }
    const pengurangBtn = btns.find(b => b.textContent.includes('Pengurang Emisi'));
    if (pengurangBtn) {
      pengurangBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked PLTS navigation:', clicked);
  await new Promise(r => setTimeout(r, 2000));

  // Screenshot 1: PLTS Overview Top with 4 StatCards
  await page.screenshot({ path: 'public/screenshot_plts_overview_top.png' });
  console.log('Captured public/screenshot_plts_overview_top.png');

  // Test Mode Toggle: Month mode
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const monthBtn = btns.find(b => b.textContent.includes('Bulan Ini Saja'));
    if (monthBtn) monthBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'public/screenshot_plts_mode_month.png' });
  console.log('Captured public/screenshot_plts_mode_month.png');

  // Switch back to YTD
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const ytdBtn = btns.find(b => b.textContent.includes('Akumulasi Jan-Sep'));
    if (ytdBtn) ytdBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  // Scroll to Analisis Kinerja PLTS
  await page.evaluate(() => {
    const el = document.querySelector('[data-plts-performance-analysis="true"]');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  });
  await new Promise(r => setTimeout(r, 800));

  // Click Sub-Tab 1: Produksi vs Target
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.textContent.includes('Produksi vs Target'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'public/screenshot_tab1_produksi.png' });
  console.log('Captured public/screenshot_tab1_produksi.png');

  // Click Sub-Tab 2: Performa Sistem (PR)
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.textContent.includes('Performa Sistem (PR)'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'public/screenshot_tab2_pr.png' });
  console.log('Captured public/screenshot_tab2_pr.png');

  // Click Sub-Tab 3: Parameter Pendukung
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.textContent.includes('Parameter Pendukung'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'public/screenshot_tab3_support.png' });
  console.log('Captured public/screenshot_tab3_support.png');

  // Click Sub-Tab 4: Beban vs PLTS
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.textContent.includes('Beban vs PLTS'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'public/screenshot_tab4_load.png' });
  console.log('Captured public/screenshot_tab4_load.png');

  // Test Sub-Tab 4 view mode: Perbandingan per Cabang DC
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.textContent.includes('Perbandingan per Cabang DC'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'public/screenshot_tab4_load_branch.png' });
  console.log('Captured public/screenshot_tab4_load_branch.png');

  await browser.close();
  console.log('Total JS Errors detected:', jsErrors.length);
  if (jsErrors.length > 0) {
    console.error('FAIL | JS errors:', jsErrors);
    process.exit(1);
  } else {
    console.log('ALL TABS TESTED AND SCREENSHOTS CAPTURED SUCCESSFULLY WITH 0 JS ERRORS!');
    process.exit(0);
  }
})();
