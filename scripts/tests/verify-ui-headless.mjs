import fs from 'fs';
import puppeteer from 'puppeteer';

async function run() {
  if (!fs.existsSync('docs/evidence/ui-final')) {
    fs.mkdirSync('docs/evidence/ui-final', { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 2600 });

  page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[BROWSER PAGE ERROR]', err));

  console.log('Navigating to http://127.0.0.1:3000...');
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  // Find all tab buttons
  const buttons = await page.$$('button');
  console.log('Found buttons:', buttons.length);
  for (const b of buttons) {
    const text = await page.evaluate(el => el.innerText.trim(), b);
    if (text.includes('PLTS') || text.includes('Kelistrikan PLTS')) {
      console.log('Clicking PLTS tab button:', JSON.stringify(text));
      await b.click();
      break;
    }
  }

  // Wait 5s for data to fully render
  await new Promise(r => setTimeout(r, 5000));

  await page.screenshot({ path: 'docs/evidence/ui-final/plts_dashboard_tab.png', fullPage: true });
  console.log('Screenshot saved: docs/evidence/ui-final/plts_dashboard_tab.png');

  // Extract all rendered text in PLTS tab
  const pltsDom = await page.evaluate(() => {
    return {
      bodyText: document.body.innerText,
    };
  });

  console.log('\n=== PLTS TAB DOM TEXT (FIRST 4000 CHARS) ===');
  console.log(pltsDom.bodyText.slice(0, 4000));

  // Check forbidden mock numbers
  const forbiddenMocks = ['1.768.000', '1,768,000', '+15.8%', '88.1', '11.9', '1860'];
  const foundMocks = forbiddenMocks.filter(m => pltsDom.bodyText.includes(m));
  console.log('\n=== FORBIDDEN MOCK STRINGS AUDIT ===');
  console.log(foundMocks.length === 0 ? 'STATUS: CLEAN (0 mock strings found)' : 'FOUND: ' + foundMocks.join(', '));

  await browser.close();
}

run().catch(e => {
  console.error('Headless UI test failed:', e);
  process.exit(1);
});
