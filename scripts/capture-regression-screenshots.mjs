import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('docs/evidence/regression');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function captureScreenshots() {
  console.log('Launching browser to capture regression screenshots...');
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 }
  });

  try {
    const page = await browser.newPage();
    console.log('Navigating to http://127.0.0.1:3000 ...');
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for PLTS Tab to load
    await page.waitForSelector('button', { timeout: 10000 });

    // Click on Live iSolarCloud API sub-tab if needed
    const subTabButtons = await page.$$('button');
    for (const btn of subTabButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Live iSolarCloud API')) {
        console.log('Clicking Live iSolarCloud API sub-tab...');
        await btn.click();
        await new Promise(r => setTimeout(r, 2000));
        break;
      }
    }

    // Capture View 1: Master-Detail (Daftar Lokasi + Trend Chart)
    console.log('Capturing 01_daftar_lokasi_dan_grafik.png ...');
    await page.screenshot({
      path: path.join(outDir, '01_daftar_lokasi_dan_grafik.png'),
      fullPage: false
    });

    // Switch to Specific Yield metric and capture
    const metricSelect = await page.$('select');
    if (metricSelect) {
      // Find metric options
    }

    // Scroll down to Tabel Data Matang
    console.log('Capturing 02_tabel_data_matang.png ...');
    const tableEl = await page.$('table');
    if (tableEl) {
      await page.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }), tableEl);
      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({
        path: path.join(outDir, '02_tabel_data_matang.png'),
        fullPage: false
      });
    }

    // Capture full page
    console.log('Capturing 03_full_plts_dashboard.png ...');
    await page.screenshot({
      path: path.join(outDir, '03_full_plts_dashboard.png'),
      fullPage: true
    });

    console.log('Screenshots successfully saved in docs/evidence/regression/');
  } finally {
    await browser.close();
  }
}

captureScreenshots().catch(console.error);
