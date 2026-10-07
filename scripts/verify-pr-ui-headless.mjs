import fs from 'fs';
import puppeteer from 'puppeteer';

async function run() {
  if (!fs.existsSync('docs/evidence/ui-pr')) {
    fs.mkdirSync('docs/evidence/ui-pr', { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 2600 });

  page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[BROWSER PAGE ERROR]', err));

  console.log('1. Navigating to http://127.0.0.1:3000...');
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  // 2. Click PLTS Tab
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await page.evaluate(el => el.innerText.trim(), b);
    if (text.includes('PLTS') || text.includes('Kelistrikan PLTS')) {
      console.log('Clicking PLTS tab:', JSON.stringify(text));
      await b.click();
      break;
    }
  }

  await new Promise(r => setTimeout(r, 3000));

  // 3. Find and click "Performa Sistem (PR)" button
  const allButtons = await page.$$('button');
  for (const b of allButtons) {
    const text = await page.evaluate(el => el.innerText.trim(), b);
    if (text.includes('Performa Sistem (PR)') || text === 'Performa Sistem (PR)') {
      console.log('Clicking PR Sub-tab:', JSON.stringify(text));
      await b.click();
      break;
    }
  }

  // Wait 4s for PR data and charts to render
  await new Promise(r => setTimeout(r, 4000));

  await page.screenshot({ path: 'docs/evidence/ui-pr/pr_vs_temperature_chart.png', fullPage: true });
  console.log('Screenshot saved: docs/evidence/ui-pr/pr_vs_temperature_chart.png');

  // 4. Extract rendered DOM in PR tab
  const prDom = await page.evaluate(() => {
    const prSection = document.querySelector('[data-testid="tab-system-performance-pr"]');
    return {
      bodyText: document.body.innerText,
      prSectionText: prSection ? prSection.innerText : 'SECTION NOT FOUND',
    };
  });

  console.log('\n=== RENDERED DOM TEXT IN PR TAB ===');
  console.log(prDom.prSectionText);

  // 5. Test Parameter dropdown switch to "Iradiasi Solar (GHI)"
  const selects = await page.$$('select');
  for (const sel of selects) {
    const val = await page.evaluate(el => el.value, sel);
    if (val === 'temp_panel') {
      console.log('Switching parameter dropdown to "ghi"...');
      await sel.select('ghi');
      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: 'docs/evidence/ui-pr/pr_vs_ghi_chart.png', fullPage: true });
      console.log('Screenshot saved: docs/evidence/ui-pr/pr_vs_ghi_chart.png');
      break;
    }
  }

  await browser.close();
  console.log('\nHeadless PR UI verification completed successfully!');
}

run().catch(e => {
  console.error('PR UI Verification failed:', e);
  process.exit(1);
});
