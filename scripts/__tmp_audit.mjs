import fs from 'node:fs';
import puppeteer from 'puppeteer';
process.env.AUTH_SESSION_SECRET = fs.readFileSync('.env.local', 'utf8').match(/^AUTH_SESSION_SECRET=(.*)$/m)[1].trim().replace(/^["']|["']$/g, '');
const { createSessionToken } = await import('../src/lib/auth.js');
const out = process.argv[2];
const theme = process.argv[3] || 'dark';
const pages = (process.argv[4] || 'Ringkasan Emisi,Scope 1,Scope 2,Scope 3,PLTS,Daur Ulang Air,Riwayat Audit').split(',');
const browser = await puppeteer.launch({ headless: 'new', ignoreDefaultArgs: ['--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const issues = [];
page.on('pageerror', e => issues.push(`pageerror: ${e.message.slice(0, 160)}`));
page.on('console', m => { if (m.type() === 'error') issues.push(`console: ${m.text().slice(0, 160)}`); });
await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('sparta-theme', t); } catch {} }, theme);
await page.setCookie({ name: 'sparta_session', value: createSessionToken('admin'), domain: 'localhost', path: '/' });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 120000 });
for (const label of pages) {
  await page.evaluate((t) => [...document.querySelectorAll('aside a, aside button, nav a, nav button')].find(e => e.textContent.trim().startsWith(t))?.click(), label);
  await new Promise(r => setTimeout(r, 9000));
  const scan = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const overflowX = document.documentElement.scrollWidth > vw + 1;
    const wide = [...document.querySelectorAll('main *')].filter(e => { const r = e.getBoundingClientRect(); return r.right > vw + 2 && r.width > 0 && getComputedStyle(e).position !== 'fixed'; }).slice(0, 3).map(e => `${e.tagName}.${String(e.className).slice(0, 50)}`);
    const clipped = [...document.querySelectorAll('main h1, main h2, main h3, main p, main span, main td, main th, main button')].filter(e => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow === 'hidden' && getComputedStyle(e).textOverflow !== 'ellipsis').slice(0, 5).map(e => e.textContent.trim().slice(0, 40));
    const emptyCharts = [...document.querySelectorAll('.recharts-wrapper')].filter(w => !w.querySelector('svg.recharts-surface')).length;
    const nan = [...document.querySelectorAll('main *')].filter(e => e.children.length === 0 && /\b(NaN|undefined|Infinity|null)\b/.test(e.textContent)).slice(0, 5).map(e => e.textContent.trim().slice(0, 50));
    return { overflowX, wide, clipped, emptyCharts, nan, height: document.documentElement.scrollHeight };
  });
  issues.push(`${label}: ${JSON.stringify(scan)}`);
  const file = `${out}/${theme}-${label.replace(/\s+/g, '_')}.png`;
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0, i = 0; y < h && i < 8; y += 860, i++) { await page.evaluate(v => window.scrollTo(0, v), y); await new Promise(r => setTimeout(r, 700)); await page.screenshot({ path: file.replace('.png', '-' + i + '.png') }); }
}
console.log(issues.join('\n'));
await browser.close();
