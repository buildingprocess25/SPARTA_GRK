import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('docs/evidence/regression');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function captureAllViews() {
  console.log('Capturing all regression views...');
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1440, height: 960 }
  });

  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle2', timeout: 30000 });

    // Switch to PLTS tab
    const pltsTabBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.innerText && b.innerText.includes('Kelistrikan PLTS Atap'));
    });
    await pltsTabBtn.click();
    await new Promise(r => setTimeout(r, 1500));

    // 1. Overview & Target RKAP
    console.log('1. Capturing 01_overview_rkap_SESUDAH.png ...');
    await page.screenshot({
      path: path.join(outDir, '01_overview_rkap_SESUDAH.png'),
      fullPage: false
    });

    // 2. Switch to Live iSolarCloud API View
    const apiBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.innerText && b.innerText.includes('Live iSolarCloud API'));
    });
    await apiBtn.click();
    await new Promise(r => setTimeout(r, 2000));

    // 2. Master-Detail (Daftar Lokasi + Trend Chart)
    console.log('2. Capturing 02_daftar_lokasi_ranking_SESUDAH.png ...');
    await page.screenshot({
      path: path.join(outDir, '02_daftar_lokasi_ranking_SESUDAH.png'),
      fullPage: false
    });

    // 3. Scroll to Tabel Data Matang
    console.log('3. Capturing 03_tabel_data_matang_SESUDAH.png ...');
    const tableEl = await page.$('table');
    if (tableEl) {
      await page.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }), tableEl);
      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({
        path: path.join(outDir, '03_tabel_data_matang_SESUDAH.png'),
        fullPage: false
      });
    }

    // 4. Switch to Telemetri Live per DC sub-tab in analytics
    const telemetryTabBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.innerText && b.innerText.includes('Telemetri Live per DC'));
    });
    if (telemetryTabBtn) {
      await telemetryTabBtn.click();
      await new Promise(r => setTimeout(r, 1000));
      console.log('4. Capturing 04_telemetri_live_dc_SESUDAH.png ...');
      await page.screenshot({
        path: path.join(outDir, '04_telemetri_live_dc_SESUDAH.png'),
        fullPage: false
      });
    }

    // 5. Full Page View
    console.log('5. Capturing 05_full_plts_dashboard_SESUDAH.png ...');
    await page.screenshot({
      path: path.join(outDir, '05_full_plts_dashboard_SESUDAH.png'),
      fullPage: true
    });

    console.log('All regression screenshots successfully saved in docs/evidence/regression/');
  } finally {
    await browser.close();
  }
}

captureAllViews().catch(console.error);
