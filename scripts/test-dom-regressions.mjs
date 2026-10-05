import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

async function runDOMRegressionSuite() {
  console.log('=== TEST SUITE: DOM & UI COMPONENT REGRESSION TESTS ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 }
  });

  try {
    const page = await browser.newPage();
    
    // Listen for console errors
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    console.log('1. Navigating to http://127.0.0.1:3000 ...');
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle2', timeout: 30000 });
    assert.equal(pageErrors.length, 0, `Tidak boleh ada runtime error di browser: ${pageErrors.join(', ')}`);

    // Switch to Kelistrikan PLTS Atap tab
    console.log('2. Switching to "Kelistrikan PLTS Atap" tab...');
    const pltsTabBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.innerText && b.innerText.includes('Kelistrikan PLTS Atap'));
    });
    assert.ok(pltsTabBtn, 'Tombol tab "Kelistrikan PLTS Atap" harus ada');
    await pltsTabBtn.click();
    await new Promise(r => setTimeout(r, 1500));

    // =========================================================================
    // CHECK 1: SUB-TAB 1 (Overview & Target RKAP Resume)
    // =========================================================================
    console.log('3. Checking Overview & Target RKAP sub-tab...');
    const bodyText = await page.evaluate(() => document.body.innerText);

    // a) Check Total Production & Emission in Overview
    assert.ok(bodyText.includes('4.804.338,8') || bodyText.includes('4.804,34') || bodyText.includes('4804.34'), 'Total produksi 4.804.338,8 kWh / 4.804,34 MWh harus tampil di UI');
    assert.ok(bodyText.includes('3.730,30') || bodyText.includes('3730.30'), 'Total emisi 3.730,30 tCO2e harus tampil di UI');
    console.log('   ✔ Produksi 4.804.338,8 kWh (4.804,34 MWh) dan Emisi 3.730,30 tCO2e terverifikasi di DOM');

    // b) Check Rekap Bulanan tidak boleh menampilkan "Belum masuk" untuk Jan-Sep
    const rekapHasBelumMasukForJanSep = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      for (const r of rows) {
        const text = r.innerText;
        if (text.includes('Jan') || text.includes('Feb') || text.includes('Mar') || text.includes('Apr') || text.includes('Mei') || text.includes('Jun') || text.includes('Jul') || text.includes('Agu') || text.includes('Sep')) {
          if (text.includes('Belum masuk') || text.includes('belum masuk')) {
            return true;
          }
        }
      }
      return false;
    });
    assert.equal(rekapHasBelumMasukForJanSep, false, 'Tabel Rekap Bulanan tidak boleh menampilkan "Belum masuk" untuk bulan Jan-Sep 2026');
    console.log('   ✔ Tabel Rekap Bulanan Jan-Sep 2026 terisi valid (tanpa "Belum masuk")');

    // =========================================================================
    // CHECK 2: SUB-TAB 2 (Live iSolarCloud API View)
    // =========================================================================
    console.log('3. Navigating to Live iSolarCloud API sub-tab...');
    const apiBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.innerText.includes('Live iSolarCloud API'));
    });
    assert.ok(apiBtn, 'Tombol sub-tab Live iSolarCloud API harus ada');
    await apiBtn.click();
    await new Promise(r => setTimeout(r, 2000));

    const liveApiText = await page.evaluate(() => document.body.innerText);

    // a) Check Gateway Panel & Live StatCards exist
    assert.ok(liveApiText.includes('iSolarCloud Sungrow OpenAPI Gateway'), 'Panel gateway iSolarCloud harus tampil');
    assert.ok(liveApiText.includes('DAYA REALTIME') || liveApiText.includes('Daya Realtime'), 'Kartu daya realtime harus tampil');

    // b) Check Master-Detail Daftar Lokasi
    assert.ok(liveApiText.includes('Daftar Lokasi DC'), 'Panel Daftar Lokasi DC harus tampil');
    
    // c) Check Gorontalo is NOT ranked and tagged "Dalam Pembangunan"
    const gorontaloRankInfo = await page.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll('div'));
      const gorontaloRow = allDivs.find(d => d.innerText && d.innerText.includes('Gorontalo') && d.innerText.includes('Dalam Pembangunan'));
      if (!gorontaloRow) return null;
      return gorontaloRow.innerText;
    });
    assert.ok(gorontaloRankInfo, 'Gorontalo harus terdaftar dengan label "Dalam Pembangunan"');
    assert.ok(gorontaloRankInfo.includes('#—') || gorontaloRankInfo.includes('#-'), 'Gorontalo harus dikecualikan dari ranking (#—)');
    console.log('   ✔ Gorontalo berstatus "Dalam Pembangunan" dan dikecualikan dari ranking (#—)');

    // d) Check Audit Baseline flag hiding when disabled
    const hasBaselineTextInLiveTab = await page.evaluate(() => {
      const tableHeaders = Array.from(document.querySelectorAll('th')).map(th => th.innerText.toLowerCase());
      const hasProxyPrHeader = tableHeaders.some(h => h.includes('proxy pr') || h.includes('audit apr'));
      const labels = Array.from(document.querySelectorAll('label')).map(l => l.innerText.toLowerCase());
      const hasBaselineCheckbox = labels.some(l => l.includes('sertakan baseline'));
      return { hasProxyPrHeader, hasBaselineCheckbox };
    });
    assert.equal(hasBaselineTextInLiveTab.hasProxyPrHeader, false, 'Kolom Proxy PR / Audit Apr harus tersembunyi saat auditBaseline=false');
    assert.equal(hasBaselineTextInLiveTab.hasBaselineCheckbox, false, 'Checkbox sertakan baseline harus tersembunyi saat auditBaseline=false');
    console.log('   ✔ Kolom Proxy PR dan Checkbox Baseline bersih tersembunyi saat auditBaseline=false');

    // e) Check Tabel Data Matang Totals (4.804,34 MWh and 3.730,30 t)
    const tableFooterData = await page.evaluate(() => {
      const tfoot = document.querySelector('tfoot');
      if (!tfoot) return null;
      return tfoot.innerText;
    });
    assert.ok(tableFooterData, 'Footer Tabel Data Matang harus ada');
    assert.ok(tableFooterData.includes('4.804,34') || tableFooterData.includes('4804.34'), 'Total produksi di footer tabel harus 4.804,34 MWh');
    assert.ok(tableFooterData.includes('3.730,30') || tableFooterData.includes('3730.30'), 'Total emisi di footer tabel harus 3.730,30 t');
    console.log('   ✔ Footer Tabel Data Matang terverifikasi: 4.804,34 MWh dan 3.730,30 t');

    // f) Check Trend Chart points existence
    const chartHasLines = await page.evaluate(() => {
      const svg = document.querySelector('.recharts-surface');
      if (!svg) return false;
      const paths = svg.querySelectorAll('path.recharts-line-curve, path.recharts-area-area, g.recharts-line');
      return paths.length > 0;
    });
    assert.ok(chartHasLines, 'Grafik tren harus memiliki kurva/garis data aktif');
    console.log('   ✔ Grafik Garis Rata-rata memiliki titik kurva aktif');

    console.log('\n✔ SEMUA 8 CHECK REGRESI DOM & UI BERHASIL LOLOS (0 ERROR)\n');
  } finally {
    await browser.close();
  }
}

runDOMRegressionSuite().catch(err => {
  console.error('❌ DOM Regression Test FAILED:', err);
  process.exit(1);
});
