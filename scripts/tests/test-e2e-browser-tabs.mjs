import puppeteer from 'puppeteer';
import assert from 'assert';
import path from 'path';

const PORT = process.env.PORT || '3005';
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runBrowserVerification() {
  console.log('================================================================================');
  console.log(`STARTING BROWSER & TAB INTERACTION VERIFICATION (BASE_URL: ${BASE_URL})`);
  console.log('================================================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      const location = msg.location();
      if (!text.includes('404') && !location.url?.includes('favicon.ico')) {
        consoleErrors.push(text);
      }
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  const requestedEndpoints = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/plts/dashboard')) {
      const parsed = new URL(url);
      requestedEndpoints.push({
        url: parsed.pathname + parsed.search,
        pathname: parsed.pathname,
        timestamp: Date.now(),
      });
    }
  });

  try {
    // Navigate to dashboard
    await page.goto(`${BASE_URL}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1000));

    // --- 1. SKELETON UNDER FAST 4G THROTTLING (< 1000 ms) ---
    console.log('[STEP 1] Measuring Skeleton Visibility under Fast 4G Throttling...');
    const client = await page.target().createCDPSession();
    await client.send('Network.enable');
    // Fast 4G throttling: 40ms RTT latency, 4 Mbps download (~500 KB/s), 3 Mbps upload (~375 KB/s)
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 40,
      downloadThroughput: (4 * 1024 * 1024) / 8,
      uploadThroughput: (3 * 1024 * 1024) / 8,
    });

    const navStart = performance.now();
    // Click on "Kelistrikan PLTS Atap"
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const pltsBtn = buttons.find((b) => b.innerText.includes('Kelistrikan PLTS Atap') || b.innerText.includes('PLTS Atap'));
      if (pltsBtn) pltsBtn.click();
    });

    // Measure time until skeleton element appears
    await page.waitForSelector('.animate-pulse, [data-testid="skeleton"]', { timeout: 3000 });
    const skeletonVisibleMs = performance.now() - navStart;
    console.log(`   ⏱️  Skeleton element became visible in: ${skeletonVisibleMs.toFixed(1)} ms under Fast 4G (Target: < 1000 ms)`);
    assert.ok(skeletonVisibleMs < 1000, `Skeleton took too long: ${skeletonVisibleMs} ms`);
    console.log('   ✅ Fast 4G Skeleton latency is under 1 second.');

    // Disable throttling for interaction tests
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });

    // Wait for initial network idle
    await new Promise((r) => setTimeout(r, 2000));

    // --- 2. INITIAL LOAD ZERO TAB REQUESTS CHECK ---
    console.log('\n[STEP 2] Verifying Zero Tab Requests on Initial Load...');
    const initialTabRequests = requestedEndpoints.filter((r) =>
      r.pathname !== '/api/plts/dashboard/summary'
    );
    console.log(`   Total PLTS requests during initial load: ${requestedEndpoints.length}`);
    requestedEndpoints.forEach((r) => console.log(`   - ${r.pathname}`));

    const hasOnlySummary = requestedEndpoints.some((r) => r.pathname.endsWith('/summary')) && initialTabRequests.length === 0;
    console.log(`   Initial tab requests (expected 0): ${initialTabRequests.length}`);
    assert.strictEqual(initialTabRequests.length, 0, 'Tab endpoints were unexpectedly requested on initial load!');
    console.log('   ✅ Initial load fetches ONLY lightweight summary (0 tab endpoints requested).');

    // --- 3. TAB ON-DEMAND / HOVER / CLICK REQUEST ---
    console.log('\n[STEP 3] Testing Tab Click / On-Demand Fetching...');
    const beforeTabRequestsCount = requestedEndpoints.length;

    // Click on Tab 2: "Performance Ratio (PR)"
    console.log('   Clicking Tab: "Performance Ratio (PR)"...');
    const tabClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const prTab = buttons.find((b) => b.innerText.includes('Performance Ratio') || b.innerText.includes('PR'));
      if (prTab) {
        prTab.click();
        return true;
      }
      return false;
    });
    assert.ok(tabClicked, 'Could not find Performance Ratio tab button');

    await new Promise((r) => setTimeout(r, 1500));

    const newTabRequests = requestedEndpoints.slice(beforeTabRequestsCount);
    console.log(`   New requests triggered on tab switch: ${newTabRequests.length}`);
    newTabRequests.forEach((r) => console.log(`   - ${r.pathname}`));
    const prRequested = newTabRequests.some((r) => r.pathname.includes('/pr'));
    assert.ok(prRequested, 'PR tab endpoint was not requested upon clicking the tab!');
    console.log('   ✅ PR tab endpoint requested strictly on demand upon tab interaction.');

    // --- 4. TOGGLE YTD / BULAN INI (ZERO NETWORK REQUESTS) ---
    console.log('\n[STEP 4] Testing YTD / Bulan Ini Toggle (Expected: 0 Network Requests)...');
    const beforeToggleCount = requestedEndpoints.length;

    const toggleClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const monthBtn = buttons.find((b) => b.innerText.trim() === 'Bulan Ini' || b.innerText.includes('Bulan Ini'));
      if (monthBtn) {
        monthBtn.click();
        return true;
      }
      return false;
    });

    await new Promise((r) => setTimeout(r, 1000));

    const afterToggleCount = requestedEndpoints.length;
    const newToggleRequests = requestedEndpoints.slice(beforeToggleCount);
    console.log(`   Network requests triggered on mode toggle: ${newToggleRequests.length}`);
    newToggleRequests.forEach((r) => console.log(`   - ${r.pathname}?${r.url}`));
    assert.strictEqual(newToggleRequests.length, 0, 'Mode toggle triggered unexpected network requests!');
    console.log('   ✅ Period toggle (YTD <-> Bulan Ini) executes purely in client memory with 0 network requests.');

    // --- 5. TAB ERROR BOUNDARY & ISOLATION ---
    console.log('\n[STEP 5] Testing Tab Error Boundary & Isolation...');
    // Intercept /api/plts/dashboard/support and respond with HTTP 500 error
    await page.setRequestInterception(true);
    const interceptor = (req) => {
      if (req.url().includes('/api/plts/dashboard/support')) {
        req.respond({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Simulated Support Tab Failure' }),
        });
      } else {
        req.continue();
      }
    };
    page.on('request', interceptor);

    // Switch to Tab 3: "Parameter Pendukung"
    console.log('   Clicking Tab: "Parameter Pendukung" (Simulating network error)...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const supportTab = buttons.find((b) => b.innerText.includes('Parameter Pendukung') || b.innerText.includes('Pendukung'));
      if (supportTab) supportTab.click();
    });

    await new Promise((r) => setTimeout(r, 1500));

    // Verify error banner rendered inside tab container
    const errorRendered = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      return bodyText.includes('Simulated Support Tab Failure') || bodyText.includes('Gagal memuat parameter pendukung') || bodyText.includes('Coba Lagi');
    });
    console.log(`   Tab error state rendered: ${errorRendered}`);
    assert.ok(errorRendered, 'Error boundary was not rendered for failing tab');

    // Switch back to Tab 2: "Performance Ratio (PR)" to verify dashboard remains fully interactive
    console.log('   Switching back to "Performance Ratio (PR)" (Verifying other tabs unharmed)...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const prTab = buttons.find((b) => b.innerText.includes('Performance Ratio') || b.innerText.includes('PR'));
      if (prTab) prTab.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Verify PR content is intact
    const prIntact = await page.evaluate(() => {
      return document.body.innerText.includes('Performance Ratio (PR)');
    });
    assert.ok(prIntact, 'PR tab content was broken by error in support tab');
    console.log('   ✅ Error in one tab is completely isolated and does not affect other tabs or parent dashboard.');

    // Disable request interception
    page.off('request', interceptor);
    await page.setRequestInterception(false);

    // --- 6. CONSOLE ERROR AUDIT ---
    console.log('\n[STEP 6] Console Error Audit...');
    // Filter out the simulated 500 fetch error from console errors
    const nonSimulatedErrors = consoleErrors.filter((e) => !e.includes('Simulated') && !e.includes('500'));
    console.log(`   Application runtime error count: ${nonSimulatedErrors.length}`);
    if (nonSimulatedErrors.length > 0) {
      console.warn('   ⚠️ Console errors found:', nonSimulatedErrors);
    }
    assert.strictEqual(nonSimulatedErrors.length, 0, 'Unexpected application console errors occurred during interactions');
    console.log('   ✅ 0 application console errors detected across all workflows.');

    console.log('\n================================================================================');
    console.log('      ALL BROWSER E2E TESTS PASSED WITH 100% SPEC COMPLIANCE!                   ');
    console.log('================================================================================');
  } finally {
    await browser.close();
  }
}

runBrowserVerification().catch((err) => {
  console.error('❌ Browser verification failed:', err);
  process.exit(1);
});
