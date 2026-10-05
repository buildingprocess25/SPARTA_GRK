import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({headless: 'new'});
  const page = await browser.newPage();
  
  await page.setViewport({width: 1440, height: 900});
  await page.goto('http://localhost:3001', {waitUntil: 'networkidle0'});
  
  // click PLTS tab
  const pltsTabs = await page.$$('button');
  for (const btn of pltsTabs) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Pengurang Emisi')) {
      await btn.click();
      break;
    }
  }
  
  await page.waitForSelector('table', {timeout: 5000});
  await new Promise(r => setTimeout(r, 1000));
  
  const metrics = await page.evaluate(() => {
    const container = document.querySelector('table')?.parentElement;
    if (!container) return {error: 'Container not found'};
    
    const theadTh = container.querySelector('thead th');
    const tfootTd = container.querySelector('tfoot td');
    const firstTd = container.querySelector('tbody tr td:first-child');
    
    return {
      viewportHeight: window.innerHeight,
      documentHeight: document.body.scrollHeight,
      containerOffsetHeight: container.offsetHeight,
      containerScrollHeight: container.scrollHeight,
      isScrollable: container.scrollHeight > container.clientHeight,
      theadSticky: theadTh ? window.getComputedStyle(theadTh).position : 'N/A',
      tfootSticky: tfootTd ? window.getComputedStyle(tfootTd).position : 'N/A',
      firstColSticky: firstTd ? window.getComputedStyle(firstTd).position : 'N/A',
    };
  });
  
  console.log('--- Desktop (1440x900) ---');
  console.log(metrics);
  
  await page.setViewport({width: 375, height: 667});
  await new Promise(r => setTimeout(r, 1000));
  const mobileMetrics = await page.evaluate(() => {
    const container = document.querySelector('table')?.parentElement;
    return {
      viewportHeight: window.innerHeight,
      documentHeight: document.body.scrollHeight,
      containerOffsetHeight: container.offsetHeight,
      containerScrollHeight: container.scrollHeight,
      isScrollable: container.scrollHeight > container.clientHeight
    };
  });
  
  console.log('\n--- Mobile (375x667) ---');
  console.log(mobileMetrics);
  
  await browser.close();
})();
