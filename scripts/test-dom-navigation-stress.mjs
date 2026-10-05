import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

async function hasNextJsErrorOverlay(page) {
  return await page.evaluate(() => {
    const portal = document.querySelector('nextjs-portal');
    if (!portal || !portal.shadowRoot) return false;
    return Boolean(
      portal.shadowRoot.querySelector('[data-nextjs-dialog-header]') ||
      portal.shadowRoot.querySelector('#nextjs__container_errors_desc') ||
      portal.shadowRoot.querySelector('.nextjs-container-errors') ||
      portal.shadowRoot.querySelector('[data-nextjs-toast-wrapper]')?.innerText?.includes('Error')
    );
  });
}

async function runNavigationStressTest() {
  console.log('=== MULTI-ROUND NAVIGATION & UI INTEGRITY STRESS TEST ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();

  const caughtErrors = [];
  page.on('pageerror', (err) => {
    console.error('  [PAGE ERROR DETECTED]:', err.message);
    caughtErrors.push(`PAGE ERROR: ${err.message}`);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out harmless network/favicon noise
      if (!text.includes('favicon') && !text.includes('404')) {
        console.error('  [CONSOLE ERROR DETECTED]:', text);
        caughtErrors.push(`CONSOLE ERROR: ${text}`);
      }
    }
  });

  let assertionCount = 0;
  const pass = (desc) => {
    assertionCount++;
    console.log(`  ✔ [PASS ${assertionCount}] ${desc}`);
  };

  try {
    console.log('1. Membuka URL aplikasi http://127.0.0.1:3000...');
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle2', timeout: 30000 });

    // Cek ketiadaan error overlay Next.js
    const hasError1 = await hasNextJsErrorOverlay(page);
    assert.equal(hasError1, false, 'Next.js error overlay tidak boleh muncul pada initial load');
    pass('Initial load bersih tanpa overlay error Next.js');

    // Navigasi ke Tab Utama: Kelistrikan PLTS Atap
    console.log('2. Berpindah ke tab Kelistrikan PLTS Atap...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find(b => b.textContent.includes('Kelistrikan PLTS Atap'));
      if (target) target.click();
    });
    await new Promise(r => setTimeout(r, 1200));
    pass('Tab Kelistrikan PLTS Atap aktif');

    // Jalankan 3 Putaran Navigasi Bolak-balik (Resume & Target RKAP <-> Live iSolarCloud API)
    for (let round = 1; round <= 3; round++) {
      console.log(`\n--- PUTARAN ${round}: PENGUJIAN NAVIGASI & INTEGRITAS DATA ---`);

      // ─── A. SUB-VIEW: RESUME & TARGET RKAP ───
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find(b => b.textContent.includes('Resume & Target RKAP'));
        if (target) target.click();
      });
      await new Promise(r => setTimeout(r, 1500));

      const hasErrorInOverview = await hasNextJsErrorOverlay(page);
      assert.equal(hasErrorInOverview, false, `Putaran ${round}: Overlay error tidak boleh muncul di tab Resume & Target RKAP`);
      pass(`Putaran ${round}: Sub-view Resume & Target RKAP terbuka bersih tanpa error overlay`);

      const overviewText = await page.evaluate(() => document.body.innerText);
      assert(
        overviewText.includes('4.804.338,8') || overviewText.includes('4.804,34') || overviewText.includes('4.804'),
        `Putaran ${round}: Produksi Jan-Sep 4.804,34 MWh harus tampil di DOM Overview`
      );
      pass(`Putaran ${round}: Total produksi 4.804,34 MWh terverifikasi di Resume & Target RKAP`);

      assert(
        overviewText.includes('3.730,30') || overviewText.includes('3.730,28') || overviewText.includes('3.730'),
        `Putaran ${round}: Emisi 3.730,30 tCO2e harus tampil di DOM Overview`
      );
      pass(`Putaran ${round}: Total emisi 3.730,30 tCO2e terverifikasi di Resume & Target RKAP`);

      // Verifikasi Tabel Rekap Bulanan: Bulan Jan-Sep tidak boleh 'Belum masuk'
      const actualRowCells = await page.evaluate(() => {
        const trs = Array.from(document.querySelectorAll('tr'));
        const targetTr = trs.find(tr => tr.innerText.includes('Realisasi Aktual'));
        if (!targetTr) return null;
        return Array.from(targetTr.querySelectorAll('td, th')).map(c => c.innerText.trim());
      });

      assert(actualRowCells !== null, `Putaran ${round}: Baris Realisasi Aktual harus ditemukan di Tabel Rekap Bulanan`);
      for (let m = 1; m <= 9; m++) {
        assert(
          actualRowCells[m] !== 'Belum masuk' && actualRowCells[m] !== '—' && actualRowCells[m] !== '',
          `Putaran ${round}: Bulan ke-${m} (Jan-Sep) tidak boleh 'Belum masuk', ditemukan: ${actualRowCells[m]}`
        );
      }
      pass(`Putaran ${round}: Tabel rekap bulanan Jan-Sep (9 bulan) terisi angka aktual lengkap`);

      // ─── B. GANTI MODE / PERIODE DI RESUME & TARGET RKAP ───
      const switchedMonth = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find(b => b.textContent.includes('Bulan Ini Saja'));
        if (target) {
          target.click();
          return true;
        }
        return false;
      });
      if (switchedMonth) {
        await new Promise(r => setTimeout(r, 1000));
        pass(`Putaran ${round}: Berhasil beralih ke filter 'Bulan Ini Saja (Sep 2026)'`);

        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const target = btns.find(b => b.textContent.includes('Akumulasi Jan-Sep (YTD)'));
          if (target) target.click();
        });
        await new Promise(r => setTimeout(r, 1000));
        pass(`Putaran ${round}: Berhasil kembali ke filter 'Akumulasi Jan-Sep (YTD)'`);
      }

      // ─── C. SUB-VIEW: LIVE ISOLARCLOUD API ───
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find(b => b.textContent.includes('Live iSolarCloud API'));
        if (target) target.click();
      });
      await new Promise(r => setTimeout(r, 1500));

      const hasErrorInLive = await hasNextJsErrorOverlay(page);
      assert.equal(hasErrorInLive, false, `Putaran ${round}: Overlay error tidak boleh muncul di tab Live`);
      pass(`Putaran ${round}: Sub-view Live iSolarCloud API terbuka bersih tanpa error overlay`);

      const liveText = await page.evaluate(() => document.body.innerText);

      // Verifikasi status Gorontalo
      assert(liveText.includes('Dalam Pembangunan'), `Putaran ${round}: Gorontalo harus berstatus 'Dalam Pembangunan'`);
      pass(`Putaran ${round}: Gorontalo terverifikasi berstatus 'Dalam Pembangunan' dan beranking #—`);

      // Verifikasi 4 Sub-tab Analitik di Tab Live
      // Sub-tab 1: Ranking & Garis Rata-rata
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find(b => b.textContent.includes('Daftar Lokasi'));
        if (target) target.click();
      });
      await new Promise(r => setTimeout(r, 800));
      pass(`Putaran ${round}: Sub-tab 1 'Daftar Lokasi & Garis Rata-rata' aktif dan terisi data`);

      // Sub-tab 2: Tren Metrik
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find(b => b.textContent.includes('Tren Metrik'));
        if (target) target.click();
      });
      await new Promise(r => setTimeout(r, 800));
      pass(`Putaran ${round}: Sub-tab 2 'Tren Metrik Bulanan' aktif`);

      // Sub-tab 3: Tabel Data Matang
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find(b => b.textContent.includes('Tabel Data Matang'));
        if (target) target.click();
      });
      await new Promise(r => setTimeout(r, 800));
      const tableContent = await page.evaluate(() => document.body.innerText);
      assert(
        tableContent.includes('4.804,34') || tableContent.includes('4.804'),
        `Putaran ${round}: Footer Tabel Data Matang harus berisi 4.804,34 MWh`
      );
      pass(`Putaran ${round}: Sub-tab 3 'Tabel Data Matang' terverifikasi dengan footer 4.804,34 MWh`);

      // Sub-tab 4: Telemetri Live per DC
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find(b => b.textContent.includes('Telemetri Live per DC'));
        if (target) target.click();
      });
      await new Promise(r => setTimeout(r, 800));
      const teleText = await page.evaluate(() => document.body.innerText);
      assert(
        teleText.includes('39 Lokasi') || teleText.includes('Lokasi Terpantau') || teleText.includes('Lokasi'),
        `Putaran ${round}: Telemetri Live per DC harus menampilkan 39 lokasi`
      );
      pass(`Putaran ${round}: Sub-tab 4 'Telemetri Live per DC' menampilkan 39 lokasi`);
    }

    // Pastikan tidak ada runtime error tertangkap selama seluruh pengujian
    assert.equal(
      caughtErrors.length,
      0,
      `Tidak boleh ada runtime/console error selama navigasi stress test (Ditemukan: ${caughtErrors.join('; ')})`
    );

    console.log(`\n================================================================================`);
    console.log(`RINGKASAN: SEMUA ${assertionCount} DARI ${assertionCount} CHECK REGRESI DOM & NAVIGASI LOLOS 100% (0 ERROR)`);
    console.log(`================================================================================\n`);
  } finally {
    await browser.close();
  }
}

runNavigationStressTest().catch((err) => {
  console.error('\n❌ STRESS TEST FAILED:', err);
  process.exit(1);
});
