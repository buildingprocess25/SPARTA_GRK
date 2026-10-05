import puppeteer from 'puppeteer';

async function debugUI() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3001', { waitUntil: 'networkidle2' });

  // List all buttons on initial page
  const initialButtons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim());
  });
  console.log('Initial buttons:', initialButtons);

  // Click on Pengurang Emisi
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Pengurang Emisi'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  const pltsButtons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
  });
  console.log('Buttons after opening Pengurang Emisi:', pltsButtons);

  const selects = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('select')).map(s => ({
      options: Array.from(s.options).map(o => ({ value: o.value, text: o.text }))
    }));
  });
  console.log('Selects found:', JSON.stringify(selects, null, 2));

  await browser.close();
}

debugUI();
