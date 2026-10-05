import puppeteer from 'puppeteer';

async function measureViewports() {
  console.log('=== MEASURING VIEWPORT & PLTS TABLE CONTAINER HEIGHTS ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const urlsToTry = ['http://127.0.0.1:3000', 'http://127.0.0.1:3001'];
  let activeUrl = urlsToTry[0];

  try {
    const page = await browser.newPage();

    // Verify which port is alive
    for (const url of urlsToTry) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 5000 });
        activeUrl = url;
        break;
      } catch (_) {}
    }
    console.log(`Connected to active frontend at: ${activeUrl}`);

    // Helper to navigate to PLTS tab
    const navigateToPlts = async () => {
      await page.evaluate(() => {
        // Try finding sub-item or main item
        const buttons = Array.from(document.querySelectorAll('button'));
        const pltsSubBtn = buttons.find(b => b.textContent?.includes('Kelistrikan PLTS Atap') || b.textContent?.includes('PLTS Atap'));
        if (pltsSubBtn) {
          pltsSubBtn.click();
          return;
        }
        const pengurangBtn = buttons.find(b => b.textContent?.includes('Pengurang Emisi'));
        if (pengurangBtn) {
          pengurangBtn.click();
        }
      });
      await page.waitForSelector('[data-plts-table-container="true"]', { timeout: 15000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1500));
    };

    // 1. Desktop 1440x900
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(activeUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await navigateToPlts();

    const desktopMetrics = await page.evaluate(() => {
      const container = document.querySelector('[data-plts-table-container="true"]');
      if (!container) return { error: 'Element [data-plts-table-container="true"] not found' };

      const computed = window.getComputedStyle(container);
      const rect = container.getBoundingClientRect();
      const thead = container.querySelector('thead');
      const tfoot = container.querySelector('tfoot');
      const firstCol = container.querySelector('tbody td:first-child');

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentHeight: document.documentElement.scrollHeight,
        containerFound: true,
        selector: '[data-plts-table-container="true"]',
        boundingRectHeight: Math.round(rect.height),
        clientHeight: container.clientHeight,
        scrollHeight: container.scrollHeight,
        computedMaxHeight: computed.maxHeight,
        computedHeight: computed.height,
        computedOverflowY: computed.overflowY,
        computedOverflowX: computed.overflowX,
        theadPosition: thead ? window.getComputedStyle(thead).position : null,
        theadTop: thead ? window.getComputedStyle(thead).top : null,
        tfootPosition: tfoot ? window.getComputedStyle(tfoot).position : null,
        tfootBottom: tfoot ? window.getComputedStyle(tfoot).bottom : null,
        firstColPosition: firstCol ? window.getComputedStyle(firstCol).position : null,
        firstColLeft: firstCol ? window.getComputedStyle(firstCol).left : null,
      };
    });

    console.log('--- Desktop Viewport (1440 x 900) ---');
    console.log(`Target Element: ${desktopMetrics.selector}`);
    console.log(`Computed maxHeight: ${desktopMetrics.computedMaxHeight}`);
    console.log(`Rendered clientHeight: ${desktopMetrics.clientHeight}px (Max allowed: 460px)`);
    console.log(`Table scrollHeight: ${desktopMetrics.scrollHeight}px (Scrollable: ${desktopMetrics.scrollHeight > desktopMetrics.clientHeight})`);
    console.log(`Overflow-Y: ${desktopMetrics.computedOverflowY}, Overflow-X: ${desktopMetrics.computedOverflowX}`);
    console.log(`Sticky thead position: ${desktopMetrics.theadPosition} (top: ${desktopMetrics.theadTop})`);
    console.log(`Sticky tfoot position: ${desktopMetrics.tfootPosition} (bottom: ${desktopMetrics.tfootBottom})`);
    console.log(`Sticky first column position: ${desktopMetrics.firstColPosition} (left: ${desktopMetrics.firstColLeft})`);

    // 2. Mobile 375x812
    await page.setViewport({ width: 375, height: 812 });
    await page.goto(activeUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // Open mobile sidebar
    await page.evaluate(() => {
      const menuBtn = document.querySelector('button[aria-label*="menu" i], button[aria-label*="sidebar" i]') || 
                      Array.from(document.querySelectorAll('button')).find(b => b.querySelector('svg'));
      if (menuBtn) menuBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));
    await navigateToPlts();

    const mobileMetrics = await page.evaluate(() => {
      const container = document.querySelector('[data-plts-table-container="true"]');
      if (!container) return { error: 'Element [data-plts-table-container="true"] not found' };

      const computed = window.getComputedStyle(container);
      const rect = container.getBoundingClientRect();
      const thead = container.querySelector('thead');
      const tfoot = container.querySelector('tfoot');
      const firstCol = container.querySelector('tbody td:first-child');

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentHeight: document.documentElement.scrollHeight,
        containerFound: true,
        selector: '[data-plts-table-container="true"]',
        boundingRectHeight: Math.round(rect.height),
        clientHeight: container.clientHeight,
        scrollHeight: container.scrollHeight,
        computedMaxHeight: computed.maxHeight,
        computedHeight: computed.height,
        computedOverflowY: computed.overflowY,
        computedOverflowX: computed.overflowX,
        theadPosition: thead ? window.getComputedStyle(thead).position : null,
        theadTop: thead ? window.getComputedStyle(thead).top : null,
        tfootPosition: tfoot ? window.getComputedStyle(tfoot).position : null,
        tfootBottom: tfoot ? window.getComputedStyle(tfoot).bottom : null,
        firstColPosition: firstCol ? window.getComputedStyle(firstCol).position : null,
        firstColLeft: firstCol ? window.getComputedStyle(firstCol).left : null,
      };
    });

    console.log('\n--- Mobile Viewport (375 x 812) ---');
    console.log(`Target Element: ${mobileMetrics.selector}`);
    console.log(`Computed maxHeight: ${mobileMetrics.computedMaxHeight}`);
    console.log(`Rendered clientHeight: ${mobileMetrics.clientHeight}px (Max allowed: 460px)`);
    console.log(`Table scrollHeight: ${mobileMetrics.scrollHeight}px (Scrollable: ${mobileMetrics.scrollHeight > mobileMetrics.clientHeight})`);
    console.log(`Overflow-Y: ${mobileMetrics.computedOverflowY}, Overflow-X: ${mobileMetrics.computedOverflowX}`);
    console.log(`Sticky thead position: ${mobileMetrics.theadPosition} (top: ${mobileMetrics.theadTop})`);
    console.log(`Sticky tfoot position: ${mobileMetrics.tfootPosition} (bottom: ${mobileMetrics.tfootBottom})`);
    console.log(`Sticky first column position: ${mobileMetrics.firstColPosition} (left: ${mobileMetrics.firstColLeft})`);

  } finally {
    await browser.close();
  }
}

measureViewports().catch(err => {
  console.error('Measurement error:', err);
  process.exit(1);
});
