import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'docs/evidence/screenshots';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BRAIN_DIR = 'C:/Users/valen/.gemini/antigravity-ide/brain/aac0e5ff-b87c-4a87-955b-9118ec49ed49';
const ARTIFACT_MEDIA_DIR = path.join(BRAIN_DIR, '.tempmediaStorage');
fs.mkdirSync(ARTIFACT_MEDIA_DIR, { recursive: true });

async function runVisualVerification() {
  console.log('================================================================');
  console.log('  PLTS DASHBOARD FULL VISUAL & REGRESSION VERIFICATION');
  console.log('================================================================');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1200, deviceScaleFactor: 1 });

  const consoleLogs = [];
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error' && !text.includes('Failed to load resource') && !text.includes('favicon')) {
      consoleErrors.push(text);
      console.error('BROWSER CONSOLE ERROR:', text);
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
    console.error('BROWSER PAGE EXCEPTION:', err.message);
  });

  console.log('\n[1/6] Navigating to http://127.0.0.1:3000 ...');
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 2000));

  // Navigate directly to PLTS Atap by clicking the sub-item in sidebar
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const pltsSubBtn = buttons.find(b => b.textContent.includes('Kelistrikan PLTS Atap'));
    if (pltsSubBtn) pltsSubBtn.click();
  });
  await new Promise(r => setTimeout(r, 2500));

  // Helper to save screenshot both in docs/evidence and artifact storage
  async function saveScreenshot(filename) {
    const localPath = path.join(SCREENSHOT_DIR, filename);
    await page.screenshot({ path: localPath, fullPage: false });
    const artifactPath = path.join(ARTIFACT_MEDIA_DIR, filename);
    fs.copyFileSync(localPath, artifactPath);
    console.log(`  [Screenshot saved] -> ${localPath}`);
    return localPath;
  }

  async function saveFullPageScreenshot(filename) {
    const localPath = path.join(SCREENSHOT_DIR, filename);
    await page.screenshot({ path: localPath, fullPage: true });
    const artifactPath = path.join(ARTIFACT_MEDIA_DIR, filename);
    fs.copyFileSync(localPath, artifactPath);
    console.log(`  [FullPage Screenshot saved] -> ${localPath}`);
    return localPath;
  }

  // =========================================================================
  // TAB 1: RESUME & TARGET RKAP
  // =========================================================================
  console.log('\n[2/6] Verifying Tab "Resume & Target RKAP"...');
  
  // Ensure "Resume & Target RKAP" subtab is active
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const resumeBtn = btns.find(b => b.textContent.includes('Resume & Target RKAP'));
    if (resumeBtn) resumeBtn.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  await saveScreenshot('01_resume_target_rkap_top.png');

  // Verify KPI cards and values
  const resumeState = await page.evaluate(() => {
    const text = document.body.innerText;
    
    const hasCapacity = text.includes('KAPASITAS PLTS') || text.includes('5.876');
    const hasGeneration = text.includes('GENERASI PLTS') || text.includes('4.804.339');
    const hasPr = text.includes('PR:') || text.includes('73.4%') || text.includes('73,4%');
    const hasStatusCard = Boolean(document.querySelector('[data-testid="plant-status-summary"]')) || text.includes('Status operasional terakhir');
    const hasChart = text.includes('Generasi PLTS vs Konsumsi PLN (Bulanan)') || text.includes('Generasi PLTS vs Konsumsi PLN');
    const hasEnergyComp = text.includes('Komposisi Energi DC');
    const hasSummaryCard = Boolean(document.querySelector('[data-testid="plts-summary-table"]')) || text.includes('Data Pemantauan PLTS per Branch DC') || text.includes('Data Pemantauan');
    const hasMatrixTable = Boolean(document.querySelector('[data-testid="plts-monthly-matrix-table"]')) || text.includes('Matrix Target vs Realisasi Bulanan') || text.includes('Target vs Realisasi');

    return {
      hasCapacity,
      hasGeneration,
      hasPr,
      hasStatusCard,
      hasChart,
      hasEnergyComp,
      hasSummaryCard,
      hasMatrixTable,
    };
  });
  console.log('Resume Tab Content State:', resumeState);

  // =========================================================================
  // SUB-TABS: PLTS PERFORMANCE ANALYSIS (Produksi vs Target, PR, Parameter, Beban)
  // =========================================================================
  console.log('\n[3/6] Verifying all 4 Sub-Tabs of Analisis Performa & Deviasi Target...');

  const subTabs = [
    { label: 'Produksi vs Target', file: '02_subtab_produksi_vs_target.png' },
    { label: 'Performa Sistem (PR)', file: '03_subtab_performance_ratio_pr.png' },
    { label: 'Parameter Pendukung', file: '04_subtab_parameter_cuaca.png' },
    { label: 'Beban vs PLTS', file: '05_subtab_beban_vs_plts.png' },
  ];

  for (const st of subTabs) {
    console.log(`  Switching to sub-tab: ${st.label} ...`);
    const clickedSubTab = await page.evaluate((targetLabel) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.trim().includes(targetLabel));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    }, st.label);
    console.log(`    Clicked ${st.label}: ${clickedSubTab}`);
    await new Promise(r => setTimeout(r, 2000)); // allow on-demand fetch

    // Scroll to performance section
    await page.evaluate(() => {
      const el = document.querySelector('[data-plts-performance-analysis="true"]') ||
                 Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Analisis Kinerja PLTS'))?.closest('.rounded-2xl');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await new Promise(r => setTimeout(r, 1000));
    await saveScreenshot(st.file);
  }

  // =========================================================================
  // MATRIX TABLE
  // =========================================================================
  console.log('\n[4/6] Verifying Monthly Matrix Table...');
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="plts-monthly-matrix-table"]') ||
               Array.from(document.querySelectorAll('h3, h2')).find(h => h.textContent.includes('Matrix') || h.textContent.includes('Realisasi Bulanan'))?.closest('.rounded-2xl');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await new Promise(r => setTimeout(r, 1500));
  await saveScreenshot('06_monthly_matrix_table.png');

  // =========================================================================
  // TAB 2: LIVE ISOLARCLOUD API
  // =========================================================================
  console.log('\n[5/6] Verifying Tab "Live iSolarCloud API"...');
  
  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 500));

  // Click "Live iSolarCloud API" subtab
  const clickedLiveTab = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const liveBtn = btns.find(b => b.textContent.includes('Live iSolarCloud API'));
    if (liveBtn) {
      liveBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Live iSolarCloud API subtab:', clickedLiveTab);
  await new Promise(r => setTimeout(r, 3500)); // allow dynamic import & telemetry to render

  await saveScreenshot('07_live_isolar_tab_top.png');

  // Verify Live tab elements and plant counts
  const liveTabEvaluation = await page.evaluate(() => {
    const text = document.body.innerText;
    const hasGateway = text.includes('iSolarCloud Sungrow OpenAPI Gateway') || text.includes('gateway.isolarcloud.com.hk');
    const hasDayaRealtime = text.includes('DAYA REALTIME (OUTPUT)');
    const hasProduksiHariIni = text.includes('PRODUKSI HARI INI');
    const hasBulanBerjalan = text.includes('TOTAL BULAN BERJALAN');
    const hasEmisiHariIni = text.includes('EMISI TERHINDAR HARI INI');
    
    // Check status text
    const statCards = Array.from(document.querySelectorAll('.rounded-2xl, .rounded-xl, .p-5, .p-4'));
    let trendStatusText = '';
    statCards.forEach(c => {
      const t = c.innerText;
      if (t.includes('Online') && t.includes('Menunggu') && t.includes('Offline')) {
        trendStatusText = t;
      }
    });

    // Check Analytics Section presence
    const hasAnalyticsSection = text.includes('Komparasi') || text.includes('Detail per DC') || text.includes('Status Telemetri') || text.includes('Specific Yield');
    const tableRows = document.querySelectorAll('tbody tr');
    const hasTableRows = tableRows.length;
    const tableRowTexts = Array.from(tableRows).map(tr => tr.innerText.trim()).slice(0, 5);

    // Look for Gorontalo in plant list
    const hasGorontalo = text.includes('Gorontalo');
    const hasCilacap = text.includes('Cilacap 1') || text.includes('Cilacap');
    const hasMedan = text.includes('Medan');

    return {
      hasGateway,
      hasDayaRealtime,
      hasProduksiHariIni,
      hasBulanBerjalan,
      hasEmisiHariIni,
      trendStatusText,
      hasAnalyticsSection,
      hasTableRows,
      tableRowTexts,
      hasGorontalo,
      hasCilacap,
      hasMedan,
    };
  });
  console.log('Live Tab Evaluation:', liveTabEvaluation);

  // Scroll down to capture the Analytics Section (Rankings, Plant list, Inverter detail table)
  await page.evaluate(() => {
    window.scrollBy(0, 500);
  });
  await new Promise(r => setTimeout(r, 1000));
  await saveScreenshot('08_live_isolar_analytics_section.png');

  // Switch to "Detail per DC & Inverter" / Telemetry tab inside Analytics Section
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const detailBtn = buttons.find(b => b.textContent.includes('Detail per DC') || b.textContent.includes('Inverter') || b.textContent.includes('Status Telemetri'));
    if (detailBtn) detailBtn.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  await saveScreenshot('09_live_isolar_detail_dc_table.png');

  // Full page screenshot of Live tab
  await saveFullPageScreenshot('10_live_isolar_full_page.png');

  // =========================================================================
  // REGRESSION ASSERTIONS
  // =========================================================================
  console.log('\n[6/6] Checking Regression Assertions...');
  const errors = [];

  if (!resumeState.hasCapacity) errors.push('Missing KAPASITAS PLTS KPI on Resume tab');
  if (!resumeState.hasGeneration) errors.push('Missing GENERASI PLTS KPI on Resume tab');
  if (!resumeState.hasPr) errors.push('Missing PR indicator on Resume tab');
  if (!resumeState.hasChart) errors.push('Missing Generasi PLTS vs PLN chart on Resume tab');

  if (!liveTabEvaluation.hasGateway) errors.push('Missing Gateway panel on Live tab');
  if (!liveTabEvaluation.hasDayaRealtime) errors.push('Missing Daya Realtime card on Live tab');
  if (!liveTabEvaluation.hasProduksiHariIni) errors.push('Missing Produksi Hari Ini card on Live tab');
  if (!liveTabEvaluation.hasAnalyticsSection) errors.push('REGRESSION: PLTSAnalyticsSection is missing below gateway on Live tab!');
  if (!liveTabEvaluation.hasGorontalo) errors.push('Gorontalo missing from Live plant list');
  if (liveTabEvaluation.hasTableRows < 10) errors.push(`Too few table rows on Live tab (${liveTabEvaluation.hasTableRows})`);

  if (consoleErrors.length > 0) {
    console.warn(`Browser console had ${consoleErrors.length} errors:`, consoleErrors);
  }

  console.log('================================================================');
  if (errors.length === 0) {
    console.log('>>> ALL VISUAL & REGRESSION CHECKS PASSED SUCCESSFULLY! <<<');
  } else {
    console.error('>>> REGRESSION FAILURES DETECTED <<<');
    errors.forEach(e => console.error('  - ' + e));
  }
  console.log('================================================================');

  await browser.close();

  // Save JSON summary report
  const summaryReport = {
    timestamp: new Date().toISOString(),
    resumeState,
    liveTabEvaluation,
    consoleErrors,
    pageErrors,
    errors,
    screenshots: [
      '01_resume_target_rkap_top.png',
      '02_subtab_produksi_vs_target.png',
      '03_subtab_performance_ratio_pr.png',
      '04_subtab_parameter_cuaca.png',
      '05_subtab_beban_vs_plts.png',
      '06_monthly_matrix_table.png',
      '07_live_isolar_tab_top.png',
      '08_live_isolar_analytics_section.png',
      '09_live_isolar_detail_dc_table.png',
      '10_live_isolar_full_page.png',
    ],
  };

  fs.writeFileSync('docs/evidence/visual_verification_summary.json', JSON.stringify(summaryReport, null, 2));
  console.log('Summary report saved to docs/evidence/visual_verification_summary.json');
}

runVisualVerification().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
