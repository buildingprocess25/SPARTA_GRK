import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const EVIDENCE_DIR = path.resolve('docs/evidence');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function run() {
  console.log('--- Starting Bagian D & E Multi-Tab Chart Verification & Screenshot Capture ---');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1050']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1050 });

  const pageErrors = [];
  page.on('pageerror', err => {
    console.error('PageError:', err.message);
    pageErrors.push(err.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('ConsoleError:', msg.text());
      pageErrors.push(msg.text());
    }
  });

  console.log('Navigating to http://127.0.0.1:3000 ...');
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1000));

  // 1. Navigate to PLTS Tab ("Kelistrikan PLTS Atap")
  console.log('Navigating to PLTS Tab (Kelistrikan PLTS Atap)...');
  await page.evaluate(() => {
    const pltsBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Kelistrikan PLTS Atap'));
    if (pltsBtn) pltsBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  // 2. Switch to "Live iSolarCloud API" sub-view
  console.log('Switching to "Live iSolarCloud API" sub-view...');
  await page.evaluate(() => {
    const liveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Live iSolarCloud API'));
    if (liveBtn) liveBtn.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // Scroll to Unified Master-Detail Analytics & Multi-DC Trend Chart
  console.log('Scrolling to Unified Analytics section...');
  await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll('h2, h3')).find(h => h.textContent.includes('Analisis Multi-DC'));
    if (heading) {
      heading.scrollIntoView({ behavior: 'instant', block: 'start' });
    } else {
      window.scrollBy(0, 450);
    }
  });
  await new Promise(r => setTimeout(r, 1000));

  // --- COMPREHENSIVE TESTS FOR ALL METRIC TABS & 3 CHART VIEW MODES ---
  console.log('\n--- Running 3-Mode Multi-Tab Chart Verification ---');

  const metricsToTest = [
    { name: 'Specific Yield Hari Ini', id: 'specificYield', unit: 'kWh/kWp' },
    { name: 'Equivalent Hours (API)', id: 'equivalentHour', unit: 'jam' },
    { name: 'Total Produksi', id: 'yieldMwh', unit: 'MWh' },
    { name: 'Capacity Factor', id: 'capacityFactor', unit: '%' },
    { name: 'Peak Power', id: 'peakPower', unit: 'kW' },
    { name: 'Emisi Terhindar', id: 'co2', unit: 'tCO₂e' }
  ];

  for (const metric of metricsToTest) {
    console.log(`\n=== Testing Metric: ${metric.name} (${metric.id}) ===`);

    // Click metric button
    await page.evaluate((mName) => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === mName);
      if (btn) btn.click();
    }, metric.name);
    await new Promise(r => setTimeout(r, 800));

    // 1. Test Mode "Semua PLTS" (individual)
    console.log(`[${metric.id}] Testing Mode "Semua PLTS"...`);
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Semua PLTS');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    let lineCount = await page.evaluate(() => document.querySelectorAll('.recharts-line').length);
    console.log(`  -> Lines rendered in "Semua PLTS" mode: ${lineCount} (Expected: 38 individual lines)`);
    if (lineCount !== 38) throw new Error(`[${metric.id}] Expected 38 individual lines in "Semua PLTS" mode, got ${lineCount}`);

    let summaryText = await page.evaluate(() => {
      const footer = document.querySelector('.recharts-responsive-container').parentElement.nextElementSibling;
      return footer ? footer.innerText : '';
    });
    console.log(`  -> Summary text: "${summaryText.replace(/\n/g, ' ')}"`);
    if (!summaryText.includes('38 PLTS ditampilkan')) {
      throw new Error(`[${metric.id}] Expected summary to contain "38 PLTS ditampilkan", got "${summaryText}"`);
    }

    await page.screenshot({ path: path.join(EVIDENCE_DIR, `chart_${metric.id}_individual.png`), fullPage: false });

    // 2. Test Mode "Rata-rata" (average)
    console.log(`[${metric.id}] Testing Mode "Rata-rata"...`);
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Rata-rata');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    lineCount = await page.evaluate(() => document.querySelectorAll('.recharts-line').length);
    console.log(`  -> Lines rendered in "Rata-rata" mode: ${lineCount} (Expected: 1 average line)`);
    if (lineCount !== 1) throw new Error(`[${metric.id}] Expected 1 line in "Rata-rata" mode, got ${lineCount}`);

    summaryText = await page.evaluate(() => {
      const footer = document.querySelector('.recharts-responsive-container').parentElement.nextElementSibling;
      return footer ? footer.innerText : '';
    });
    console.log(`  -> Summary text: "${summaryText.replace(/\n/g, ' ')}"`);
    if (!summaryText.includes('Rata-rata Tertimbang (38 PLTS)')) {
      throw new Error(`[${metric.id}] Expected summary to contain "Rata-rata Tertimbang (38 PLTS)", got "${summaryText}"`);
    }

    await page.screenshot({ path: path.join(EVIDENCE_DIR, `chart_${metric.id}_average.png`), fullPage: false });

    // 3. Test Mode "Rentang Min-Maks" (minmax)
    console.log(`[${metric.id}] Testing Mode "Rentang Min-Maks"...`);
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Rentang Min-Maks');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    lineCount = await page.evaluate(() => document.querySelectorAll('.recharts-line').length);
    console.log(`  -> Lines rendered in "Rentang Min-Maks" mode: ${lineCount} (Expected: 3 lines: Max, Min, Reference Avg)`);
    if (lineCount !== 3) throw new Error(`[${metric.id}] Expected 3 lines in "Rentang Min-Maks" mode, got ${lineCount}`);

    summaryText = await page.evaluate(() => {
      const footer = document.querySelector('.recharts-responsive-container').parentElement.nextElementSibling;
      return footer ? footer.innerText : '';
    });
    console.log(`  -> Summary text: "${summaryText.replace(/\n/g, ' ')}"`);
    if (!summaryText.includes('Rentang (38 PLTS)')) {
      throw new Error(`[${metric.id}] Expected summary to contain "Rentang (38 PLTS)", got "${summaryText}"`);
    }

    await page.screenshot({ path: path.join(EVIDENCE_DIR, `chart_${metric.id}_minmax.png`), fullPage: false });
  }

  // --- STATE PERSISTENCE TEST ACROSS TAB SWITCHES ---
  console.log('\n=== Testing State Persistence Across Tab Switches ===');
  // Set to "Rata-rata"
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Rata-rata');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Switch to Capacity Factor
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Capacity Factor');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  let activeModeBtn = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Rata-rata');
    return btn ? btn.className.includes('bg-blue-600') : false;
  });
  console.log(`Rata-rata button still active after metric switch: ${activeModeBtn}`);
  if (!activeModeBtn) throw new Error('State persistence failed: chartViewMode reset upon metric switch');

  let linesCount = await page.evaluate(() => document.querySelectorAll('.recharts-line').length);
  console.log(`Lines count in Capacity Factor (Rata-rata): ${linesCount} (Expected: 1)`);
  if (linesCount !== 1) throw new Error(`Expected 1 line in Rata-rata mode on Capacity Factor, got ${linesCount}`);

  // Switch to Total Produksi
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Total Produksi');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  activeModeBtn = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Rata-rata');
    return btn ? btn.className.includes('bg-blue-600') : false;
  });
  console.log(`Rata-rata button still active after switching to Total Produksi: ${activeModeBtn}`);
  if (!activeModeBtn) throw new Error('State persistence failed: chartViewMode reset upon switching to Total Produksi');

  linesCount = await page.evaluate(() => document.querySelectorAll('.recharts-line').length);
  console.log(`Lines count in Total Produksi (Rata-rata): ${linesCount} (Expected: 1)`);
  if (linesCount !== 1) throw new Error(`Expected 1 line in Rata-rata mode on Total Produksi, got ${linesCount}`);

  // Test Hover Highlight in "Semua PLTS" mode
  console.log('\n=== Testing Hover Highlight in "Semua PLTS" Mode ===');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Semua PLTS');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  await page.evaluate(() => {
    const firstRow = document.querySelector('.group');
    if (firstRow) {
      firstRow.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'chart_hover_highlight.png'), fullPage: false });
  console.log('Saved: chart_hover_highlight.png');

  // Check errors
  if (pageErrors.length > 0) {
    console.warn('Page errors encountered:', pageErrors);
  } else {
    console.log('\nSUCCESS: 0 console errors, 0 page errors encountered across all metric tabs and modes!');
  }

  await browser.close();
  console.log('--- All automated tests and evidence screenshots completed successfully ---');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
