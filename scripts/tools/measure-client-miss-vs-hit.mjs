import puppeteer from 'puppeteer';
import { performance } from 'perf_hooks';

const PORT = process.env.PORT || '3005';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.REVALIDATE_SECRET_TOKEN || process.env.CRON_SECRET || 'plts_internal_secret_key_2026';

async function measureRun({ isCold = false } = {}) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  if (isCold) {
    await fetch(`${BASE_URL}/api/plts/revalidate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SECRET}` },
    });
  } else {
    // Warm up server cache
    await fetch(`${BASE_URL}/api/plts/dashboard/summary?period=2026-01_2026-09&mode=YTD&month=9&throughMonth=9&compare=2025,2026`);
  }

  // Load app shell
  await page.goto(`${BASE_URL}`, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 600));

  // Enable Fast 4G Throttling (40ms RTT, 4 Mbps down, 3 Mbps up)
  const client = await page.target().createCDPSession();
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 40,
    downloadThroughput: (4 * 1024 * 1024) / 8,
    uploadThroughput: (3 * 1024 * 1024) / 8,
  });

  const tStart = performance.now();

  // Click on "Kelistrikan PLTS Atap"
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const pltsBtn = buttons.find((b) => b.innerText.includes('Kelistrikan PLTS Atap') || b.innerText.includes('PLTS Atap') || b.innerText.includes('PLTS'));
    if (pltsBtn) pltsBtn.click();
  });

  // 1. Time to Skeleton
  await page.waitForSelector('.animate-pulse, [data-testid="skeleton"]', { timeout: 3000 }).catch(() => null);
  const tSkeleton = performance.now() - tStart;

  // 2. Time to Cards Filled with Real Data (Methodology: DOM text mutation matching canonical metrics)
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return text.includes('4.804.339') || 
           text.includes('4.804.338,8') || 
           text.includes('5.876,12') ||
           text.includes('3.730,30');
  }, { timeout: 15000 });
  const tCardsFilled = performance.now() - tStart;

  // 3. Time to Main Chart Rendered (Methodology: waitForSelector on recharts SVG surface with rendered path/rect elements)
  await page.waitForSelector('svg.recharts-surface path, svg.recharts-surface rect, .recharts-wrapper', { timeout: 15000 });
  const tChartRendered = performance.now() - tStart;

  await browser.close();

  return {
    tSkeleton,
    tCardsFilled,
    tChartRendered,
  };
}

async function runClientBenchmark() {
  console.log('================================================================================');
  console.log('   CLIENT PERFORMANCE: CARDS FILLED & CHART RENDERED (MISS VS HIT SEPARATE)    ');
  console.log('================================================================================\n');

  console.log('1. Measuring Server Cache MISS (Cold First Load under Fast 4G)...');
  const coldMetrics = await measureRun({ isCold: true });
  console.log(`   - Time to Skeleton Display: ${coldMetrics.tSkeleton.toFixed(1)} ms`);
  console.log(`   - Time to Cards Filled with Data: ${coldMetrics.tCardsFilled.toFixed(1)} ms`);
  console.log(`   - Time to Main Chart Rendered: ${coldMetrics.tChartRendered.toFixed(1)} ms`);

  console.log('\n2. Measuring Server Cache HIT (Warm Reload under Fast 4G)...');
  const warmMetrics = await measureRun({ isCold: false });
  console.log(`   - Time to Skeleton Display: ${warmMetrics.tSkeleton.toFixed(1)} ms`);
  console.log(`   - Time to Cards Filled with Data: ${warmMetrics.tCardsFilled.toFixed(1)} ms`);
  console.log(`   - Time to Main Chart Rendered: ${warmMetrics.tChartRendered.toFixed(1)} ms`);

  console.log('\n--- SUMMARY TABULATION ---');
  console.log('| Client Lifecycle Metric | Server Cache MISS (Cold) | Server Cache HIT (Warm) | Measurement Methodology |');
  console.log('| :--- | :---: | :---: | :--- |');
  console.log(`| **Skeleton Display** | ${coldMetrics.tSkeleton.toFixed(1)} ms | ${warmMetrics.tSkeleton.toFixed(1)} ms | Selector match \`.animate-pulse\` |`);
  console.log(`| **Cards Terisi Data** | **${coldMetrics.tCardsFilled.toFixed(1)} ms** | **${warmMetrics.tCardsFilled.toFixed(1)} ms** | DOM Text Mutation assertion matching canonical KPI values (\`4.804.339\` kWh / \`5.876,12\` kWp) |`);
  console.log(`| **Chart Utama Selesai** | **${coldMetrics.tChartRendered.toFixed(1)} ms** | **${warmMetrics.tChartRendered.toFixed(1)} ms** | Recharts SVG Surface \`svg.recharts-surface path, rect\` paint completion |`);
}

runClientBenchmark().catch(err => {
  console.error(err);
  process.exit(1);
});
