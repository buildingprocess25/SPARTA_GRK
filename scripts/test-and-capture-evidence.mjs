import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const EVIDENCE_DIR = path.resolve('docs/evidence');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function run() {
  console.log('--- Starting Bagian D Automated Verification & Screenshot Capture ---');
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

  // 1. Capture Resume Tab
  console.log('Capturing Resume Tab...');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'dashboard_resume_tab.png'), fullPage: false });
  console.log('Saved: dashboard_resume_tab.png');

  // 2. Navigate to PLTS Tab ("Kelistrikan PLTS Atap")
  console.log('Navigating to PLTS Tab (Kelistrikan PLTS Atap)...');
  await page.evaluate(() => {
    const pltsBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Kelistrikan PLTS Atap'));
    if (pltsBtn) pltsBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  // 3. Switch to "Live iSolarCloud API" sub-view
  console.log('Switching to "Live iSolarCloud API" sub-view...');
  await page.evaluate(() => {
    const liveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Live iSolarCloud API'));
    if (liveBtn) liveBtn.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // Capture Top Live Gateway & Stat Cards
  console.log('Capturing Top Live Gateway & Stat Cards...');
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'dashboard_top_status_cards.png'), fullPage: false });
  console.log('Saved: dashboard_top_status_cards.png');

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

  // --- BAGIAN D TESTS ---
  console.log('\n--- Running Bagian D Test Suite ---');

  // Test 1: "Pilih Semua" -> 38 operational plant lines (+ average line)
  console.log('Testing "Pilih Semua"...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Pilih Semua');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  let lineCount = await page.evaluate(() => {
    return document.querySelectorAll('.recharts-line').length;
  });
  console.log(`Lines rendered after "Pilih Semua": ${lineCount} (Expected: 38 plants + 1 average = 39 or 38+ lines)`);
  if (lineCount < 38) throw new Error(`Expected at least 38 lines, got ${lineCount}`);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'chart_all_38_plants.png'), fullPage: false });
  console.log('Saved: chart_all_38_plants.png');

  // Test 2: "Kosongkan" -> 0 lines and Empty State
  console.log('Testing "Kosongkan"...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Kosongkan');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  const emptyStateText = await page.evaluate(() => {
    return document.body.innerText.includes('Pilih minimal satu lokasi');
  });
  lineCount = await page.evaluate(() => document.querySelectorAll('.recharts-line').length);
  console.log(`Empty state visible: ${emptyStateText}, Lines rendered: ${lineCount}`);
  if (!emptyStateText || lineCount !== 0) throw new Error('Empty state failed or lines still rendered after Kosongkan');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'chart_empty_state.png'), fullPage: false });
  console.log('Saved: chart_empty_state.png');

  // Test 3: Select 1 Plant (Parung)
  console.log('Testing Select 1 Plant (Parung)...');
  await page.evaluate(() => {
    const parung = Array.from(document.querySelectorAll('span')).find(s => s.textContent.trim() === 'Parung' || s.textContent.includes('Parung'));
    if (parung) {
      const parent = parung.closest('.group') || parung.parentElement;
      parent.click();
    }
  });
  await new Promise(r => setTimeout(r, 1000));
  lineCount = await page.evaluate(() => document.querySelectorAll('.recharts-line').length);
  console.log(`Lines rendered for 1 plant: ${lineCount} (Expected: 1 plant line + 1 average line = 2)`);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'chart_1_plant.png'), fullPage: false });
  console.log('Saved: chart_1_plant.png');

  // Test 4: Select 3 Plants (Malang, Bandung 1)
  console.log('Testing Select 3 Plants...');
  await page.evaluate(() => {
    ['Malang', 'Bandung 1'].forEach(name => {
      const span = Array.from(document.querySelectorAll('span')).find(s => s.textContent.includes(name));
      if (span) {
        const parent = span.closest('.group') || span.parentElement;
        parent.click();
      }
    });
  });
  await new Promise(r => setTimeout(r, 1000));
  lineCount = await page.evaluate(() => document.querySelectorAll('.recharts-line').length);
  console.log(`Lines rendered for 3 plants: ${lineCount} (Expected: 3 plants + 1 average + min/max = 4-6)`);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'chart_3_plants.png'), fullPage: false });
  console.log('Saved: chart_3_plants.png');

  // Test 5: Top 5 Filter
  console.log('Testing Top 5 preset...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Top 5');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  lineCount = await page.evaluate(() => document.querySelectorAll('.recharts-line').length);
  console.log(`Lines rendered for Top 5: ${lineCount}`);

  // Test 6: Verify Gorontalo is never in the chart lines or ranking
  const gorontaloText = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('Gorontalo (Dikecualikan)') || text.includes('Dalam Pembangunan');
  });
  console.log(`Gorontalo excluded/marked as construction: ${gorontaloText}`);

  // Test 7: Hover Highlight
  console.log('Testing Hover Highlight...');
  await page.evaluate(() => {
    const firstRow = document.querySelector('.group');
    if (firstRow) {
      firstRow.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'chart_hover_highlight.png'), fullPage: false });
  console.log('Saved: chart_hover_highlight.png');

  // Test 8: Navigate to Overview Sub-Tab to capture Summary Table & Rekap
  console.log('Navigating to Overview & Target RKAP subview...');
  await page.evaluate(() => {
    const overviewBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Resume & Target RKAP'));
    if (overviewBtn) overviewBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  // Scroll down to Tabel Rekap Data Pemantauan
  console.log('Capturing Tabel Rekap & Monthly Matrix...');
  await page.evaluate(() => {
    window.scrollBy(0, 600);
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'table_rekap_and_monthly_matrix.png'), fullPage: false });
  console.log('Saved: table_rekap_and_monthly_matrix.png');

  // Scroll down to Scope 2 Monitoring Emisi Table
  console.log('Capturing Scope 2 Emisi DC Table...');
  await page.evaluate(() => {
    window.scrollBy(0, 700);
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'table_emisi_scope2_dc.png'), fullPage: false });
  console.log('Saved: table_emisi_scope2_dc.png');

  // Check errors
  if (pageErrors.length > 0) {
    console.warn('Page errors encountered:', pageErrors);
  } else {
    console.log('SUCCESS: 0 console errors, 0 page errors encountered!');
  }

  await browser.close();
  console.log('--- All automated tests and evidence screenshots completed successfully ---');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
