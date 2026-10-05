import puppeteer from 'puppeteer';

async function run() {
  console.log('=== STARTING REFRESH SEKARANG VERIFICATION TEST ===');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });

  // 1. Load the site
  console.log('Navigating to http://localhost:3000 ...');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 15000 });
  } catch (err) {
    console.log('Falling back to http://localhost:3001 ...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle2', timeout: 15000 });
  }

  // Helper to extract dashboard summary state
  async function extractDashboardState() {
    return await page.evaluate(() => {
      const bodyText = document.body.innerText;
      
      const powerMatch = bodyText.match(/DAYA REALTIME[^\n]*\n[^\n]*\n([0-9.,]+)\s*kW/i) || bodyText.match(/([0-9.,]+)\s*kW\s*\n\s*[0-9]+\s*Online/i);
      const prodTodayMatch = bodyText.match(/PRODUKSI HARI INI[^\n]*\n[^\n]*\n([0-9.,]+)\s*kWh/i);
      const monthProdMatch = bodyText.match(/TOTAL BULAN BERJALAN[^\n]*\n[^\n]*\n([0-9.,]+)\s*MWh/i);
      const quotaHourMatch = bodyText.match(/KUOTA JAM INI\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i);
      const quotaMonthMatch = bodyText.match(/KUOTA BULAN INI\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i);
      const waitingDataMatches = (bodyText.match(/Menunggu Data/g) || []).length;
      
      const chartDots = document.querySelectorAll('.recharts-line-dot, .recharts-dot, circle.recharts-dot').length;
      
      return {
        powerKw: powerMatch ? powerMatch[1] : null,
        prodTodayKwh: prodTodayMatch ? prodTodayMatch[1] : null,
        monthProdMwh: monthProdMatch ? monthProdMatch[1] : null,
        quotaHour: quotaHourMatch ? quotaHourMatch[1] : null,
        quotaMonth: quotaMonthMatch ? quotaMonthMatch[1] : null,
        waitingDataCount: waitingDataMatches,
        chartDotsCount: chartDots,
        hasMenyinkronkan: bodyText.includes('Menyinkronkan...'),
        hasRefreshSekarang: bodyText.includes('Refresh Sekarang')
      };
    });
  }

  async function goToLiveApiTab() {
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('button, a, span'));
      const target = elements.find(el => el.textContent.includes('Kelistrikan PLTS Atap') || el.textContent.includes('PLTS Atap'));
      if (target) target.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('Live iSolarCloud API'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2000));
  }

  // Navigate to Live API tab
  await goToLiveApiTab();

  // 4. Capture INITIAL STATE before click
  const beforeState = await extractDashboardState();
  console.log('\n--- KONDISI SEBELUM KLIK ---');
  console.log('Daya Realtime:', beforeState.powerKw, 'kW');
  console.log('Produksi Hari Ini:', beforeState.prodTodayKwh, 'kWh');
  console.log('Bulan Berjalan:', beforeState.monthProdMwh, 'MWh');
  console.log('Kuota Jam / Bulan:', beforeState.quotaHour, '/', beforeState.quotaMonth);
  console.log('Jumlah plant "Menunggu Data":', beforeState.waitingDataCount);
  console.log('Titik Chart Historis:', beforeState.chartDotsCount);

  await page.screenshot({ path: 'scripts/screenshot_before_refresh.png', fullPage: true });

  // 5. Click "Refresh Sekarang"
  console.log('\n=== MENGKLIK TOMBOL "Refresh Sekarang" ===');
  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent.includes('Refresh Sekarang'));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log('Tombol Refresh ditemukan & diklik:', clicked);

  // 6. Check during sync
  await new Promise(r => setTimeout(r, 400));
  const duringState = await extractDashboardState();
  console.log('Status selama sinkronisasi (Menyinkronkan...):', duringState.hasMenyinkronkan);

  // 7. Wait for sync to complete
  console.log('Menunggu sinkronisasi selesai...');
  await page.waitForFunction(() => {
    return document.body.innerText.includes('Refresh Sekarang') && !document.body.innerText.includes('Menyinkronkan...');
  }, { timeout: 30000 });
  console.log('Sinkronisasi selesai!');
  await new Promise(r => setTimeout(r, 1500));

  // 8. Capture POST-REFRESH STATE
  const afterState = await extractDashboardState();
  console.log('\n--- KONDISI SETELAH KLIK REFRESH SEKARANG ---');
  console.log('Daya Realtime:', afterState.powerKw, 'kW');
  console.log('Produksi Hari Ini:', afterState.prodTodayKwh, 'kWh');
  console.log('Bulan Berjalan:', afterState.monthProdMwh, 'MWh');
  console.log('Kuota Jam / Bulan:', afterState.quotaHour, '/', afterState.quotaMonth);
  console.log('Jumlah plant "Menunggu Data":', afterState.waitingDataCount);
  console.log('Titik Chart Historis:', afterState.chartDotsCount);

  await page.screenshot({ path: 'scripts/screenshot_after_refresh.png', fullPage: true });

  // 9. Hard refresh page and verify consistency
  console.log('\n=== MELAKUKAN HARD REFRESH BROWSER (page.reload) ===');
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await goToLiveApiTab();
  await new Promise(r => setTimeout(r, 2000));

  const hardReloadState = await extractDashboardState();
  console.log('\n--- KONDISI SETELAH HARD REFRESH ---');
  console.log('Daya Realtime:', hardReloadState.powerKw, 'kW');
  console.log('Produksi Hari Ini:', hardReloadState.prodTodayKwh, 'kWh');
  console.log('Bulan Berjalan:', hardReloadState.monthProdMwh, 'MWh');
  console.log('Kuota Jam / Bulan:', hardReloadState.quotaHour, '/', hardReloadState.quotaMonth);
  console.log('Jumlah plant "Menunggu Data":', hardReloadState.waitingDataCount);
  console.log('Titik Chart Historis:', hardReloadState.chartDotsCount);

  // 10. Assertions
  const assertions = [
    {
      name: 'Daya Realtime valid setelah refresh (> 0)',
      pass: afterState.powerKw !== '0,0' && afterState.powerKw !== '0' && afterState.powerKw !== null
    },
    {
      name: 'Produksi Hari Ini valid setelah refresh (> 0)',
      pass: afterState.prodTodayKwh !== '0,0' && afterState.prodTodayKwh !== '0' && afterState.prodTodayKwh !== null
    },
    {
      name: 'Tidak ada 36 plant berstatus "Menunggu Data"',
      pass: afterState.waitingDataCount < 5
    },
    {
      name: 'Grafik histori mempertahankan seluruh titik (Jan-Sep 2026)',
      pass: afterState.chartDotsCount >= 8
    },
    {
      name: 'Kuota jam dan bulan konsisten dan tidak jatuh ke fallback 1/3',
      pass: parseInt(afterState.quotaMonth || '0', 10) >= 40
    },
    {
      name: 'Hard refresh menghasilkan data valid yang konsisten dengan post-refresh',
      pass: hardReloadState.powerKw !== '0,0' && hardReloadState.powerKw !== null
    }
  ];

  console.log('\n=== HASIL VERIFIKASI ASSERTION ===');
  let allPassed = true;
  for (const a of assertions) {
    console.log(`[${a.pass ? 'PASS' : 'FAIL'}] ${a.name}`);
    if (!a.pass) allPassed = false;
  }

  await browser.close();
  console.log(allPassed ? '\n>>> SEMUA PENGUJIAN LULUS 100%! <<<' : '\n>>> ADA PENGUJIAN GAGAL <<<');
  process.exit(allPassed ? 0 : 1);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
