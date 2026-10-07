#!/usr/bin/env node
/**
 * UI Final Verification Script
 * Takes screenshots and extracts DOM text for all major dashboard sections.
 * Verifies no mock values (1.768.000, +15.8%, 88.1, 11.9, 1860) remain.
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';
const OUT_DIR = path.resolve('docs/evidence/ui-final');
fs.mkdirSync(OUT_DIR, { recursive: true });

const FORBIDDEN_PATTERNS = [
  '1.768.000', '1,768,000', '1768000', '1760000',
  '+15.8%', '+15,8%',
  /\b88\.1\b/, /\b88,1\b/,   // energy mix mock 88.1%
  /\b11\.9\b/, /\b11,9\b/,   // energy mix mock 11.9%
  /\b1860\b/,                 // installedCapacity mock
];

function checkForbidden(text, section) {
  const found = [];
  for (const pat of FORBIDDEN_PATTERNS) {
    if (pat instanceof RegExp) {
      if (pat.test(text)) found.push(pat.toString());
    } else {
      if (text.includes(pat)) found.push(pat);
    }
  }
  return found;
}

async function waitForContent(page, timeout = 15000) {
  // Wait for skeleton loaders to disappear
  try {
    await page.waitForFunction(() => {
      const skeletons = document.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]');
      return skeletons.length === 0;
    }, { timeout });
  } catch { /* ok, continue */ }
  await new Promise(r => setTimeout(r, 2000));
}

async function scrollToAndScreenshot(page, selector, name, description) {
  try {
    const el = await page.waitForSelector(selector, { timeout: 10000 });
    if (!el) throw new Error(`Selector not found: ${selector}`);
    await el.scrollIntoView();
    await new Promise(r => setTimeout(r, 1500));
    const box = await el.boundingBox();
    if (!box) throw new Error(`No bounding box for: ${selector}`);
    // Screenshot with some padding
    const clip = {
      x: Math.max(0, box.x - 20),
      y: Math.max(0, box.y - 20),
      width: Math.min(box.width + 40, 1920),
      height: Math.min(box.height + 40, 2000),
    };
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), clip });
    const text = await el.evaluate(el => el.innerText);
    console.log(`✓ ${name}: ${description} (${text.length} chars)`);
    return text;
  } catch (err) {
    console.log(`✗ ${name}: ${err.message}`);
    return null;
  }
}

(async () => {
  console.log('=== UI Final Verification ===\n');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();

  // Navigate and wait for data
  console.log('Navigating to dashboard...');
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await waitForContent(page);

  // Click PLTS tab if not already active
  try {
    const pltsTab = await page.$('button::-p-text(PLTS)');
    if (pltsTab) {
      await pltsTab.click();
      await waitForContent(page);
    }
  } catch { /* may already be on PLTS */ }

  // Full page screenshot
  await page.screenshot({ path: path.join(OUT_DIR, '00_full_page.png'), fullPage: true });
  console.log('✓ Full page screenshot saved\n');

  // Extract all page text for mock value check
  const fullText = await page.evaluate(() => document.body.innerText);
  const allForbidden = checkForbidden(fullText, 'FULL PAGE');

  // ===== SECTION SCREENSHOTS =====
  const results = {};

  // 1. KPI Cards
  console.log('\n--- KPI Cards ---');
  const kpiText = await scrollToAndScreenshot(page,
    'div.grid.grid-cols-1.sm\\:grid-cols-2.xl\\:grid-cols-4',
    '01_kpi_cards', 'KPI Cards (Kapasitas, Produksi, Penghematan, Emisi)');
  results.kpi = kpiText;

  // 2. Energy Mix / Komposisi Energi
  console.log('\n--- Energy Mix ---');
  let energyMixText = null;
  try {
    const mixEl = await page.evaluateHandle(() => {
      const els = [...document.querySelectorAll('h3, h4, span')];
      const header = els.find(e => e.textContent.includes('Komposisi') || e.textContent.includes('Bauran'));
      return header ? header.closest('div[class*="CardBox"], div[class*="card"], div[class*="rounded"]') || header.parentElement.parentElement : null;
    });
    if (mixEl) {
      energyMixText = await mixEl.evaluate(el => el.innerText);
      await mixEl.evaluate(el => el.scrollIntoView());
      await new Promise(r => setTimeout(r, 1000));
      const box = await mixEl.boundingBox();
      if (box) {
        await page.screenshot({ path: path.join(OUT_DIR, '02_energy_mix.png'), clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 20), width: Math.min(box.width + 40, 1920), height: Math.min(box.height + 40, 1200) } });
        console.log(`✓ 02_energy_mix: Komposisi Energi (${energyMixText?.length} chars)`);
      }
    }
  } catch (e) { console.log(`✗ energy_mix: ${e.message}`); }
  results.energyMix = energyMixText;

  // 3. Ringkasan PLTS (PLTSSummaryCard)
  console.log('\n--- Ringkasan PLTS ---');
  let ringkasanText = null;
  try {
    const ringkEl = await page.evaluateHandle(() => {
      const h = [...document.querySelectorAll('h3, h4')].find(e => e.textContent.includes('Ringkasan PLTS'));
      return h ? h.closest('[class*="CardBox"], [class*="card"], [class*="rounded-2xl"]') || h.parentElement.parentElement.parentElement : null;
    });
    if (ringkEl) {
      ringkasanText = await ringkEl.evaluate(el => el.innerText);
      await ringkEl.evaluate(el => el.scrollIntoView({ block: 'start' }));
      await new Promise(r => setTimeout(r, 1000));
      const box = await ringkEl.boundingBox();
      if (box) {
        await page.screenshot({ path: path.join(OUT_DIR, '03_ringkasan_plts.png'), clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 20), width: Math.min(box.width + 40, 1920), height: Math.min(box.height + 40, 1500) } });
        console.log(`✓ 03_ringkasan_plts (${ringkasanText?.length} chars)`);
      }
    }
  } catch (e) { console.log(`✗ ringkasan: ${e.message}`); }
  results.ringkasan = ringkasanText;

  // 4. Grafik 2025 vs 2026 (production comparison chart)
  console.log('\n--- Grafik Produksi ---');
  let chartProdText = null;
  try {
    const chartEl = await page.evaluateHandle(() => {
      const el = [...document.querySelectorAll('h3, h4, span')].find(e =>
        e.textContent.includes('Produksi') && (e.textContent.includes('Konsumsi') || e.textContent.includes('vs')));
      return el ? el.closest('[class*="CardBox"], [class*="card"], [class*="rounded"]') || el.parentElement.parentElement : null;
    });
    if (chartEl) {
      chartProdText = await chartEl.evaluate(el => el.innerText);
      await chartEl.evaluate(el => el.scrollIntoView());
      await new Promise(r => setTimeout(r, 1000));
      const box = await chartEl.boundingBox();
      if (box) {
        await page.screenshot({ path: path.join(OUT_DIR, '04_chart_production.png'), clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 20), width: Math.min(box.width + 40, 1920), height: Math.min(box.height + 40, 1500) } });
        console.log(`✓ 04_chart_production (${chartProdText?.length} chars)`);
      }
    }
  } catch (e) { console.log(`✗ chart_production: ${e.message}`); }
  results.chartProd = chartProdText;

  // 5. Rekapitulasi Bulanan (Monthly Matrix)
  console.log('\n--- Rekapitulasi Bulanan ---');
  let rekapText = null;
  try {
    const rekapEl = await page.evaluateHandle(() => {
      const el = [...document.querySelectorAll('h3, h4, span')].find(e =>
        e.textContent.includes('Rekapitulasi') || e.textContent.includes('Matriks'));
      return el ? el.closest('[class*="CardBox"], [class*="card"], [class*="rounded-2xl"]') || el.parentElement.parentElement.parentElement : null;
    });
    if (rekapEl) {
      rekapText = await rekapEl.evaluate(el => el.innerText);
      await rekapEl.evaluate(el => el.scrollIntoView());
      await new Promise(r => setTimeout(r, 1000));
      const box = await rekapEl.boundingBox();
      if (box) {
        await page.screenshot({ path: path.join(OUT_DIR, '05_rekapitulasi.png'), clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 20), width: Math.min(box.width + 40, 1920), height: Math.min(box.height + 40, 2000) } });
        console.log(`✓ 05_rekapitulasi (${rekapText?.length} chars)`);
      }
    }
  } catch (e) { console.log(`✗ rekapitulasi: ${e.message}`); }
  results.rekap = rekapText;

  // 6. Multi-DC Section (Kalkulasi Emisi Aktual per Distribution Center)
  console.log('\n--- Multi-DC ---');
  let multiDcText = null;
  try {
    const multiEl = await page.evaluateHandle(() => {
      const h3s = [...document.querySelectorAll('h3')];
      const h = h3s.find(e => e.textContent.includes('Kalkulasi Emisi Aktual per Distribution Center') || e.textContent.includes('Multi-DC'));
      return h ? h.closest('[class*="CardBox"], [class*="card"], [class*="rounded"]') || h.parentElement.parentElement : null;
    });
    if (multiEl) {
      multiDcText = await multiEl.evaluate(el => el.innerText);
      await multiEl.evaluate(el => el.scrollIntoView({ block: 'center' }));
      await new Promise(r => setTimeout(r, 1000));
      const box = await multiEl.boundingBox();
      if (box) {
        await page.screenshot({ path: path.join(OUT_DIR, '06_multi_dc.png'), clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: Math.min(box.width + 20, 1900), height: Math.min(box.height + 20, 1200) } });
        console.log(`✓ 06_multi_dc (${multiDcText?.length} chars)`);
      }
    }
  } catch (e) { console.log(`✗ multi_dc: ${e.message}`); }
  results.multiDc = multiDcText;

  // 7. Analisis Kinerja PLTS - Tab "Performa Sistem (PR)"
  console.log('\n--- PR Tab ---');
  let prTabText = null;
  try {
    // Click PR tab button inside Analisis Kinerja PLTS
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const prBtn = btns.find(b => b.textContent.includes('Performa Sistem (PR)'));
      if (prBtn) {
        prBtn.scrollIntoView({ block: 'center' });
        prBtn.click();
      }
    });
    console.log('  Clicked "Performa Sistem (PR)" button');
    
    // Wait for the PR container or skeleton to resolve
    await new Promise(r => setTimeout(r, 4000));
    await page.waitForSelector('[data-testid="tab-system-performance-pr"]', { timeout: 15000 });
    
    const prContent = await page.$('[data-testid="tab-system-performance-pr"]');
    if (prContent) {
      prTabText = await prContent.evaluate(el => el.innerText);
      await prContent.evaluate(el => el.scrollIntoView({ block: 'start' }));
      await new Promise(r => setTimeout(r, 1500));
      const box = await prContent.boundingBox();
      if (box) {
        await page.screenshot({ path: path.join(OUT_DIR, '07_pr_tab.png'), clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: Math.min(box.width + 20, 1900), height: Math.min(box.height + 20, 1500) } });
        console.log(`✓ 07_pr_tab (${prTabText?.length} chars)`);
      }
    }
  } catch (e) { console.log(`✗ pr_tab: ${e.message}`); }
  results.prTab = prTabText;

  // 7b. PR tab chart specifically
  try {
    const chartBox = await page.$('.recharts-wrapper');
    if (chartBox) {
      await chartBox.evaluate(el => el.scrollIntoView());
      await new Promise(r => setTimeout(r, 1000));
      const box = await chartBox.boundingBox();
      if (box) {
        await page.screenshot({ path: path.join(OUT_DIR, '07b_pr_chart.png'), clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 20), width: Math.min(box.width + 40, 1920), height: Math.min(box.height + 40, 800) } });
        console.log('✓ 07b_pr_chart');
      }
    }
  } catch { /* ok */ }

  // === SUMMARY ===
  console.log('\n\n=== FORBIDDEN PATTERN CHECK ===');
  if (allForbidden.length === 0) {
    console.log('✓ No mock/hardcoded values found in DOM!');
  } else {
    console.log(`✗ FOUND ${allForbidden.length} forbidden patterns:`, allForbidden);
  }

  console.log('\n=== EXTRACTED VALUES ===');
  // Parse and display key values from KPI text
  if (results.kpi) {
    console.log('\nKPI Cards text:');
    console.log(results.kpi.substring(0, 1500));
  }
  if (results.energyMix) {
    console.log('\nEnergy Mix text:');
    console.log(results.energyMix.substring(0, 500));
  }
  if (results.ringkasan) {
    console.log('\nRingkasan text:');
    console.log(results.ringkasan.substring(0, 1000));
  }
  if (results.prTab) {
    console.log('\nPR Tab text:');
    console.log(results.prTab.substring(0, 2000));
  }

  // Save full extraction report
  const report = {
    timestamp: new Date().toISOString(),
    forbiddenPatternsFound: allForbidden,
    sections: Object.fromEntries(
      Object.entries(results).map(([k, v]) => [k, v ? v.substring(0, 3000) : 'NOT FOUND'])
    ),
    fullPageTextLength: fullText.length,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'verification_report.json'), JSON.stringify(report, null, 2));
  console.log('\n✓ Report saved to docs/evidence/ui-final/verification_report.json');

  await browser.close();
  console.log('\n=== DONE ===');
})();
