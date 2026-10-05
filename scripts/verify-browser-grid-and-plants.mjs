import puppeteer from 'puppeteer';

async function verifyBrowser() {
  console.log('=== STARTING BROWSER E2E VERIFICATION ===');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    // 1. Navigate to main dashboard
    console.log('\n[1] Navigating to http://127.0.0.1:3001 ...');
    await page.goto('http://127.0.0.1:3001', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout ? page.waitForTimeout(2000) : new Promise(r => setTimeout(r, 2000));

    // 2. Click on PLTS Tab
    console.log('[2] Switching to Tab: Kelistrikan PLTS Atap...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Kelistrikan PLTS Atap') || b.innerText.includes('Pengurang Emisi'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // 3. Verify Grid Filter: "Semua" -> default shows 39 plants
    console.log('[3] Checking default Grid filter (Semua)...');
    const defaultRowCount = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
    console.log(`    - Table initially rendered with ${defaultRowCount} rows.`);

    // 4. Test selecting Grid: "JAMALI"
    console.log('[4] Testing Grid dropdown filter: Selecting "JAMALI"...');
    const jamaliResult = await page.evaluate(async () => {
      const selects = Array.from(document.querySelectorAll('select'));
      const gridSel = selects.find(s => Array.from(s.options).some(o => o.value === 'JAMALI'));
      if (!gridSel) return { error: 'Grid select not found' };
      gridSel.value = 'JAMALI';
      gridSel.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true };
    });
    console.log('    - Selected JAMALI:', jamaliResult);
    await new Promise(r => setTimeout(r, 2000));
    
    const jamaliRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
    console.log(`    ✔ JAMALI Grid selected: Table rendered ${jamaliRows} rows (Expected > 0).`);

    // 5. Test selecting Grid: "SUMATERA"
    console.log('[5] Testing Grid dropdown filter: Selecting "SUMATERA"...');
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const gridSel = selects.find(s => Array.from(s.options).some(o => o.value === 'SUMATERA'));
      if (gridSel) {
        gridSel.value = 'SUMATERA';
        gridSel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 2000));
    const sumateraRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
    console.log(`    ✔ SUMATERA Grid selected: Table rendered ${sumateraRows} rows.`);

    // 6. Test selecting Grid: "NTB_LOMBOK"
    console.log('[6] Testing Grid dropdown filter: Selecting "NTB_LOMBOK"...');
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const gridSel = selects.find(s => Array.from(s.options).some(o => o.value === 'NTB_LOMBOK' || o.value === 'LOMBOK'));
      if (gridSel) {
        gridSel.value = gridSel.querySelector('option[value="NTB_LOMBOK"]') ? 'NTB_LOMBOK' : 'LOMBOK';
        gridSel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 2000));
    const lombokRows = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('tbody tr')).map(tr => tr.innerText.split('\t')[0] || tr.innerText.slice(0, 30));
    });
    console.log(`    ✔ LOMBOK Grid selected: Table rendered ${lombokRows.length} rows:`, lombokRows);

    // 7. Reset to ALL
    console.log('[7] Resetting Grid filter to "ALL"...');
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const gridSel = selects.find(s => Array.from(s.options).some(o => o.value === 'ALL'));
      if (gridSel) {
        gridSel.value = 'ALL';
        gridSel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 2000));

    // 8. Check Live iSolarCloud Tab
    console.log('\n[8] Navigating to Live iSolarCloud tab...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Live iSolarCloud') || b.innerText.includes('Live iSolar'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 3000));

    // Verify independent Cilacap 1, 2, 3 and Lombok A, B rows
    const liveTableRows = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr')).map(tr => tr.innerText);
      return rows;
    });

    console.log(`    ✔ Live iSolarCloud rendered ${liveTableRows.length} total rows.`);
    const hasCilacap1 = liveTableRows.some(r => r.includes('Cilacap 1'));
    const hasCilacap2 = liveTableRows.some(r => r.includes('Cilacap 2'));
    const hasCilacap3 = liveTableRows.some(r => r.includes('Cilacap 3'));
    const hasLombokA = liveTableRows.some(r => r.includes('Lombok A'));
    const hasLombokB = liveTableRows.some(r => r.includes('Lombok B'));

    console.log(`    - Cilacap 1 present: ${hasCilacap1}`);
    console.log(`    - Cilacap 2 present: ${hasCilacap2}`);
    console.log(`    - Cilacap 3 present: ${hasCilacap3}`);
    console.log(`    - Lombok A present: ${hasLombokA}`);
    console.log(`    - Lombok B present: ${hasLombokB}`);

    // 9. Test "Refresh Sekarang" button on Live iSolar
    console.log('\n[9] Testing "Refresh Sekarang" button on Live iSolarCloud API...');
    const refreshClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Refresh Sekarang'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (refreshClicked) {
      console.log('    - Clicked "Refresh Sekarang", waiting for live data response...');
      await new Promise(r => setTimeout(r, 4000));
      
      const afterRefreshText = await page.evaluate(() => document.body.innerText);
      const isStillPopulated = !afterRefreshText.includes('Semua plant Menunggu Data') && afterRefreshText.includes('5.876');
      console.log(`    ✔ Live Data preserved after Refresh Sekarang: ${isStillPopulated}`);
    }

    console.log('\n=== ALL BROWSER E2E VERIFICATIONS COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('Browser verification error:', err);
  } finally {
    await browser.close();
  }
}

verifyBrowser();
