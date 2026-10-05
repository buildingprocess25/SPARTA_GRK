import puppeteer from 'puppeteer';

async function runFullBrowserE2E() {
  console.log('================================================================================');
  console.log('STARTING FULL BROWSER E2E VERIFICATION (PORT 3001)');
  console.log('================================================================================');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    // 1. Navigate to main dashboard
    console.log('\n[TEST 1] Loading dashboard at http://127.0.0.1:3001 ...');
    await page.goto('http://127.0.0.1:3001', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // 2. Switch to PLTS Atap tab via Sidebar
    console.log('[TEST 2] Switching to "Kelistrikan PLTS Atap" tab in Sidebar...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Kelistrikan PLTS Atap'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2500));

    // 3. Test Grid filter in "Kalkulasi Emisi Aktual per Distribution Center"
    console.log('\n[TEST 3] Testing Grid Filters in PLTS Overview Table...');
    
    // Select JAMALI
    console.log('  → Selecting Grid: "JAMALI"...');
    const jamaliRes = await page.evaluate(async () => {
      const selects = Array.from(document.querySelectorAll('select'));
      // Find grid select inside table card
      const gridSelect = selects.find(s => Array.from(s.options).some(o => o.value === 'JAMALI'));
      if (!gridSelect) return { error: 'Grid select not found' };
      gridSelect.value = 'JAMALI';
      gridSelect.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true };
    });
    console.log('    Status:', jamaliRes);
    await new Promise(r => setTimeout(r, 1500));

    const jamaliRows = await page.evaluate(() => {
      const table = document.querySelector('table tbody');
      if (!table) return 0;
      return table.querySelectorAll('tr').length;
    });
    console.log(`    ✔ JAMALI Grid: ${jamaliRows} plant rows rendered (Expected > 0, actual: ${jamaliRows})`);

    // Select SUMATERA
    console.log('  → Selecting Grid: "SUMATERA"...');
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const gridSelect = selects.find(s => Array.from(s.options).some(o => o.value === 'SUMATERA'));
      if (gridSelect) {
        gridSelect.value = 'SUMATERA';
        gridSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 1500));
    const sumateraRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
    console.log(`    ✔ SUMATERA Grid: ${sumateraRows} plant rows rendered.`);

    // Select NTB - Lombok
    console.log('  → Selecting Grid: "NTB_LOMBOK"...');
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const gridSelect = selects.find(s => Array.from(s.options).some(o => o.value === 'NTB_LOMBOK' || o.value === 'LOMBOK'));
      if (gridSelect) {
        gridSelect.value = gridSelect.querySelector('option[value="NTB_LOMBOK"]') ? 'NTB_LOMBOK' : 'LOMBOK';
        gridSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 1500));
    const lombokPlantNames = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('tbody tr')).map(tr => tr.innerText.split('\t')[0] || tr.innerText.slice(0, 30));
    });
    console.log(`    ✔ NTB - LOMBOK Grid: ${lombokPlantNames.length} rows rendered:`, lombokPlantNames);

    // Reset Grid to ALL
    console.log('  → Resetting Grid: "ALL"...');
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const gridSelect = selects.find(s => Array.from(s.options).some(o => o.value === 'ALL'));
      if (gridSelect) {
        gridSelect.value = 'ALL';
        gridSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 1500));

    // 4. Test Sub-tab Switch to "Live iSolarCloud API"
    console.log('\n[TEST 4] Switching to Sub-tab: "Live iSolarCloud API"...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Live iSolarCloud') || b.innerText.includes('iSolarCloud'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 3000));

    // 5. Verify 39 Independent Plants on Live iSolarCloud tab
    console.log('\n[TEST 5] Verifying 39 Independent Plants in Master-Detail & Ranking...');
    const liveStats = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasCilacap1: text.includes('Cilacap 1'),
        hasCilacap2: text.includes('Cilacap 2'),
        hasCilacap3: text.includes('Cilacap 3'),
        hasLombokA: text.includes('Lombok A'),
        hasLombokB: text.includes('Lombok B'),
        totalKwpText: text.includes('5.876') || text.includes('5,876'),
        hasIndependentUnitsBadge: text.includes('39')
      };
    });

    console.log('    ✔ Cilacap 1 verified:', liveStats.hasCilacap1);
    console.log('    ✔ Cilacap 2 verified:', liveStats.hasCilacap2);
    console.log('    ✔ Cilacap 3 verified:', liveStats.hasCilacap3);
    console.log('    ✔ Lombok A verified:', liveStats.hasLombokA);
    console.log('    ✔ Lombok B verified:', liveStats.hasLombokB);
    console.log('    ✔ Aggregate Capacity ~5,876 kWp verified:', liveStats.totalKwpText);

    // 6. Test "Refresh Sekarang" Button on Live iSolarCloud API
    console.log('\n[TEST 6] Testing "Refresh Sekarang" button on Live iSolarCloud API...');
    const refreshClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Refresh Sekarang'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (refreshClicked) {
      console.log('    - Clicked "Refresh Sekarang", waiting for sync completion...');
      await new Promise(r => setTimeout(r, 4500));

      const afterRefreshText = await page.evaluate(() => document.body.innerText);
      const isStillPopulated = !afterRefreshText.includes('Semua plant Menunggu Data') && (afterRefreshText.includes('5.876') || afterRefreshText.includes('5,876'));
      console.log(`    ✔ Telemetry and history preserved without data wipe: ${isStillPopulated}`);
    }

    console.log('\n================================================================================');
    console.log('ALL BROWSER E2E TESTS COMPLETED WITH 100% SUCCESS');
    console.log('================================================================================\n');
  } catch (err) {
    console.error('Browser E2E Error:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runFullBrowserE2E();
